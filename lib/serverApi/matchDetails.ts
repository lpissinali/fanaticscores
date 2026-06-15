/**
 * Server-side match detail fetching.
 * Unlike the client version, this does NOT depend on the match cache.
 * It fetches everything from api-football by fixture ID directly.
 */

import { fetchAF, hasBodyErrors, currentSeason, COMP_CODE_TO_LEAGUE_ID, LEAGUE_ID_TO_CODE, CUP_CODES, AF_LIVE_TTL_SECONDS, AF_STABLE_TTL_SECONDS, AF_SLOW_TTL_SECONDS, AF_HOT_TTL_SECONDS, AF_TEAM_FIXTURES_TTL_SECONDS } from './config';
import { isRateLimited } from './rateLimit';
import { isDailyBudgetExhausted } from './dailyBudget';

// ── Public types ──────────────────────────────────────────────────────────────

export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'HT' | 'FT' | 'AET' | 'PEN' | 'POSTPONED' | 'CANCELLED' | 'SUSPENDED' | 'AWARDED' | string;

export interface MatchEvent {
  min: string; type: 'goal' | 'yellow' | 'red' | 'sub' | 'var';
  team: 'home' | 'away'; player: string; detail?: string;
}

export interface MatchStats {
  possession: [number, number]; shots: [number, number];
  shotsOnTarget: [number, number]; xG: [number, number];
  corners: [number, number]; fouls: [number, number];
}

export interface H2HMatch {
  id: string; date: string;
  homeTeam: string; homeScore: number | null; homeCrest: string;
  awayTeam: string; awayScore: number | null; awayCrest: string;
}

export interface StandingRow {
  position: number; teamId: string; teamName: string; teamShort: string; teamCrest: string;
  played: number; won: number; draw: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number;
  points: number; form: string | null;
}

export interface MatchDetailData {
  id: string; status: MatchStatus; minute: string | number | null; kickoff: string;
  competition: string; compCountry: string; compCode: string; compType: string;
  matchday: number | null; stage: string | null; venue: string | null; referee: string | null;
  halfTime: { home: number | null; away: number | null };
  home: { id: string; name: string; short: string; initial: string; color: string; crest?: string; score: number | null };
  away: { id: string; name: string; short: string; initial: string; color: string; crest?: string; score: number | null };
  events: MatchEvent[];
  stats: MatchStats | null;
  h2h: { homeWins: number; draws: number; awayWins: number; totalGoals: number; recent: H2HMatch[] } | null;
  standings: StandingRow[];
}

// ── Raw API types ─────────────────────────────────────────────────────────────

interface AFTeamRef { id: number; name: string; logo: string; }
interface AFRawEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
  type: string; detail: string; comments: string | null;
}
interface AFFixtureDetail {
  fixture: {
    id: number; date: string; referee: string | null;
    venue: { id: number; name: string; city: string } | null;
    status: { short: string; elapsed: number | null };
  };
  league: { id: number; name: string; country: string; round: string; logo: string };
  teams: { home: AFTeamRef & { winner: boolean | null }; away: AFTeamRef & { winner: boolean | null } };
  goals: { home: number | null; away: number | null };
  score: { halftime: { home: number | null; away: number | null } };
  events: AFRawEvent[];
}
interface AFStatItem { type: string; value: string | number | null; }
interface AFTeamStats { team: { id: number }; statistics: AFStatItem[]; }
interface AFH2HMatch {
  fixture: { id: number; date: string; status: { short: string } };
  teams: { home: AFTeamRef; away: AFTeamRef };
  goals: { home: number | null; away: number | null };
}
interface AFStandingsEntry {
  rank: number; team: { id: number; name: string; logo: string };
  points: number; goalsDiff: number; form: string | null;
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toShort(name: string) { return name.split(/\s+/)[0]; }
function toInitial(name: string) { return name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase(); }

function mapStatus(short: string): MatchStatus {
  switch (short) {
    case 'FT': case 'AWD': return 'FT';
    case 'AET': return 'AET';
    case 'PEN': return 'PEN';
    case 'HT':  return 'HT';
    case '1H': case '2H': case 'ET': case 'BT': case 'P': return 'LIVE';
    case 'PST': return 'POSTPONED';
    case 'CANC': case 'ABD': return 'CANCELLED';
    case 'SUSP': case 'INT': return 'SUSPENDED';
    default: return 'SCHEDULED';
  }
}

/**
 * True for any raw api-football status meaning the match is currently
 * underway (including half-time) — i.e. data that's actively changing and
 * worth refreshing on the short `AF_LIVE_TTL_SECONDS` cadence rather than
 * the default hour-long window.
 */
function isLiveStatus(short: string): boolean {
  return ['1H', '2H', 'ET', 'BT', 'P', 'HT'].includes(short);
}

/**
 * Statuses after which a fixture's data can never change again (full time,
 * extra time, penalties, awarded, walkover). Deliberately excludes PST/CANC —
 * postponed and cancelled matches can be rescheduled.
 */
const FINISHED_SHORTS = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);

