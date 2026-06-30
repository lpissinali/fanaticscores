'use client';
/* ============================================================
   api-football.com v3  --  API service layer (frontend)
   Single /fixtures?date=DATE call returns all leagues at once.
   In production the Firestore cache (via Cloud Functions) is
   always preferred; this file is only used as a dev/fallback.
   ============================================================ */

import type { Match, TeamInfo, FeaturedMatch, Competition, MatchStatus } from '../types';
import { getFollowedNames } from '../useFollowing';

const BASE = '/api/af';

// League definitions — must stay in sync with apiFootballFetch.ts
export const LEAGUE_LIST = [
  // ── International tournaments ────────────────────────────────────────────────
  { id: 1,   code: 'WC',   name: 'FIFA World Cup',          country: 'World',        short: 'WC',   flag: '#8b6914', type: 'CUP'    },
  { id: 15,  code: 'CWC',  name: 'Club World Cup',          country: 'World',        short: 'CWC',  flag: '#8b6914', type: 'CUP'    },
  { id: 4,   code: 'EURO', name: 'UEFA European Championship', country: 'Europe',    short: 'EURO', flag: '#1a3a6b', type: 'CUP'    },
  { id: 9,   code: 'CA',   name: 'Copa America',            country: 'S. America',   short: 'CA',   flag: '#006400', type: 'CUP'    },
  { id: 6,   code: 'AFCN', name: 'Africa Cup of Nations',   country: 'Africa',       short: 'AFCN', flag: '#8b4513', type: 'CUP'    },
  { id: 5,   code: 'UNL',  name: 'UEFA Nations League',     country: 'Europe',       short: 'UNL',  flag: '#1a3a6b', type: 'CUP'    },
  // ── UEFA club competitions ────────────────────────────────────────────────────
  { id: 2,   code: 'CL',   name: 'UEFA Champions League',   country: 'Europe',       short: 'UCL',  flag: '#1a3a6b', type: 'CUP'    },
  { id: 3,   code: 'EL',   name: 'UEFA Europa League',      country: 'Europe',       short: 'UEL',  flag: '#e87800', type: 'CUP'    },
  { id: 848, code: 'UECL', name: 'UEFA Conference League',  country: 'Europe',       short: 'UECL', flag: '#1a6b3a', type: 'CUP'    },
  // ── South American club competitions ─────────────────────────────────────────
  { id: 13,  code: 'LIBT', name: 'Copa Libertadores',       country: 'S. America',   short: 'LIBT', flag: '#006400', type: 'CUP'    },
  { id: 11,  code: 'CSUD', name: 'Copa Sudamericana',       country: 'S. America',   short: 'CSUD', flag: '#005500', type: 'CUP'    },
  // ── Top 5 European leagues ────────────────────────────────────────────────────
  { id: 39,  code: 'PL',   name: 'Premier League',          country: 'England',      short: 'PL',   flag: '#3d0d6b', type: 'LEAGUE' },
  { id: 140, code: 'PD',   name: 'La Liga',                 country: 'Spain',        short: 'LL',   flag: '#8b0000', type: 'LEAGUE' },
  { id: 135, code: 'SA',   name: 'Serie A',                 country: 'Italy',        short: 'SA',   flag: '#003580', type: 'LEAGUE' },
  { id: 78,  code: 'BL1',  name: 'Bundesliga',              country: 'Germany',      short: 'BL',   flag: '#cc0000', type: 'LEAGUE' },
  { id: 61,  code: 'FL1',  name: 'Ligue 1',                 country: 'France',       short: 'L1',   flag: '#003189', type: 'LEAGUE' },
  // ── Other European leagues ────────────────────────────────────────────────────
  { id: 88,  code: 'DED',  name: 'Eredivisie',              country: 'Netherlands',  short: 'ERE',  flag: '#ff6600', type: 'LEAGUE' },
  { id: 94,  code: 'PPL',  name: 'Primeira Liga',           country: 'Portugal',     short: 'PPL',  flag: '#006600', type: 'LEAGUE' },
  { id: 179, code: 'SPL',  name: 'Scottish Premiership',    country: 'Scotland',     short: 'SPL',  flag: '#003399', type: 'LEAGUE' },
  { id: 144, code: 'JPL',  name: 'Jupiler Pro League',      country: 'Belgium',      short: 'JPL',  flag: '#fdda24', type: 'LEAGUE' },
  { id: 203, code: 'TSL',  name: 'Super Lig',               country: 'Turkey',       short: 'TSL',  flag: '#e30a17', type: 'LEAGUE' },
  { id: 307, code: 'SAPL', name: 'Saudi Pro League',        country: 'Saudi Arabia', short: 'SAPL', flag: '#006400', type: 'LEAGUE' },
  // ── Second divisions ─────────────────────────────────────────────────────────
  { id: 40,  code: 'ELC',  name: 'Championship',            country: 'England',      short: 'CH',   flag: '#2d0d5b', type: 'LEAGUE' },
  { id: 141, code: 'SD',   name: 'La Liga 2',               country: 'Spain',        short: 'LL2',  flag: '#8b0000', type: 'LEAGUE' },
  { id: 136, code: 'SB',   name: 'Serie B',                 country: 'Italy',        short: 'SB',   flag: '#003580', type: 'LEAGUE' },
  { id: 79,  code: 'BL2',  name: '2. Bundesliga',           country: 'Germany',      short: 'BL2',  flag: '#cc0000', type: 'LEAGUE' },
  { id: 62,  code: 'FL2',  name: 'Ligue 2',                 country: 'France',       short: 'L2',   flag: '#003189', type: 'LEAGUE' },
  // ── Americas ─────────────────────────────────────────────────────────────────
  { id: 71,  code: 'BSA',  name: 'Brasileirao',             country: 'Brazil',       short: 'BSA',  flag: '#006400', type: 'LEAGUE' },
  { id: 128, code: 'ARG',  name: 'Liga Profesional',        country: 'Argentina',    short: 'ARG',  flag: '#75aadb', type: 'LEAGUE' },
  { id: 262, code: 'MX',   name: 'Liga MX',                 country: 'Mexico',       short: 'MX',   flag: '#006847', type: 'LEAGUE' },
  { id: 253, code: 'MLS',  name: 'MLS',                     country: 'USA',          short: 'MLS',  flag: '#002a5c', type: 'LEAGUE' },
  { id: 239, code: 'COL',  name: 'Primera A',               country: 'Colombia',     short: 'COL',  flag: '#fcd116', type: 'LEAGUE' },
  { id: 265, code: 'CHI',  name: 'Primera Division',        country: 'Chile',        short: 'CHI',  flag: '#d52b1e', type: 'LEAGUE' },
  // ── Asia ─────────────────────────────────────────────────────────────────────
  { id: 98,  code: 'J1',   name: 'J1 League',               country: 'Japan',        short: 'J1',   flag: '#bc002d', type: 'LEAGUE' },
  { id: 169, code: 'CSL',  name: 'Chinese Super League',    country: 'China',        short: 'CSL',  flag: '#de2910', type: 'LEAGUE' },
  // ── Domestic cups ────────────────────────────────────────────────────────────
  { id: 45,  code: 'FAC',  name: 'FA Cup',                  country: 'England',      short: 'FAC',  flag: '#3d0d6b', type: 'CUP'    },
  { id: 48,  code: 'LCC',  name: 'Carabao Cup',             country: 'England',      short: 'EFL',  flag: '#3d0d6b', type: 'CUP'    },
  { id: 143, code: 'CDR',  name: 'Copa del Rey',            country: 'Spain',        short: 'CDR',  flag: '#8b0000', type: 'CUP'    },
  { id: 81,  code: 'DFB',  name: 'DFB-Pokal',               country: 'Germany',      short: 'DFB',  flag: '#cc0000', type: 'CUP'    },
  { id: 137, code: 'CI',   name: 'Coppa Italia',            country: 'Italy',        short: 'CI',   flag: '#003580', type: 'CUP'    },
  { id: 66,  code: 'CDF',  name: 'Coupe de France',         country: 'France',       short: 'CDF',  flag: '#003189', type: 'CUP'    },
] as const;

