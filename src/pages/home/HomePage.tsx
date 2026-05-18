import styles from './HomePage.module.css';
import { mockData } from '../../lib/mock';
import type { SupportedLocale } from '../../i18n';
import type { Competition, Match, TrendingItem } from '../../lib/types';

import Sidebar from '../../components/layout/Sidebar/Sidebar';
import Footer from '../../components/layout/Footer/Footer';
import FSLogo from '../../components/shared/FSLogo/FSLogo';
import Crest from '../../components/shared/Crest/Crest';
import Icon from '../../components/shared/Icon/Icon';
import LiveDot from '../../components/shared/LiveDot/LiveDot';
import MatchRow from '../../components/shared/MatchRow/MatchRow';
import MomentumGraph from '../../components/shared/MomentumGraph/MomentumGraph';
import AIInsight from '../../components/shared/AIInsight/AIInsight';
import AISigil from '../../components/shared/AISigil/AISigil';
import SplitBar from '../../components/shared/SplitBar/SplitBar';

interface HomePageProps {
  locale: SupportedLocale;
}

// ── Followed teams (mock — replace with user state / persistence) ────────────
const FOLLOWED: Array<{ name: string; initial: string; color: string }> = [
  { name: 'Manchester City', initial: 'M', color: '#6CABDD' },
  { name: 'Real Madrid',     initial: 'R', color: '#FEBE10' },
  { name: 'Barcelona',       initial: 'B', color: '#A50044' },
];

// ── Featured live match card ─────────────────────────────────────────────────
function FeaturedMatchCard() {
  const m = mockData.featuredMatch;
  return (
    <div className={styles.featured}>
      {/* Orange glow accent */}
      <div className={styles.featuredGlow} aria-hidden="true" />

      {/* Top row */}
      <div className={styles.featuredTop}>
        <span className={styles.featuredLive}>
          <LiveDot />
          <span>{m.minute}'</span>
        </span>
        <span className={styles.featuredComp}>{m.competition}</span>
        <button className="fs-btn ghost sm" aria-label="Share this match">
          <Icon name="share" size={14} />
        </button>
      </div>

      {/* Score grid */}
      <div className={styles.scoreGrid}>
        {/* Home */}
        <div className={styles.teamBlock}>
          <Crest team={m.home} size="xl" />
          <span className={styles.teamName}>{m.home.name}</span>
        </div>

        {/* Score */}
        <div className={styles.scoreBlock}>
          <span className={styles.score}>{m.home.score}</span>
          <span className={styles.scoreDash}>–</span>
          <span className={styles.score}>{m.away.score}</span>
        </div>

        {/* Away */}
        <div className={`${styles.teamBlock} ${styles.teamBlockAway}`}>
          <Crest team={m.away} size="xl" />
          <span className={styles.teamName}>{m.away.name}</span>
        </div>
      </div>

      {m.aggregate && (
        <p className={styles.aggregate}>{m.aggregate}</p>
      )}

      {/* Stats row */}
      <div className={styles.featuredStats}>
        <div className={styles.statItem}>
          <MomentumGraph series={m.momentumSeries} height={40} />
          <span className={styles.statLabel}>Momentum</span>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>
            <span>{m.stats.possession[0]}%</span>
            <span className={styles.statSeparator}>/</span>
            <span>{m.stats.possession[1]}%</span>
          </div>
          <span className={styles.statLabel}>Possession</span>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>
            <span>{m.stats.shots[0]}</span>
            <span className={styles.statSeparator}>/</span>
            <span>{m.stats.shots[1]}</span>
          </div>
          <span className={styles.statLabel}>Shots</span>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>
            <span>{m.stats.xG[0]}</span>
            <span className={styles.statSeparator}>/</span>
            <span>{m.stats.xG[1]}</span>
          </div>
          <span className={styles.statLabel}>xG</span>
        </div>
      </div>
    </div>
  );
}

// ── Match section (competition block) ────────────────────────────────────────
function MatchSection({ comp }: { comp: Competition }) {
  const handleMatchClick = (_match: Match) => {
    // TODO: navigate to match detail page
  };

  return (
    <div className={styles.compBlock}>
      <div className="list-header">
        <div className="lh-title">
          <span
            className="lh-flag"
            style={{ backgroundColor: comp.flag }}
            aria-hidden="true"
          />
          {comp.name}
          {comp.stage && <span className={styles.compStage}>{comp.stage}</span>}
        </div>
        <Icon name="chevron-right" size={14} style={{ color: 'var(--text-faint)' }} />
      </div>
      {comp.matches.map((match) => (
        <MatchRow key={match.id} match={match} onClick={handleMatchClick} />
      ))}
    </div>
  );
}

