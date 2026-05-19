/**
 * Match cache — populated by useMatches whenever home-page data loads.
 * Backed by sessionStorage so the match details page works after refresh.
 * Free-tier football-data.org does not allow GET /v4/matches/:id,
 * so we rely entirely on this cache for basic match info.
 */
import type { Match, Competition } from './types';

const CACHE_KEY = 'fs_match_cache_v1';

export interface CachedMatch {
  match: Match;
  competition: string;
  compCode: string;   // e.g. 'PL', 'SA', 'CL'
  compType: string;   // 'LEAGUE' | 'CUP'
}

// Infer competition type from code — CL and WC are knockout competitions.
const CUP_CODES = new Set(['CL', 'WC']);

// In-memory store (Map is the source of truth; sessionStorage is the mirror).
const store = new Map<string, CachedMatch>();

function persist() {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify([...store.entries()]));
  } catch { /* storage full or unavailable */ }
}

function hydrate() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const entries: [string, CachedMatch][] = JSON.parse(raw);
    for (const [id, entry] of entries) store.set(id, entry);
  } catch { /* corrupt data */ }
}

// Hydrate once on module load so a page refresh still finds cached matches.
hydrate();

/** Call this after every successful fetchMatchesForDate. */
export function cacheCompetitions(comps: Competition[]): void {
  for (const comp of comps) {
    const compType = CUP_CODES.has(comp.id) ? 'CUP' : 'LEAGUE';
    for (const match of comp.matches) {
      store.set(match.id, {
        match,
        competition: comp.name,
        compCode: comp.id,
        compType,
      });
    }
  }
  persist();
}

/** Returns cached match data or null if not yet loaded. */
export function getCachedMatch(matchId: string): CachedMatch | null {
  return store.get(matchId) ?? null;
}
