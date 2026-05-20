/* ============================================================
   Match details API -- head2head + standings
   NOTE: GET /v4/matches/{id} is 403 on the free tier.
   Basic match data comes from the in-memory match cache
   (populated by the home-page fetch). H2H and standings
   are fetched once and cached in localStorage for 12 h.
   ============================================================ */

import type { MatchStatus } from '../types';
import { getCachedMatch } from '../matchCache';
import { cacheGet, cacheSet } from '../apiCache';

const BASE = '/api/fd';
const H2H_TTL       = 12 * 60 * 60 * 1000;  // 12 h -- historical data
const STANDINGS_TTL = 12 * 60 * 60 * 1000;  // 12 h -- updates once per matchday

// ── Raw API types ────────────────────────────────────────────────────────────

interface FDTeamRef { id: number; name: string; shortName: string; tla: string; crest: string; }
interface FDScore {
  winner: string | null; duration: string;
  fullTime: { home: number | null; away: number | null };
  halfTime:  { home: number | null; away: number | null };
}
interface FDH2HMatch {
  id: number; utcDate: string; status: string;
  homeTeam: FDTeamRef; awayTeam: FDTeamRef; score: FDScore;
}
interface FDStandingRow {
  position: number;
  team: FDTeamRef;
  playedGames: number; won: number; draw: number; lost: number;
  points: number; goalsFor: number; goalsAgainst: number; goalDifference: number;
  form: string | null;
}

// ── Public types ─────────────────────────────────────────────────────────────

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
  home: { id: string; name: string; short: string; initial: string; color: string; crest?: string; score: number | null; };
  away: { id: string; name: string; short: string; initial: string; color: string; crest?: string; score: number | null; };
  h2h: { homeWins: number; draws: number; awayWins: number; totalGoals: number; recent: H2HMatch[]; } | null;
  standings: StandingRow[];
}

// ── Fetch head2head (cached 12 h) ─────────────────────────────────────────────

type H2HResult = { homeWins: number; draws: number; awayWins: number; totalGoals: number; recent: H2HMatch[]; } | null;

async function fetchWithRetry(url: string, retries = 2, delayMs = 3000): Promise<Response> {
  const res = await fetch(url);
  if (res.status === 429 && retries > 0) {
    console.warn(`[matchDetails] 429 rate limit on ${url} — retrying in ${delayMs}ms`);
    await new Promise(r => setTimeout(r, delayMs));
    return fetchWithRetry(url, retries - 1, delayMs * 2);
  }
  return res;
}

async function fetchH2H(matchId: string, homeId: string, awayId: string): Promise<H2HResult> {
  const key = `h2h:${matchId}`;
  const hit = cacheGet<H2HResult>(key);
  if (hit !== null) return hit;

  try {
    const res = await fetchWithRetry(`${BASE}/matches/${matchId}/head2head?limit=5`);
    if (!res.ok) {
      console.warn(`[matchDetails] H2H fetch failed: ${res.status}`);
      return null;
    }
    const data = await res.json() as { matches: FDH2HMatch[] };
    const matches = (data.matches ?? []).slice(0, 5);

    console.log('[H2H] homeId:', homeId, 'awayId:', awayId);
    console.log('[H2H] matches:', matches.map(m => ({
      homeTeamId: m.homeTeam.id, awayTeamId: m.awayTeam.id,
      score: `${m.score.fullTime.home}-${m.score.fullTime.away}`,
    })));

    // Derive wins/draws from match results rather than aggregates (free-tier aggregates
    // are unreliable). Compare each match's winner against the current match's team IDs.
    let homeWins = 0, draws = 0, awayWins = 0, totalGoals = 0;
    for (const m of matches) {
      const hScore = m.score.fullTime.home;
      const aScore = m.score.fullTime.away;
      if (hScore === null || aScore === null) continue;
      totalGoals += hScore + aScore;
      if (hScore === aScore) {
        draws++;
      } else {
        const winnerId = String(hScore > aScore ? m.homeTeam.id : m.awayTeam.id);
        if (winnerId === homeId)      homeWins++;
        else if (winnerId === awayId) awayWins++;
      }
    }

    const result: H2HResult = {
      homeWins, draws, awayWins, totalGoals,
      recent: matches.map(m => ({
        id:        String(m.id),
        date:      m.utcDate.slice(0, 10),
        homeTeam:  m.homeTeam.shortName || m.homeTeam.name,
        homeScore: m.score.fullTime.home,
        homeCrest: m.homeTeam.crest,
        awayTeam:  m.awayTeam.shortName || m.awayTeam.name,
        awayScore: m.score.fullTime.away,
        awayCrest: m.awayTeam.crest,
      })),
    };
    cacheSet(key, result, H2H_TTL);
    return result;
  } catch { return null; }
}

// ── Fetch standings (cached 12 h) ─────────────────────────────────────────────

async function fetchStandings(compCode: string): Promise<StandingRow[]> {
  const key = `standings:${compCode}`;
  const hit = cacheGet<StandingRow[]>(key);
  if (hit !== null) return hit;

  try {
    const res = await fetchWithRetry(`${BASE}/competitions/${compCode}/standings`);
    if (!res.ok) {
      console.warn(`[matchDetails] standings fetch failed: ${res.status} for ${compCode}`);
      return [];
    }
    const data = await res.json() as { standings: { type: string; table: FDStandingRow[] }[] };
    const total = data.standings.find(s => s.type === 'TOTAL') ?? data.standings[0];
    if (!total) return [];
    const rows: StandingRow[] = total.table.map(r => ({
      position:       r.position,
      teamId:         String(r.team.id),
      teamName:       r.team.shortName || r.team.name,
      teamShort:      r.team.tla || (r.team.shortName || r.team.name).slice(0, 3).toUpperCase(),
      teamCrest:      r.team.crest,
      played:         r.playedGames,
      won:            r.won,
      draw:           r.draw,
      lost:           r.lost,
      goalsFor:       r.goalsFor,
      goalsAgainst:   r.goalsAgainst,
      goalDifference: r.goalDifference,
      points:         r.points,
      form:           r.form ?? null,
    }));
    cacheSet(key, rows, STANDINGS_TTL);
    return rows;
  } catch { return []; }
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function fetchMatchDetail(matchId: string): Promise<MatchDetailData | null> {
  const cached = getCachedMatch(matchId);
  if (!cached) return null;

  const { match, competition, compCountry, compCode, compType } = cached;

  const [h2h, standings] = await Promise.all([
    fetchH2H(matchId, match.home.id ?? '', match.away.id ?? ''),
    compType === 'LEAGUE' ? fetchStandings(compCode) : Promise.resolve([] as StandingRow[]),
  ]);

  return {
    id:          match.id,
    status:      match.status,
    minute:      match.minute ?? null,
    kickoff:     match.kickoff ?? '',
    competition,
    compCountry,
    compCode,
    compType,
    matchday:    null,
    stage:       null,
    venue:       null,
    referee:     null,
    halfTime:    { home: null, away: null },
    home: {
      id:      match.home.id ?? '',
      name:    match.home.name,
      short:   match.home.short,
      initial: match.home.initial,
      color:   match.home.color,
      crest:   match.home.crest,
      score:   match.home.score,
    },
    away: {
      id:      match.away.id ?? '',
      name:    match.away.name,
      short:   match.away.short,
      initial: match.away.initial,
      color:   match.away.color,
      crest:   match.away.crest,
      score:   match.away.score,
    },
    h2h,
    standings,
  };
}
