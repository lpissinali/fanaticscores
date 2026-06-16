/**
 * Lightweight data fetchers for OpenGraph images.
 *
 * Why this exists:
 * Each detail page's `opengraph-image.tsx` renders in its OWN request, separate
 * from the page itself. Calling the full fetchMatchDetail / fetchTeamDetail /
 * fetchCompetitionDetail there re-runs the entire fan-out (stats, H2H,
 * standings, squads, season-event aggregation…) a SECOND time just to draw a
 * card with a score and a couple of crests. The OG card only needs a handful of
 * fields, all available from one or two cheap endpoints. These helpers fetch
 * exactly that, sharing the same Firestore cache, rate limiter and daily-budget
 * guard as the main path.
 *
 * Worst case before: a World Cup competition OG image triggered the full
 * multi-group recompute (~1 season fetch + one /fixtures/events call per played
 * match — dozens of calls) to show 3 team names. After: 2 calls (/leagues +
 * /standings). Match OG: 1 call instead of 4–6. Team OG: 1 call instead of 4.
 */

import {
  fetchAF, hasBodyErrors, currentSeason,
  COMP_CODE_TO_LEAGUE_ID, AF_STABLE_TTL_SECONDS, AF_LIVE_TTL_SECONDS,
} from './config';
import { isRateLimited } from './rateLimit';
import { isDailyBudgetExhausted } from './dailyBudget';

// ── Match ───────────────────────────────────────────────────────────────────

export interface MatchOG {
  competition: string;
  status: 'LIVE' | 'HT' | 'FT' | 'OTHER';
  minute: number | null;
  home: { name: string; crest: string; score: number | null };
  away: { name: string; crest: string; score: number | null };
  venue: string | null;
}

interface AFFixtureLite {
  fixture: {
    date: string;
    venue: { name: string | null; city: string | null } | null;
    status: { short: string; elapsed: number | null };
  };
  league: { name: string };
  teams: { home: { name: string; logo: string }; away: { name: string; logo: string } };
  goals: { home: number | null; away: number | null };
}

const LIVE_SHORTS = new Set(['1H', '2H', 'ET', 'BT', 'P', 'HT']);
const FINISHED_SHORTS = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);

function ogStatus(short: string): MatchOG['status'] {
  if (short === 'HT') return 'HT';
  if (LIVE_SHORTS.has(short)) return 'LIVE';
  if (FINISHED_SHORTS.has(short)) return 'FT';
  return 'OTHER';
}

export async function fetchMatchOG(matchId: string): Promise<MatchOG | null> {
  if (await isRateLimited()) return null;
  if (await isDailyBudgetExhausted()) return null;
  try {
    const path = `/fixtures?id=${matchId}`;
    const res = await fetchAF(path, AF_STABLE_TTL_SECONDS);
    if (!res.ok) return null;
    const json = await res.json() as { response: AFFixtureLite[]; errors: unknown };
    if (hasBodyErrors(json.errors)) return null;
    let f = json.response?.[0];
    if (!f) return null;

    // If the match is live, re-read at the short TTL so the OG score/minute
    // isn't up to a week stale (shares the same cache entry as the page).
    if (LIVE_SHORTS.has(f.fixture.status.short)) {
      const live = await fetchAF(path, AF_LIVE_TTL_SECONDS);
      if (live.ok) {
        const lj = await live.json() as { response: AFFixtureLite[]; errors: unknown };
        if (!hasBodyErrors(lj.errors) && lj.response?.[0]) f = lj.response[0];
      }
    }

    const short = f.fixture.status.short;
    return {
      competition: f.league.name,
      status: ogStatus(short),
      minute: short !== 'HT' && LIVE_SHORTS.has(short) ? f.fixture.status.elapsed : null,
      home: { name: f.teams.home.name, crest: f.teams.home.logo, score: f.goals.home },
      away: { name: f.teams.away.name, crest: f.teams.away.logo, score: f.goals.away },
      venue: f.fixture.venue?.name
        ? [f.fixture.venue.name, f.fixture.venue.city].filter(Boolean).join(', ')
        : null,
    };
  } catch { return null; }
}

// ── Team ────────────────────────────────────────────────────────────────────

export interface TeamOG {
  name: string;
  crest: string;
  founded: number | null;
  venue: string | null;
}

interface AFTeamLite {
  team: { name: string; logo: string; founded: number | null };
  venue: { name: string | null } | null;
}

export async function fetchTeamOG(teamId: string): Promise<TeamOG | null> {
  if (await isRateLimited()) return null;
  if (await isDailyBudgetExhausted()) return null;
  try {
    // Team identity only — the OG card doesn't need the squad or fixtures the
    // full team page fetches, so this is one call instead of four.
    const res = await fetchAF(`/teams?id=${teamId}`, AF_STABLE_TTL_SECONDS);
    if (!res.ok) return null;
    const json = await res.json() as { response: AFTeamLite[]; errors: unknown };
    if (hasBodyErrors(json.errors)) return null;
    const e = json.response?.[0];
    if (!e) return null;
    return {
      name: e.team.name,
      crest: e.team.logo,
      founded: e.team.founded ?? null,
      venue: e.venue?.name ?? null,
    };
  } catch { return null; }
}

// ── Competition ───────────────────────────────────────────────────────────────

export interface CompetitionOG {
  name: string;
  emblem: string | null;
  area: string | null;
  season: { start: string; end: string } | null;
  topTeams: { teamShort: string; teamName: string; teamCrest: string; points: number }[];
}

interface AFLeagueLite {
  league: { name: string; logo: string };
  country: { name: string };
  seasons: { year: number; start: string; end: string; current: boolean }[];
}

interface AFStandingLite {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
}

export async function fetchCompetitionOG(code: string): Promise<CompetitionOG | null> {
  const leagueId = COMP_CODE_TO_LEAGUE_ID[code];
  if (!leagueId) return null;
  if (await isRateLimited()) return null;
  if (await isDailyBudgetExhausted()) return null;
  try {
    const res = await fetchAF(`/leagues?id=${leagueId}`);
    if (!res.ok) return null;
    const json = await res.json() as { response: AFLeagueLite[]; errors: unknown };
    if (hasBodyErrors(json.errors)) return null;
    const entry = json.response?.[0];
    if (!entry) return null;
    const season = entry.seasons.find(s => s.current) ?? entry.seasons.at(-1) ?? null;

    // Top 3 for context — a single standings call at the current season. The
    // OG doesn't need the full recompute/event aggregation the page does; any
    // miss just yields no topTeams and the card still renders name/area/season.
    let topTeams: CompetitionOG['topTeams'] = [];
    const seasonYear = season ? Number(season.start.slice(0, 4)) : currentSeason();
    const stRes = await fetchAF(`/standings?league=${leagueId}&season=${seasonYear}`);
    if (stRes.ok) {
      const stJson = await stRes.json() as {
        response: Array<{ league: { standings: AFStandingLite[][] } }>;
        errors: unknown;
      };
      if (!hasBodyErrors(stJson.errors)) {
        const table = stJson.response?.[0]?.league?.standings?.[0] ?? [];
        topTeams = table.slice(0, 3).map(r => ({
          teamShort: r.team.name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase(),
          teamName: r.team.name,
          teamCrest: r.team.logo,
          points: r.points,
        }));
      }
    }

    return {
      name: entry.league.name,
      emblem: entry.league.logo ?? null,
      area: entry.country.name ?? null,
      season: season ? { start: season.start, end: season.end } : null,
      topTeams,
    };
  } catch { return null; }
}
