import styles from './MatchRow.module.css';
import Crest from '../Crest/Crest';
import StatusChip from '../StatusChip/StatusChip';
import type { Match } from '../../../lib/types';

interface MatchRowProps {
  match: Match;
  onClick?: (match: Match) => void;
}

/**
 * Standard list-cell representation of a match.
 * 3-column grid: [status/time] [teams + crests] [scores]
 */
export default function MatchRow({ match, onClick }: MatchRowProps) {
  const { home, away } = match;
  const isLiveOrPlayed = match.status === 'LIVE' || match.status === 'HT' || match.status === 'FT';
  const homeWinner = isLiveOrPlayed && home.score !== null && away.score !== null && home.score > away.score;
  const awayWinner = isLiveOrPlayed && home.score !== null && away.score !== null && away.score > home.score;

  return (
    <div
      className="match-row"
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(match)}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(match)}
    >
      {/* Time / Status */}
      <div className="time-col">
        <StatusChip match={match} />
      </div>

      {/* Teams */}
      <div className="teams">
        <div className="team-line">
          <Crest team={home} size="md" />
          <span className={`team-name ${awayWinner ? 'muted' : ''}`}>{home.name}</span>
        </div>
        <div className="team-line">
          <Crest team={away} size="md" />
          <span className={`team-name ${homeWinner ? 'muted' : ''}`}>{away.name}</span>
        </div>
      </div>

      {/* Score */}
      <div className="score-col">
        {isLiveOrPlayed ? (
          <>
            <span className={`num ${awayWinner ? 'muted' : ''}`}>{home.score}</span>
            <span className={`num ${homeWinner ? 'muted' : ''}`}>{away.score}</span>
          </>
        ) : (
          <span className={styles.vs}>vs</span>
        )}
      </div>
    </div>
  );
}