// ── Right rail: AI brief ──────────────────────────────────────────────────────
function AIBriefCard() {
  return (
    <AIInsight
      body={mockData.featuredMatch.aiPulse}
      showActions
    />
  );
}

// ── Right rail: Share Studio promo ───────────────────────────────────────────
function ShareStudioPromo() {
  return (
    <div className={styles.studiopromo}>
      <div className={styles.studioPromoHeader}>
        <AISigil size={14} />
        <span className={styles.studioPromoLabel}>New · Share Studio</span>
      </div>
      <p className={styles.studioPromoHeading}>Turn any moment into a post</p>
      <button className="fs-btn primary">
        <Icon name="sparkles" size={14} />
        Try Share Studio
      </button>
    </div>
  );
}

// ── Right rail: Trending now ─────────────────────────────────────────────────
const TAG_COLORS: Record<string, string> = {
  GOAL:   'var(--green)',
  RED:    'var(--live)',
  MOMENT: 'var(--orange)',
  RESULT: 'var(--text-dim)',
};

function TrendingCard({ items }: { items: TrendingItem[] }) {
  return (
    <div className={styles.trending}>
      <div className={styles.trendingHeader}>
        <Icon name="flame" size={14} style={{ color: 'var(--orange)' }} />
        <span className={styles.trendingTitle}>Trending now</span>
      </div>
      {items.map((item) => (
        <div key={item.id} className={styles.trendItem}>
          <span
            className={styles.trendTag}
            style={{ color: TAG_COLORS[item.tag] ?? 'var(--text-faint)' }}
          >
            {item.tag}
          </span>
          <span className={styles.trendText}>{item.text}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main desktop layout ───────────────────────────────────────────────────────
function DesktopLayout({ locale }: { locale: SupportedLocale }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Exclude the featured match from the competition list to avoid duplicate
  const competitions = mockData.competitions.map((comp) => ({
    ...comp,
    matches: comp.matches.filter((m) => !m.featured),
  })).filter((comp) => comp.matches.length > 0);

  // Pair competitions into 2 columns
  const pairs: [Competition, Competition | undefined][] = [];
  for (let i = 0; i < competitions.length; i += 2) {
    pairs.push([competitions[i], competitions[i + 1]]);
  }

  return (
    <div className={styles.desktop}>
      {/* Left sidebar */}
      <Sidebar locale={locale} followedTeams={FOLLOWED} />

      {/* Main column */}
      <main className={styles.main}>
        {/* Page header */}
        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderLeft}>
            <span className={`${styles.eyebrow} fs-mono`}>{dateStr}</span>
            <h1 className={styles.pageTitle}>Today's matches</h1>
          </div>
          <div className={styles.pageHeaderRight}>
            <div className={styles.searchField}>
              <Icon name="search" size={14} style={{ color: 'var(--text-faint)' }} />
              <input
                type="search"
                placeholder="Search teams, competitions…"
                className={styles.searchInput}
                aria-label="Search"
              />
            </div>
            <button className="fs-btn primary">
              <Icon name="sparkles" size={14} />
              Share Studio
            </button>
          </div>
        </div>

        {/* Featured live match */}
        <FeaturedMatchCard />

        {/* Match grid — 2 columns */}
        <div className={styles.matchGrid}>
          {pairs.map(([a, b], i) => (
            <div key={i} className={styles.matchGridRow}>
              <MatchSection comp={a} />
              {b && <MatchSection comp={b} />}
            </div>
          ))}
        </div>

        <Footer />
      </main>

      {/* Right rail */}
      <aside className={styles.rail}>
        <AIBriefCard />
        <ShareStudioPromo />
        {mockData.trending && <TrendingCard items={mockData.trending} />}
      </aside>
    </div>
  );
}

// ── Mobile layout ─────────────────────────────────────────────────────────────
function MobileLayout() {
  return (
    <div className="screen">
      {/* Top bar */}
      <div className={styles.mobileTopBar}>
        <FSLogo size={28} />
        <div className={styles.mobileTopBarActions}>
          <button className="fs-btn ghost sm" aria-label="Search">
            <Icon name="search" size={16} />
          </button>
          <button className="fs-btn ghost sm" aria-label="Profile">
            <Icon name="user" size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="scroll">
        {/* AI brief */}
        <div className={styles.mobilePad}>
          <AIInsight body={mockData.featuredMatch.aiPulse} />
        </div>

        {/* Featured match (compact) */}
        <div className={styles.mobilePad}>
          <div className={styles.mobileFeatured}>
            <div className={styles.mobileFeaturedTop}>
              <span className={styles.featuredLive}>
                <LiveDot />
                <span>{mockData.featuredMatch.minute}'</span>
              </span>
              <span className={styles.featuredComp}>{mockData.featuredMatch.competition}</span>
            </div>
            <div className={styles.mobileScoreRow}>
              <div className={styles.mobileTeam}>
                <Crest team={mockData.featuredMatch.home} size="lg" />
                <span className={styles.mobileTeamName}>{mockData.featuredMatch.home.short}</span>
              </div>
              <div className={styles.mobileScore}>
                <span>{mockData.featuredMatch.home.score}</span>
                <span className={styles.mobileScoreDash}>–</span>
                <span>{mockData.featuredMatch.away.score}</span>
              </div>
              <div className={`${styles.mobileTeam} ${styles.mobileTeamRight}`}>
                <Crest team={mockData.featuredMatch.away} size="lg" />
                <span className={styles.mobileTeamName}>{mockData.featuredMatch.away.short}</span>
              </div>
            </div>
            <MomentumGraph series={mockData.featuredMatch.momentumSeries} height={36} />
          </div>
        </div>

        {/* Match list by competition */}
        {mockData.competitions.map((comp) => (
          <div key={comp.id}>
            <div className="list-header" style={{ background: 'var(--bg)' }}>
              <div className="lh-title">
                <span
                  className="lh-flag"
                  style={{ backgroundColor: comp.flag }}
                  aria-hidden="true"
                />
                {comp.short}
              </div>
            </div>
            {comp.matches.map((match) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </div>
        ))}

        {/* Stats bar from featured match */}
        <div className={styles.mobilePad} style={{ marginTop: 16 }}>
          <div className={styles.mobileStatBlock}>
            <span className={styles.mobileStatTitle}>
              {mockData.featuredMatch.home.short} vs {mockData.featuredMatch.away.short} — Live stats
            </span>
            <SplitBar
              label="Possession"
              homeValue={mockData.featuredMatch.stats.possession[0]}
              awayValue={mockData.featuredMatch.stats.possession[1]}
              homeColor={mockData.featuredMatch.home.color}
              awayColor={mockData.featuredMatch.away.color}
              isPercent
            />
            <SplitBar
              label="Shots"
              homeValue={mockData.featuredMatch.stats.shots[0]}
              awayValue={mockData.featuredMatch.stats.shots[1]}
              homeColor={mockData.featuredMatch.home.color}
              awayColor={mockData.featuredMatch.away.color}
            />
            <SplitBar
              label="xG"
              homeValue={mockData.featuredMatch.stats.xG[0]}
              awayValue={mockData.featuredMatch.stats.xG[1]}
              homeColor={mockData.featuredMatch.home.color}
              awayColor={mockData.featuredMatch.away.color}
            />
          </div>
        </div>
      </div>

      {/* Bottom tab bar */}
      <nav className={styles.bottomTabs} aria-label="Bottom navigation">
        {[
          { id: 'today',  icon: 'home'     as const, label: 'Today'   },
          { id: 'live',   icon: 'zap'      as const, label: 'Live'    },
          { id: 'studio', icon: 'sparkles' as const, label: 'Studio'  },
          { id: 'profile',icon: 'user'     as const, label: 'Profile' },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tabBtn} ${tab.id === 'today' ? styles.tabActive : ''}`}
            aria-label={tab.label}
          >
            <Icon name={tab.icon} size={20} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── Page entry point ──────────────────────────────────────────────────────────
export default function HomePage({ locale }: HomePageProps) {
  return (
    <>
      {/* Desktop (≥1024px) */}
      <div className={styles.desktopOnly}>
        <DesktopLayout locale={locale} />
      </div>
      {/* Mobile (<1024px) */}
      <div className={styles.mobileOnly}>
        <MobileLayout />
      </div>
    </>
  );
}