const ALLOWED_IDS:  Set<number>                              = new Set(LEAGUE_LIST.map(l => l.id as number));
const LEAGUE_BY_ID: Map<number, typeof LEAGUE_LIST[number]> = new Map(LEAGUE_LIST.map(l => [l.id as number, l]));

// Priority tier for featured match selection.
const TIER: Record<number, number> = {
    // International
  1: 12, 4: 12, 9: 11, 6: 11, 15: 10,
  // UEFA club
  2: 10, 3: 9, 848: 7, 5: 7,
  // South American club
  13: 9, 11: 7,
  // Top 5 leagues
  39: 8, 140: 8, 135: 8, 78: 7, 61: 7,
  // Other European leagues
  88: 6, 94: 6, 179: 5, 144: 5, 203: 5, 307: 5,
  // 2nd divisions
  40: 4, 141: 4, 136: 4, 79: 4, 62: 4,
  // Americas
  71: 5, 128: 5, 262: 5, 253: 5, 239: 3, 265: 3,
  // Asia
  98: 4, 169: 3,
  // Domestic cups
  45: 6, 48: 4, 143: 6, 81: 6, 137: 6, 66: 6,
};

// ── api-football.com v3 raw types ────────────────────────────────────────────

interface AFFixtureStatus { short: string; elapsed: number | null; }
interface AFFixtureInfo   { id: number; date: string; status: AFFixtureStatus; }
interface AFLeague        { id: number; name: string; country: string; round: string; }
interface AFTeam          { id: number; name: string; logo: string; winner?: boolean | null; }
interface AFGoals         { home: number | null; away: number | null; }
interface AFFixture {
  fixture: AFFixtureInfo;
  league:  AFLeague;
  teams:   { home: AFTeam; away: AFTeam };
  goals:   AFGoals;
  score?:  { penalty?: { home: number | null; away: number | null } };
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

function mapStatus(s: string): MatchStatus {
  switch (s) {
    case '1H':
    case '2H':
    case 'ET':
    case 'BT':
    case 'P':   return 'LIVE';
    case 'HT':  return 'HT';
    case 'FT':  return 'FT';
    case 'AET': return 'AET';
    case 'PEN': return 'PEN';
    case 'PST': return 'POSTPONED';
    case 'CANC':
    case 'ABD':
    case 'SUSP':
    case 'INT': return 'CANCELLED';
    default:    return 'SCHEDULED';
  }
}

function formatKickoff(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function mapTeam(af: AFTeam, score: number | null): TeamInfo {
  const words = af.name.split(/\s+/);
  const initial = words.length >= 2
    ? words.map(w => w[0]).join('').slice(0, 3).toUpperCase()
    : af.name.slice(0, 3).toUpperCase();
  return {
    id:      String(af.id),
    name:    af.name,
    short:   words[0],
    initial,
    color:   '#3a3a48',
    crest:   af.logo || undefined,
    score,
  };
}

// Maximum realistic match duration (90 + HT + ET + penalties) with safety margin.
const STALE_LIVE_MS = 3.5 * 3_600_000;

function mapFixtureToMatch(f: AFFixture): Match {
  let status = mapStatus(f.fixture.status.short);
  const elapsed = f.fixture.status.elapsed;

  // Stale-LIVE guard: if kickoff + 3.5 h has passed, the match must be over.
  if ((status === 'LIVE' || status === 'HT') &&
      Date.now() - new Date(f.fixture.date).getTime() > STALE_LIVE_MS) {
    status = 'FT';
  }

  const minute: string | number | null =
    (elapsed != null && (status === 'LIVE' || status === 'HT')) ? elapsed : null;

  const winner: 'home' | 'away' | null =
    f.teams.home.winner === true ? 'home' :
    f.teams.away.winner === true ? 'away' : null;
  const penalty = status === 'PEN' && f.score?.penalty
    ? { home: f.score.penalty.home ?? null, away: f.score.penalty.away ?? null }
    : undefined;

  return {
    id:      String(f.fixture.id),
    status,
    minute,
    kickoff: status === 'SCHEDULED' ? formatKickoff(f.fixture.date) : undefined,
    home:    mapTeam(f.teams.home, f.goals.home),
    away:    mapTeam(f.teams.away, f.goals.away),
    winner,
    penalty,
  };
}

function parseRound(round: string): string | undefined {
  if (!round) return undefined;
  const m = round.match(/^(.+?)\s*-\s*(.+)$/);
  if (!m) return round;
  const [, prefix, suffix] = m;
  if (/regular\s+season/i.test(prefix)) return `Matchday ${suffix}`;
  return `${prefix} ${suffix}`;
}

function hasFollowedTeam(f: AFFixture, followed: Set<string>): boolean {
  if (followed.size === 0) return false;
  return followed.has(f.teams.home.name) || followed.has(f.teams.away.name);
}

function pickFeatured(whitelisted: AFFixture[]): FeaturedMatch | null {
  const followed = getFollowedNames();

  const LIVE_CODES  = new Set(['1H', '2H', 'ET', 'BT', 'P', 'HT']);
  const SCHED_CODES = new Set(['NS', 'TBD']);
  const FIN_CODES   = new Set(['FT', 'AET', 'PEN']);
  const now = Date.now();

  // A fixture is effectively live only if it hasn't exceeded the stale threshold.
  const isEffectivelyLive = (f: AFFixture) =>
    LIVE_CODES.has(f.fixture.status.short) &&
    now - new Date(f.fixture.date).getTime() <= STALE_LIVE_MS;

  const tryGroups = [
    whitelisted.filter(isEffectivelyLive),
    whitelisted.filter(f => SCHED_CODES.has(f.fixture.status.short)),
    whitelisted.filter(f => FIN_CODES.has(f.fixture.status.short) ||
      (LIVE_CODES.has(f.fixture.status.short) && !isEffectivelyLive(f))),
  ];

  for (const group of tryGroups) {
    if (group.length === 0) continue;
    const best = group.reduce((b, m) => {
      const mF = hasFollowedTeam(m, followed) ? 1 : 0;
      const bF = hasFollowedTeam(b, followed) ? 1 : 0;
      if (mF !== bF) return mF > bF ? m : b;
      return (TIER[m.league.id] ?? 0) >= (TIER[b.league.id] ?? 0) ? m : b;
    });
    return {
      ...mapFixtureToMatch(best),
      competition:    LEAGUE_BY_ID.get(best.league.id)?.name ?? best.league.name,
      compCountry:    best.league.country,
      stats:          { possession: [50, 50], shots: [0, 0], xG: [0.0, 0.0] },
      events:         [],
      aiPulse:        '',
      momentumSeries: [],
    };
  }
  return null;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface TodayData {
  competitions: Competition[];
  featured:     FeaturedMatch | null;
  hadErrors:    boolean;
  aiBrief:      string | null;
}

export async function fetchMatchesForDate(date: string): Promise<TodayData> {
  let fixtures: AFFixture[] = [];
  let hadErrors = false;

  try {
    const res = await fetch(`${BASE}/fixtures?date=${date}`);
    if (res.status === 429 || !res.ok) {
      hadErrors = true;
    } else {
      const json = await res.json() as { response: AFFixture[]; errors: unknown };
      const errors = json.errors;
      if (errors && typeof errors === 'object' && Object.keys(errors as object).length > 0) {
        hadErrors = true;
      }
      fixtures = json.response ?? [];
    }
  } catch {
    hadErrors = true;
  }

  // Group by league ID in priority order
  const byLeague = new Map<number, AFFixture[]>();
  for (const f of fixtures) {
    if (!ALLOWED_IDS.has(f.league.id)) continue;
    const arr = byLeague.get(f.league.id) ?? [];
    arr.push(f);
    byLeague.set(f.league.id, arr);
  }

  const competitions: Competition[] = [];
  for (const leagueDef of LEAGUE_LIST) {
    const group = byLeague.get(leagueDef.id);
    if (!group || group.length === 0) continue;
    competitions.push({
      id:      leagueDef.code,
      name:    leagueDef.name,
      country: leagueDef.country,
      short:   leagueDef.short,
      flag:    leagueDef.flag,
      stage:   parseRound(group[0].league.round),
      matches: group.map(mapFixtureToMatch),
    });
  }

  const whitelisted = fixtures.filter(f => ALLOWED_IDS.has(f.league.id));
  return { competitions, featured: pickFeatured(whitelisted), hadErrors, aiBrief: null };
}

export function fetchTodayData(): Promise<TodayData> {
  return fetchMatchesForDate(new Date().toISOString().slice(0, 10));
}
