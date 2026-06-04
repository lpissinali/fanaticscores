/* ============================================================
   Team details API — api-football v3
   Fetches team info, squad, coach, recent results & upcoming fixtures.
   All parallel requests; cached in localStorage.
   ============================================================ */

import { cacheGet, cacheSet } from '../apiCache';
import { cacheMatch } from '../matchCache';
import type { Match } from '../types';

const BASE       = '/api/af';
const TTL_INFO   = 24 * 60 * 60 * 1000;  // 24 h for team info/squad/coach
const TTL_MATCH  = 30 * 60 * 1000;       // 30 min for fixtures

// Maps api-football league ID → our internal comp code (for competition page links).
const LEAGUE_ID_TO_CODE: Record<number, string> = {
  1:   'WC',   15:  'CWC',  4:   'EURO', 9:   'CA',   6:   'AFCN', 5:   'UNL',
  2:   'CL',   3:   'EL',   848: 'UECL',
  13:  'LIBT', 11:  'CSUD',
  39:  'PL',   140: 'PD',   135: 'SA',   78:  'BL1',  61:  'FL1',
  88:  'DED',  94:  'PPL',  179: 'SPL',  144: 'JPL',  203: 'TSL',  307: 'SAPL',
  40:  'ELC',  141: 'SD',   136: 'SB',   79:  'BL2',  62:  'FL2',
  71:  'BSA',  128: 'ARG',  262: 'MX',   253: 'MLS',  239: 'COL',  265: 'CHI',
  98:  'J1',   169: 'CSL',
  45:  'FAC',  48:  'LCC',  143: 'CDR',  81:  'DFB',  137: 'CI',   66:  'CDF',
};

// ── Raw API types ─────────────────────────────────────────────────────────────

interface AFTeam {
  id:       number;
  name:     string;
  code:     string | null;
  country:  string;
  founded:  number | null;
  national: boolean;
  logo:     string;
}

interface AFVenue {
  id:       number | null;
  name:     string | null;
  address:  string | null;
  city:     string | null;
  capacity: number | null;
  surface:  string | null;
  image:    string | null;
}

interface AFSquadPlayer {
  id:       number;
  name:     string;
  age:      number | null;
  number:   number | null;
  position: string | null;  // "Goalkeeper" | "Defender" | "Midfielder" | "Attacker"
  photo:    string | null;
}


interface AFFixture {
  fixture: {
    id:     number;
    date:   string;
    status: { short: string; elapsed: number | null };
  };
  league: {
    id:   number;
    name: string;
    logo: string;
  };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface TeamPlayer {
  id: string;
  name: string;
  position: 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Forward' | 'Unknown';
  dateOfBirth: string | null;
  nationality: string | null;
  age: number | null;
}

export interface TeamMatch {
  id: string;
  utcDate: string;
  status: string;
  homeTeam: { id: string; name: string; crest: string; score: number | null; };
  awayTeam: { id: string; name: string; crest: string; score: number | null; };
  competition: string;
  compCode: string;
}

export interface RunningCompetition {
  id: string;
  name: string;
  code: string;
  type: string;
  emblem: string | null;
}

export interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  address: string | null;
  website: string | null;
  founded: number | null;
  clubColors: string | null;
  venue: string | null;
  coach: { name: string; nationality: string | null; contractUntil: string | null; } | null;
  squad: TeamPlayer[];
  runningCompetitions: RunningCompetition[];
}

export interface TeamDetailData {
  info: TeamInfo;
  recentMatches: TeamMatch[];
  upcomingMatches: TeamMatch[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, retries = 2, delayMs = 3000): Promise<Response> {
  const res = await fetch(url);
  if (res.status === 429 && retries > 0) {
    await new Promise(r => setTimeout(r, delayMs));
    return fetchWithRetry(url, retries - 1, delayMs * 2);
  }
  return res;
}

function hasBodyErrors(errors: unknown): boolean {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === 'object') return Object.keys(errors as object).length > 0;
  return false;
}

function mapPosition(raw: string | null): TeamPlayer['position'] {
  switch (raw) {
    case 'Goalkeeper': return 'Goalkeeper';
    case 'Defender':   return 'Defender';
    case 'Midfielder': return 'Midfielder';
    case 'Attacker':   return 'Forward';
    default:           return 'Unknown';
  }
}

