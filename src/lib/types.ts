/* ============================================================
   Fanatic Scores -- Core TypeScript types
   Matches the shape expected by all UI components.
   Real API adapters (src/adapters/*) must return these types.
   ============================================================ */

export type MatchStatus = 'LIVE' | 'HT' | 'FT' | 'AET' | 'PEN' | 'SCHEDULED' | 'POSTPONED' | 'CANCELLED';

export interface TeamInfo {
  id?: string;
  name: string;
  short: string;
  initial: string;
  color: string;
  crest?: string;
  score: number | null;
  scorers?: Array<{ player: string; minute: string; xg?: number }>;
}

export interface MatchEvent {
  min: string;
  type: 'goal' | 'yellow' | 'red' | 'sub' | 'var';
  team: 'home' | 'away';
  player: string;
  detail?: string;
}

export interface MatchStats {
  possession: [number, number];
  shots: [number, number];
  shotsOnTarget?: [number, number];
  xG: [number, number];
  corners?: [number, number];
  fouls?: [number, number];
}

export interface Match {
  id: string;
  status: MatchStatus;
  minute?: string | number | null;
  extra?: string;
  home: TeamInfo;
  away: TeamInfo;
  venue?: string;
  aggregate?: string;
  kickoff?: string;
  featured?: boolean;
  /** Winning side for a decided knockout tie (esp. settled on penalties). */
  winner?: 'home' | 'away' | null;
  /** Penalty-shootout score — present only when status is 'PEN'. */
  penalty?: { home: number | null; away: number | null };
}

export interface FeaturedMatch extends Match {
  competition: string;
  compCountry: string;
  stats: MatchStats;
  events: MatchEvent[];
  aiPulse: string;
  momentumSeries: number[];
}

export interface Competition {
  id: string;
  name: string;
  country: string;
  short: string;
  stage?: string;
  flag: string;
  matches: Match[];
}

export interface TrendingItem {
  id: string;
  tag: 'GOAL' | 'RED' | 'MOMENT' | 'RESULT';
  text: string;
  matchId?: string;
}

export interface FSData {
  featuredMatch: FeaturedMatch;
  competitions: Competition[];
  trending?: TrendingItem[];
}
