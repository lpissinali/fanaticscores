/**
 * Server-side API configuration.
 * These functions run in Next.js Server Components / Route Handlers only.
 * The AF_API_KEY is never sent to the browser.
 */

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
 * Retries with exponential back-off on 429, same as before.
 */
export async function fetchAF(
  path: string,
  ttlSeconds: number = AF_CACHE_TTL_SECONDS,
  retries = 2,
  delayMs = 3000,
): Promise<Response> {
  const cached = await readCachedAF(path, ttlSeconds);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: { 'content-type': 'application/json', 'x-af-cache': 'shared-hit' },
    });
  }

  // Every real network attempt counts against api-football's daily quota
  // (including retries and error responses), so record it as such.
  recordUpstreamCall();

  const res = await fetch(`${AF_BASE}${path}`, {
    headers: afHeaders(),
    // Keep Next's own per-instance fetch cache too, as a fast first line of
    // defense between Firestore reads for the same instance/request tree.
    // Always uses the long window — the per-instance cache is just a cheap
    // pre-filter in front of the shared Firestore cache, which is what
    // actually enforces `ttlSeconds` for freshness decisions.
    next: { revalidate: AF_CACHE_TTL_SECONDS },
  });

  if (res.status === 429 && retries > 0) {
    await new Promise(r => setTimeout(r, delayMs));
    return fetchAF(path, ttlSeconds, retries - 1, delayMs * 2);
  }

  if (res.ok) {
    const body = await res.clone().text();
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

  return res;
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