function mapFixtureStatus(short: string): string {
  switch (short) {
    case 'FT': case 'AET': case 'PEN':                           return 'FINISHED';
    case '1H': case '2H': case 'ET': case 'BT': case 'P':
    case 'HT':                                                    return 'IN_PLAY';
    case 'PST':                                                   return 'POSTPONED';
    case 'CANC': case 'ABD': case 'SUSP': case 'INT':            return 'CANCELLED';
    default:                                                      return 'SCHEDULED';
  }
}

function mapFixture(f: AFFixture): TeamMatch {
  return {
    id:      String(f.fixture.id),
    utcDate: f.fixture.date,
    status:  mapFixtureStatus(f.fixture.status.short),
    homeTeam: {
      id:    String(f.teams.home.id),
      name:  f.teams.home.name,
      crest: f.teams.home.logo,
      score: f.goals.home,
    },
    awayTeam: {
      id:    String(f.teams.away.id),
      name:  f.teams.away.name,
      crest: f.teams.away.logo,
      score: f.goals.away,
    },
    competition: f.league.name,
    compCode:    LEAGUE_ID_TO_CODE[f.league.id] ?? '',
  };
}

// ── Individual fetchers ───────────────────────────────────────────────────────

async function fetchTeamInfoRaw(
  teamId: string,
): Promise<{ team: AFTeam; venue: AFVenue | null } | null> {
  const key = `team_af_info:${teamId}`;
  const hit = cacheGet<{ team: AFTeam; venue: AFVenue | null }>(key);
  if (hit) return hit;

  try {
    const res = await fetchWithRetry(`${BASE}/teams?id=${teamId}`);
    if (!res.ok) return null;
    const json = await res.json() as {
      response: Array<{ team: AFTeam; venue: AFVenue }>;
      errors: unknown;
    };
    if (hasBodyErrors(json.errors)) return null;
    const entry = json.response?.[0];
    if (!entry) return null;
    const result = { team: entry.team, venue: entry.venue ?? null };
    cacheSet(key, result, TTL_INFO);
    return result;
  } catch { return null; }
}

async function fetchSquad(teamId: string): Promise<TeamPlayer[]> {
  const key = `team_af_squad:${teamId}`;
  const hit = cacheGet<TeamPlayer[]>(key);
  if (hit) return hit;

  try {
    const res = await fetchWithRetry(`${BASE}/players/squads?team=${teamId}`);
    if (!res.ok) return [];
    const json = await res.json() as {
      response: Array<{ players: AFSquadPlayer[] }>;
      errors: unknown;
    };
    if (hasBodyErrors(json.errors)) return [];

    const players = json.response?.[0]?.players ?? [];
    const squad: TeamPlayer[] = players.map(p => ({
      id:          String(p.id),
      name:        p.name,
      position:    mapPosition(p.position),
      dateOfBirth: null,   // not available from squads endpoint
      nationality: null,   // not available from squads endpoint
      age:         p.age ?? null,
    }));
    cacheSet(key, squad, TTL_INFO);
    return squad;
  } catch { return []; }
}


const SEED_CUP_CODES = new Set([
  'WC','CWC','EURO','CA','AFCN','UNL',
  'CL','EL','UECL','LIBT','CSUD',
  'FAC','LCC','CDR','DFB','CI','CDF',
]);

