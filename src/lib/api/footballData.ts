/* ============================================================
   football-data.org v4  --  API service layer
   Per-competition fetching with 350 ms stagger.
   COMP_LIST ordered by tier so a 429 on the last request
   always drops the lowest-priority competition first.
   ============================================================ */

import type { Match, TeamInfo, FeaturedMatch, Competition, MatchStatus } from '../types';
import { getFollowedNames } from '../useFollowing';

const BASE = '/api/fd';

// Ordered highest-to-lowest priority so rate-limit failures drop least important comps first.
const COMP_LIST = [
  { code: 'CL',  name: 'UEFA Champions League', country: 'Europe',      short: 'UCL', flag: '#1a3a6b' },
  { code: 'PL',  name: 'Premier League',         country: 'England',     short: 'PL',  flag: '#3d0d6b' },
  { code: 'PD',  name: 'Primera Division',       country: 'Spain',       short: 'LL',  flag: '#8b0000' },
  { code: 'SA',  name: 'Serie A',                country: 'Italy',       short: 'SA',  flag: '#003580' },
  { code: 'BL1', name: 'Bundesliga',             country: 'Germany',     short: 'BL',  flag: '#cc0000' },
  { code: 'FL1', name: 'Ligue 1',                country: 'France',      short: 'L1',  flag: '#003189' },
  { code: 'BSA', name: 'Campeonato Brasileiro',  country: 'Brazil',      short: 'BSA', flag: '#006400' },
  { code: 'ELC', name: 'Championship',           country: 'England',     short: 'CH',  flag: '#2d0d5b' },
  { code: 'DED', name: 'Eredivisie',             country: 'Netherlands', short: 'ERE', flag: '#ff6600' },
  { code: 'PPL', name: 'Primeira Liga',          country: 'Portugal',    short: 'PPL', flag: '#006600' },
  { code: 'WC',  name: 'FIFA World Cup',         country: 'World',       short: 'WC',  flag: '#8b6914' },
] as const;

// -- football-data.org raw types -------------------------------------------------

interface FDTeam {
  id: number; name: string; shortName: string; tla: string; crest: string;
}

interface FDCompetition {
  id: number; name: string; code: string; type: string; emblem: string;
  area: { name: string; flag: string | null };
}

interface FDScore {
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  duration: string;
  fullTime:  { home: number | null; away: number | null };
  halfTime:  { home: number | null; away: number | null };
}

interface FDMatch {
  id: number; utcDate: string; status: string;
  minute?: number | null; injuryTime?: number | null;
  stage: string | null;
  competition: FDCompetition;
  homeTeam: FDTeam; awayTeam: FDTeam;
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
    id:      String(fd.id),
    name,
    short:   name.split(' ')[0],
    initial: fd.tla || name.slice(0, 3).toUpperCase(),
    color:   '#3a3a48',
    crest:   fd.crest || undefined,
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
    id:      String(fd.id),
    status,
    minute,
    kickoff: status === 'SCHEDULED' ? formatKickoff(fd.utcDate) : undefined,
    home:    mapTeam(fd.homeTeam, fd.score.fullTime.home),
    away:    mapTeam(fd.awayTeam, fd.score.fullTime.away),
  };
}

function formatStage(s: string): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// Higher number = higher priority in featured card selection.
const COMP_TIER: Record<string, number> = {
  CL: 10, WC: 9, PL: 8, PD: 8, SA: 8, BL1: 7, FL1: 7,
  BSA: 5, ELC: 4, DED: 4, PPL: 4,
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
  const statusPriority = ['IN_PLAY', 'PAUSED', 'TIMED', 'SCHEDULED', 'FINISHED'];
  for (const s of statusPriority) {
    const candidates = fdMatches.filter(m => m.status === s);
    if (candidates.length === 0) continue;
    const fd = candidates.reduce((best, m) => {
      const mF = hasFollowedTeam(m, followed)    ? 1 : 0;
      const bF = hasFollowedTeam(best, followed) ? 1 : 0;
      if (mF !== bF) return mF > bF ? m : best;
      return compTier(m) >= compTier(best) ? m : best;
    });
    return {
      ...mapMatch(fd),
      competition:    fd.competition?.name ?? '',
      stats:          { possession: [50, 50], shots: [0, 0], xG: [0.0, 0.0] },
      events:         [],
      aiPulse:        '',
      momentumSeries: [],
    };
  }
  return null;
}

// -- Per-competition fetch --------------------------------------------------------

interface CompResult { matches: FDMatch[]; rateLimited: boolean; }

const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

async function fetchCompMatches(code: string, dateFrom: string, dateTo: string): Promise<CompResult> {
  try {
    const res = await fetch(`${BASE}/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);
    if (res.status === 429) return { matches: [], rateLimited: true };
    if (!res.ok)            return { matches: [], rateLimited: false };
    const data = (await res.json()) as { matches: FDMatch[] };
    return { matches: data.matches ?? [], rateLimited: false };
  } catch {
    return { matches: [], rateLimited: false };
  }
}

// -- Public API ------------------------------------------------------------------

export interface TodayData {
  competitions: Competition[];
  featured:     FeaturedMatch | null;
  hadErrors:    boolean;
}

export async function fetchMatchesForDate(date: string): Promise<TodayData> {
  // Sequential with 350 ms stagger (~11 req in 3.5 s).
  // COMP_LIST is priority-ordered so a 429 always drops the lowest-tier comp first.
  const allResults: CompResult[] = [];
  for (let i = 0; i < COMP_LIST.length; i++) {
    if (i > 0) await delay(350);
    allResults.push(await fetchCompMatches(COMP_LIST[i].code, date, date));
  }

  const competitions: Competition[] = [];
  const allFdMatches: FDMatch[] = [];
  let hadErrors = false;

  COMP_LIST.forEach((comp, i) => {
    const { matches: fdMatches, rateLimited } = allResults[i];
    if (rateLimited) { hadErrors = true; return; }
    if (fdMatches.length === 0) return;

    const stage = fdMatches[0]?.stage;
    allFdMatches.push(...fdMatches);

    competitions.push({
      id:      comp.code,
      name:    comp.name,
      country: comp.country,
      short:   comp.short,
      flag:    comp.flag,
      stage:   stage ? formatStage(stage) : undefined,
      matches: fdMatches.map(mapMatch),
    });
  });

  return { competitions, featured: pickFeatured(allFdMatches), hadErrors };
}

export function fetchTodayData(): Promise<TodayData> {
  return fetchMatchesForDate(new Date().toISOString().slice(0, 10));
}
