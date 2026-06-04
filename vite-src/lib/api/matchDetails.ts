/* ============================================================
   Match details API -- fixture detail + events + stats + h2h + standings
   Basic match data comes from the in-memory match cache
   (populated by the home-page fetch via useMatches hook).
   All results cached 24 h (testing TTL — tighten for production).
   ============================================================ */

import type { MatchStatus, MatchEvent, MatchStats } from '../types';
import { getCachedMatch } from '../matchCache';
import { cacheGet, cacheSet } from '../apiCache';

const BASE = '/api/af';
const TTL = 24 * 60 * 60 * 1000;   // 24 h — flatten for testing; tighten in prod

// Maps our internal compCode → api-football league ID (for standings).
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

// Derive api-football season year from current date.
function currentSeason(): number {
  const now = new Date();
  return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
}

// ── Raw API types ─────────────────────────────────────────────────────────────

interface AFTeamRef  { id: number; name: string; logo: string; }
interface AFGoals    { home: number | null; away: number | null; }
interface AFScore    { home: number | null; away: number | null; }

// /fixtures?id response
interface AFScoreBlock { halftime: AFScore; fulltime: AFScore; extratime: AFScore; penalty: AFScore; }
interface AFEventTime  { elapsed: number; extra: number | null; }
interface AFEventPlayer { id: number | null; name: string | null; }
interface AFRawEvent {
  time:     AFEventTime;
  team:     { id: number; name: string };
  player:   AFEventPlayer;
  assist:   AFEventPlayer;
  type:     string;   // "Goal" | "Card" | "subst" | "Var"
  detail:   string;   // "Normal Goal" | "Own Goal" | "Penalty" | "Yellow Card" | "Red Card" | ...
  comments: string | null;
}
interface AFFixtureDetail {
  fixture: {
    id:      number;
    referee: string | null;
    venue:   { id: number; name: string; city: string } | null;
    status:  { short: string; elapsed: number | null };
  };
  league: { id: number; name: string; country: string; round: string };
  teams:  { home: AFTeamRef; away: AFTeamRef };
  goals:  AFGoals;
  score:  AFScoreBlock;
  events: AFRawEvent[];
}

// /fixtures/statistics response
interface AFStatItem  { type: string; value: string | number | null; }
interface AFTeamStats { team: { id: number }; statistics: AFStatItem[]; }

// H2H response
interface AFH2HMatch {
  fixture: { id: number; date: string; status: { short: string } };
  teams:   { home: AFTeamRef; away: AFTeamRef };
  goals:   AFGoals;
}

// Standings response
interface AFStandingsEntry {
  rank:      number;
  team:      { id: number; name: string; logo: string };
  points:    number;
  goalsDiff: number;
  form:      string | null;
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface H2HMatch {
  id: string; date: string;
  homeTeam: string; homeScore: number | null; homeCrest: string;
  awayTeam: string; awayScore: number | null; awayCrest: string;
}

export interface StandingRow {
  position: number;
  teamId: string; teamName: string; teamShort: string; teamCrest: string;
  played: number; won: number; draw: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number;
  points: number; form: string | null;
}

export interface MatchDetailData {
  id: string;
  status: MatchStatus;
  minute: string | number | null;
  kickoff: string;
  competition: string;
  compCountry: string;
  compCode: string;
  compType: string;
  matchday: number | null;
  stage: string | null;
  venue: string | null;
  referee: string | null;
  halfTime: { home: number | null; away: number | null };
  home: { id: string; name: string; short: string; initial: string; color: string; crest?: string; score: number | null };
  away: { id: string; name: string; short: string; initial: string; color: string; crest?: string; score: number | null };
  events: MatchEvent[];
  stats: MatchStats | null;
  h2h: { homeWins: number; draws: number; awayWins: number; totalGoals: number; recent: H2HMatch[] } | null;
  standings: StandingRow[];
}

// ── Retry helper ──────────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, retries = 2, delayMs = 3000): Promise<Response> {
  const res = await fetch(url);
  if (res.status === 429 && retries > 0) {
    console.warn(`[matchDetails] 429 on ${url} — retrying in ${delayMs}ms`);
    await new Promise(r => setTimeout(r, delayMs));
    return fetchWithRetry(url, retries - 1, delayMs * 2);
  }
  return res;
}

