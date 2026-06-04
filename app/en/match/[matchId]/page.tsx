/**
 * Match page — Server Component.
 * Fetches fixture data directly from api-football (no match cache needed).
 * Google sees: teams, score, events, venue, standings.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchMatchDetail } from '@/lib/serverApi/matchDetails';
import type { MatchDetailData, MatchEvent, StandingRow } from '@/lib/serverApi/matchDetails';
import Sidebar from '@/src/components/layout/Sidebar/Sidebar';
import Footer from '@/src/components/layout/Footer/Footer';
import RailPromo from '@/src/components/shared/RailPromo/RailPromo';
import Icon from '@/src/components/shared/Icon/Icon';
import styles from '@/src/pages/match/MatchPage.module.css';
import Link from 'next/link';

interface Props { params: Promise<{ matchId: string }> }

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { matchId } = await params;
  const data = await fetchMatchDetail(matchId);
  if (!data) return { title: 'Match' };
  const score = data.home.score !== null && data.away.score !== null
    ? `${data.home.score}–${data.away.score}`
    : 'vs';
  const title = `${data.home.name} ${score} ${data.away.name} — ${data.competition}`;
  const description = `Match details for ${data.home.name} vs ${data.away.name} in ${data.competition}${data.venue ? ` at ${data.venue}` : ''}.`;
  const url = `/en/match/${matchId}`;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    twitter: { title, description },
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreHeader({ d, matchId }: { d: MatchDetailData; matchId: string }) {
  const statusChip =
    d.status === 'LIVE' ? <span className="chip live">Live{d.minute ? ` · ${d.minute}′` : ''}</span> :
    d.status === 'HT'   ? <span className="chip ht">Half Time</span> :
    d.status === 'FT'   ? <span className="chip ft">Full Time</span> :
                          <span className="chip">{d.kickoff ? new Date(d.kickoff).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Upcoming'}</span>;

  return (
    <div className={styles.featured}>
      <div className={styles.featuredGlow} aria-hidden="true" />
      <div className={styles.featuredTop}>
        <div className={styles.featuredMeta}>
          {statusChip}
          <Link href={d.compCode ? `/en/competition/${d.compCode}` : '/en/competitions'} style={{ textDecoration: 'none' }}>
            <span className={styles.compLabel}>{d.compCountry ? `${d.compCountry} · ` : ''}{d.competition}</span>
          </Link>
          {d.matchday && <span className={styles.matchday}>MD {d.matchday}</span>}
        </div>
        <Link href={`/en/studio/${matchId}`} className="fs-btn ghost" style={{ height: 32, padding: '0 12px', fontSize: 12, textDecoration: 'none' }}>
          <Icon name="share" size={14} /> Share Studio
        </Link>
      </div>

      <div className={styles.scoreGrid}>
        <Link href={`/en/team/${d.home.id}`} className={styles.teamLeft} style={{ textDecoration: 'none' }}>
          {d.home.crest && <img src={d.home.crest} alt={d.home.name} width={56} height={56} style={{ objectFit: 'contain' }} />}
          <div>
            <div className={styles.teamRole}>Home</div>
            <div className={styles.teamName}>{d.home.name}</div>
          </div>
        </Link>

        <div className={styles.scoreBlock}>
          <span className={styles.score}>{d.home.score ?? '–'}</span>
          <span className={styles.scoreDash}>–</span>
          <span className={styles.score}>{d.away.score ?? '–'}</span>
        </div>

        <Link href={`/en/team/${d.away.id}`} className={styles.teamRight} style={{ textDecoration: 'none' }}>
          <div style={{ textAlign: 'right' }}>
            <div className={styles.teamRole}>Away</div>
            <div className={styles.teamName}>{d.away.name}</div>
          </div>
          {d.away.crest && <img src={d.away.crest} alt={d.away.name} width={56} height={56} style={{ objectFit: 'contain' }} />}
        </Link>
      </div>

      {d.halfTime.home !== null && (
        <div className={styles.htRow}>
          <span className={styles.htLabel}>Half-time</span>
          <span className={styles.htScore}>{d.halfTime.home} – {d.halfTime.away ?? 0}</span>
        </div>
      )}

    </div>
  );
}

function EventIcon({ type, detail }: { type: string; detail?: string }) {
  if (type === 'goal') {
    const cls = detail === 'own goal' ? styles.iconGoalOwn : detail === 'pen' ? styles.iconGoalPen : styles.iconGoal;
    return <span className={cls}>⚽</span>;
  }
  if (type === 'yellow') return <div className={styles.iconYellow} />;
  if (type === 'red')    return <div className={styles.iconRed} />;
  if (type === 'sub') return (
    <svg className={styles.iconSub} viewBox="0 0 16 16" fill="none">
      <path d="M8 2v5l3-3" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 14V9l-3 3" stroke="#e03131" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  return <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'monospace' }}>VAR</span>;
}

function EventsSection({ events }: { events: MatchEvent[] }) {
  if (events.length === 0) return null;
  const mainEvents = events.filter(e => e.type !== 'sub' && e.type !== 'var');
  const subs       = events.filter(e => e.type === 'sub');

  function EventRow({ e }: { e: MatchEvent }) {
    const text = (
      <div className={styles.eventTextWrap}>
        <span className={e.type === 'goal' ? styles.eventPlayerGoal : styles.eventPlayer}>{e.player}</span>
        {e.detail && <span className={styles.eventDetail}>{e.detail}</span>}
      </div>
    );
    const iconEl = (
      <div className={styles.eventIconWrap}>
        <EventIcon type={e.type} detail={e.detail} />
      </div>
    );
    // Grid: 1fr (home) | 52px (minute) | 1fr (away)
    const minCol = (
      <div className={styles.eventMinCol}>
        <span className={styles.eventMinBadge}>{e.min}′</span>
      </div>
    );
    return (
      <div className={styles.eventRow}>
        {e.team === 'home' ? (
          <>
            <div className={`${styles.eventCell} ${styles.eventCellHome}`}>{text}{iconEl}</div>
            {minCol}
            <div className={`${styles.eventCell} ${styles.eventCellEmpty}`} />
          </>
        ) : (
          <>
            <div className={`${styles.eventCell} ${styles.eventCellEmpty}`} />
            {minCol}
            <div className={`${styles.eventCell} ${styles.eventCellAway}`}>{iconEl}{text}</div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Match Events</h2>
      <div className={styles.eventsGrid}>
        {mainEvents.map((e, i) => <EventRow key={i} e={e} />)}
        {subs.length > 0 && (
          <>
            <div className={styles.eventsDivider}>
              <div className={styles.eventsDividerLine} />
              <span className={styles.eventsDividerLabel}>Substitutions</span>
              <div className={styles.eventsDividerLine} />
            </div>
            {subs.map((e, i) => <EventRow key={i} e={e} />)}
          </>
        )}
      </div>
    </div>
  );
}

function StandingsSection({ rows, homeId, awayId, compName }: { rows: StandingRow[]; homeId: string; awayId: string; compName: string }) {
  if (rows.length === 0) return null;
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{compName} — Standings</h2>
      <div className={styles.table}>
        <div className={styles.tableHead}>
          <span className={styles.colPos}>#</span>
          <span className={styles.colTeam}>Club</span>
          <span className={styles.colNum}>P</span>
          <span className={styles.colNum}>W</span>
          <span className={styles.colNum}>D</span>
          <span className={styles.colNum}>L</span>
          <span className={styles.colNum}>GD</span>
          <span className={styles.colPts}>Pts</span>
        </div>
        {rows.map(r => {
          const highlight = r.teamId === homeId || r.teamId === awayId;
          return (
            <Link key={r.teamId} href={`/en/team/${r.teamId}`}
              className={[styles.tableRow, highlight ? styles.highlighted : ''].filter(Boolean).join(' ')}
              style={{ textDecoration: 'none' }}>
              <span className={styles.colPos}>{r.position}</span>
              <span className={styles.colTeam}>
                <img src={r.teamCrest} alt={r.teamName} width={16} height={16} style={{ objectFit: 'contain', flexShrink: 0 }} />
                {r.teamName}
              </span>
              <span className={styles.colNum}>{r.played}</span>
              <span className={styles.colNum}>{r.won}</span>
              <span className={styles.colNum}>{r.draw}</span>
              <span className={styles.colNum}>{r.lost}</span>
              <span className={styles.colNum}>{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</span>
              <span className={styles.colPts}>{r.points}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function H2HSection({ d }: { d: MatchDetailData }) {
  if (!d.h2h) return null;
  const { homeWins, draws, awayWins, totalGoal