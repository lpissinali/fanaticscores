/**
 * Fleet-wide daily upstream-call budget for api-football.
 *
 * Why this exists:
 * The api-football key is shared between FanaticScores and PitaCopa, with a
 * 7,500-requests/day quota. Googlebot legitimately crawls the unbounded
 * /en/match ↔ /en/team link graph from ~30 IPs, each comfortably under the
 * per-IP behavioral rate limit — so per-IP limiting alone cannot bound the
 * total daily spend. This module gives the fleet one hard ceiling: every real
 * upstream fetch increments a Firestore counter (one doc per UTC day, same
 * reset boundary as api-football's quota), and once the day's count crosses
 * DAILY_LIMIT the api-football-backed detail pages/routes stop calling
 * upstream and render 404 instead.
 *
 * What stays alive when the budget trips:
 * - /en/today and date pages (served from Firestore matchday docs)
 * - the scheduler Cloud Function (separate code path, ~1 call/min max)
 * - PitaCopa (own server, own cache — the whole point of the headroom)
 *
 * Design notes (same patterns as rateLimit.ts / sharedCache.ts):
 * - Fail-OPEN on any Firestore error.
 * - The exhausted check is memoized in instance memory for 60 s, so it adds
 *   roughly one Firestore read per instance per minute, not per request.
 * - Increments are fire-and-forget; they must never slow or fail a request.
 */

import 'server-only';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ── Tunables ────────────────────────────────────────────────────────────────

/**
 * Max upstream api-football calls FanaticScores' web tier may make per UTC
 * day. Leaves ~2,000 of the 7,500 quota for the scheduler (≤1,440) and
 * PitaCopa's World Cup proxy (a few hundred on match days).
 */
const DAILY_LIMIT = 5500;

/** How long one instance trusts its last exhausted-check, in ms. */
const CHECK_TTL_MS = 60_000;

const COLLECTION = 'afDaily';

// ── Firestore handle ─────────────────────────────────────────────────────────

function adminApp() {
  const apps = getApps();
  if (apps.length) return apps[0];
  return initializeApp();
}

let dbSingleton: FirebaseFirestore.Firestore | null = null;
function db(): FirebaseFirestore.Firestore {
  if (!dbSingleton) dbSingleton = getFirestore(adminApp());
  return dbSingleton;
}

/** api-football's daily quota resets at 00:00 UTC; key the counter the same way. */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Recording ────────────────────────────────────────────────────────────────

/**
 * Count one real upstream api-football request. Called from fetchAF right
 * after the network call (every attempt counts — api-football bills retries
 * and error responses against the quota too). Fire-and-forget.
 */
export function recordUpstreamCall(): void {
  try {
    void db()
      .collection(COLLECTION)
      .doc(todayKey())
      .set({ count: FieldValue.increment(1), updatedAt: Date.now() }, { merge: true })
      .catch(() => { /* never let accounting affect the live request */ });
  } catch {
    /* ditto */
  }
}

// ── Checking ─────────────────────────────────────────────────────────────────

let lastCheck: { day: string; exhausted: boolean; at: number } | null = null;

/**
 * True when today's upstream spend has crossed DAILY_LIMIT — callers should
 * skip upstream work and render not-found, exactly like the per-IP limiter.
 * Memoized per instance for CHECK_TTL_MS; fails open.
 */
export async function isDailyBudgetExhausted(): Promise<boolean> {
  try {
    const day = todayKey();
    if (lastCheck && lastCheck.day === day && Date.now() - lastCheck.at < CHECK_TTL_MS) {
      return lastCheck.exhausted;
    }
    const snap = await db().collection(COLLECTION).doc(day).get();
    const count = snap.exists ? ((snap.data()?.count as number) ?? 0) : 0;
    const exhausted = count >= DAILY_LIMIT;
    if (exhausted && (!lastCheck || !lastCheck.exhausted || lastCheck.day !== day)) {
      console.warn(`[dailyBudget] EXHAUSTED count=${count} limit=${DAILY_LIMIT} day=${day}`);
    }
    lastCheck = { day, exhausted, at: Date.now() };
    return exhausted;
  } catch {
    return false; // a broken budget check must never take the site down
  }
}
