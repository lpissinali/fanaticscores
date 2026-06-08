/**
 * Behavioral, per-IP rate limiting for the api-football-backed detail pages
 * (/en/team/[id], /en/match/[id], /en/competition/[code]).
 *
 * Why this exists:
 * Those pages each fan out into several api-football calls on a cache miss
 * (team detail alone = /teams + /players/squads + 2× /fixtures). The shared
 * Firestore cache (see ./sharedCache) makes *repeat* hits to the same ID cheap,
 * but it does nothing against ID *enumeration* — a scraper walking novel
 * /en/team/{1,2,3,...} IDs misses the cache every time and burns ~4 upstream
 * calls per ID. That is what was eating the daily api-football quota.
 *
 * The fix here targets behavior, not identity. We deliberately do NOT try to
 * decide "is this really Googlebot?" from User-Agent or published crawler IP
 * ranges — that approach proved both fragile and unsafe (false-positive 403s on
 * genuine Google prefetch traffic). Instead we simply cap how many distinct
 * detail-page requests any single client IP may trigger per hour. Real visitors
 * and real crawlers stay far under the cap; an enumeration scraper trips it.
 *
 * Design notes:
 * - Backed by Firestore so the count is accurate across the whole App Hosting
 *   fleet (up to 100 Cloud Run instances), not per-instance.
 * - Fail-OPEN: any Firestore error, or an unidentifiable client IP, results in
 *   the request being allowed. A broken limiter must never take the site down
 *   or block real users — at worst it stops protecting the quota.
 * - Memoized per request via React `cache()`, so a single page view that runs
 *   generateMetadata + the page body (and reuses the same fetcher) is counted
 *   ONCE, not once per fetcher call.
 */

import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// ── Tunables ────────────────────────────────────────────────────────────────

/** Max distinct detail-page requests permitted per client IP per window. */
const LIMIT = 100;

/** Length of the fixed counting window, in seconds (1 hour). */
const WINDOW_SECONDS = 3600;

const COLLECTION = 'rateLimits';

// ── Firestore handle (same admin-SDK pattern as sharedCache.ts) ──────────────

function adminApp() {
  const apps = getApps();
  if (apps.length) return apps[0];
  // No-arg init: on Firebase App Hosting (Cloud Run) this picks up Application
  // Default Credentials and the project ID from the attached service account.
  return initializeApp();
}

let dbSingleton: FirebaseFirestore.Firestore | null = null;
function db(): FirebaseFirestore.Firestore {
  if (!dbSingleton) dbSingleton = getFirestore(adminApp());
  return dbSingleton;
}

// ── Client IP extraction ─────────────────────────────────────────────────────

/**
 * Best-effort client IP from the incoming request headers.
 *
 * On Firebase App Hosting / Cloud Run the original client IP is the left-most
 * entry of X-Forwarded-For. NOTE: a client can prepend its own X-Forwarded-For,
 * so a determined adversary could rotate spoofed left-most values to dodge the
 * cap. The current scraper spoofs only its User-Agent, not XFF, so left-most is
 * sufficient today. If XFF spoofing ever shows up in the logs, switch to a
 * trusted right-most-N position instead (the value the platform appends).
 *
 * Returns null when no usable IP is present → caller treats that as "allow".
 */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = h.get('x-real-ip');
  return real?.trim() || null;
}

// ── Core counter ─────────────────────────────────────────────────────────────

/**
 * Atomically increments this IP's counter for the current fixed window and
 * returns whether the request is still within the cap. Fail-open on any error.
 */
async function incrementAndCheck(ip: string): Promise<boolean> {
  try {
    const bucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
    // Document IDs can't contain characters like ':' freely; ':' is fine, but
    // IPv6 colons are kept readable and '/' (CIDR) never appears in an IP.
    const docId = `${ip}__${bucket}`;
    const ref = db().collection(COLLECTION).doc(docId);

    const count = await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? ((snap.data()?.count as number) ?? 0) : 0;
      const next = current + 1;
      tx.set(
        ref,
        {
          count: next,
          ip,
          bucket,
          updatedAt: Date.now(),
          // For a Firestore TTL policy: set the TTL field to `expireAt` so old
          // counter docs auto-delete ~2 windows after they stop being touched.
          expireAt: Timestamp.fromMillis(Date.now() + WINDOW_SECONDS * 2 * 1000),
        },
        { merge: true },
      );
      return next;
    });

    return count <= LIMIT;
  } catch {
    // Best-effort: never let a limiter failure block the request.
    return true;
  }
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Per-request (React-cached) rate-limit check for detail pages.
 * Returns true if the request is ALLOWED, false if it should be denied.
 *
 * Memoization means generateMetadata + the page body + the OG image renderer,
 * when they share a request, increment the counter exactly once.
 */
export const checkDetailRateLimit = cache(async (): Promise<boolean> => {
  const ip = await clientIp();
  if (!ip) return true; // can't identify the caller → don't penalize
  return incrementAndCheck(ip);
});

/** Convenience inverse for guard sites: `if (await isRateLimited()) return null;` */
export async function isRateLimited(): Promise<boolean> {
  return !(await checkDetailRateLimit());
}
