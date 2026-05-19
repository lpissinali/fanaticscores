/* ============================================================
   football-data.org v4  --  API service layer
   Free tier (TIER_ONE) competitions only.
   CLI (Copa Libertadores) is TIER_FOUR -- excluded.
   ============================================================ */

import type { Match, TeamInfo, FeaturedMatch, Competition, MatchStatus } from '../types';
import { getFollowedNames } from '../useFollowing';

const BASE = '/api/fd';

// -- Competitions to poll (all TIER_ONE on football-data.org free plan) ----------

const COMP_LIST = [
  { code: 'CL',  name: 'UEFA Champions League', country: 'Europe',      short: 'UCL', flag: '#1a3a6b' },
  { code: 'WC',  name: 'FIFA World Cup',         country: 'World',       short: 'WC',  flag: '#8b6914' },
  { code: 'PL',  name: 'Premier League',         country: 'England',     short: 'PL',  flag: '#3d0d6b' },
  { code: 'ELC', name: 'Championship',           country: 'England',     short: 'CH',  flag: '#2d0d5b' },
  { code: 'BL1', name: 'Bundesliga',             country: 'Germany',     short: 'BL',  flag: '#cc0000' },
  { code: 'FL1', name: 'Ligue 1',                country: 'France',      short: 'L1',  flag: '#003189' },
  { code: 'SA',  name: 'Serie A',                country: 'Italy',       short: 'SA',  flag: '#003580' },
  { code: 'PD',  name: 'Primera Division',       country: 'Spain',       short: 'LL',  flag: '#8b0000' },
  { code: 'BSA', name: 'Campeonato Brasileiro',  country: 'Brazil',      short: 'BSA', flag: '#006400' },
  { code: 'DED', name: 'Eredivisie',             country: 'Netherlands', short: 'ERE', flag: '#ff6600' },
  { code: 'PPL', name: 'Primeira Liga',          country: 'Portugal',    short: 'PPL', flag: '#006600' },
] as const;

// -- football-data.org raw types -------------------------------------------------

interface FDTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

interface FDCompetition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string;
  area: { name: string; flag: string | null };
}

interface FDScore {
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  duration: string;
  fullTime:  { home: number | null; away: number | null };
  halfTime:  { home: number | null; away: number | null };
}

interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  minute: number | null;
  injuryTime: number | null;
  stage: string | null;
  competition: FDCompetition;
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score: FDScore;
}

// -- Mapping helpers -------------------------------------------------------------

function mapStatus(s: string): MatchStatus {
  switch (s) {
    case 'IN_PLAY':   return 'LIVE';
    case 'PAUSED':    return 'HT';
    case 'FINISHED':  return 'FT';
    case 'POSTPONED': return 'POSTPONED';
    case 'CANCELLED':
    case 'SUSPENDED': return 'CANCELLED';
    default:          return 'SCHEDULED';
  }
}

