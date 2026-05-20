/* ============================================================
   Competition details API
   Fetches info, standings and top scorers for a given comp code.
   All responses cached in localStorage (12 h for standings/info,
   1 h for scorers so goal tallies stay fresh).
   ============================================================ */

import { cacheGet, cacheSet } from '../apiCache';

const BASE    = '/api/fd';
const TTL_12H =  12 * 60 * 60 * 1000;
const TTL_1H  =       60 * 60 * 1000;

// ── Raw API shapes ────────────────────────────────────────────────────────────

interface FDArea { id: number; name: string; code: string; flag: string | null; }

interface FDSeason {
  id: number;
  startDate: string;
  endDate: string;
  currentMatchday: number | null;
  winner: { id: number; name: string; crest: string | null; } | null;
}

interface FDCompetition {
  id: number;
  area: FDArea;
  name: string;
  code: string;
  type: string;
  emblem: string | null;
  currentSeason: FDSeason | null;
}

interface FDStandingRow {
  position: number;
  team: { id: number; name: string; shortName: string; tla: string; crest: string; };
  playedGames: number;
  won: number; draw: number; lost: number;
  points: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number;
  form: string | null;
}

interface FDScorer {
  player: { id: number; name: string; nationality: string; };
  team: { id: number; name: string; shortName: string; crest: string; };
  playedMatches: number;
  goals: number;
  assists: number | null;
  penalties: number | null;
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

export interface CompetitionDetailData {
  info: CompInfo;
  standings: CompStandingRow[];
  scorers: CompScorer[];
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, retries = 2, delayMs = 3000): Promise<Response> {
  const res = await fetch(url);
  if (res.status === 429 && retries > 0) {
    await new Promise(r => setTimeout(r, delayMs));
    return fetchWithRetry(url, retries - 1, delayMs * 2);
  }
  return res;
}

async function fetchCompInfo(code: string): Promise<CompInfo | null> {
  const key = `comp_info:${code}`;
  const hit = cacheGet<CompInfo>(key);
  if (hit) return hit;

  try {
    const res = await fetchWithRetry(`${BASE}/competitions/${code}`);
    if (!res.ok) return null;
    const d = await res.json() as FDCompetition;
    const info: CompInfo = {
      id:     d.id,
      code:   d.code,
      name:   d.name,
      type:   d.type,
      emblem: d.emblem ?? null,
      area:   { name: d.area.name, code: d.area.code, flag: d.area.flag ?? null },
      season: d.currentSeason ? {
        startDate:       d.currentSeason.startDate,
        endDate:         d.currentSeason.endDate,
        currentMatchday: d.currentSeason.currentMatchday,
        winner:          d.currentSeason.winner
          ? { name: d.currentSeason.winner.name, crest: d.currentSeason.winner.crest ?? null }
          : null,
      } : null,
    };
    cacheSet(key, info, TTL_12H);
    return info;
  } catch { return null; }
}

async function fetchCompStandings(code: string): Promise<CompStandingRow[]> {
  const key = `comp_standings:${code}`;
  const hit = cacheGet<CompStandingRow[]>(key);
  if (hit) return hit;

  try {
    const res = await fetchWithRetry(`${BASE}/competitions/${code}/standings`);
    if (!res.ok) return [];
    const d = await res.json() as { standings: { type: string; table: FDStandingRow[] }[] };
    const total = d.standings.find(s => s.type === 'TOTAL') ?? d.standings[0];
    if (!total) return [];
    const rows: CompStandingRow[] = total.table.map(r => ({
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
    cacheSet(key, rows, TTL_12H);
    return rows;
  } catch { return []; }
}

async function fetchCompScorers(code: string): Promise<CompScorer[]> {
  const key = `comp_scorers:${code}`;
  const hit = cacheGet<CompScorer[]>(key);
  if (hit) return hit;

  try {
    const res = await fetchWithRetry(`${BASE}/competitions/${code}/scorers?limit=20`);
    if (!res.ok) return [];
    const d = await res.json() as { scorers: FDScorer[] };
    const scorers: CompScorer[] = (d.scorers ?? []).map(s => ({
      playerName:   s.player.name,
      nationality:  s.player.nationality,
      teamName:     s.team.shortName || s.team.name,
      teamShort:    (s.team.shortName || s.team.name).slice(0, 3).toUpperCase(),
      teamCrest:    s.team.crest,
      goals:        s.goals,
      assists:      s.assists ?? null,
      penalties:    s.penalties ?? null,
      playedMatches: s.playedMatches,
    }));
    cacheSet(key, scorers, TTL_1H);
    return scorers;
  } catch { return []; }
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function fetchCompetitionDetail(code: string): Promise<CompetitionDetailData | null> {
  const info = await fetchCompInfo(code);
  if (!info) return null;

  const isLeague = info.type === 'LEAGUE' || info.type === 'LEAGUE_CUP';

  const [standings, scorers] = await Promise.all([
    isLeague ? fetchCompStandings(code) : Promise.resolve([] as CompStandingRow[]),
    fetchCompScorers(code),
  ]);

  return { info, standings, scorers };
}
