/**
 * Server-side API configuration.
 * These functions run in Next.js Server Components / Route Handlers only.
 * The AF_API_KEY is never sent to the browser.
 */

import { cache as reactCache } from 'react';
import { readCachedAF, writeCachedAF } from './sharedCache';
import { recordUpstreamCall } from './dailyBudget';

export const AF_BASE = 'https://v3.football.api-sports.io';

const AF_CACHE_TTL_SECONDS = 3600;

/**
 * Long read-freshness windows for data that changes slowly or never. These
 * matter because Googlebot legitimately re-crawls thousands of team/match
 * pages a day: with the default hour-long window every re-crawl re-burns the
 * full upstream fan-out, while with these windows a re-crawl is a Firestore
 * read. (Writes always refresh the same shared cache entry, so different
 * callers can read the same endpoint at different freshness needs.)
 */
export const AF_STABLE_TTL_SECONDS = 7 * 24 * 3600; // immutable-ish: team identity, finished matches
export const AF_SLOW_TTL_SECONDS = 24 * 3600;       // slow-moving: squads, head-to-head history
export const AF_TEAM_FIXTURES_TTL_SECONDS = 6 * 3600; // a team's recent/upcoming fixture lists

/**
 * "Hot" window (PitaCopa-style adaptive freshness): used for standings and
 * top scorers of a competition that currently has a match live / just
 * finished / about to start. Those tables only actually change at full time,
 * so 5 minutes is fresh enough while costing ~12 calls/hour per endpoint at
 * worst — the fixtures rail itself uses AF_LIVE_TTL_SECONDS for live scores.
 */
export const AF_HOT_TTL_SECONDS = 300;

/**
 * Short TTL for endpoints backing in-progress matches (fixture status, live
 * stats). Live viewers want near-real-time updates, so once matchDetails.ts
 * has confirmed a match is actually live, it re-checks these endpoints
 * against this much shorter freshness window instead of the default hour.
 */
export const AF_LIVE_TTL_SECONDS = 120;

export function afHeaders(): HeadersInit {
  const key = process.env.AF_API_KEY ?? '';
  if (!key) console.warn('[serverApi] AF_API_KEY is not set');
  return { 'x-apisports-key': key };
}

export function hasBodyErrors(errors: unknown): boolean {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === 'object') return Object.keys(errors as object).length > 0;
  return false;
}

/**
 * Fetch from api-football, going through the Firestore-backed shared cache
 * first (see ./sharedCache). This makes "cache for an hour" actually mean
 * one real upstream call per hour per endpoint *across the whole fleet* of
 * App Hosting instances — not once per instance, which is what Next's
 * built-in in-memory fetch cache effectively gives us under bursty/scaled
 * traffic (and which was burning through our daily api-football quota).
 *
 * `ttlSeconds` controls how fresh a cached copy must be to serve from the
 * shared cache (defaults to the standard hour-long window). Pass a shorter
 * value — e.g. AF_LIVE_TTL_SECONDS — for endpoints where the caller has
 * already confirmed the underlying data changes quickly (live matches).
 * Note this only affects *read* freshness checks; every successful, error-free
 * response is still written back to the same cache entry with a fresh
 * timestamp, so short- and long-TTL callers transparently share one record.
 *
 * IMPORTANT — the upstream fetch is `cache: 'no-store'`, NOT Next-cached.
 * The previous version used `next: { revalidate: 3600 }` on the inner fetch,
 * which broke freshness in two ways on warm instances:
 *   1. When Firestore said "stale", the per-instance Next data cache could
 *      return an hour-old body without ever hitting upstream — and that stale
 *      body was then re-written to Firestore with a FRESH timestamp. Under
 *      continuous traffic the same stale standings got re-stamped every hour,
 *      so they never updated (visible on /en/competition/WC during the World
 *      Cup opener).
 *   2. The live 120s re-check hit the same URL whose per-instance entry was
 *      created pre-match with the 1-hour window → live scores froze for up
 *      to an hour on warm instances.
 * Per-request deduplication (generateMetadata + page sharing one fetch) is
 * provided by React cache() below instead — that was the only real value the
 * per-instance data cache added.
 *
 * Retries with exponential back-off on 429, same as before.
 */