function formatKickoff(utcDate: string): string {
  return new Date(utcDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function mapTeam(fd: FDTeam, score: number | null): TeamInfo {
  const name = fd.shortName || fd.name;
  return {
    name,
    short: name.split(' ')[0],
    initial: fd.tla || name.slice(0, 3).toUpperCase(),
    color: '#3a3a48',
    crest: fd.crest || undefined,
    score,
  };
}

function mapMatch(fd: FDMatch): Match {
  const status = mapStatus(fd.status);
  let minute: string | number | null = null;
  if (fd.minute != null) {
    minute = fd.injuryTime ? `${fd.minute}+${fd.injuryTime}` : fd.minute;
  }
  return {
    id: String(fd.id),
    status,
    minute,
    kickoff: status === 'SCHEDULED' ? formatKickoff(fd.utcDate) : undefined,
    home: mapTeam(fd.homeTeam, fd.score.fullTime.home),
    away: mapTeam(fd.awayTeam, fd.score.fullTime.away),
  };
}

function formatStage(s: string): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}


// Higher number = higher priority in featured card selection.
const COMP_TIER: Record<string, number> = {
  CL:  10,  // UEFA Champions League
  WC:   9,  // FIFA World Cup
  PL:   8,  // Premier League
  PD:   8,  // La Liga
  SA:   8,  // Serie A
  BL1:  7,  // Bundesliga
  FL1:  7,  // Ligue 1
  BSA:  5,  // Brasileirao
  ELC:  4,  // Championship
  DED:  4,  // Eredivisie
  PPL:  4,  // Primeira Liga
};

function compTier(fd: FDMatch): number {
  return COMP_TIER[fd.competition?.code ?? ''] ?? 0;
}

function hasFollowedTeam(fd: FDMatch, followed: Set<string>): boolean {
  if (followed.size === 0) return false;
  const home = fd.homeTeam.shortName || fd.homeTeam.name;
  const away = fd.awayTeam.shortName || fd.awayTeam.name;
  return followed.has(home) || followed.has(away);
}

function pickFeatured(fdMatches: FDMatch[]): FeaturedMatch | null {
  const followed = getFollowedNames();
  // Status priority: live > half-time > upcoming > finished.
  // Within each bucket: followed teams first, then highest competition tier.
  const statusPriority = ['IN_PLAY', 'PAUSED', 'TIMED', 'SCHEDULED', 'FINISHED'];
  for (const s of statusPriority) {
    const candidates = fdMatches.filter(m => m.status === s);
    if (candidates.length === 0) continue;
    const fd = candidates.reduce((best, m) => {
      const mFollowed   = hasFollowedTeam(m, followed)    ? 1 : 0;
      const bestFollowed = hasFollowedTeam(best, followed) ? 1 : 0;
      if (mFollowed !== bestFollowed) return mFollowed > bestFollowed ? m : best;
      return compTier(m) >= compTier(best) ? m : best;
    });
    return {
      ...mapMatch(fd),
      competition: fd.competition?.name ?? '',
      stats: { possession: [50, 50], shots: [0, 0], xG: [0.0, 0.0] },
      events: [],
      aiPulse: '',
      momentumSeries: [],
    };
  }
  return null;
}

// -- Fetch one competition's matches, silently return [] on failure ---------------

async function fetchCompMatches(code: string, dateFrom: string, dateTo: string): Promise<FDMatch[]> {
  try {
    const res = await fetch(`${BASE}/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);
    if (res.status === 429) return [];
    if (!res.ok) return [];
    const data = (await res.json()) as { matches: FDMatch[] };
    return data.matches ?? [];
  } catch {
    return [];
  }
}

const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

// -- Public API ------------------------------------------------------------------

export interface TodayData {
  competitions: Competition[];
  featured: FeaturedMatch | null;
}

export async function fetchMatchesForDate(date: string): Promise<TodayData> {
  // Sequential with 350ms stagger -- 11 comps x 350ms ~= 3.5s, ~5 req/min steady state.
  const allResults: FDMatch[][] = [];
  for (let i = 0; i < COMP_LIST.length; i++) {
    if (i > 0) await delay(350);
    allResults.push(await fetchCompMatches(COMP_LIST[i].code, date, date));
  }

  const competitions: Competition[] = [];
  const allFdMatches: FDMatch[] = [];

  COMP_LIST.forEach((comp, i) => {
    const fdMatches = allResults[i];
    if (fdMatches.length === 0) return;

    const stage = fdMatches[0]?.stage;
    allFdMatches.push(...fdMatches);

    competitions.push({
      id: comp.code,
      name: comp.name,
      country: comp.country,
      short: comp.short,
      flag: comp.flag,
      stage: stage ? formatStage(stage) : undefined,
      matches: fdMatches.map(mapMatch),
    });
  });

  return { competitions, featured: pickFeatured(allFdMatches) };
}

export function fetchTodayData(): Promise<TodayData> {
  return fetchMatchesForDate(new Date().toISOString().slice(0, 10));
}
