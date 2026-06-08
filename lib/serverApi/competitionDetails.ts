/**
 * Server-side competition details fetching.
 * Calls api-football directly — no browser caches, no proxy.
 * Used by the /en/competition/[compCode] Server Component.
 */

import { fetchAF, hasBodyErrors, currentSeason, COMP_CODE_TO_LEAGUE_ID, CUP_CODES } from './config';
import { isRateLimited } from './rateLimit';

// ── Public types (mirrors src/lib/api/competitionDetails.ts) ─────────────────

export interface CompInfo {
  id: number; code: string; name: string; type: string; emblem: string | null;
  area: { name: string; code: string; flag: string | null };
  season: {
    startDate: string; endDate: string;
    currentMatchday: number | null;
    winner: { name: string; crest: string | null } | null;
  } | null;
}

export interface CompStandingRow {
  position: number; teamId: string; teamName: string; teamShort: string; teamCrest: string;
  played: number; won: number; draw: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number;
  points: number; form: string | null;
}

export interface CompStandingGroup { name: string; rows: CompStandingRow[]; }

export interface CompScorer {
  playerName: string; nationality: string; teamName: string; teamShort: string;
  teamCrest: string; goals: number; assists: number | null;
  penalties: number | null; playedMatches: number;
}

export interface CompFixture {
  id: number; utcDate: string; status: string; round: string | null;
  homeTeam: { id: number; name: string; crest: string; score: number | null };
  awayTeam: { id: number; name: string; crest: string; score: number | null };
}

export interface CompetitionDetailData {
  info: CompInfo;
  standingGroups: CompStandingGroup[];
  scorers: CompScorer[];
  upcomingFixtures: CompFixture[];
  recentResults: CompFixture[];
}

// ── Raw API types ─────────────────────────────────────────────────────────────

