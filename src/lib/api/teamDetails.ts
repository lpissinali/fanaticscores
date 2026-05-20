/* ============================================================
   Team details API — football-data.org v4
   Fetches team info, squad, recent results & upcoming fixtures.
   Cached in localStorage: 6 h for info/squad, 30 min for matches.
   ============================================================ */

import { cacheGet, cacheSet } from '../apiCache';

const BASE      = '/api/fd';
const TTL_6H    =  6 * 60 * 60 * 1000;
const TTL_30MIN = 30 * 60 * 1000;

// ── Raw API shapes ────────────────────────────────────────────────────────────

interface FDRunningComp {
  id: number; name: string; code: string; type: string; emblem: string | null;
}

interface FDCoach {
  id: number | null;
  name: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  contract: { start: string | null; until: string | null; } | null;
}

interface FDPlayer {
  id: number;
  name: string;
  position: string | null;   // "Goalkeeper" | "Defence" | "Midfield" | "Offence" | null
  dateOfBirth: string | null;
  nationality: string | null;
}

interface FDTeamDetail {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  address: string | null;
  website: string | null;
  founded: number | null;
  clubColors: string | null;
  venue: string | null;
  runningCompetitions: FDRunningComp[];
  coach: FDCoach | null;
  squad: FDPlayer[];
  lastUpdated: string;
}

interface FDMatchTeam { id: number; name: string; shortName: string; tla: string; crest: string; }
interface FDMatchScore {
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
}
interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string | null;
  homeTeam: FDMatchTeam;
  awayTeam: FDMatchTeam;
  score: FDMatchScore;
  competition: { id: number; name: string; code: string; emblem: string | null; };
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

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now   = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function mapPosition(raw: string | null): TeamPlayer['position'] {
  switch (raw) {
    case 'Goalkeeper': return 'Goalkeeper';
    case 'Defence':    return 'Defender';
    case 'Midfield':   return 'Midfielder';
    case 'Offence':    return 'Forward';
    default:           return 'Unknown';
  }
}

function mapMatch(fd: FDMatch): TeamMatch {
  return {
    id:          String(fd.id),
    utcDate:     fd.utcDate,
    status:      fd.status,
    homeTeam: {
      id:    String(fd.homeTeam.id),
      name:  fd.homeTeam.shortName || fd.homeTeam.name,
      crest: fd.homeTeam.crest,
      score: fd.score.fullTime.home,
    },
    awayTeam: {
      id:    String(fd.awayTeam.id),
      name:  fd.awayTeam.shortName || fd.awayTeam.name,
      crest: fd.awayTeam.crest,
      score: fd.score.fullTime.away,
    },
    competition: fd.competition.name,
    compCode:    fd.competition.code,
  };
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchTeamInfo(teamId: string): Promise<TeamInfo | null> {
  const key = `team_info:${teamId}`;
  const hit = cacheGet<TeamInfo>(key);
  if (hit) return hit;

  try {
    const res = await fetchWithRetry(`${BASE}/teams/${teamId}`);
    if (!res.ok) return null;
    const d = await res.json() as FDTeamDetail;

    const info: TeamInfo = {
      id:        String(d.id),
      name:      d.name,
      shortName: d.shortName || d.name,
      tla:       d.tla,
      crest:     d.crest,
      address:   d.address
        ? (d.address.replace(/\bnull\b/g, '').replace(/\s{2,}/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').trim() || null)
        : null,
      website:   d.website ?? null,
      founded:   d.founded ?? null,
      clubColors: d.clubColors ?? null,
      venue:     d.venue ?? null,
      coach:     d.coach?.name
        ? { name: d.coach.name, nationality: d.coach.nationality ?? null, contractUntil: d.coach.contract?.until ?? null }
        : null,
      squad: (d.squad ?? []).map(p => ({
        id:          String(p.id),
        name:        p.name,
        position:    mapPosition(p.position),
        dateOfBirth: p.dateOfBirth ?? null,
        nationality: p.nationality ?? null,
        age:         calcAge(p.dateOfBirth),
      })),
      runningCompetitions: (d.runningCompetitions ?? []).map(c => ({
        id:     String(c.id),
        name:   c.name,
        code:   c.code,
        type:   c.type,
        emblem: c.emblem ?? null,
      })),
    };

    cacheSet(key, info, TTL_6H);
    return info;
  } catch { return null; }
}

async function fetchTeamMatches(teamId: string): Promise<{ recent: TeamMatch[]; upcoming: TeamMatch[] }> {
  const key = `team_matches:${teamId}`;
  const hit = cacheGet<{ recent: TeamMatch[]; upcoming: TeamMatch[] }>(key);
  if (hit) return hit;

  try {
    // Fetch last 6 finished + next 5 scheduled in two parallel requests
    const [finishedRes, scheduledRes] = await Promise.all([
      fetchWithRetry(`${BASE}/teams/${teamId}/matches?status=FINISHED&limit=6`),
      fetchWithRetry(`${BASE}/teams/${teamId}/matches?status=SCHEDULED&limit=5`),
    ]);

    const recent: TeamMatch[]   = [];
    const upcoming: TeamMatch[] = [];

    if (finishedRes.ok) {
      const d = await finishedRes.json() as { matches: FDMatch[] };
      recent.push(...(d.matches ?? []).map(mapMatch).reverse()); // most recent first
    }
    if (scheduledRes.ok) {
      const d = await scheduledRes.json() as { matches: FDMatch[] };
      upcoming.push(...(d.matches ?? []).map(mapMatch));
    }

    const result = { recent, upcoming };
    cacheSet(key, result, TTL_30MIN);
    return result;
  } catch {
    return { recent: [], upcoming: [] };
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function fetchTeamDetail(teamId: string): Promise<TeamDetailData | null> {
  const info = await fetchTeamInfo(teamId);
  if (!info) return null;
  const { recent, upcoming } = await fetchTeamMatches(teamId);
  return { info, recentMatches: recent, upcomingMatches: upcoming };
}
