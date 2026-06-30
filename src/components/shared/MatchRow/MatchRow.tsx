'use client';
import Link from 'next/link';
;
import styles from './MatchRow.module.css';
import Icon from '../Icon/Icon';
import Crest from '../Crest/Crest';
import { useFollowing } from '../../../lib/useFollowing';
import type { Match, TeamInfo } from '../../../lib/types';

// -- Follow star -------------------------------------------------------------
function FollowStar({ team }: { team: TeamInfo }) {
  const [followed, toggle] = useFollowing({
    id:      team.id,
    name:    team.name,
    initial: team.initial,
    color:   team.color,
    crest:   team.crest,
  });
  return (
    <button
      className={styles.followBtn}
      onClick={(e) => toggle(e)}
      title={followed ? `Unfollow ${team.name}` : `Follow ${team.name}`}
      aria-label={followed ? `Unfollow ${team.name}` : `Follow ${team.name}`}
      aria-pressed={followed}
      style={{ color: followed ? 'var(--orange)' : undefined }}
    >
      <svg
        width="14" height="14" viewBox="0 0 24 24"
        fill={followed ? 'var(--orange)' : 'none'}
        stroke={followed ? 'var(--orange)' : 'currentColor'}
        strokeWidth="2"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z" />
      </svg>
    </button>
  );
}

// -- Time column -------------------------------------------------------------
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
  // Tie decided in extra time / on penalties — finished, with a distinct label.
  if (match.status === 'AET') return <span className={styles.timeFT}>AET</span>;
  if (match.status === 'PEN') return <span className={styles.timeFT}>AP</span>;
  return <span className={styles.timeScheduled}>{match.kickoff ?? ''}</span>;
}

// -- Team name (linked if id available) -------------------------------------
function TeamName({ team, muted, locale }: { team: TeamInfo; muted: boolean; locale: string }) {
  const cls = `team-name${muted ? ' muted' : ''}`;
  if (team.id) {
    return (
      <Link
        href={`/${locale}/team/${team.id}`}
        className={`${cls} ${styles.teamLink}`}
        onClick={e => e.stopPropagation()}
      >
        {team.name}
      </Link>
    );
  }
  return <span className={cls}>{team.name}</span>;
}

// -- Match row ---------------------------------------------------------------
interface MatchRowProps {
  match: Match;
  featured?: boolean;
  locale?: string;
  onClick?: (match: Match) => void;
}

// Small "PEN" marker shown after the shootout winner's name.
function PenTag() {
  return (
    <span
      aria-label="won on penalties"
      style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: 'var(--orange)', background: 'var(--orange-soft)', padding: '1px 4px', borderRadius: 4, marginLeft: 4, flexShrink: 0 }}
    >
      PEN
    </span>
  );
}

export default function MatchRow({ match, featured = false, locale = 'en', onClick }: MatchRowProps) {
  const { home, away } = match;
  const hasScore = home.score !== null && away.score !== null;
  const isPen = match.status === 'PEN';
  // For a shootout the 90'/ET score is level, so the winner comes from
  // `match.winner` rather than the goal score.
  const homeWins = isPen ? match.winner === 'home' : (hasScore && (home.score as number) > (away.score as number));
  const awayWins = isPen ? match.winner === 'away' : (hasScore && (away.score as number) > (home.score as number));

  return (
    <div
      className="match-row"
      style={featured ? { background: 'linear-gradient(180deg, rgba(252,128,3,0.04), transparent)' } : undefined}
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(match)}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(match)}
    >
      <div className="time-col">
        <Link
          href={`/${locale}/studio/${match.id}`}
          className={styles.studioBtn}
          onClick={e => e.stopPropagation()}
          title="Open in Share Studio"
          aria-label="Share Studio"
        >
          <Icon name="share" size={14} />
        </Link>
        <TimeCol match={match} />
      </div>

      <div className="teams">
        <div className="team-line">
          <Crest team={home} size="md" />
          <TeamName team={home} muted={awayWins} locale={locale} />
          {isPen && homeWins && <PenTag />}
          <FollowStar team={home} />
        </div>
        <div className="team-line">
          <Crest team={away} size="md" />
          <TeamName team={away} muted={homeWins} locale={locale} />
          {isPen && awayWins && <PenTag />}
          <FollowStar team={away} />
        </div>
      </div>

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
