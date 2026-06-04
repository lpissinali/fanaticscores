'use client';
import styles from './HomePage.module.css';
import { useState } from 'react';
import { useSEO } from '../../lib/useSEO';
import { useParams, useRouter} from 'next/navigation';
import Link from 'next/link';
import type { SupportedLocale } from '../../i18n';
import type { Competition, FeaturedMatch, Match, TrendingItem } from '../../lib/types';
import { useMatches } from '../../lib/useMatches';

import Sidebar from '../../components/layout/Sidebar/Sidebar';
import Footer from '../../components/layout/Footer/Footer';
import FSLogo from '../../components/shared/FSLogo/FSLogo';
import Crest from '../../components/shared/Crest/Crest';
import Icon from '../../components/shared/Icon/Icon';
import LiveDot from '../../components/shared/LiveDot/LiveDot';
import MatchRow from '../../components/shared/MatchRow/MatchRow';
import MomentumGraph from '../../components/shared/MomentumGraph/MomentumGraph';
import AIInsight from '../../components/shared/AIInsight/AIInsight';
import SearchModal     from '../../components/shared/SearchModal/SearchModal';
import ScheduleModal   from '../../components/shared/ScheduleModal/ScheduleModal';
import MobileBottomNav from '../../components/shared/MobileBottomNav/MobileBottomNav';

interface HomePageProps {
  locale: SupportedLocale;
}

// -----------------------------------------------------------------------
// DESKTOP
// -----------------------------------------------------------------------

