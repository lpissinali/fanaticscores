import styles from './HomePage.module.css';
import { mockData } from '../../lib/mock';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { SupportedLocale } from '../../i18n';
import type { Competition, FeaturedMatch, Match, TrendingItem } from '../../lib/types';
import { useMatches } from '../../lib/useMatches';

import Sidebar from '../../components/layout/Sidebar/Sidebar';
import FSLogo from '../../components/shared/FSLogo/FSLogo';
import Crest from '../../components/shared/Crest/Crest';
import Icon from '../../components/shared/Icon/Icon';
import LiveDot from '../../components/shared/LiveDot/LiveDot';
import MatchRow from '../../components/shared/MatchRow/MatchRow';
import MomentumGraph from '../../components/shared/MomentumGraph/MomentumGraph';
import AIInsight from '../../components/shared/AIInsight/AIInsight';
import ScheduleModal from '../../components/shared/ScheduleModal/ScheduleModal';

interface HomePageProps {
  locale: SupportedLocale;
}

// -----------------------------------------------------------------------
// DESKTOP
// -----------------------------------------------------------------------

function DesktopFeatured({ featured }: { featured: FeaturedMatch | null }) {
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
          <span className={styles.featuredCompLabel}>{m.competition}</span>
        </div>
        <button className="fs-btn ghost" style={{ height: 32, padding: '0 12px', fontSize: 12 }}>
          <Icon name="share" size={14} /> Share match
        </button>
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
  const handleClick = (_m: Match) => {};
  return (
    <div className={styles.compBlock}>
      <div className={styles.compHeader}>
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
        <MatchRow key={m.id} match={m} onClick={handleClick} />
      ))}
    </div>
  );
}

function AIBriefCard() {
  return (
    <div>
      <AIInsight
        title="Your AI brief"
        body="2 of your teams play tonight. The City-Madrid tie is tilting toward Pep's side; expect City to push for a decisive third in the next 15 minutes based on the pressure curve."
      />
      <div className={styles.aiActions}>
        <button className="fs-btn ghost" style={{ flex: 1, height: 34, fontSize: 12 }}>
          Ask anything
        </button>
        <button className="fs-btn ghost" style={{ flex: 1, height: 34, fontSize: 12 }}>
          Tonight's read
        </button>
      </div>
    </div>
  );
}

function ShareStudioPromo() {
  return (
    <div className={styles.studioPromo}>
      <div className={styles.studioPromoHeader}>
        <Icon name="sparkles" size={16} style={{ color: 'var(--orange)' }} />
        <span className={styles.studioPromoLabel}>New &middot; Share Studio</span>
      </div>
      <p className={styles.studioPromoHeading}>
        Turn any moment into a card you will want to post.
      </p>
      <button className="fs-btn primary" style={{ height: 34, fontSize: 12 }}>
        Open Studio &rarr;
      </button>
    </div>
  );
}

