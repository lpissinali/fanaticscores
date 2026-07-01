/**
 * Server-side team detail fetching.
 * Calls api-football directly — no browser caches.
 */

import {
  fetchAF, hasBodyErrors, currentSeason, LEAGUE_ID_TO_CODE, CUP_CODES,
  AF_STABLE_TTL_SECONDS, AF_SLOW_TTL_SECONDS, AF_TEAM_FIXTURES_TTL_SECONDS,
} from './config';
import { isRateLimited } from './rateLimit';

// ── Public types ──────────────────────────────────────────────────────────────

export interface TeamPlayer {
  id: string; name: string;
  position: 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Forward' | 'Unknown';
  age: number | null;
}

export interface TeamMatch {
  id: string; utcDate: string; status: string;
  homeTeam: { id: string; name: string; crest: string; score: number | null };
  awayTeam: { id: string; name: string; crest: string; score: number | null };
  competition: string; compCode: string;
}

export interface RunningCompetition {
  id: string; name: string; code: string; type: string; emblem: string | null;
}

export interface TeamInfo {
  id: string; name: string; shortName: string; tla: string; crest: string;
  address: string | null; website: string | null; founded: number | null;
  clubColors: string | null; venue: string | null;
  coach: { name: string; nationality: string | null; contractUntil: string | null } | null;
  squad: TeamPlayer[];
  runningCompetitions: RunningCompetition[];
}

export interface TeamDetailData {
  info: TeamInfo;
  recentMatches: TeamMatch[];
  upcomingMatches: TeamMatch[];
}

// ── Raw API types ─────────────────────────────────────────────────────────────

interface AFTeam { id: number; name: string; code: string | null; country: string; founded: number | null; national: boolean; logo: string; }
interface AFVenue { id: number | null; name: string | null; address: string | null; city: string | null; capacity: number | null; surface: string | null; image: string | null; }
interface AFSquadPlayer { id: number; name: string; age: number | null; number: number | null; position: string | null; photo: string | null; }
interface AFFixture {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null } };
  league: { id: number; name: string; logo: string };
  teams: { home: { id: number; name: string; logo: string; winner: boolean | null }; away: { id: number; name: string; logo: string; winner: boolean | null } };
  goals: { home: number | null; away: number | null };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    case 'FT': case 'AET': case 'PEN': return 'FINISHED';
    case '1H': case '2H': case 'ET': case 'BT': case 'P': case 'HT': return 'IN_PLAY';
    case 'PST': return 'POSTPONED';
    case 'CANC': case 'ABD': case 'SUSP': case 'INT': return 'CANCELLED';
    default: return 'SCHEDULED';
  }
}