function hasBodyErrors(errors: unknown): boolean {
  return Boolean(errors && typeof errors === 'object' && Object.keys(errors as object).length > 0);
}

// ── Fetch fixture detail (events + referee + venue + halftime + round) ────────

interface FixtureDetail {
  referee:  string | null;
  venue:    string | null;
  round:    string | null;
  halfTime: { home: number | null; away: number | null };
  events:   MatchEvent[];
}

async function fetchFixtureDetail(matchId: string, homeId: string): Promise<FixtureDetail | null> {
  const key = `fixture:af:${matchId}`;
  const hit = cacheGet<FixtureDetail>(key);
  if (hit !== null) return hit;

  try {
    const res = await fetchWithRetry(`${BASE}/fixtures?id=${matchId}`);
    if (!res.ok) return null;
    const json = await res.json() as { response: AFFixtureDetail[]; errors: unknown };
    if (hasBodyErrors(json.errors)) { console.warn('[matchDetails] fixture errors', json.errors); return null; }

    const f = json.response?.[0];
    if (!f) return null;

    const events: MatchEvent[] = (f.events ?? []).flatMap((e): MatchEvent[] => {
      const min = e.time.extra ? `${e.time.elapsed}+${e.time.extra}` : String(e.time.elapsed);
      const team: 'home' | 'away' = String(e.team.id) === homeId ? 'home' : 'away';
      const player = e.player.name ?? '';

      if (e.type === 'Goal') {
        const detail = e.detail === 'Own Goal' ? 'own goal' : e.detail === 'Penalty' ? 'pen' : undefined;
        return [{ min, type: 'goal', team, player, detail }];
      }
      if (e.type === 'Card') {
        if (e.detail === 'Yellow Card')     return [{ min, type: 'yellow', team, player }];
        if (e.detail === 'Red Card')        return [{ min, type: 'red',    team, player }];
        if (e.detail === 'Yellow Red Card') return [{ min, type: 'red',    team, player, detail: '2nd yellow' }];
      }
      if (e.type === 'subst') {
        const detail = e.assist.name ? `↑ ${e.assist.name}` : undefined;
        return [{ min, type: 'sub', team, player, detail }];
      }
      if (e.type === 'Var') {
        return [{ min, type: 'var', team, player, detail: e.detail }];
      }
      return [];
    });

    const result: FixtureDetail = {
      referee:  f.fixture.referee ?? null,
      venue:    f.fixture.venue ? `${f.fixture.venue.name}, ${f.fixture.venue.city}` : null,
      round:    f.league.round ?? null,
      halfTime: { home: f.score.halftime.home, away: f.score.halftime.away },
      events,
    };
    cacheSet(key, result, TTL);
    return result;
  } catch {
    return null;
  }
}

// ── Parse round string → matchday / stage ─────────────────────────────────────

function parseMatchday(round: string | null): number | null {
  if (!round) return null;
  const m = round.match(/(\d+)$/);
  return m ? Number(m[1]) : null;
}

function parseStage(round: string | null): string | null {
  if (!round) return null;
  if (/regular\s+season/i.test(round)) return null;
  return round.replace(/_/g, ' ');
}

// ── Fetch match statistics ────────────────────────────────────────────────────

