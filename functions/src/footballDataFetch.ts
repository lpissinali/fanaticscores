/**
 * Core football-data.org fetching logic shared by scheduled + on-demand functions.
 * Returns a Firestore-ready matchday document.
 */

import { defineSecret } from 'firebase-functions/params';

export const fdApiKey = defineSecret('FD_API_KEY');
const FD_BASE = 'https://api.football-data.org/v4';

export const COMP_LIST = [
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

export interface MatchdayDoc {
  competitions:       CompetitionData[];
  featured:           MatchData | null;
  hadErrors:          boolean;
  hasLive:            boolean;
  fetchedAt:          number;
  nextFetchAfter:     number;
  aiBrief:            string | null;
  aiBriefGeneratedAt: number;
}

export interface CompetitionData {
  id: string; name: string; country: string; short: string; flag: string;
  stage?: string;
  matches: MatchData[];
}

export interface MatchData {
  id: string; status: string; minute: string | number | null;
  kickoff?: string; competition?: string;
  home: TeamData; away: TeamData;
}

export interface TeamData {
  id: string; name: string; short: string; initial: string;
  color: string; crest?: string; score: number | null;
}

interface FDTeam  { id: number; name: string; shortName: string; tla: string; crest: string; }
interface FDScore { fullTime: { home: number|null; away: number|null }; }
interface FDMatch {
  id: number; utcDate: string; status: string;
  minute?: number|null; injuryTime?: number|null; stage: string|null;
  competition: { id: number; name: string; code: string; type: string };
  homeTeam: FDTeam; awayTeam: FDTeam; score: FDScore;
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function mapStatus(s: string): string {
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

function mapTeam(fd: FDTeam, score: number | null): TeamData {
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

function formatStage(s: string): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

const COMP_TIER: Record<string, number> = {
  CL: 10, WC: 9, PL: 8, PD: 8, SA: 8, BL1: 7, FL1: 7,
  BSA: 5, ELC: 4, DED: 4, PPL: 4,
};

export function calcNextFetch(date: string, hasLive: boolean, hadErrors: boolean, now: number): number {
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) return hadErrors ? now + 65000 : now + 24 * 3600000;
  if (date > today) return now + (hadErrors ? 65000 : 3600000);
  if (hasLive)   return now + 60000;
  if (hadErrors) return now + 65000;
  return now + 2 * 60000;
}

export async function fetchMatchday(date: string, apiKey: string): Promise<MatchdayDoc> {
  const now = Date.now();
  const competitions: CompetitionData[] = [];
  const allMatches: FDMatch[] = [];
  let hadErrors = false;

  for (let i = 0; i < COMP_LIST.length; i++) {
    if (i > 0) await delay(350);
    const comp = COMP_LIST[i];
    try {
      const res = await fetch(
        FD_BASE + '/competitions/' + comp.code + '/matches?dateFrom=' + date + '&dateTo=' + date,
        { headers: { 'X-Auth-Token': apiKey } }
      );
      if (res.status === 429) { hadErrors = true; continue; }
      if (!res.ok) continue;
      const data = await res.json() as { matches: FDMatch[] };
      const fdMatches = data.matches ?? [];
      if (fdMatches.length === 0) continue;

      allMatches.push(...fdMatches);
      const stage = fdMatches[0]?.stage;
      competitions.push({
        id:      comp.code,
        name:    comp.name,
        country: comp.country,
        short:   comp.short,
        flag:    comp.flag,
        stage:   stage ? formatStage(stage) : undefined,
        matches: fdMatches.map(fd => {
          const status = mapStatus(fd.status);
          let minute: string | number | null = null;
          if (fd.minute != null) {
            minute = fd.injuryTime ? fd.minute + '+' + fd.injuryTime : fd.minute;
          }
          return {
            id:      String(fd.id),
            status,
            minute,
            kickoff: status === 'SCHEDULED' ? formatKickoff(fd.utcDate) : undefined,
            home:    mapTeam(fd.homeTeam, fd.score.fullTime.home),
            away:    mapTeam(fd.awayTeam, fd.score.fullTime.away),
          };
        }),
      });
    } catch { /* network error -- skip comp */ }
  }

  const hasLive = allMatches.some(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');

  let featured: MatchData | null = null;
  const priority = ['IN_PLAY', 'PAUSED', 'TIMED', 'SCHEDULED', 'FINISHED'];
  for (const s of priority) {
    const candidates = allMatches.filter(m => m.status === s);
    if (candidates.length === 0) continue;
    const fd = candidates.reduce((best, m) => {
      const mt = COMP_TIER[m.competition?.code ?? ''] ?? 0;
      const bt = COMP_TIER[best.competition?.code ?? ''] ?? 0;
      return mt >= bt ? m : best;
    });
    const status = mapStatus(fd.status);
    let minute: string | number | null = null;
    if (fd.minute != null) minute = fd.injuryTime ? fd.minute + '+' + fd.injuryTime : fd.minute;
    featured = {
      id: String(fd.id), status, minute,
      kickoff: status === 'SCHEDULED' ? formatKickoff(fd.utcDate) : undefined,
      competition: fd.competition?.name ?? '',
      home: mapTeam(fd.homeTeam, fd.score.fullTime.home),
      away: mapTeam(fd.awayTeam, fd.score.fullTime.away),
    };
    break;
  }

  return {
    competitions,
    featured,
    hadErrors,
    hasLive,
    fetchedAt:          now,
    nextFetchAfter:     calcNextFetch(date, hasLive, hadErrors, now),
    aiBrief:            null,
    aiBriefGeneratedAt: 0,
  };
}