function parseMatchday(round: string | null): number | null {
  if (!round) return null;
  const m = round.match(/(\d+)$/);
  return m ? Number(m[1]) : null;
}

function parseStage(round: string | null): string | null {
  if (!round || /regular\s+season/i.test(round)) return null;
  return round.replace(/_/g, ' ');
}

// ── Fetch core fixture data (events, teams, score, venue, referee) ────────────

async function fetchFixture(matchId: string): Promise<{
  fixture: AFFixtureDetail;
  events: MatchEvent[];
  compCode: string;
  compType: string;
} | null> {
  try {
    const path = `/fixtures?id=${matchId}`;

    // Three-tier freshness, cheapest first:
    // 1. Read at the week-long window. If the cached copy says the match is
    //    FINISHED, it can never change again — serve it. This is what makes
    //    crawler re-visits of result pages (the bulk of traffic) ~free.
    // 2. Otherwise (scheduled/postponed/live/stale-unknown), re-read at the
    //    standard hour window — may trigger one upstream call per hour.
    // 3. If that says the match is LIVE, re-read at the live TTL (2 min).
    const res  = await fetchAF(path, AF_STABLE_TTL_SECONDS);
    if (!res.ok) return null;
    const json = await res.json() as { response: AFFixtureDetail[]; errors: unknown };
    if (hasBodyErrors(json.errors)) return null;
    let f = json.response?.[0];
    if (!f) return null;

    if (!FINISHED_SHORTS.has(f.fixture.status.short)) {
      const hourRes = await fetchAF(path);
      if (hourRes.ok) {
        const hourJson = await hourRes.json() as { response: AFFixtureDetail[]; errors: unknown };
        const hourF = hourJson.response?.[0];
        if (!hasBodyErrors(hourJson.errors) && hourF) f = hourF;
      }
    }

    // Treat as live: status says in-progress, OR the match is inside its
    // kickoff window (from 30 min before kickoff to ~4h after) while the
    // cached copy still says scheduled — api-football flips NS→1H a few
    // minutes late, and an "NS" snapshot cached just before kickoff would
    // otherwise be served as fresh for up to an hour into the match.
    const kickoffMs = Date.parse(f.fixture.date);
    const inKickoffWindow = Number.isFinite(kickoffMs) &&
      Date.now() > kickoffMs - 30 * 60_000 &&
      Date.now() < kickoffMs + 4 * 3_600_000;

    if (isLiveStatus(f.fixture.status.short) ||
        (inKickoffWindow && !FINISHED_SHORTS.has(f.fixture.status.short))) {
      // Match is (or should be) in progress: an hour-old snapshot isn't good
      // enough for live viewers. Re-check the SAME cache entry against the
      // much shorter live TTL — this triggers a fresh upstream fetch only
      // when the stored copy is more than AF_LIVE_TTL_SECONDS old, and
      // naturally stops once the match ends and settles into FT/AET/PEN.
      const liveRes = await fetchAF(path, AF_LIVE_TTL_SECONDS);
      if (liveRes.ok) {
        const liveJson = await liveRes.json() as { response: AFFixtureDetail[]; errors: unknown };
        const liveF = liveJson.response?.[0];
        if (!hasBodyErrors(liveJson.errors) && liveF) f = liveF;
      }
    }

    const homeId = String(f.teams.home.id);
    const compCode = LEAGUE_ID_TO_CODE[f.league.id] ?? '';
    const compType = CUP_CODES.has(compCode) ? 'CUP' : 'LEAGUE';

    const events: MatchEvent[] = (f.events ?? []).flatMap((e): MatchEvent[] => {
      const min  = e.time.extra ? `${e.time.elapsed}+${e.time.extra}` : String(e.time.elapsed);
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
      if (e.type === 'Var') return [{ min, type: 'var', team, player, detail: e.detail }];
      return [];
    });

    return { fixture: f, events, compCode, compType };
  } catch { return null; }
}

// ── Fetch stats ───────────────────────────────────────────────────────────────

