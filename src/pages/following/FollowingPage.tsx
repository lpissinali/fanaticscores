import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAllFollowed } from '../../lib/useFollowing';
import { fetchTeamFixtures, type TeamMatch } from '../../lib/api/teamDetails';
import { useSEO } from '../../lib/useSEO';
import Sidebar from '../../components/layout/Sidebar/Sidebar';
import Footer from '../../components/layout/Footer/Footer';
import FSLogo from '../../components/shared/FSLogo/FSLogo';
import Icon from '../../components/shared/Icon/Icon';
import MobileBottomNav from '../../components/shared/MobileBottomNav/MobileBottomNav';
import type { SupportedLocale } from '../../i18n';
import styles from './FollowingPage.module.css';

interface FollowingPageProps { locale: SupportedLocale; }

// ── Augmented fixture row ────────────────────────────────────────────────────

interface FixtureRow extends TeamMatch {
  /** IDs of followed teams that appear in this match */
  followedIds: string[];
}

// ── Group by competition (preserves order of first appearance) ───────────────

function groupByComp(matches: FixtureRow[]): Array<{ competition: string; matches: FixtureRow[] }> {
  const map = new Map<string, FixtureRow[]>();
  for (const m of matches) {
    const group = map.get(m.competition) ?? [];
    group.push(m);
    map.set(m.competition, group);
  }
  return [...map.entries()].map(([competition, ms]) => ({ competition, matches: ms }));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getResultTag(
  match: FixtureRow,
): 'W' | 'D' | 'L' | null {
  if (match.status !== 'FINISHED') return null;
  const hs = match.homeTeam.score;
  const as_ = match.awayTeam.score;
  if (hs === null || as_ === null) return null;

  // Determine from the perspective of the first followed team
  const followedId = match.followedIds[0];
  const isHome = match.homeTeam.id === followedId;
  const myScore  = isHome ? hs : as_;
  const oppScore = isHome ? as_ : hs;

  if (myScore > oppScore) return 'W';
  if (myScore < oppScore) return 'L';
  return 'D';
}

function formatDate(utcDate: string): string {
  const d = new Date(utcDate);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(utcDate: string): string {
  return new Date(utcDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ── Fixture row component ────────────────────────────────────────────────────

function FixtureRowItem({ match, locale }: { match: FixtureRow; locale: string }) {
  const navigate = useNavigate();
  const isScheduled = match.status === 'SCHEDULED' || match.status === 'TIMED';

  const homeFollowed = match.followedIds.includes(match.homeTeam.id);
  const awayFollowed = match.followedIds.includes(match.awayTeam.id);

  return (
    <div
      className={styles.fixtureRow}
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/${locale}/match/${match.id}`)}
      onKeyDown={e => e.key === 'Enter' && navigate(`/${locale}/match/${match.id}`)}
    >
      {/* Date + time */}
      <div className={styles.dateCell}>
        <span className={styles.dateText}>{formatDate(match.utcDate)}</span>
        {isScheduled && <span className={styles.timeText}>{formatTime(match.utcDate)}</span>}
      </div>

      {/* Home crest */}
      <img
        src={match.homeTeam.crest}
        alt={match.homeTeam.name}
        className={styles.teamCrest}
        onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
      />

      {/* Home name */}
      <span className={[styles.teamName, homeFollowed ? styles.teamNameFollowed : ''].filter(Boolean).join(' ')}>
        {match.homeTeam.name}
      </span>

      {/* Score or vs separator */}
      {isScheduled ? (
        <div className={styles.vsSep}>vs</div>
      ) : (
        <div className={styles.scoreCell}>
          <span>{match.homeTeam.score ?? '–'}</span>
          <span className={styles.scoreDash}>–</span>
          <span>{match.awayTeam.score ?? '–'}</span>
        </div>
      )}

      {/* Away name */}
      <span className={[styles.teamName, styles.teamNameRight, awayFollowed ? styles.teamNameFollowed : ''].filter(Boolean).join(' ')}>
        {match.awayTeam.name}
      </span>

      {/* Away crest */}
      <img
        src={match.awayTeam.crest}
        alt={match.awayTeam.name}
        className={styles.teamCrest}
        onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
      />
    </div>
  );
}

// ── Data hook ────────────────────────────────────────────────────────────────

function useFollowingFixtures() {
  const followed = useAllFollowed();
  const [upcoming, setUpcoming] = useState<FixtureRow[]>([]);
  const [recent,   setRecent]   = useState<FixtureRow[]>([]);
  const [loading,  setLoading]  = useState(true);

  // IDs with an actual API id
  const teamIds = useMemo(
    () => followed.filter(t => t.id).map(t => t.id as string),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [followed.map(t => t.id).join(',')],
  );

  useEffect(() => {
    if (teamIds.length === 0) {
      setUpcoming([]);
      setRecent([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const followedIdSet = new Set(teamIds);

    Promise.all(teamIds.map(id => fetchTeamFixtures(id))).then(results => {
      const seenUpcoming = new Map<string, FixtureRow>();
      const seenRecent   = new Map<string, FixtureRow>();

      results.forEach(({ recent: r, upcoming: u }) => {
        for (const m of u) {
          if (seenUpcoming.has(m.id)) {
            // Merge followedIds for duplicate (two followed teams playing each other)
            const existing = seenUpcoming.get(m.id)!;
            if (followedIdSet.has(m.homeTeam.id) && !existing.followedIds.includes(m.homeTeam.id))
              existing.followedIds.push(m.homeTeam.id);
            if (followedIdSet.has(m.awayTeam.id) && !existing.followedIds.includes(m.awayTeam.id))
              existing.followedIds.push(m.awayTeam.id);
          } else {
            const followedIds: string[] = [];
            if (followedIdSet.has(m.homeTeam.id)) followedIds.push(m.homeTeam.id);
            if (followedIdSet.has(m.awayTeam.id)) followedIds.push(m.awayTeam.id);
            seenUpcoming.set(m.id, { ...m, followedIds });
          }
        }
        for (const m of r) {
          if (seenRecent.has(m.id)) {
            const existing = seenRecent.get(m.id)!;
            if (followedIdSet.has(m.homeTeam.id) && !existing.followedIds.includes(m.homeTeam.id))
              existing.followedIds.push(m.homeTeam.id);
            if (followedIdSet.has(m.awayTeam.id) && !existing.followedIds.includes(m.awayTeam.id))
              existing.followedIds.push(m.awayTeam.id);
          } else {
            const followedIds: string[] = [];
            if (followedIdSet.has(m.homeTeam.id)) followedIds.push(m.homeTeam.id);
            if (followedIdSet.has(m.awayTeam.id)) followedIds.push(m.awayTeam.id);
            seenRecent.set(m.id, { ...m, followedIds });
          }
        }
      });

      // Sort upcoming ASC by date, recent DESC by date
      const sortedUpcoming = [...seenUpcoming.values()].sort(
        (a, b) => a.utcDate.localeCompare(b.utcDate),
      );
      const sortedRecent = [...seenRecent.values()].sort(
        (a, b) => b.utcDate.localeCompare(a.utcDate),
      );

      setUpcoming(sortedUpcoming);
      setRecent(sortedRecent);
      setLoading(false);
    });
  }, [teamIds]);

  return { upcoming, recent, loading, followedCount: followed.length, hasIds: teamIds.length };
}

// ── Content ──────────────────────────────────────────────────────────────────

function FollowingContent({ locale }: { locale: string }) {
  const { upcoming, recent, loading, followedCount, hasIds } = useFollowingFixtures();

  if (followedCount === 0) {
    return (
      <div className={styles.stateBox}>
        <Icon name="star" size={32} style={{ color: 'var(--text-faint)' }} />
        <div className={styles.stateTitle}>No teams followed yet</div>
        <div className={styles.stateBody}>
          Visit any team page and tap the star to follow them. Their upcoming fixtures and recent results will appear here.
        </div>
        <Link to={`/${locale}/competitions`} className="fs-btn ghost" style={{ textDecoration: 'none', height: 36, fontSize: 13 }}>
          Browse competitions
        </Link>
      </div>
    );
  }

  if (hasIds === 0) {
    return (
      <div className={styles.stateBox}>
        <Icon name="star" size={32} style={{ color: 'var(--text-faint)' }} />
        <div className={styles.stateTitle}>Teams followed, but no fixture data</div>
        <div className={styles.stateBody}>
          The teams you follow don't have an associated ID yet. Try visiting their team page first.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.stateBox}>
        <div className={styles.stateBody} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
          Loading fixtures…
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Upcoming</span>
          <span className={styles.sectionCount}>{upcoming.length}</span>
        </div>
        {upcoming.length === 0 ? (
          <div className={styles.emptySection}>No upcoming fixtures found</div>
        ) : (
          groupByComp(upcoming).map(({ competition, matches: ms }) => (
            <div key={competition} className={styles.compGroup}>
              <div className={styles.compGroupHeader}>{competition}</div>
              <div className={styles.matchList}>
                {ms.map(m => <FixtureRowItem key={m.id} match={m} locale={locale} />)}
              </div>
            </div>
          ))
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Recent Results</span>
          <span className={styles.sectionCount}>{recent.length}</span>
        </div>
        {recent.length === 0 ? (
          <div className={styles.emptySection}>No recent results found</div>
        ) : (
          groupByComp(recent).map(({ competition, matches: ms }) => (
            <div key={competition} className={styles.compGroup}>
              <div className={styles.compGroupHeader}>{competition}</div>
              <div className={styles.matchList}>
                {ms.map(m => <FixtureRowItem key={m.id} match={m} locale={locale} />)}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

// ── Desktop layout ────────────────────────────────────────────────────────────

function DesktopLayout({ locale }: { locale: SupportedLocale }) {
  return (
    <div className={styles.desktop}>
      <Sidebar locale={locale} />
      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Following</h1>
          <div className={styles.pageSubtitle}>Upcoming fixtures &amp; recent results from your teams</div>
        </div>
        <FollowingContent locale={locale} />
        <Footer />
      </main>
    </div>
  );
}

// ── Mobile layout ─────────────────────────────────────────────────────────────

function MobileLayout({ locale }: { locale: SupportedLocale }) {
  const navigate = useNavigate();
  return (
    <div className="screen">
      <div className={styles.mobTopBar}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}>
          <Icon name="chevron-left" size={20} />
        </button>
        <FSLogo size={24} />
        <span className={styles.mobTitle}>Following</span>
      </div>
      <div className="scroll" style={{ padding: '16px 16px 80px' }}>
        <FollowingContent locale={locale} />
      </div>
      <MobileBottomNav locale={locale} activeTab="follow" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FollowingPage({ locale }: FollowingPageProps) {
  useSEO({
    title: 'Following — Your Teams',
    description: 'Upcoming fixtures and recent results from the football teams you follow.',
    canonical: `/${locale}/following`,
  });

  return (
    <>
      <div className={styles.desktopOnly}>
        <DesktopLayout locale={locale} />
      </div>
      <div className={styles.mobileOnly}>
        <MobileLayout locale={locale} />
      </div>
    </>
  );
}