const fetchAFCore = reactCache(async (
  path: string,
  ttlSeconds: number,
  retries: number,
  delayMs: number,
): Promise<{ status: number; body: string; source: 'shared-hit' | 'upstream' }> => {
  const cached = await readCachedAF(path, ttlSeconds);
  if (cached) return { status: cached.status, body: cached.body, source: 'shared-hit' };

  for (;;) {
    // Every real network attempt counts against api-football's daily quota
    // (including retries and error responses), so record it as such.
    recordUpstreamCall();

    const res = await fetch(`${AF_BASE}${path}`, {
      headers: afHeaders(),
      cache: 'no-store',
    });

    if (res.status === 429 && retries > 0) {
      retries -= 1;
      await new Promise(r => setTimeout(r, delayMs));
      delayMs *= 2;
      continue;
    }

    const body = await res.text();
    if (res.ok) {
      let shouldCache = false;
      try {
        const parsed = JSON.parse(body) as { errors?: unknown };
        // Don't cache error bodies (bad/expired key, daily quota exhausted,
        // plan restrictions, etc.) — api-football returns these with HTTP 200,
        // and freezing them into the shared cache for an hour would mean every
        // instance keeps serving "quota exceeded" long after it actually clears.
        shouldCache = !hasBodyErrors(parsed.errors);
      } catch {
        // Non-JSON body — don't cache it.
      }
      if (shouldCache) void writeCachedAF(path, res.status, body);
    }
    return { status: res.status, body, source: 'upstream' };
  }
});

export async function fetchAF(
  path: string,
  ttlSeconds: number = AF_CACHE_TTL_SECONDS,
  retries = 2,
  delayMs = 3000,
): Promise<Response> {
  // Memoized core returns plain data (a Response body can only be consumed
  // once, so the memo must not hand the same Response to two callers).
  const r = await fetchAFCore(path, ttlSeconds, retries, delayMs);
  return new Response(r.body, {
    status: r.status,
    headers: { 'content-type': 'application/json', 'x-af-cache': r.source },
  });
}

/** Derive api-football season year from current date (European calendar). */
export function currentSeason(): number {
  const now = new Date();
  return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
}

export const COMP_CODE_TO_LEAGUE_ID: Record<string, number> = {
  WC:   1,   CWC: 15,  EURO: 4,  CA:   9,  AFCN: 6,  UNL: 5,
  CL:   2,   EL:  3,   UECL: 848,
  LIBT: 13,  CSUD: 11,
  PL:   39,  PD:  140, SA:  135, BL1:  78, FL1:  61,
  DED:  88,  PPL: 94,  SPL: 179, JPL: 144, TSL: 203, SAPL: 307,
  ELC:  40,  SD:  141, SB:  136, BL2:  79, FL2:  62,
  BSA:  71,  ARG: 128, MX:  262, MLS: 253, COL: 239, CHI: 265,
  J1:   98,  CSL: 169,
  FAC:  45,  LCC:  48, CDR: 143, DFB:  81, CI:  137, CDF:  66,
};

export const LEAGUE_ID_TO_CODE: Record<number, string> = Object.fromEntries(
  Object.entries(COMP_CODE_TO_LEAGUE_ID).map(([k, v]) => [v, k])
);

export const CUP_CODES = new Set([
  'WC', 'CWC', 'EURO', 'CA', 'AFCN', 'UNL',
  'CL', 'EL', 'UECL', 'LIBT', 'CSUD',
  'FAC', 'LCC', 'CDR', 'DFB', 'CI', 'CDF',
]);