async function fetchStats(matchId: string, homeId: string, isLive: boolean, isFinished = false): Promise<MatchStats | null> {
  try {
    // Live matches: stats (possession, shots, etc.) change minute to minute,
    // so use the short TTL once we already know the match is in progress
    // (status comes from fetchFixture, which runs first in fetchMatchDetail).
    // Finished matches: stats are immutable → week-long window.
    const ttl = isLive ? AF_LIVE_TTL_SECONDS : isFinished ? AF_STABLE_TTL_SECONDS : undefined;
    const res  = await fetchAF(`/fixtures/statistics?fixture=${matchId}`, ttl);
    if (!res.ok) return null;
    const json = await res.json() as { response: AFTeamStats[]; errors: unknown };
    if (hasBodyErrors(json.errors)) return null;
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
    return {
      possession:    [normHome, 100 - normHome],
      shots:         [getStat(homeEntry, 'Total Shots'),   getStat(awayEntry, 'Total Shots')],
      shotsOnTarget: [getStat(homeEntry, 'Shots on Goal'), getStat(awayEntry, 'Shots on Goal')],
      xG:            [getStat(homeEntry, 'expected_goals'), getStat(awayEntry, 'expected_goals')],
      corners:       [getStat(homeEntry, 'Corner Kicks'),  getStat(awayEntry, 'Corner Kicks')],
      fouls:         [getStat(homeEntry, 'Fouls'),         getStat(awayEntry, 'Fouls')],
    };
  } catch { return null; }
}

// ── Fetch H2H ─────────────────────────────────────────────────────────────────

async function fetchH2H(homeId: string, awayId: string): Promise<MatchDetailData['h2h']> {
  try {
    // H2H history is past results — immutable. Use stable 7-day TTL.
    const res  = await fetchAF(`/fixtures/headtohead?h2h=${homeId}-${awayId}`, AF_STABLE_TTL_SECONDS);
    if (!res.ok) return null;
    const data = await res.json() as { response: AFH2HMatch[]; errors: unknown };
    if (hasBodyErrors(data.errors)) return null;
    const finished = (data.response ?? [])
      .filter(m => ['FT', 'AET', 'PEN'].includes(m.fixture.status.short))
      .sort((a, b) => b.fixture.date.localeCompare(a.fixture.date))
      .slice(0, 5);
    let homeWins = 0, draws = 0, awayWins = 0, totalGoals = 0;
    for (const m of finished) {
      const hScore = m.goals.home; const aScore = m.goals.away;
      if (hScore === null || aScore === null) continue;
      totalGoals += hScore + aScore;
      if (hScore === aScore) { draws++; }
      else {
        const homeWon = hScore > aScore
          ? String(m.teams.home.id) === homeId
          : String(m.teams.away.id) === homeId;
        if (homeWon) homeWins++; else awayWins++;
      }
    }
    return {
      homeWins, draws, awayWins, totalGoals,
      recent: finished.map(m => ({
        id: String(m.fixture.id), date: m.fixture.date.slice(0, 10),
        homeTeam: m.teams.home.name, homeScore: m.goals.home, homeCrest: m.teams.home.logo,
        awayTeam: m.teams.away.name, awayScore: m.goals.away, awayCrest: m.teams.away.logo,
      })),
    };
  } catch { return null; }
}

// ── Fetch standings ───────────────────────────────────────────────────────────

async function fetchStandings(compCode: string, ttlSeconds?: number): Promise<StandingRow[]> {
  if (CUP_CODES.has(compCode)) return [];
  const leagueId = COMP_CODE_TO_LEAGUE_ID[compCode];
  if (!leagueId) return [];
  for (let offset = 0; offset <= 2; offset++) {
    const season = currentSeason() - offset;
    try {
      const res  = await fetchAF(`/standings?league=${leagueId}&season=${season}`, ttlSeconds);
      if (!res.ok) continue;
      const data = await res.json() as {
        response: Array<{ league: { standings: AFStandingsEntry[][] } }>; errors: unknown;
      };
      if (hasBodyErrors(data.errors)) {
        const msg = JSON.stringify(data.errors);
        if (msg.includes('plan') || msg.includes('season')) continue;
        return [];
      }
      const table = data.response?.[0]?.league?.standings?.[0] ?? [];
      if (table.length === 0) continue;
      return table.map(r => ({
        position: r.rank, teamId: String(r.team.id), teamName: r.team.name,
        teamShort: r.team.name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase(),
        teamCrest: r.team.logo, played: r.all.played, won: r.all.win, draw: r.all.draw,
        lost: r.all.lose, goalsFor: r.all.goals.for, goalsAgainst: r.all.goals.against,
        goalDifference: r.goalsDiff, points: r.points, form: r.form ?? null,
      }));
    } catch { continue; }
  }
  return [];
}

// ── Related fixtures (for "More in [Competition]" rail) ───────────────────────

export interface RelatedFixture {
  id: string;
  utcDate: string;
  status: string;
  homeTeam: { id: string; name: string; short: string; crest: string; score: number | null };
  awayTeam: { id: string; name: string; short: string; crest: string; score: number | null };
}

type AFFixtureRow = {
  fixture: { id: number; date: string; status: { short: string } };
  teams:   { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } };
  goals:   { home: number | null; away: number | null };
};