function DesktopFeatured({ featured, locale }: { featured: FeaturedMatch | null; locale: string }) {
  if (!featured) {
    return (
      <div className={styles.featured} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
        <div className={styles.featuredGlow} aria-hidden="true" />
        <span style={{ color: 'var(--text-faint)', fontSize: 14 }}>No live match right now</span>
      </div>
    );
  }

  const m = featured;
  const hasStats = m.stats && (m.stats.shots[0] + m.stats.shots[1] > 0 || m.stats.possession[0] !== 50);

  return (
    <div className={styles.featured}>
      <div className={styles.featuredGlow} aria-hidden="true" />

      <div className={styles.featuredTop}>
        <div className={styles.featuredTopLeft}>
          {m.status === 'LIVE' ? (
            <span className="chip live">
              <LiveDot />
              Live &middot; {m.minute}&prime;
            </span>
          ) : m.status === 'HT' ? (
            <span className="chip ht">Half Time</span>
          ) : m.status === 'FT' ? (
            <span className="chip ft">Full Time</span>
          ) : (
            <span className="chip">{m.kickoff ?? 'Upcoming'}</span>
          )}
          <span className={styles.featuredCompLabel}>{m.compCountry ? `${m.compCountry} · ` : ''}{m.competition}</span>
        </div>
        <Link href={`/${locale}/studio/${m.id}`} className="fs-btn ghost" style={{ height: 32, padding: '0 12px', fontSize: 12, textDecoration: 'none' }}>
          <Icon name="share" size={14} /> Share match
        </Link>
      </div>

      <div className={styles.scoreGrid}>
        <div className={styles.teamLeft}>
          <Crest team={m.home} size="xl" />
          <div>
            <div className={styles.teamRole}>Home</div>
            <div className={styles.teamName}>{m.home.name}</div>
          </div>
        </div>

        <div className={styles.scoreBlock}>
          <span className={styles.score}>{m.home.score ?? '--'}</span>
          <span className={styles.scoreDash}>&ndash;</span>
          <span className={styles.score}>{m.away.score ?? '--'}</span>
        </div>

        <div className={styles.teamRight}>
          <div style={{ textAlign: 'right' }}>
            <div className={styles.teamRole}>Away</div>
            <div className={styles.teamName}>{m.away.name}</div>
          </div>
          <Crest team={m.away} size="xl" />
        </div>
      </div>

      {hasStats && (
        <div className={styles.statsRow}>
          <div className={styles.statMomentum}>
            <div className={styles.statLabel}>Momentum</div>
            {m.momentumSeries && m.momentumSeries.length > 0
              ? <MomentumGraph series={m.momentumSeries} height={40} />
              : <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>--</span>}
          </div>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>Possession</div>
            <div className={styles.statValue}>
              <span className={styles.statBig}>{m.stats.possession[0]}%</span>
              <span className={styles.statMeta}>vs {m.stats.possession[1]}%</span>
            </div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>Shots &middot; xG</div>
            <div className={styles.statValue}>
              <span className={styles.statBig}>
                {m.stats.shots[0]} &mdash; {m.stats.shots[1]}
              </span>
              <span className={styles.statMeta}>
                {m.stats.xG[0]} &mdash; {m.stats.xG[1]}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DesktopMatchSection({ comp }: { comp: Competition }) {
  const router = useRouter();
  const handleClick = (m: Match) => router.push(`/en/match/${m.id}`);
  return (
    <div className={styles.compBlock}>
      <div className={styles.compHeader} style={{ cursor: 'pointer' }} onClick={() => router.push(`/en/competition/${comp.id}`)}>
        <div className="lh-title">
          <span className="lh-flag" style={{ backgroundColor: comp.flag }} aria-hidden="true" />
          {comp.country} – {comp.name}
          {comp.stage && (
            <span className={styles.compStage}>&middot; {comp.stage}</span>
          )}
        </div>
        <Icon name="chevron-right" size={14} style={{ color: 'var(--text-faint)' }} />
      </div>
      {comp.matches.map((m) => (
        <MatchRow key={m.id} match={m} locale="en" onClick={handleClick} />
      ))}
    </div>
  );
}

function AIBriefCard({ brief }: { brief: string | null }) {
  const body = brief ?? 'Generating today\'s brief…';
  return (
    <div>
      <AIInsight title="Your AI brief" body={body} />
    </div>
  );
}

function ShareStudioPromo({ locale }: { locale: string }) {
  return (
    <div className={styles.studioPromo}>
      <div className={styles.studioPromoHeader}>
        <Icon name="sparkles" size={16} style={{ color: 'var(--orange)' }} />
        <span className={styles.studioPromoLabel}>New &middot; Share Studio</span>
      </div>
      <p className={styles.studioPromoHeading}>
        Turn any moment into a card you will want to post.
      </p>
      <Link href={`/${locale}/studio`} className="fs-btn primary" style={{ height: 34, fontSize: 12, textDecoration: 'none' }}>
        Open Studio &rarr;
      </Link>
    </div>
  );
}

function buildTrendingItems(competitions: Competition[]): TrendingItem[] {
  const items: TrendingItem[] = [];
  const BIG_COMPS = new Set(['UEFA Champions League', 'Premier League', 'Primera Division', 'Serie A', 'Bundesliga', 'Ligue 1']);

  for (const comp of competitions) {
    for (const m of comp.matches) {
      const h = m.home.short || m.home.name;
      const a = m.away.short || m.away.name;
      const hs = m.home.score;
      const as_ = m.away.score;
      const score = hs !== null && as_ !== null ? `${hs}–${as_}` : '';

      if (m.status === 'LIVE') {
        const min = m.minute ? ` ${m.minute}'` : '';
        const totalGoals = (hs ?? 0) + (as_ ?? 0);
        items.push({
          id: m.id, matchId: m.id,
          tag: totalGoals > 0 ? 'GOAL' : 'MOMENT',
          text: `${h} ${score} ${a}${min} — ${comp.name}`,
        });
      } else if (m.status === 'HT') {
        items.push({
          id: m.id, matchId: m.id,
          tag: 'MOMENT',
          text: `${h} ${score} ${a} · Half Time — ${comp.name}`,
        });
      } else if (m.status === 'FT' && hs !== null && as_ !== null && (hs + as_) >= 3) {
        // Only surface high-scoring finished games
        items.push({
          id: m.id, matchId: m.id,
          tag: 'RESULT',
          text: `${h} ${score} ${a} · Full Time — ${comp.name}`,
        });
      } else if (m.status === 'SCHEDULED' && m.kickoff && BIG_COMPS.has(comp.name)) {
        items.push({
          id: m.id, matchId: m.id,
          tag: 'MOMENT',
          text: `${h} vs ${a} · ${m.kickoff} — ${comp.name}`,
        });
      }
    }
  }

  // Priority: LIVE (GOAL > MOMENT) → HT → FT results → upcoming
  const priority: Record<string, number> = { GOAL: 4, RESULT: 3, MOMENT: 2 };
  items.sort((a, b) => {
    // LIVE items first (they have a minute), then rest
    const aLive = a.text.includes("'") ? 1 : 0;
    const bLive = b.text.includes("'") ? 1 : 0;
    if (aLive !== bLive) return bLive - aLive;
    return (priority[b.tag] ?? 0) - (priority[a.tag] ?? 0);
  });

  return items.slice(0, 7);
}

function TrendingCard({ competitions }: { competitions: Competition[] }) {
  const items = buildTrendingItems(competitions);
  if (items.length === 0) return null;
  return (
    <div className={styles.trending}>
      <div className={styles.trendingHeader}>
        <Icon name="flame" size={14} style={{ color: 'var(--orange)' }} />
        <span className={styles.trendingTitle}>Trending now</span>
      </div>
      <div className={styles.trendList}>
        {items.map((item) => (
          <div key={item.id} className={styles.trendItem}>
            <span className={styles.trendTag}>{item.tag}</span>
            <span className={styles.trendText}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


interface LayoutProps {
  locale?: SupportedLocale;
  featured: FeaturedMatch | null;
  competitions: Competition[];
  loading: boolean;
  error: string | null;
  hadErrors: boolean;
  resolvedDate: string;  // YYYY-MM-DD
  refresh: () => void;
  aiBrief: string | null;
}

function DesktopLayout({ locale, featured, competitions, loading, error, resolvedDate, aiBrief }: LayoutProps) {
  const [showSearch,    setShowSearch]    = useState(false);
  const [activeFilter,  setActiveFilter]  = useState<'all' | 'live'>('all');

  const LIVE_STATUSES = new Set(['LIVE', 'HT']);
  const liveCount = competitions.flatMap(c => c.matches).filter(m => LIVE_STATUSES.has(m.status)).length;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow  = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  let dateLabel: string;
  let pageTitle: string;
  if (resolvedDate === today) {
    dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    pageTitle = "Today's matches";
  } else if (resolvedDate === yesterday) {
    dateLabel = new Date(resolvedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    pageTitle = "Yesterday's matches";
  } else if (resolvedDate === tomorrow) {
    dateLabel = new Date(resolvedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    pageTitle = "Tomorrow's matches";
  } else {
    dateLabel = new Date(resolvedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    pageTitle = `Matches · ${dateLabel}`;
  }

  const display = activeFilter === 'live'
    ? competitions
        .map(c => ({ ...c, matches: c.matches.filter(m => LIVE_STATUSES.has(m.status)) }))
        .filter(c => c.matches.length > 0)
    : competitions;
  const pairs: [Competition, Competition | undefined][] = [];
  for (let i = 0; i < display.length; i += 2) pairs.push([display[i], display[i + 1]]);

  return (
    <div className={styles.desktop}>
      <Sidebar
        locale={locale ?? 'en'}
        liveCount={liveCount}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.eyebrow}>{dateLabel}</div>
            <h1 className={styles.pageTitle}>{pageTitle}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {error && (
              <span style={{ fontSize: 11, color: 'var(--live)', fontFamily: 'JetBrains Mono, monospace' }}>
                {error}
              </span>
            )}

            <div className={styles.searchField} role="button" tabIndex={0}
              onClick={() => setShowSearch(true)}
              onKeyDown={e => e.key === 'Enter' && setShowSearch(true)}>
              <Icon name="search" size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>
                Search teams, competitions&hellip;
              </span>
            </div>
            <Link href={`/${locale}/studio`} className="fs-btn primary" style={{ height: 38, textDecoration: 'none' }}>
              <Icon name="sparkles" size={14} style={{ color: '#1a0d04' }} />
              Share Studio
            </Link>
          </div>
        </div>

        <DesktopFeatured featured={loading ? null : (featured ?? null)} locale={locale ?? 'en'} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, marginTop: 24, flexGrow: 1, alignContent: 'start' }}>
          {loading && display.length === 0 ? (
            <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: '32px 0', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>
              Loading matches&hellip;
            </div>
          ) : display.length === 0 ? (
            <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: '32px 0', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>
              {error ? 'Could not load matches — retrying' : activeFilter === 'live' ? 'No live matches' : 'No matches scheduled'}
            </div>
          ) : (
            <div className={styles.matchGrid}>
              {pairs.map(([a, b]) => (
                <div key={a.id} style={{ display: 'contents' }}>
                  <DesktopMatchSection comp={a} />
                  {b && <DesktopMatchSection comp={b} />}
                </div>
              ))}
            </div>
          )}
        </div>

        <Footer />
      </main>

      <aside className={styles.rail}>
        <AIBriefCard brief={aiBrief} />
        <ShareStudioPromo locale={locale ?? 'en'} />
        <TrendingCard competitions={competitions} />
      </aside>
      {showSearch && <SearchModal locale={locale ?? 'en'} onClose={() => setShowSearch(false)} />}
    </div>
  );
}

// -----------------------------------------------------------------------
// MOBILE
// -----------------------------------------------------------------------


function MobileFeatured({ featured, locale }: { featured: FeaturedMatch | null; locale: string }) {
  if (!featured) {
    return (
      <div className={styles.mobFeatured} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
        <div className={styles.mobFeaturedGlow} aria-hidden="true" />
        <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>No live match right now</span>
      </div>
    );
  }

  const m = featured;
  return (
    <div className={styles.mobFeatured}>
      <div className={styles.mobFeaturedGlow} aria-hidden="true" />

      <div className={styles.mobFeaturedTop}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {m.status === 'LIVE' ? (
            <span className="chip live"><LiveDot />{m.minute}&prime;</span>
          ) : m.status === 'HT' ? (
            <span className="chip ht">HT</span>
          ) : m.status === 'FT' ? (
            <span className="chip ft">FT</span>
          ) : (
            <span className="chip">{m.kickoff ?? ''}</span>
          )}
          <span className={styles.mobCompLabel}>{m.compCountry ? `${m.compCountry} · ` : ''}{m.competition}</span>
        </div>
        <Link href={`/${locale}/studio/${m.id}`} className="fs-btn ghost" style={{ height: 28, padding: '0 10px', borderColor: 'transparent', fontSize: 12, textDecoration: 'none' }}>
          <Icon name="share" size={14} /> Share
        </Link>
      </div>

      <div className={styles.mobScoreRow}>
        <div className={styles.mobTeam}>
          <Crest team={m.home} size="lg" />
          <span className={styles.mobTeamName}>{m.home.short}</span>
        </div>
        <div className={styles.mobScore}>
          <span>{m.home.score ?? '--'}</span>
          <span className={styles.mobScoreSep}>:</span>
          <span>{m.away.score ?? '--'}</span>
        </div>
        <div className={styles.mobTeam}>
          <Crest team={m.away} size="lg" />
          <span className={styles.mobTeamName}>{m.away.short}</span>
        </div>
      </div>

      {m.momentumSeries && m.momentumSeries.length > 0 && (
        <div className={styles.mobMomentumBar}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.mobStatLabel}>Momentum</div>
            <MomentumGraph series={m.momentumSeries} height={28} />
          </div>
        </div>
      )}
    </div>
  );
}

function MobileLayout({ featured, competitions, loading, error, aiBrief, locale, resolvedDate }: LayoutProps) {
  const router = useRouter();
  const [activeTab,    setActiveTab]    = useState('all');
  const [showSchedule, setShowSchedule] = useState(false);
  const LIVE_STATUSES = new Set(['LIVE', 'HT']);
  const display = activeTab === 'live'
    ? competitions
        .map(c => ({ ...c, matches: c.matches.filter(m => LIVE_STATUSES.has(m.status)) }))
        .filter(c => c.matches.length > 0)
    : competitions;

  const todayYmd     = new Date().toISOString().slice(0, 10);
  const yesterdayYmd = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrowYmd  = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const datePills = [
    { label: 'Yesterday', ymd: yesterdayYmd },
    { label: 'Today',     ymd: todayYmd     },
    { label: 'Tomorrow',  ymd: tomorrowYmd  },
  ];

  const dateLabel = resolvedDate === todayYmd
    ? new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : new Date(resolvedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const liveCount = competitions.reduce((n, c) => n + c.matches.filter(m => LIVE_STATUSES.has(m.status)).length, 0);
  const allCount  = competitions.reduce((n, c) => n + c.matches.length, 0);

  const tabs = [
    { id: 'live', label: 'Live', count: liveCount },
    { id: 'all',  label: 'All',  count: allCount  },
  ];

  return (
    <div className="screen">
      <div className={styles.mobTopBar}>
        <FSLogo size={28} />

        <div className={styles.mobTopPills}>
          {datePills.map(({ label, ymd }) => {
            const isActive = resolvedDate === ymd;
            return (
              <button
                key={label}
                className="chip"
                onClick={() => router.push(ymd === todayYmd ? `/${locale ?? 'en'}/today` : `/${locale ?? 'en'}/${ymd}`)}
                style={{
                  background:  isActive ? 'var(--orange)' : 'var(--surface)',
                  color:       isActive ? '#1a0d04'       : 'var(--text-dim)',
                  borderColor: isActive ? 'transparent'   : 'var(--border)',
                  height: 24, padding: '0 10px', flex: '0 0 auto', cursor: 'pointer', fontSize: 11,
                }}
              >
                {label}
              </button>
            );
          })}
          <button
            className="chip"
            onClick={() => setShowSchedule(true)}
            style={{
              background: 'var(--surface)', color: 'var(--text-dim)',
              borderColor: 'var(--border)',
              height: 24, padding: '0 10px', flex: '0 0 auto', cursor: 'pointer', fontSize: 11,
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Icon name="calendar" size={12} />
          </button>
        </div>

      </div>

      <div className={styles.tabStrip} style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="fs-btn ghost"
              style={{
                height: 40, padding: '0 14px', borderRadius: 0,
                borderBottom: activeTab === t.id ? '2px solid var(--orange)' : '2px solid transparent',
                color: activeTab === t.id ? 'var(--text)' : 'var(--text-dim)',
                fontWeight: 700, fontSize: 13, gap: 6,
              }}
            >
              {t.label}
              <span style={{
                fontSize: 11, padding: '2px 6px', borderRadius: 999,
                background: activeTab === t.id ? 'var(--orange-soft)' : 'var(--surface)',
                color: activeTab === t.id ? 'var(--orange)' : 'var(--text-faint)',
              }}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className={styles.mobEyebrow} style={{ alignSelf: 'center', paddingRight: 2 }}>{dateLabel}</div>
      </div>

      <div className="scroll">
        <MobileFeatured featured={loading ? null : featured} locale={locale ?? 'en'} />

        <div style={{ padding: '0 16px 12px' }}>
          <AIInsight
            title="Your AI brief"
            body={aiBrief ?? 'Generating today\'s brief…'}
          />
        </div>

        {loading && display.length === 0 ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: '32px 16px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>
            Loading matches&hellip;
          </div>
        ) : display.length === 0 ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: '32px 16px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>
            {error ? 'Could not load matches — retrying' : 'No matches scheduled'}
          </div>
        ) : (
          display.map((comp) => (
            <div key={comp.id}>
              <div className="list-header" style={{ cursor: 'pointer' }} onClick={() => router.push(`/en/competition/${comp.id}`)}>
                <div className="lh-title">
                  <span className="lh-flag" style={{ backgroundColor: comp.flag }} aria-hidden="true" />
                  {comp.country} – {comp.name}
                  {comp.stage && (
                    <span style={{ color: 'var(--text-faint)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                      &middot; {comp.stage}
                    </span>
                  )}
                </div>
                <Icon name="chevron-right" size={14} style={{ color: 'var(--text-faint)' }} />
              </div>
              {comp.matches.map((m) => <MatchRow key={m.id} match={m} locale="en" onClick={(m) => router.push(`/en/match/${m.id}`)} />)}
            </div>
          ))
        )}

        <div style={{ padding: '0 16px' }}>
          <Footer />
        </div>
        <div style={{ height: 90 }} />
      </div>

      <MobileBottomNav locale={locale ?? 'en'} activeTab="home" />
      {showSchedule && <ScheduleModal locale={locale ?? 'en'} onClose={() => setShowSchedule(false)} />}
    </div>
  );
}

// -----------------------------------------------------------------------
// PAGE
// -----------------------------------------------------------------------

export default function HomePage({ locale }: HomePageProps) {
  const { date: dateParam } = useParams() as { date?: string };
  const today = new Date().toISOString().slice(0, 10);
  const resolvedDate = (!dateParam || dateParam === 'today') ? today : dateParam;

  useSEO({
    title: "Today's Football Scores & Live Results",
    description: 'Live football scores, real-time match updates, standings and AI match cards — all on FanaticScores.',
    canonical: `/${locale}/today`,
  });

  const { featured, competitions, loading, error, hadErrors, refresh, aiBrief } = useMatches(resolvedDate);
  return (
    <>
      <div className={styles.desktopOnly}>
        <DesktopLayout locale={locale} featured={featured} competitions={competitions} loading={loading} error={error} hadErrors={hadErrors} resolvedDate={resolvedDate} refresh={refresh} aiBrief={aiBrief} />
      </div>
      <div className={styles.mobileOnly}>
        <MobileLayout featured={featured} competitions={competitions} loading={loading} error={error} hadErrors={hadErrors} resolvedDate={resolvedDate} refresh={refresh} aiBrief={aiBrief} />
      </div>
    </>
  );
}
