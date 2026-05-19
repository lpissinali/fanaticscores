/* ============================================================
   football-data.org v4  --  API service layer
   All requests go through /api/fd (never directly from the
   browser) to avoid CORS issues:
     dev  -> Vite proxy -> api.football-data.org
     prod -> Firebase Function -> api.football-data.org
   ============================================================ */

import type { Match, TeamInfo, FeaturedMatch, Competition, MatchStatus } from '../types';

const BASE = '/api/fd';

// ── Football-data.org raw types ──────────────────────────────────────────────

interface FDArea { name: string; flag: string | null; }

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
  area: FDArea;
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

interface FDMatchesResponse {
  matches: FDMatch[];
}

// ── Competition metadata lookup ───────────────────────────────────────────────

const COMP_META: Record<string, { country: string; short: string; flag: string }> = {
  CL:  { country: 'Europe',      short: 'UCL', flag: '#1a3a6b' },
  PL:  { country: 'England',     short: 'PL',  flag: '#3d0d6b' },
  PD:  { country: 'Spain',       short: 'LL',  flag: '#8b0000' },
  SA:  { country: 'Italy',       short: 'SA',  flag: '#003580' },
  BSA: { country: 'Brazil',      short: 'BSA', flag: '#006400' },
  BL1: { country: 'Germany',     short: 'BL',  flag: '#333333' },
  FL1: { country: 'France',      short: 'L1',  flag: '#00209f' },
  PPL: { country: 'Portugal',    short: 'PPL', flag: '#006600' },
  DED: { country: 'Netherlands', short: 'ERE', flag: '#ff4500' },
  EC:  { country: 'Europe',      short: 'EURO',flag: '#003399' },
  WC:  { country: 'World',       short: 'WC',  flag: '#333333' },
};

// ── Mapping helpers ───────────────────────────────────────────────────────────

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

function pickFeatured(fdMatches: FDMatch[]): FeaturedMatch | null {
  const priority = ['IN_PLAY', 'PAUSED', 'TIMED', 'SCHEDULED', 'FINISHED'];
  for (const s of priority) {
    const fd = fdMatches.find(m => m.status === s);
    if (fd) {
      const base = mapMatch(fd);
      return {
        ...base,
        competition: fd.competition.name,
        stats: { possession: [50, 50], shots: [0, 0], xG: [0.0, 0.0] },
        events: [],
        aiPulse: '',
        momentumSeries: [],
      };
    }
  }
  return null;
}

function formatStage(s: string): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface TodayData {
  competitions: Competition[];
  featured: FeaturedMatch | null;
}

export async function fetchTodayData(): Promise<TodayData> {
  const today = new Date().toISOString().slice(0, 10);
  const url = `${BASE}/matches?dateFrom=${today}&dateTo=${today}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`football-data.org ${res.status}: ${text || res.statusText}`);
  }

  const data = (await res.json()) as FDMatchesResponse;
  const fdMatches = data.matches ?? [];

  const compMap = new Map<string, { fdComp: FDCompetition; stage: string | null; matches: Match[] }>();
  for (const fd of fdMatches) {
    const code = fd.competition.code;
    if (!compMap.has(code)) {
      compMap.set(code, { fdComp: fd.competition, stage: fd.stage, matches: [] });
    }
    compMap.get(code)!.matches.push(mapMatch(fd));
  }

  const competitions: Competition[] = Array.from(compMap.entries()).map(([code, { fdComp, stage, matches }]) => {
    const meta = COMP_META[code] ?? { country: fdComp.area?.name ?? '', short: code, flag: '#444444' };
    return {
      id: String(fdComp.id),
      name: fdComp.name,
      country: meta.country,
      short: meta.short,
      flag: meta.flag,
      stage: stage ? formatStage(stage) : undefined,
      matches,
    };
  });

  return { competitions, featured: pickFeatured(fdMatches) };
}