function mapFixtureRows(rows: AFFixtureRow[], excludeMatchId: string, limit: number): RelatedFixture[] {
  return rows
    .filter(f => String(f.fixture.id) !== excludeMatchId)
    .slice(0, limit)
    .map(f => ({
      id:       String(f.fixture.id),
      utcDate:  f.fixture.date,
      status:   mapStatus(f.fixture.status.short),
      homeTeam: { id: String(f.teams.home.id), name: f.teams.home.name, short: toShort(f.teams.home.name), crest: f.teams.home.logo, score: f.goals.home },
      awayTeam: { id: String(f.teams.away.id), name: f.teams.away.name, short: toShort(f.teams.away.name), crest: f.teams.away.logo, score: f.goals.away },
    }));
}

export async function fetchRelatedFixtures(
  compCode: string,
  excludeMatchId: string,
  limit = 4,
): Promise<RelatedFixture[]> {
  const leagueId = COMP_CODE_TO_LEAGUE_ID[compCode];
  if (!leagueId) return [];
  try {
    const season = currentSeason();
    // Try upcoming first; fall back to recent results if season is over.
    // Use AF_TEAM_FIXTURES_TTL_SECONDS (6h): fixture schedules change at most daily.
    const [nextRes, lastRes] = await Promise.all([
      fetchAF(`/fixtures?league=${leagueId}&season=${season}&next=10`, AF_TEAM_FIXTURES_TTL_SECONDS),
      fetchAF(`/fixtures?league=${leagueId}&season=${season}&last=10`, AF_TEAM_FIXTURES_TTL_SECONDS),
    ]);

    const nextJson = nextRes.ok ? await nextRes.json() as { response: AFFixtureRow[] } : { response: [] };
    const upcoming = mapFixtureRows(nextJson.response ?? [], excludeMatchId, limit);
    if (upcoming.length > 0) return upcoming;

    const lastJson = lastRes.ok ? await lastRes.json() as { response: AFFixtureRow[] } : { response: [] };
    return mapFixtureRows((lastJson.response ?? []).reverse(), excludeMatchId, limit);
  } catch { return []; }
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function fetchMatchDetail(matchId: string): Promise<MatchDetailData | null> {
  // Behavioral rate limit: deny enumeration scrapers before spending any
  // api-football quota. Over-limit looks identical to "match not found" (→ 404).
  if (await isRateLimited()) return null;
  // Hard daily ceiling on the shared api-football quota.
  if (await isDailyBudgetExhausted()) return null;

  const fixtureData = await fetchFixture(matchId);
  if (!fixtureData) return null;

  const { fixture: f, events, compCode, compType } = fixtureData;
  const homeId = String(f.teams.home.id);
  const awayId = String(f.teams.away.id);
  const isLive = isLiveStatus(f.fixture.status.short);
  const isFinished = FINISHED_SHORTS.has(f.fixture.status.short);

  // Match in/near its window → the league table is actively changing; read
  // standings at the hot TTL instead of the idle hour (adaptive freshness).
  const kickMs = Date.parse(f.fixture.date);
  const inWindow = isLive ||
    (Number.isFinite(kickMs) && Date.now() - kickMs > 0 && Date.now() - kickMs < 4 * 3_600_000);

  const [stats, h2h, standings] = await Promise.all([
    fetchStats(matchId, homeId, isLive, isFinished),
    fetchH2H(homeId, awayId),
    compType === 'LEAGUE'
      ? fetchStandings(compCode, inWindow ? AF_HOT_TTL_SECONDS : undefined)
      : Promise.resolve([] as StandingRow[]),
  ]);

  const status = mapStatus(f.fixture.status.short);
  const round  = f.league.round ?? null;

  return {
    id:          matchId,
    status,
    minute:      f.fixture.status.elapsed ?? null,
    kickoff:     f.fixture.date,
    competition: f.league.name,
    compCountry: f.league.country,
    compCode,
    compType,
    matchday:    parseMatchday(round),
    stage:       parseStage(round),
    venue:       f.fixture.venue?.name ? [f.fixture.venue.name, f.fixture.venue.city].filter(Boolean).join(', ') : null,
    referee:     f.fixture.referee ?? null,
    halfTime:    { home: f.score.halftime.home, away: f.score.halftime.away },
    home: {
      id:      homeId, name: f.teams.home.name,
      short:   toShort(f.teams.home.name), initial: toInitial(f.teams.home.name),
      color:   '#3a3a48', crest: f.teams.home.logo, score: f.goals.home,
    },
    away: {
      id:      awayId, name: f.teams.away.name,
      short:   toShort(f.teams.away.name), initial: toInitial(f.teams.away.name),
      color:   '#3a3a48', crest: f.teams.away.logo, score: f.goals.away,
    },
    events, stats, h2h, standings,
  };
}