async function fetchMatchStats(matchId: string, homeId: string): Promise<MatchStats | null> {
  const key = `stats:af:${matchId}`;
  const hit = cacheGet<MatchStats>(key);
  if (hit !== null) return hit;

  try {
    const res = await fetchWithRetry(`${BASE}/fixtures/statistics?fixture=${matchId}`);
    if (!res.ok) return null;
    const json = await res.json() as { response: AFTeamStats[]; errors: unknown };
    if (hasBodyErrors(json.errors)) { console.warn('[matchDetails] stats errors', json.errors); return null; }

    const teams = json.response ?? [];
    if (teams.length < 2) return null;

    const homeEntry = teams.find(t => String(t.team.id) === homeId) ?? teams[0];
    const awayEntry = teams.find(t => String(t.team.id) !== homeId) ?? teams[1];

    function getStat(entry: AFTeamStats, type: string): number {
      const item = entry.statistics.find(s => s.type === type);
      if (!item || item.value === null) return 0;
      if (typeof item.value === 'string') return parseFloat(item.value.replace('%', '')) || 0;
      return Number(item.value) || 0;
    }

    const homePoss = getStat(homeEntry, 'Ball Possession');
    const awayPoss = getStat(awayEntry, 'Ball Possession');
    const possTotal = homePoss + awayPoss;
    const normHome = possTotal > 0 ? Math.round((homePoss / possTotal) * 100) : 50;

    const stats: MatchStats = {
      possession:    [normHome, 100 - normHome],
      shots:         [getStat(homeEntry, 'Total Shots'),   getStat(awayEntry, 'Total Shots')],
      shotsOnTarget: [getStat(homeEntry, 'Shots on Goal'), getStat(awayEntry, 'Shots on Goal')],
      xG:            [getStat(homeEntry, 'expected_goals'), getStat(awayEntry, 'expected_goals')],
      corners:       [getStat(homeEntry, 'Corner Kicks'),  getStat(awayEntry, 'Corner Kicks')],
      fouls:         [getStat(homeEntry, 'Fouls'),         getStat(awayEntry, 'Fouls')],
    };
    cacheSet(key, stats, TTL);
    return stats;
  } catch {
    return null;
  }
}

// ── Fetch head2head ───────────────────────────────────────────────────────────

type H2HResult = NonNullable<MatchDetailData['h2h']> | null;

async function fetchH2H(homeId: string, awayId: string): Promise<H2HResult> {
  if (!homeId || !awayId) return null;
  const key = `h2h:af:${homeId}-${awayId}`;
  const hit = cacheGet<H2HResult>(key);
  if (hit !== null) return hit;

  try {
    // Note: &last=N is a paid feature — omit it and slice manually.
    const res = await fetchWithRetry(`${BASE}/fixtures/headtohead?h2h=${homeId}-${awayId}`);
    if (!res.ok) return null;
    const data = await res.json() as { response: AFH2HMatch[]; errors: unknown };
    if (hasBodyErrors(data.errors)) { console.warn('[matchDetails] H2H errors', data.errors); return null; }

    // Keep only finished matches, sort newest-first, take 5.
    const finished = (data.response ?? [])
      .filter(m => ['FT', 'AET', 'PEN'].includes(m.fixture.status.short))
      .sort((a, b) => b.fixture.date.localeCompare(a.fixture.date))
      .slice(0, 5);

    let homeWins = 0, draws = 0, awayWins = 0, totalGoals = 0;
    for (const m of finished) {
      const hScore = m.goals.home;
      const aScore = m.goals.away;
      if (hScore === null || aScore === null) continue;
      totalGoals += hScore + aScore;
      if (hScore === aScore) {
        draws++;
      } else {
        const homeWon = hScore > aScore
          ? String(m.teams.home.id) === homeId
          : String(m.teams.away.id) === homeId;
        if (homeWon) homeWins++; else awayWins++;
      }
    }

    const result: H2HResult = {
      homeWins, draws, awayWins, totalGoals,
      recent: finished.map(m => ({
        id:        String(m.fixture.id),
        date:      m.fixture.date.slice(0, 10),
        homeTeam:  m.teams.home.name,
        homeScore: m.goals.home,
        homeCrest: m.teams.home.logo,
        awayTeam:  m.teams.away.name,
        awayScore: m.goals.away,
        awayCrest: m.teams.away.logo,
      })),
    };
    cacheSet(key, result, TTL);
    return result;
  } catch {
    return null;
  }
}