interface AFLeagueSeason { year: number; start: string; end: string; current: boolean; }
interface AFLeagueEntry {
  league: { id: number; name: string; type: string; logo: string };
  country: { name: string; code: string | null; flag: string | null };
  seasons: AFLeagueSeason[];
}
interface AFStandingsEntry {
  rank: number; group: string | null;
  team: { id: number; name: string; logo: string };
  points: number; goalsDiff: number; form: string | null;
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
}
interface AFScorer {
  player: { id: number; name: string; nationality: string };
  statistics: Array<{
    team: { id: number; name: string; logo: string };
    goals: { total: number | null; assists: number | null };
    penalty: { scored: number | null };
    games: { appearences: number | null };
  }>;
}
interface AFFixtureRaw {
  fixture: { id: number; date: string; status: { short: string } };
  league: { round: string | null };
  teams: { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } };
  goals: { home: number | null; away: number | null };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseMatchday(round: string | null | undefined): number | null {
  if (!round) return null;
  const m = round.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

function toShort(name: string) {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
}

function mapFixture(f: AFFixtureRaw): CompFixture {
  return {
    id: f.fixture.id, utcDate: f.fixture.date,
    status: f.fixture.status.short, round: f.league.round ?? null,
    homeTeam: { id: f.teams.home.id, name: f.teams.home.name, crest: f.teams.home.logo, score: f.goals.home },
    awayTeam: { id: f.teams.away.id, name: f.teams.away.name, crest: f.teams.away.logo, score: f.goals.away },
  };
}

// ── Individual fetchers ───────────────────────────────────────────────────────

async function fetchCompInfo(code: string, leagueId: number): Promise<CompInfo | null> {
  try {
    const res  = await fetchAF(`/leagues?id=${leagueId}`);
    if (!res.ok) return null;
    const json = await res.json() as { response: AFLeagueEntry[]; errors: unknown };
    if (hasBodyErrors(json.errors)) return null;
    const entry  = json.response?.[0];
    if (!entry) return null;
    const season = entry.seasons.find(s => s.current) ?? entry.seasons.at(-1) ?? null;
    return {
      id: entry.league.id, code, name: entry.league.name,
      type: entry.league.type === 'Cup' ? 'CUP' : 'LEAGUE',
      emblem: entry.league.logo ?? null,
      area: { name: entry.country.name, code: entry.country.code ?? '', flag: entry.country.flag ?? null },
      season: season ? { startDate: season.start, endDate: season.end, currentMatchday: null, winner: null } : null,
    };
  } catch { return null; }
}

interface StandingsFetch {
  groups: CompStandingGroup[];
  currentMatchday: number | null;
  winner: { name: string; crest: string | null } | null;
}

async function fetchStandingsForSeason(leagueId: number, season: number): Promise<StandingsFetch | 'plan_error' | null> {
  try {
    const res  = await fetchAF(`/standings?league=${leagueId}&season=${season}`);
    if (!res.ok) return null;
    const data = await res.json() as {
      response: Array<{ league: { round: string | null; standings: AFStandingsEntry[][] } }>;
      errors: unknown;
    };
    if (hasBodyErrors(data.errors)) {
      const msg = JSON.stringify(data.errors);
      if (msg.includes('plan') || msg.includes('season') || msg.includes('subscription')) return 'plan_error';
      return null;
    }
    const league = data.response?.[0]?.league;
    if (!league) return null;
    const allTables = league.standings ?? [];
    if (allTables.length === 0 || allTables[0].length === 0) return null;

    const groups: CompStandingGroup[] = allTables.map(table => ({
      name: table[0]?.group ?? '',
      rows: table.map((r): CompStandingRow => ({
        position: r.rank, teamId: String(r.team.id), teamName: r.team.name,
        teamShort: toShort(r.team.name), teamCrest: r.team.logo,
        played: r.all.played, won: r.all.win, draw: r.all.draw, lost: r.all.lose,
        goalsFor: r.all.goals.for, goalsAgainst: r.all.goals.against,
        goalDifference: r.goalsDiff, points: r.points, form: r.form ?? null,
      })),
    }));

    const champion = allTables[0].find(r => r.rank === 1) ?? null;
    return {
      groups,
      currentMatchday: parseMatchday(league.round),
      winner: champion ? { name: champion.team.name, crest: champion.team.logo } : null,
    };
  } catch { return null; }
}

async function fetchStandings(code: string, leagueId: number): Promise<StandingsFetch> {
  const empty: StandingsFetch = { groups: [], currentMatchday: null, winner: null };

  const calendarYear = new Date().getFullYear();
  const baseSeason   = currentSeason();
  const seasons = [...new Set([calendarYear, baseSeason, ...Array.from({ length: 5 }, (_, i) => baseSeason - i - 1)])];

  for (const season of seasons) {
    const result = await fetchStandingsForSeason(leagueId, season);
    if (result === 'plan_error') continue;
    if (result === null) continue;
    return result;
  }
  return empty;
}

async function fetchScorers(leagueId: number, season: number): Promise<CompScorer[]> {
  try {
    const res  = await fetchAF(`/players/topscorers?league=${leagueId}&season=${season}`);
    if (!res.ok) return [];
    const json = await res.json() as { response: AFScorer[]; errors: unknown };
    if (hasBodyErrors(json.errors)) return [];
    return (json.response ?? []).map(s => {
      const stats    = s.statistics[0];
      const teamName = stats?.team.name ?? '';
      return {
        playerName: s.player.name, nationality: s.player.nationality,
        teamName, teamShort: toShort(teamName), teamCrest: stats?.team.logo ?? '',
        goals: stats?.goals.total ?? 0, assists: stats?.goals.assists ?? null,
        penalties: stats?.penalty.scored ?? null, playedMatches: stats?.games.appearences ?? 0,
      };
    });
  } catch { return []; }
}

async function fetchFixtures(leagueId: number, season: number, isCup = false): Promise<{ upcoming: CompFixture[]; recent: CompFixture[] }> {
  const limit = isCup ? 10 : 5;
  try {
    const [upRes, reRes] = await Promise.all([
      fetchAF(`/fixtures?league=${leagueId}&season=${season}&next=${limit}`),
      fetchAF(`/fixtures?league=${leagueId}&season=${season}&last=${limit}`),
    ]);
    const upJson = upRes.ok ? await upRes.json() as { response: AFFixtureRaw[] } : { response: [] };
    const reJson = reRes.ok ? await reRes.json() as { response: AFFixtureRaw[] } : { response: [] };
    return {
      upcoming: (upJson.response ?? []).map(mapFixture),
      recent:   (reJson.response ?? []).reverse().map(mapFixture),
    };
  } catch { return { upcoming: [], recent: [] }; }
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function fetchCompetitionDetail(code: string): Promise<CompetitionDetailData | null> {
  const leagueId = COMP_CODE_TO_LEAGUE_ID[code];
  if (!leagueId) return null;

  // Behavioral rate limit: deny enumeration scrapers before spending any
  // api-football quota. Over-limit looks identical to "competition not found".
  if (await isRateLimited()) return null;

  // Run info + standings in parallel; standings already tries multiple season years.
  // Then use the season year that api-football marks as current for scorers/fixtures.
  const [info, standingsFetch] = await Promise.all([
    fetchCompInfo(code, leagueId),
    fetchStandings(code, leagueId),
  ]);

  if (!info) return null;

  // Derive season year from api-football's own current-season marker so each
  // competition gets the right year automatically (WC→2026, CL→2025, EURO→2024…).
  const seasonYear = info.season?.startDate
    ? parseInt(info.season.startDate.slice(0, 4), 10)
    : currentSeason();

  const [scorers, fixtures] = await Promise.all([
    fetchScorers(leagueId, seasonYear),
    fetchFixtures(leagueId, seasonYear, CUP_CODES.has(code)),
  ]);

  if (info.season) {
    info.season.currentMatchday = standingsFetch.currentMatchday;
    const topRow    = standingsFetch.groups[0]?.rows[0];
    const seasonOver = topRow && topRow.played >= 34;
    if (seasonOver) info.season.winner = standingsFetch.winner;
  }

  return {
    info, standingGroups: standingsFetch.groups,
    scorers, upcomingFixtures: fixtures.upcoming, recentResults: fixtures.recent,
  };
}