function mapFixture(f: AFFixture): TeamMatch {
  return {
    id: String(f.fixture.id), utcDate: f.fixture.date,
    status: mapFixtureStatus(f.fixture.status.short),
    homeTeam: { id: String(f.teams.home.id), name: f.teams.home.name, crest: f.teams.home.logo, score: f.goals.home },
    awayTeam: { id: String(f.teams.away.id), name: f.teams.away.name, crest: f.teams.away.logo, score: f.goals.away },
    competition: f.league.name, compCode: LEAGUE_ID_TO_CODE[f.league.id] ?? '',
  };
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchTeamInfo(teamId: string): Promise<{ team: AFTeam; venue: AFVenue | null } | null> {
  try {
    // Team identity (name, crest, venue) is effectively immutable → week-long
    // read freshness. Crawler re-visits cost a Firestore read, not 1 upstream.
    const res  = await fetchAF(`/teams?id=${teamId}`, AF_STABLE_TTL_SECONDS);
    if (!res.ok) return null;
    const json = await res.json() as { response: Array<{ team: AFTeam; venue: AFVenue }>; errors: unknown };
    if (hasBodyErrors(json.errors)) return null;
    const entry = json.response?.[0];
    return entry ? { team: entry.team, venue: entry.venue ?? null } : null;
  } catch { return null; }
}

async function fetchSquad(teamId: string): Promise<TeamPlayer[]> {
  try {
    // Squads change on transfers/injury-list updates — daily is plenty fresh.
    const res  = await fetchAF(`/players/squads?team=${teamId}`, AF_SLOW_TTL_SECONDS);
    if (!res.ok) return [];
    const json = await res.json() as { response: Array<{ players: AFSquadPlayer[] }>; errors: unknown };
    if (hasBodyErrors(json.errors)) return [];
    return (json.response?.[0]?.players ?? []).map(p => ({
      id: String(p.id), name: p.name, position: mapPosition(p.position), age: p.age ?? null,
    }));
  } catch { return []; }
}

async function fetchFixtures(teamId: string): Promise<{ recent: TeamMatch[]; upcoming: TeamMatch[] }> {
  try {
    // Fixture lists move only when a match finishes or gets (re)scheduled;
    // 6h staleness on a team page is an acceptable trade for crawl cost.
    const [lastRes, nextRes] = await Promise.all([
      fetchAF(`/fixtures?team=${teamId}&last=6`, AF_TEAM_FIXTURES_TTL_SECONDS),
      fetchAF(`/fixtures?team=${teamId}&next=5`, AF_TEAM_FIXTURES_TTL_SECONDS),
    ]);
    const recent: TeamMatch[] = [];
    const upcoming: TeamMatch[] = [];
    if (lastRes.ok) {
      const d = await lastRes.json() as { response: AFFixture[]; errors: unknown };
      if (!hasBodyErrors(d.errors)) {
        recent.push(...(d.response ?? []).sort((a, b) => b.fixture.date.localeCompare(a.fixture.date)).map(mapFixture));
      }
    }
    if (nextRes.ok) {
      const d = await nextRes.json() as { response: AFFixture[]; errors: unknown };
      if (!hasBodyErrors(d.errors)) {
        upcoming.push(...(d.response ?? []).sort((a, b) => a.fixture.date.localeCompare(b.fixture.date)).map(mapFixture));
      }
    }
    return { recent, upcoming };
  } catch { return { recent: [], upcoming: [] }; }
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function fetchTeamDetail(teamId: string): Promise<TeamDetailData | null> {
  // Behavioral rate limit: deny enumeration scrapers before spending any
  // api-football quota. Over-limit looks identical to "team not found" (→ 404).
  if (await isRateLimited()) return null;
  // No daily-budget gate: fetchAF serves stale cache when the quota trips (the
  // ceiling still holds — fetchAF makes no upstream call — but team pages stay
  // up for crawlers instead of 404ing).

  const [teamData, squad, fixtures] = await Promise.all([
    fetchTeamInfo(teamId),
    fetchSquad(teamId),
    fetchFixtures(teamId),
  ]);
  if (!teamData) return null;

  const { team, venue } = teamData;
  const addressParts = [venue?.address, venue?.city].filter(Boolean);

  // Derive running competitions from fixture data
  const seenLeagueIds = new Set<number>();
  const runningCompetitions: RunningCompetition[] = [];
  for (const m of [...fixtures.upcoming, ...fixtures.recent]) {
    if (!m.compCode || CUP_CODES.has(m.compCode)) continue;
    const leagueId = Number(Object.entries(LEAGUE_ID_TO_CODE).find(([, v]) => v === m.compCode)?.[0]);
    if (!leagueId || seenLeagueIds.has(leagueId)) continue;
    seenLeagueIds.add(leagueId);
    runningCompetitions.push({ id: String(leagueId), name: m.competition, code: m.compCode, type: 'LEAGUE', emblem: null });
  }

  const info: TeamInfo = {
    id: String(team.id), name: team.name, shortName: team.name,
    tla: team.code ?? team.name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase(),
    crest: team.logo, address: addressParts.length > 0 ? addressParts.join(', ') : null,
    website: null, founded: team.founded ?? null, clubColors: null,
    venue: venue?.name ?? null, coach: null, squad, runningCompetitions,
  };

  return { info, recentMatches: fixtures.recent, upcomingMatches: fixtures.upcoming };
}
