/**
 * Shared, fleet-wide cache for api-football responses, backed by Firestore.
 *
 * Why this exists:
 * Next.js's built-in `fetch` cache (the `next: { revalidate }` option used in
 * fetchAF) is — by default — held in each server instance's memory. Firebase
 * App Hosting can run many concurrent Cloud Run instances (apphosting.yaml
 * allows up to 100, with minInstances: 0), and each one starts with an empty
 * cache. Under bursty/crawler traffic this means "revalidate every hour"
 * effectively becomes "every instance refetches everything," multiplying our
 * api-football request volume far beyond the daily quota.
 *
 * This module makes the cache a real, shared resource: every instance reads
 * and writes the same Firestore collection, so a given api-football endpoint
 * is fetched at most once per TTL window across the *entire* fleet.
 *
 * Design notes:
 * - Best-effort: any Firestore error falls back to "no cache" rather than
 *   failing the request — a slow/broken cache must never break the site.
 * - Only well-formed, error-free responses are cached (see fetchAF), so a
 *   transient auth/quota error doesn't get "frozen" into the cache for an hour.
 * - No stampede protection (no locks): acceptable trade-off here, since even
 *   an unprotected shared cache is a massive improvement over no shared cache
 *   at all, and locking would add real complexity/risk for a marginal gain.
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const COLLECTION = 'afCache';

interface CachedDoc {
  status: number;
  body: string;
  cachedAt: number; // epoch ms
  path: string;     // kept for debugging/inspection in the Firestore console
}

function adminApp() {
  const apps = getApps();
  if (apps.length) return apps[0];
  // No-arg init, same as functions/src/adminInit — on Firebase App Hosting
  // (Cloud Run) this picks up Application Default Credentials and the
  // project ID automatically from the attached service account / environment.
  return initializeApp();
}

let dbSingleton: FirebaseFirestore.Firestore | null = null;
function db(): FirebaseFirestore.Firestore {
  if (!dbSingleton) dbSingleton = getFirestore(adminApp());
  return dbSingleton;
}

/** Firestore document IDs can't contain '/'; base64url-encode the AF path. */
function docIdFor(path: string): string {
  return Buffer.from(path).toString('base64url').slice(0, 1500); // stay under the 1500-byte doc-ID limit
}

export interface CachedAFResponse { status: number; body: string }

/**
 * Returns a cached api-football response if one exists and is still within
 * `ttlSeconds`. Returns null on a cache miss, stale entry, or any error —
 * callers should treat null as "go fetch live."
 */
export async function readCachedAF(path: string, ttlSeconds: number): Promise<CachedAFResponse | null> {
  try {
    const snap = await db().collection(COLLECTION).doc(docIdFor(path)).get();
    if (!snap.exists) return null;
    const data = snap.data() as CachedDoc | undefined;
    if (!data) return null;
    if (Date.now() - data.cachedAt > ttlSeconds * 1000) return null;
    return { status: data.status, body: data.body };
  } catch {
    return null;
  }
}

/**
 * Stores a fresh, error-free api-football response so the rest of the fleet
 * can reuse it for up to `ttlSeconds`. Fire-and-forget — failures are swallowed.
 */
export async function writeCachedAF(path: string, status: number, body: string): Promise<void> {
  try {
    const doc: CachedDoc = { status, body, cachedAt: Date.now(), path };
    await db().collection(COLLECTION).doc(docIdFor(path)).set(doc);
  } catch {
    // Best-effort cache write — never let this affect the live response.
  }
}
