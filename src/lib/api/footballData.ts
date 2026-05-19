/* ============================================================
   football-data.org v4  --  API service layer
   Free tier (TIER_ONE) competitions only.
   CLI (Copa Libertadores) is TIER_FOUR -- excluded.
   ============================================================ */

import type { Match, TeamInfo, FeaturedMatch, Competition, MatchStatus } from '../types';

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

function pickFeatured(fdMatches: FDMatch[]): FeaturedMatch | null {
  const priority = ['IN_PLAY', 'PAUSED', 'TIMED', 'SCHEDULED', 'FINISHED'];
  for (const s of priority) {
    const fd = fdMatches.find(m => m.status === s);
    if (fd) {
      return {
        ...mapMatch(fd),
        competition: fd.competition?.name ?? '',
        stats: { possession: [50, 50], shots: [0, 0], xG: [0.0, 0.0] },
        events: [],
        aiPulse: '',
        momentumSeries: [],
      };
    }
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