function seedMatchCache(recent: TeamMatch[], upcoming: TeamMatch[]): void {
  for (const m of [...recent, ...upcoming]) {
    if (!m.compCode) continue;
    const compType = SEED_CUP_CODES.has(m.compCode) ? 'CUP' : 'LEAGUE';
    const toShort   = (name: string) => name.split(/\s+/)[0];
    const toInitial = (name: string) => name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
    const match: Match = {
      id:      m.id,
      status:  m.status === 'FINISHED'  ? 'FT'
             : m.status === 'IN_PLAY'   ? 'LIVE'
             : m.status === 'POSTPONED' ? 'POSTPONED'
             : m.status === 'CANCELLED' ? 'CANCELLED'
             : 'SCHEDULED',
      kickoff: m.status === 'SCHEDULED'
        ? new Date(m.utcDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : undefined,
      home: {
        id:      m.homeTeam.id,
        name:    m.homeTeam.name,
        short:   toShort(m.homeTeam.name),
        initial: toInitial(m.homeTeam.name),
        color:   '#3a3a48',
        crest:   m.homeTeam.crest || undefined,
        score:   m.homeTeam.score,
      },
      away: {
        id:      m.awayTeam.id,
        name:    m.awayTeam.name,
        short:   toShort(m.awayTeam.name),
        initial: toInitial(m.awayTeam.name),
        color:   '#3a3a48',
        crest:   m.awayTeam.crest || undefined,
        score:   m.awayTeam.score,
      },
    };
    cacheMatch({ match, competition: m.competition, compCountry: '', compCode: m.compCode, compType });
  }
}

async function fetchFixtures(
  teamId: string,
): Promise<{ recent: TeamMatch[]; upcoming: TeamMatch[] }> {
  const key = `team_af_matches:${teamId}`;
  const hit = cacheGet<{ recent: TeamMatch[]; upcoming: TeamMatch[] }>(key);
  if (hit) {
    // Fixtures are cached in localStorage but the match cache (sessionStorage)
    // is cleared on every page refresh — re-seed it every time.
    seedMatchCache(hit.recent, hit.upcoming);
    return hit;
  }

  try {
    const [lastRes, nextRes] = await Promise.all([
      fetchWithRetry(`${BASE}/fixtures?team=${teamId}&last=6`),
      fetchWithRetry(`${BASE}/fixtures?team=${teamId}&next=5`),
    ]);

    const recent:   TeamMatch[] = [];
    const upcoming: TeamMatch[] = [];

    if (lastRes.ok) {
      const d = await lastRes.json() as { response: AFFixture[]; errors: unknown };
      if (!hasBodyErrors(d.errors)) {
        recent.push(
          ...(d.response ?? [])
            .sort((a, b) => b.fixture.date.localeCompare(a.fixture.date))
            .map(mapFixture),
        );
      }
    }
    if (nextRes.ok) {
      const d = await nextRes.json() as { response: AFFixture[]; errors: unknown };
      if (!hasBodyErrors(d.errors)) {
        upcoming.push(
          ...(d.response ?? [])
            .sort((a, b) => a.fixture.date.localeCompare(b.fixture.date))
            .map(mapFixture),
        );
      }
    }

    const result = { recent, upcoming };
    cacheSet(key, result, TTL_MATCH);
    seedMatchCache(recent, upcoming);

    return result;
  } catch { return { recent: [], upcoming: [] }; }
}

/** Fetch just fixtures for a team — lighter than full fetchTeamDetail. */
export async function fetchTeamFixtures(
  teamId: string,
): Promise<{ recent: TeamMatch[]; upcoming: TeamMatch[] }> {
  return fetchFixtures(teamId);
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function fetchTeamDetail(teamId: string): Promise<TeamDetailData | null> {
  const [teamData, squad, fixtures] = await Promise.all([
    fetchTeamInfoRaw(teamId),
    fetchSquad(teamId),
    fetchFixtures(teamId),
  ]);
  const coach = null;

  if (!teamData) return null;

  // Derive running competitions from upcoming + recent fixtures (unique leagues).
  const seenLeagueIds = new Set<number>();
  const runningCompetitions: RunningCompetition[] = [];
  for (const m of [...fixtures.upcoming, ...fixtures.recent]) {
    // Find the league ID for this match's compCode.
    const leagueId = Number(
      Object.keys(LEAGUE_ID_TO_CODE).find(k => LEAGUE_ID_TO_CODE[Number(k)] === m.compCode),
    );
    if (!leagueId || seenLeagueIds.has(leagueId)) continue;
    seenLeagueIds.add(leagueId);
    runningCompetitions.push({
      id:     String(leagueId),
      name:   m.competition,
      code:   m.compCode,
      type:   'LEAGUE',
      emblem: null,
    });
  }

  const { team, venue } = teamData;

  // Build address string from venue fields.
  const addressParts = [venue?.address, venue?.city].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(', ') : null;

  const info: TeamInfo = {
    id:         String(team.id),
    name:       team.name,
    shortName:  team.name,
    tla:        team.code ?? team.name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase(),
    crest:      team.logo,
    address,
    website:    null,     // not provided by api-football /teams
    founded:    team.founded ?? null,
    clubColors: null,     // not provided by api-football /teams
    venue:      venue?.name ?? null,
    coach,
    squad,
    runningCompetitions,
  };

  return { info, recentMatches: fixtures.recent, upcomingMatches: fixtures.upcoming };
}