// ── Fetch standings (with season fallback for free-plan limits) ───────────────

async function fetchStandingsForSeason(leagueId: number, season: number): Promise<StandingRow[] | 'plan_error'> {
  try {
    const res = await fetchWithRetry(`${BASE}/standings?league=${leagueId}&season=${season}`);
    if (!res.ok) return [];
    const data = await res.json() as { response: Array<{ league: { standings: AFStandingsEntry[][] } }>; errors: unknown };
    // Free plan blocks seasons beyond the allowed range.
    if (hasBodyErrors(data.errors)) {
      const msg = JSON.stringify(data.errors);
      if (msg.includes('plan') || msg.includes('season')) return 'plan_error';
      return [];
    }
    const table = data.response?.[0]?.league?.standings?.[0] ?? [];
    return table.map(r => {
      const words = r.team.name.split(/\s+/);
      const teamShort = words.map(w => w[0]).join('').slice(0, 3).toUpperCase();
      return {
        position:       r.rank,
        teamId:         String(r.team.id),
        teamName:       r.team.name,
        teamShort,
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
      } as StandingRow;
    });
  } catch {
    return [];
  }
}

async function fetchStandings(compCode: string): Promise<StandingRow[]> {
  if (CUP_CODES.has(compCode)) return [];
  const leagueId = COMP_CODE_TO_LEAGUE_ID[compCode];
  if (!leagueId) return [];

  // Try current season, then fall back up to 2 years if the free plan blocks it.
  for (let offset = 0; offset <= 2; offset++) {
    const season = currentSeason() - offset;
    const key = `standings:af:${leagueId}:${season}`;
    const hit = cacheGet<StandingRow[]>(key);
    if (hit !== null) return hit;

    const result = await fetchStandingsForSeason(leagueId, season);
    if (result === 'plan_error') continue;   // try previous season
    if (result.length > 0) {
      cacheSet(key, result, TTL);
      return result;
    }
    // Empty but no plan error (e.g. season not started yet) — cache empty and stop.
    cacheSet(key, result, TTL);
    return result;
  }
  return [];
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function fetchMatchDetail(matchId: string): Promise<MatchDetailData | null> {
  const cached = getCachedMatch(matchId);
  if (!cached) return null;

  const { match, competition, compCountry, compCode, compType } = cached;
  const homeId = match.home.id ?? '';
  const awayId = match.away.id ?? '';

  const [fixtureDetail, stats, h2h, standings] = await Promise.all([
    fetchFixtureDetail(matchId, homeId),
    fetchMatchStats(matchId, homeId),
    fetchH2H(homeId, awayId),
    compType === 'LEAGUE' ? fetchStandings(compCode) : Promise.resolve([] as StandingRow[]),
  ]);

  const round = fixtureDetail?.round ?? null;

  return {
    id:          match.id,
    status:      match.status,
    minute:      match.minute ?? null,
    kickoff:     match.kickoff ?? '',
    competition,
    compCountry,
    compCode,
    compType,
    matchday:    parseMatchday(round),
    stage:       parseStage(round),
    venue:       fixtureDetail?.venue ?? null,
    referee:     fixtureDetail?.referee ?? null,
    halfTime:    fixtureDetail?.halfTime ?? { home: null, away: null },
    home: {
      id:      homeId,
      name:    match.home.name,
      short:   match.home.short,
      initial: match.home.initial,
      color:   match.home.color,
      crest:   match.home.crest,
      score:   match.home.score,
    },
    away: {
      id:      awayId,
      name:    match.away.name,
      short:   match.away.short,
      initial: match.away.initial,
      color:   match.away.color,
      crest:   match.away.crest,
      score:   match.away.score,
    },
    events:    fixtureDetail?.events ?? [],
    stats,
    h2h,
    standings,
  };
}