function TrendingCard({ items }: { items: TrendingItem[] }) {
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

function DesktopFooter() {
  const year = new Date().getFullYear();
  const linkStyle: React.CSSProperties = {
    display: 'block', fontSize: 12.5, color: 'var(--text-dim)',
    textDecoration: 'none', padding: '4px 0', cursor: 'pointer',
  };
  const colTitleStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 800, letterSpacing: '0.16em',
    textTransform: 'uppercase', color: 'var(--text-faint)',
    marginBottom: 12, fontFamily: 'JetBrains Mono, monospace',
  };

  return (
    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div>
          <FSLogo size={56} />
          <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.55, margin: '14px 0 0', maxWidth: 280 }}>
            Live scores, AI Pulse and Share Studio for football fans.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            {[['X','x'],['IG','instagram'],['TT','tiktok']].map(([label, id]) => (
              <a key={id} style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'var(--surface)', border: '1px solid var(--border)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-dim)', textDecoration: 'none',
                fontSize: 11, fontWeight: 800,
              }}>{label}</a>
            ))}
          </div>
        </div>

        <div>
          <div style={colTitleStyle}>Product</div>
          {['Live scores','AI Pulse','Share Studio','Competitions'].map((l) => (
            <a key={l} style={linkStyle}>{l}</a>
          ))}
        </div>

        <div>
          <div style={colTitleStyle}>Company</div>
          {['About','Press','Careers','Contact'].map((l) => (
            <a key={l} style={linkStyle}>{l}</a>
          ))}
        </div>

        <div>
          <div style={colTitleStyle}>Get the app</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a className={styles.storeBadge}>
              <svg width="20" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 12.04c-.03-2.95 2.41-4.37 2.52-4.44-1.37-2.01-3.51-2.28-4.27-2.31-1.81-.18-3.54 1.07-4.46 1.07-.93 0-2.34-1.04-3.85-1.01-1.98.03-3.81 1.15-4.83 2.92-2.06 3.58-.53 8.87 1.48 11.78.98 1.42 2.15 3.02 3.69 2.96 1.48-.06 2.04-.96 3.83-.96 1.78 0 2.29.96 3.86.93 1.59-.03 2.6-1.45 3.57-2.88 1.13-1.65 1.59-3.25 1.62-3.34-.04-.02-3.11-1.2-3.16-4.72zM14.13 3.36c.81-.99 1.36-2.36 1.21-3.73-1.17.05-2.59.79-3.43 1.77-.75.86-1.42 2.27-1.24 3.61 1.31.1 2.65-.66 3.46-1.65z"/>
              </svg>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Download on the</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 1 }}>App Store</div>
              </div>
            </a>
            <a className={styles.storeBadge}>
              <svg width="20" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3.6 1.3c-.4.4-.6 1-.6 1.7v18c0 .7.2 1.3.6 1.7l10.1-10.7L3.6 1.3zm11.5 11.4 2.7 2.9-12.1 7c-.3.2-.6.2-.9.1l10.3-10zm0-2.4-10.3-10c.3-.1.6-.1.9.1l12.1 7-2.7 2.9zm5.7 3.5-3-1.7 2.8-3 3 1.7c.9.5.9 1.9-.1 2.4l-2.7 1z"/>
              </svg>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Get it on</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 1 }}>Google Play</div>
              </div>
            </a>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <span style={{ fontSize: 11.5, color: 'var(--text-faint)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.04em' }}>
            &copy; {year} Fanatic Scores &middot; Not affiliated with any league or club
          </span>
          <div style={{ display: 'flex', gap: 22 }}>
            {['Terms','Privacy','Cookies','Data sources','Status'].map((l) => (
              <a key={l} style={{ fontSize: 11.5, color: 'var(--text-dim)', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

interface LayoutProps {
  locale?: SupportedLocale;
  featured: FeaturedMatch | null;
  competitions: Competition[];
  loading: boolean;
  error: string | null;
  resolvedDate: string;  // YYYY-MM-DD
}

function DesktopLayout({ locale, featured, competitions, loading, error, resolvedDate }: LayoutProps) {
  const [showSchedule, setShowSchedule] = useState(false);

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

  const display = competitions.length > 0 ? competitions : (loading ? [] : mockData.competitions);
  const pairs: [Competition, Competition | undefined][] = [];
  for (let i = 0; i < display.length; i += 2) pairs.push([display[i], display[i + 1]]);

  return (
    <div className={styles.desktop}>
      <Sidebar locale={locale ?? 'en'} onScheduleClick={() => setShowSchedule(true)} />

      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.eyebrow}>{dateLabel}</div>
            <h1 className={styles.pageTitle}>{pageTitle}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {error && (
              <span style={{ fontSize: 11, color: 'var(--live)', fontFamily: 'JetBrains Mono, monospace' }}>
                API error &mdash; retrying
              </span>
            )}
            <div className={styles.searchField}>
              <Icon name="search" size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>
                Search teams, competitions&hellip;
              </span>
            </div>
            <button className="fs-btn primary" style={{ height: 38 }}>
              <Icon name="sparkles" size={14} style={{ color: '#1a0d04' }} />
              Share Studio
            </button>
          </div>
        </div>

        <DesktopFeatured featured={loading ? null : (featured ?? null)} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, marginTop: 24 }}>
          {loading && display.length === 0 ? (
            <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: '32px 0', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>
              Loading matches&hellip;
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {pairs.map(([a, b]) => (
                <div key={a.id} style={{ display: 'contents' }}>
                  <DesktopMatchSection comp={a} />
                  {b && <DesktopMatchSection comp={b} />}
                </div>
              ))}
            </div>
          )}
        </div>

        <DesktopFooter />
      </main>

      <aside className={styles.rail}>
        <AIBriefCard />
        <ShareStudioPromo />
        {mockData.trending && <TrendingCard items={mockData.trending} />}
      </aside>
      {showSchedule && <ScheduleModal locale={locale ?? 'en'} onClose={() => setShowSchedule(false)} />}
    </div>
  );
}

// -----------------------------------------------------------------------
// MOBILE
// -----------------------------------------------------------------------

const DATE_PILLS = ['Yesterday', 'Today', 'Tomorrow', 'Sat', 'Sun', 'Mon'];
const BOTTOM_TABS = [
  { id: 'home',   label: 'Today',        icon: 'home'     as const },
  { id: 'comp',   label: 'Competitions', icon: 'trophy'   as const },
  { id: 'share',  label: 'Share',        icon: 'sparkles' as const, accent: true },
  { id: 'follow', label: 'Following',    icon: 'star'     as const },
  { id: 'me',     label: 'Me',           icon: 'user'     as const },
];

function MobileFeatured({ featured }: { featured: FeaturedMatch | null }) {
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
          <span className={styles.mobCompLabel}>{m.competition}</span>
        </div>
        <button className="fs-btn ghost" style={{ height: 28, padding: '0 10px', borderColor: 'transparent', fontSize: 12 }}>
          <Icon name="share" size={14} /> Share
        </button>
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

function MobileLayout({ featured, competitions, loading }: LayoutProps) {
  const [activeTab, setActiveTab] = useState('all');
  const display = competitions.length > 0 ? competitions : (loading ? [] : mockData.competitions);

  const liveCount = display.reduce((n, c) => n + c.matches.filter(m => m.status === 'LIVE').length, 0);
  const allCount  = display.reduce((n, c) => n + c.matches.length, 0);

  const tabs = [
    { id: 'live', label: 'Live',      count: liveCount },
    { id: 'all',  label: 'All',       count: allCount  },
    { id: 'favs', label: 'Following', count: 0         },
  ];

  return (
    <div className="screen">
      <div className={styles.mobTopBar}>
        <FSLogo size={28} />
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="fs-btn ghost" style={{ width: 36, height: 36, padding: 0, borderColor: 'transparent' }}>
            <Icon name="search" size={18} />
          </button>
          <button className="fs-btn ghost" style={{ width: 36, height: 36, padding: 0, borderColor: 'transparent' }}>
            <Icon name="bell" size={18} />
          </button>
        </div>
      </div>

      <div className={styles.datePills}>
        {DATE_PILLS.map((d, i) => (
          <button key={d} className="chip" style={{
            background: i === 1 ? 'var(--orange)' : 'var(--surface)',
            color: i === 1 ? '#1a0d04' : 'var(--text-dim)',
            borderColor: i === 1 ? 'transparent' : 'var(--border)',
            height: 32, padding: '0 14px', flex: '0 0 auto', cursor: 'pointer',
          }}>{d}</button>
        ))}
      </div>

      <div className={styles.tabStrip}>
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

      <div className="scroll">
        <MobileFeatured featured={loading ? null : featured} />

        <div style={{ padding: '0 16px 12px' }}>
          <AIInsight
            title="Your AI brief"
            body="3 of your teams play tonight. City-Madrid is heating up at 2-2. Liverpool look comfortable. Kickoff alert set for Botafogo-Corinthians."
          />
        </div>

        {loading && display.length === 0 ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: '32px 16px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>
            Loading matches&hellip;
          </div>
        ) : (
          display.map((comp) => (
            <div key={comp.id}>
              <div className="list-header">
                <div className="lh-title">
                  <span className="lh-flag" style={{ backgroundColor: comp.flag }} aria-hidden="true" />
                  {comp.country} – {comp.name}
                  {comp.stage && (
                    <span style={{ color: 'var(--text-faint)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                      &middot; {comp.stage}
                    </span>
                  )}
                </div>
                <Icon name="star" size={14} style={{ color: 'var(--text-faint)' }} />
              </div>
              {comp.matches.map((m) => <MatchRow key={m.id} match={m} />)}
            </div>
          ))
        )}

        <div style={{ height: 90 }} />
      </div>

      <nav className={styles.bottomTabs} aria-label="Main navigation" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {BOTTOM_TABS.map((t) => (
          t.accent
            ? (
              <button key={t.id} className="fs-btn" style={{
                flexDirection: 'column', gap: 2, height: 50, padding: 0,
                borderColor: 'transparent', background: 'var(--orange)', color: '#1a0d04',
              }}>
                <Icon name={t.icon} size={20} />
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em' }}>{t.label}</span>
              </button>
            ) : (
              <button key={t.id} className="fs-btn ghost" style={{
                flexDirection: 'column', gap: 4, height: 50, padding: 0,
                borderColor: 'transparent',
                color: t.id === 'home' ? 'var(--text)' : 'var(--text-faint)',
              }}>
                <Icon name={t.icon} size={20} />
                <span style={{ fontSize: 10, fontWeight: 600 }}>{t.label}</span>
              </button>
            )
        ))}
      </nav>
    </div>
  );
}

// -----------------------------------------------------------------------
// PAGE
// -----------------------------------------------------------------------

export default function HomePage({ locale }: HomePageProps) {
  const { date: dateParam } = useParams<{ date?: string }>();
  const today = new Date().toISOString().slice(0, 10);
  const resolvedDate = (!dateParam || dateParam === 'today') ? today : dateParam;

  const { featured, competitions, loading, error } = useMatches(resolvedDate);
  return (
    <>
      <div className={styles.desktopOnly}>
        <DesktopLayout locale={locale} featured={featured} competitions={competitions} loading={loading} error={error} resolvedDate={resolvedDate} />
      </div>
      <div className={styles.mobileOnly}>
        <MobileLayout featured={featured} competitions={competitions} loading={loading} error={error} resolvedDate={resolvedDate} />
      </div>
    </>
  );
}
