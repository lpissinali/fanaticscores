import styles from './MatchRow.module.css';
import Crest from '../Crest/Crest';
import { useFollowing } from '../../../lib/useFollowing';
import type { Match } from '../../../lib/types';

// ── Follow star ──────────────────────────────────────────────────────────────
function FollowStar({ teamName }: { teamName: string }) {
  const [followed, toggle] = useFollowing(teamName);
  return (
    <button
      className={styles.followBtn}
      onClick={(e) => toggle(e)}
      title={followed ? `Unfollow ${teamName}` : `Follow ${teamName}`}
      aria-label={followed ? `Unfollow ${teamName}` : `Follow ${teamName}`}
      aria-pressed={followed}
    >
      <svg
        width="14" height="14" viewBox="0 0 24 24"
        fill={followed ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z" />
      </svg>
    </button>
  );
}

// ── Time column ──────────────────────────────────────────────────────────────
function TimeCol({ match }: { match: Match }) {
  if (match.status === 'LIVE') {
    const min = String(match.minute ?? '').replace(/'/g, '');
    return (
      <div className={styles.timeLive}>
        <span className="live-dot" aria-hidden="true" />
        <span className={styles.timeLiveMin}>{min}&prime;</span>
      </div>
    );
  }
  if (match.status === 'HT') return <span className={styles.timeHT}>HT</span>;
  if (match.status === 'FT') return <span className={styles.timeFT}>FT</span>;
  return <span className={styles.timeScheduled}>{match.kickoff ?? ''}</span>;
}

// ── Match row ────────────────────────────────────────────────────────────────
interface MatchRowProps {
  match: Match;
  featured?: boolean;
  onClick?: (match: Match) => void;
}

export default function MatchRow({ match, featured = false, onClick }: MatchRowProps) {
  const { home, away } = match;
  const hasScore = home.score !== null && away.score !== null;

  const homeWins = hasScore && (home.score as number) > (away.score as number);
  const awayWins = hasScore && (away.score as number) > (home.score as number);

  return (
    <div
      className="match-row"
      style={featured ? { background: 'linear-gradient(180deg, rgba(252,128,3,0.04), transparent)' } : undefined}
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(match)}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(match)}
    >
      {/* Time / status */}
      <div className="time-col">
        <TimeCol match={match} />
      </div>

      {/* Teams */}
      <div className="teams">
        <div className="team-line">
          <Crest team={home} size="md" />
          <span className={`team-name${awayWins ? ' muted' : ''}`}>{home.name}</span>
          <FollowStar teamName={home.name} />
        </div>
        <div className="team-line">
          <Crest team={away} size="md" />
          <span className={`team-name${homeWins ? ' muted' : ''}`}>{away.name}</span>
          <FollowStar teamName={away.name} />
        </div>
      </div>

      {/* Score */}
      <div className="score-col">
        {!hasScore ? (
          <span className={styles.noScore}>&#8212;</span>
        ) : (
          <>
            <span className={`num${awayWins ? ' muted' : ''}`}>{home.score}</span>
            <span className={`num${homeWins ? ' muted' : ''}`}>{away.score}</span>
          </>
        )}
      </div>
    </div>
  );
}
