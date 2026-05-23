/* ============================================================
   Competition details API
   Fetches info, standings and top scorers for a given comp code.
   Uses api-football v3 (/api/af proxy).
   All responses cached 24 h (testing TTL — tighten for production).
   ============================================================ */

import { cacheGet, cacheSet } from '../apiCache';

const BASE = '/api/af';
const TTL  = 24 * 60 * 60 * 1000;   // 24 h — testing TTL; tighten for production

// Maps our internal compCode → api-football league ID.
const COMP_CODE_TO_LEAGUE_ID: Record<string, number> = {
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

// Cup codes — no standings fetch for these.
const CUP_CODES = new Set([
  'WC', 'CWC', 'EURO', 'CA', 'AFCN', 'UNL',
  'CL', 'EL', 'UECL',
  'LIBT', 'CSUD',
  'FAC', 'LCC', 'CDR', 'DFB', 'CI', 'CDF',
]);

// Derive api-football season year from current date (European calendar).
function currentSeason(): number {
  const now = new Date();
  return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
}

// Parse "Regular Season - 35" or "Matchday - 4" → 35 / 4.
function parseMatchday(round: string | null | undefined): number | null {
  if (!round) return null;
  const m = round.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

// ── Raw API types ─────────────────────────────────────────────────────────────

interface AFLeagueSeason {
  year:    number;
  start:   string;
  end:     string;
  current: boolean;
}

interface AFLeagueEntry {
  league: {
    id:   number;
    name: string;
    type: string;   // "League" | "Cup"
    logo: string;
  };
  country: {
    name: string;
    code: string | null;
    flag: string | null;
  };
  seasons: AFLeagueSeason[];
}

interface AFStandingsLeague {
  id:         number;
  name:       string;
  round:      string | null;
  season:     number;
  standings:  AFStandingsEntry[][];
}

interface AFStandingsEntry {
  rank:      number;
  team:      { id: number; name: string; logo: string };
  points:    number;
  goalsDiff: number;
  form:      string | null;
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
}

interface AFScorer {
  player: { id: number; name: string; nationality: string; };
  statistics: Array<{
    team:    { id: number; name: string; logo: string };
    goals:   { total: number | null; assists: number | null; };
    penalty: { scored: number | null; };
    games:   { appearences: number | null; };
  }>;
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface CompInfo {
  id: number;
  code: string;
  name: string;
  type: string;
  emblem: string | null;
  area: { name: string; code: string; flag: string | null; };
  season: {
    startDate: string;
    endDate: string;
    currentMatchday: number | null;
    winner: { name: string; crest: string | null; } | null;
  } | null;
}

export interface CompStandingRow {
  position: number;
  teamId: string;
  teamName: string;
  teamShort: string;
  teamCrest: string;
  played: number;
  won: number; draw: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number;
  points: number;
  form: string | null;
}

export interface CompScorer {
  playerName: string;
  nationality: string;
  teamName: string;
  teamShort: string;
  teamCrest: string;
  goals: number;
  assists: number | null;
  penalties: number | null;
  playedMatches: number;
}

export interface CompFixture {
  id: number;
  utcDate: string;
  status: string;
  round: string | null;
  homeTeam: { id: number; name: string; crest: string; score: number | null; };
  awayTeam: { id: number; name: string; crest: string; score: number | null; };
}

export interface CompetitionDetailData {
  info: CompInfo;
  standings: CompStandingRow[];
  scorers: CompScorer[];
  upcomingFixtures: CompFixture[];
  recentResults: CompFixture[];
}

// ── Retry helper ──────────────────────────────────────────────────────────────

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

// ── Fetch competition info ────────────────────────────────────────────────────

async function fetchCompInfo(code: string, leagueId: number): Promise<CompInfo | null> {
  const key = `comp_info:af:${leagueId}`;
  const hit = cacheGet<CompInfo>(key);
  if (hit) return hit;

  try {
    const res = await fetchWithRetry(`${BASE}/leagues?id=${leagueId}`);
    if (!res.ok) return null;
    const json = await res.json() as { response: AFLeagueEntry[]; errors: unknown };
    if (hasBodyErrors(json.errors)) return null;

    const entry = json.response?.[0];
    if (!entry) return null;

    const season = entry.seasons.find(s => s.current) ?? entry.seasons.at(-1) ?? null;

    const info: CompInfo = {
      id:     entry.league.id,
      code,
      name:   entry.league.name,
      type:   entry.league.type === 'Cup' ? 'CUP' : 'LEAGUE',
      emblem: entry.league.logo ?? null,
      area: {
        name: entry.country.name,
        code: entry.country.code ?? '',
        flag: entry.country.flag ?? null,
      },
      season: season ? {
        startDate:       season.start,
        endDate:         season.end,
        currentMatchday: null,   // filled in from standings response below
        winner:          null,   // filled in from previous-season standings below
      } : null,
    };
    // Don't cache yet — we'll update currentMatchday/winner before caching.
    return info;
  } catch { return null; }
}

// ── Fetch standings (with season fallback) ────────────────────────────────────

interface StandingsFetch {
  rows:            CompStandingRow[];
  currentMatchday: number | null;
  winner:          { name: string; crest: string | null } | null; // rank-1 team (= champion of this season if finished, or null)
}

async function fetchStandingsRaw(leagueId: number, season: number): Promise<StandingsFetch | 'plan_error' | null> {
  try {
    const res = await fetchWithRetry(`${BASE}/standings?league=${leagueId}&season=${season}`);
    if (!res.ok) return null;
    const data = await res.json() as { response: Array<{ league: AFStandingsLeague }>; errors: unknown };

    if (hasBodyErrors(data.errors)) {
      const msg = JSON.stringify(data.errors);
      if (msg.includes('plan') || msg.includes('season') || msg.includes('subscription')) return 'plan_error';
      console.warn('[competitionDetails] standings errors', data.errors);
      return null;
    }

    const league = data.response?.[0]?.league;
    if (!league) return null;

    const table = league.standings?.[0] ?? [];
    if (table.length === 0) return null;   // no data yet for this season

    const rows: CompStandingRow[] = table.map(r => ({
      position:       r.rank,
      teamId:         String(r.team.id),
      teamName:       r.team.name,
      teamShort:      r.team.name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase(),
      teamCrest:      r.team.logo,
      played:         r.all.played,
      won:            r.all.win,
      draw:           r.all.draw,
      lost:           r.all.lose,
      goalsFor:       r.all.goals.for,
      goalsAgainst:   r.all.goals.against,
      goalDifference: r.goalsDiff,
      points:         r.points,
      form:           r.form ?? null,
    }));

    const champion = table.find(r => r.rank === 1) ?? null;

    return {
      rows,
      currentMatchday: parseMatchday(league.round),
      winner: champion ? { name: champion.team.name, crest: champion.team.logo } : null,
    };
  } catch (e) {
    console.warn('[competitionDetails] standings fetch error', e);
    return null;
  }
}

async function fetchCompStandings(code: string, leagueId: number): Promise<{
  rows: CompStandingRow[];
  currentMatchday: number | null;
  winner: { name: string; crest: string | null } | null;
}> {
  const empty = { rows: [], currentMatchday: null, winner: null };
  if (CUP_CODES.has(code)) return empty;

  const baseSeason = currentSeason();

  for (let offset = 0; offset <= 2; offset++) {
    const season = baseSeason - offset;
    const key = `comp_standings:af2:${leagueId}:${season}`;
    const hit = cacheGet<{ rows: CompStandingRow[]; currentMatchday: number | null; winner: { name: string; crest: string | null } | null }>(key);
    if (hit !== null) return hit;

    const result = await fetchStandingsRaw(leagueId, season);
    if (result === 'plan_error') { console.warn(`[competitionDetails] plan_error for season ${season}, trying ${season - 1}`); continue; }
    if (result === null) continue;  // empty season or fetch error — try previous

    cacheSet(key, result, TTL);
    return result;
  }
  return empty;
}

// ── Fetch top scorers ─────────────────────────────────────────────────────────

async function fetchCompScorers(leagueId: number): Promise<CompScorer[]> {
  const season = currentSeason();
  const key = `comp_scorers:af:${leagueId}:${season}`;
  const hit = cacheGet<CompScorer[]>(key);
  if (hit) return hit;

  try {
    const res = await fetchWithRetry(`${BASE}/players/topscorers?league=${leagueId}&season=${season}`);
    if (!res.ok) { console.warn('[competitionDetails] scorers not ok', res.status); return []; }
    const json = await res.json() as { response: AFScorer[]; errors: unknown };
    if (hasBodyErrors(json.errors)) { console.warn('[competitionDetails] scorers errors', json.errors); return []; }

    const scorers: CompScorer[] = (json.response ?? []).map(s => {
      const stats = s.statistics[0];
      const teamName = stats?.team.name ?? '';
      return {
        playerName:    s.player.name,
        nationality:   s.player.nationality,
        teamName,
        teamShort:     teamName.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase(),
        teamCrest:     stats?.team.logo ?? '',
        goals:         stats?.goals.total ?? 0,
        assists:       stats?.goals.assists ?? null,
        penalties:     stats?.penalty.scored ?? null,
        playedMatches: stats?.games.appearences ?? 0,
      };
    });
    cacheSet(key, scorers, TTL);
    return scorers;
  } catch (e) { console.warn('[competitionDetails] scorers error', e); return []; }
}

// ── Fetch fixtures (upcoming + recent) ───────────────────────────────────────

interface AFFixtureRaw {
  fixture: { id: number; date: string; status: { short: string } };
  league:  { round: string | null };
  teams:   { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } };
  goals:   { home: number | null; away: number | null };
}

function mapFixture(f: AFFixtureRaw): CompFixture {
  return {
    id:       f.fixture.id,
    utcDate:  f.fixture.date,
    status:   f.fixture.status.short,
    round:    f.league.round ?? null,
    homeTeam: { id: f.teams.home.id, name: f.teams.home.name, crest: f.teams.home.logo, score: f.goals.home },
    awayTeam: { id: f.teams.away.id, name: f.teams.away.name, crest: f.teams.away.logo, score: f.goals.away },
  };
}

async function fetchCompFixtures(leagueId: number): Promise<{ upcoming: CompFixture[]; recent: CompFixture[] }> {
  const season = currentSeason();
  const key = `comp_fixtures:af:${leagueId}:${season}`;
  const hit = cacheGet<{ upcoming: CompFixture[]; recent: CompFixture[] }>(key);
  if (hit) return hit;

  const TTL_FIXTURES = 30 * 60 * 1000; // 30 min

  try {
    const [upRes, reRes] = await Promise.all([
      fetchWithRetry(`${BASE}/fixtures?league=${leagueId}&season=${season}&next=5`),
      fetchWithRetry(`${BASE}/fixtures?league=${leagueId}&season=${season}&last=5`),
    ]);

    const upJson  = upRes.ok  ? await upRes.json()  as { response: AFFixtureRaw[] } : { response: [] };
    const reJson  = reRes.ok  ? await reRes.json()  as { response: AFFixtureRaw[] } : { response: [] };

    const result = {
      upcoming: (upJson.response ?? []).map(mapFixture),
      recent:   (reJson.response ?? []).reverse().map(mapFixture),
    };
    cacheSet(key, result, TTL_FIXTURES);
    return result;
  } catch (e) {
    console.warn('[competitionDetails] fixtures error', e);
    return { upcoming: [], recent: [] };
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function fetchCompetitionDetail(code: string): Promise<CompetitionDetailData | null> {
  const leagueId = COMP_CODE_TO_LEAGUE_ID[code];
  if (!leagueId) { console.warn('[competitionDetails] unknown comp code', code); return null; }

  const [info, standingsFetch, scorers, fixtures] = await Promise.all([
    fetchCompInfo(code, leagueId),
    fetchCompStandings(code, leagueId),
    fetchCompScorers(leagueId),
    fetchCompFixtures(leagueId),
  ]);

  if (!info) return null;

  // Enrich info with currentMatchday and winner from the standings response.
  if (info.season) {
    info.season.currentMatchday = standingsFetch.currentMatchday;

    // Winner = rank-1 team from the PREVIOUS season (current season winner not yet decided).
    // If the current season standings show a played count suggesting the season is over (e.g. 38+ games),
    // use the current season's rank-1 team as champion. Otherwise fall back to previous season.
    const topRow = standingsFetch.rows[0];
    const seasonOver = topRow && topRow.played >= 34;
    if (seasonOver) {
      info.season.winner = standingsFetch.winner;
    } else {
      // Try to get last season's champion.
      const prevKey = `comp_standings:af2:${leagueId}:${currentSeason() - 1}`;
      const prevHit = cacheGet<{ rows: CompStandingRow[]; winner: { name: string; crest: string | null } | null }>(prevKey);
      if (prevHit?.winner) {
        info.season.winner = prevHit.winner;
      }
      // If no cached previous season, leave winner null (avoid an extra API call on every page load).
    }
  }

  // Cache the final info (now that currentMatchday/winner are filled in).
  cacheSet(`comp_info:af:${leagueId}`, info, TTL);

  return { info, standings: standingsFetch.rows, scorers, upcomingFixtures: fixtures.upcoming, recentResults: fixtures.recent };
}
