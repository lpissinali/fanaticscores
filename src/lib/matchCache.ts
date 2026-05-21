/**
 * Match cache — populated by useMatches whenever home-page data loads.
 * Backed by sessionStorage so the match details page works after refresh.
 * Free-tier football-data.org does not allow GET /v4/matches/:id,
 * so we rely entirely on this cache for basic match info.
 */
import type { Match, Competition } from './types';

const CACHE_KEY = 'fs_match_cache_v3';

export interface CachedMatch {
  match: Match;
  competition: string;
  compCountry: string;
  compCode: string;   // e.g. 'PL', 'SA', 'CL'
  compType: string;   // 'LEAGUE' | 'CUP'
}

// Infer competition type from code — must match LEAGUE_LIST type:'CUP' entries.
const CUP_CODES = new Set([
  'WC', 'CWC', 'EURO', 'CA', 'AFCN', 'UNL',
  'CL', 'EL', 'UECL',
  'LIBT', 'CSUD',
  'FAC', 'LCC', 'CDR', 'DFB', 'CI', 'CDF',
]);

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
        compCountry: comp.country,
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

/** Store a single entry — used by the team page to seed the cache from fixture lists. */
export function cacheMatch(entry: CachedMatch): void {
  // Don't overwrite a richer home-page entry with a leaner team-page one.
  if (store.has(entry.match.id)) return;
  store.set(entry.match.id, entry);
  persist();
}

export interface CachedTeam {
  id: string;
  name: string;
  crest?: string;
  compCode: string;
  compName: string;
  compCountry: string;
}

/** Returns all unique teams seen across cached matches (deduped by team id). */
export function getAllCachedTeams(): CachedTeam[] {
  const seen = new Map<string, CachedTeam>();
  for (const { match, compCode, competition, compCountry } of store.values()) {
    for (const side of [match.home, match.away]) {
      if (!side.id) continue;
      if (!seen.has(side.id)) {
        seen.set(side.id, {
          id:          side.id,
          name:        side.name,
          crest:       side.crest,
          compCode,
          compName:    competition,
          compCountry,
        });
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}
