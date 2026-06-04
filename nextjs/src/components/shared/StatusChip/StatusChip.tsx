import LiveDot from '../LiveDot/LiveDot';
import type { Match } from '../../../lib/types';

interface StatusChipProps {
  match: Pick<Match, 'status' | 'minute' | 'extra' | 'kickoff'>;
}

/**
 * Renders the correct status chip for a match:
 *   LIVE  → red pulsing chip with minute
 *   HT    → half-time chip
 *   FT    → full-time chip
 *   SCHED → kickoff time
 */
export default function StatusChip({ match }: StatusChipProps) {
  const { status, minute, extra } = match;

  if (status === 'LIVE') {
    const label = minute ? `${minute}${extra ? '+' + extra : ''}'` : 'LIVE';
    return (
      <span className="chip live">
        <LiveDot />
        {label}
      </span>
    );
  }

  if (status === 'HT') return <span className="chip ht">HT</span>;
  if (status === 'FT') return <span className="chip ft">FT</span>;

  return <span className="chip">{match.kickoff ?? '–'}</span>;
}
