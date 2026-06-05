/**
 * Team page — Server Component.
 * Matches the layout of the live client-side TeamPage exactly:
 * desktop (sidebar + main + rail) and mobile (top-bar + scroll + bottom-nav).
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchTeamDetail } from '@/lib/serverApi/teamDetails';
import type { TeamDetailData, TeamInfo, TeamPlayer, TeamMatch } from '@/lib/serverApi/teamDetails';
import Sidebar from '@/src/components/layout/Sidebar/Sidebar';
import Footer from '@/src/components/layout/Footer/Footer';
import RailPromo from '@/src/components/shared/RailPromo/RailPromo';
import Icon from '@/src/components/shared/Icon/Icon';
import MobileBottomNav from '@/src/components/shared/MobileBottomNav/MobileBottomNav';
import FollowButton from '@/src/components/shared/FollowButton/FollowButton';
import styles from '@/src/views/team/TeamPage.module.css';

interface Props { params: Promise<{ teamId: string }> }

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { teamId } = await params;
  const data = await fetchTeamDetail(teamId);
  if (!data) return { title: 'Team' };
  const title = `${data.info.name} — Results & Squad`;
  const desc  = `Fixtures, results and squad for ${data.info.name}${data.info.venue ? `, based at ${data.info.venue}` : ''}.`;
  return {
    title, description: desc,
    alternates: { canonical: `/en/team/${teamId}` },
    openGraph: { title, description: desc, url: `/en/team/${teamId}`, images: data.info.crest ? [{ url: data.info.crest }] : [] },
    twitter: { title, description: desc },
  };
}

// ── Position meta ──────────────────────────────────────────────────────────────

const POSITION_ORDER = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Unknown'] as const;
const POSITION_META: Record<string, { label: string; abbr: string; color: string; bg: string }> = {
  Goalkeeper: { label: 'Goalkeepers', abbr: 'GK', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  Defender:   { label: 'Defenders',   abbr: 'DF', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  Midfielder: { label: 'Midfielders', abbr: 'MF', color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  Forward:    { label: 'Forwards',    abbr: 'FW', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  Unknown:    { label: 'Other',       abbr: '–',  color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function Hero({ info, teamId }: { info: TeamInfo; teamId: string }) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroGlow} aria-hidden="true" />
      <FollowButton teamId={teamId} teamName={info.name} teamCrest={info.crest ?? undefined} tla={info.tla} />
      <div className={styles.heroInner}>
        {info.crest
          ? <img src={info.crest} alt={info.name} className={styles.crest} width={80} height={80} style={{ objectFit: 'contain' }} />
          : <div className={styles.crestPlaceholder}><Icon name="trophy" size={32} /></div>
        }
        <div className={styles.heroText}>
          {info.tla && <div className={styles.heroTla}>{info.tla}</div>}
          <h1 className={styles.heroName}>{info.name}</h1>
          <div className={styles.heroChips}>
            {info.founded && <span className="chip">Est. {info.founded}</span>}
            {info.venue   && <span className="chip"><Icon name="home" size={11} style={{ marginRight: 4 }} />{info.venue}</span>}
          </div>
          {info.runningCompetitions.length > 0 && (
            <div className={styles.compChips}>
              {info.runningCompetitions.map(c => (
                <Link key={c.id} href={`/en/competition/${c.code}`} className={styles.compChip}>
                  {c.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchRowItem({ m, teamId }: { m: TeamMatch; teamId: string }) {
  const isHome    = m.homeTeam.id === teamId;
  const opponent  = isHome ? m.awayTeam : m.homeTeam;
  const teamScore = isHome ? m.homeTeam.score : m.awayTeam.score;
  const oppScore  = isHome ? m.awayTeam.score  : m.homeTeam.score;
  const isScheduled = m.status === 'SCHEDULED' || m.status === 'TIMED';

  let resultTag: 'W' | 'D' | 'L' | null = null;
  if (!isScheduled && teamScore !== null && oppScore !== null) {
    resultTag = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'D';
  }

  const date = new Date(m.utcDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = new Date(m.utcDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <Link href={`/en/match/${m.id}`} className={styles.matchRow}>
      <div className={styles.matchDateCell}>
        <span className={styles.matchDate}>{date}</span>
        {isScheduled && <span className={styles.matchTime}>{time}</span>}
      </div>
      <div className={styles.matchVenue}>{isHome ? 'H' : 'A'}</div>
      <img src={opponent.crest} alt={opponent.name} width={20} height={20} className={styles.matchCrest} style={{ objectFit: 'contain' }} />
      <div className={styles.matchOpponent}>{opponent.name}</div>
      <div className={styles.matchComp}>{m.competition}</div>
      {!isScheduled && (
        <div className={styles.matchScore}>{teamScore ?? '–'} – {oppScore ?? '–'}</div>
      )}
      {resultTag && (
        <span className={[styles.resultTag, styles[`result${resultTag}`]].join(' ')}>{resultTag}</span>
      )}
    </Link>
  );
}

function SquadSection({ squad }: { squad: TeamPlayer[] }) {
  if (squad.length === 0) return null;
  const grouped = POSITION_ORDER.reduce<Record<string, TeamPlayer[]>>((acc, pos) => {
    const players = squad.filter(p => p.position === pos);
    if (players.length > 0) acc[pos] = players;
    return acc;
  }, {});
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Squad</h2>
      <div className={styles.squadWrapper}>
        {Object.entries(grouped).map(([pos, players]) => {
          const meta = POSITION_META[pos] ?? POSITION_META.Unknown;
          return (
            <div key={pos} className={styles.positionGroup}>
              <div className={styles.positionHeader} style={{ borderLeftColor: meta.color }}>
                <span className={styles.positionAbbr} style={{ color: meta.color, background: meta.bg }}>{meta.abbr}</span>
                <span className={styles.positionLabel}>{meta.label}</span>
                <span className={styles.positionCount}>{players.length}</span>
              </div>
              <div className={styles.playerList}>
                {players.map((p, i) => (
                  <div key={p.id} className={styles.playerRow}>
                    <span className={styles.playerIndex}>{i + 1}</span>
                    <span className={styles.playerRowName}>{p.name}</span>
                    {p.age != null && <span className={styles.playerAge}>{p.age}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MainContent({ data, teamId }: { data: TeamDetailData; teamId: string }) {
  const { info, recentMatches, upcomingMatches } = data;
  return (
    <>
      <Hero info={info} teamId={teamId} />

      {(info.coach || info.website) && (
        <div className={styles.infoGrid}>
          {info.coach && (
            <div className={styles.infoCard}>
              <div className={styles.infoLabel}>Head Coach</div>
              <div className={styles.infoValue}>{info.coach.name}</div>
              {info.coach.nationality && <div className={styles.infoSub}>{info.coach.nationality}</div>}
            </div>
          )}
          {info.website && (
            <div className={styles.infoCard}>
              <div className={styles.infoLabel}>Website</div>
              <a href={info.website} target="_blank" rel="noopener noreferrer" className={styles.websiteLink}>
                {info.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </div>
          )}
        </div>
      )}

      {upcomingMatches.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Upcoming Fixtures</h2>
          <div className={styles.matchList}>
            {upcomingMatches.map(m => <MatchRowItem key={m.id} m={m} teamId={teamId} />)}
          </div>
        </div>
      )}

      {recentMatches.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Recent Results</h2>
          <div className={styles.matchList}>
            {recentMatches.map(m => <MatchRowItem key={m.id} m={m} teamId={teamId} />)}
          </div>
        </div>
      )}

      <SquadSection squad={info.squad} />
    </>
  );
}

function Rail({ data, teamId }: { data: TeamDetailData; teamId: string }) {
  const recent = data.recentMatches;
  const wins   = recent.filter(m => { const isHome = m.homeTeam.id === teamId; const ts = isHome ? m.homeTeam.score : m.awayTeam.score; const os = isHome ? m.awayTeam.score : m.homeTeam.score; return ts !== null && os !== null && ts > os; }).length;
  const draws  = recent.filter(m => { const isHome = m.homeTeam.id === teamId; const ts = isHome ? m.homeTeam.score : m.awayTeam.score; const os = isHome ? m.awayTeam.score : m.homeTeam.score; return ts !== null && os !== null && ts === os; }).length;
  const losses = recent.length - wins - draws;

  return (
    <aside className={styles.rail}>
      <RailPromo locale="en" />
      {recent.length > 0 && (
        <div className={styles.railCard}>
          <div className={styles.railCardTitle}>Recent Form</div>
          <div className={styles.formDots}>
            {recent.map(m => {
              const isHome = m.homeTeam.id === teamId;
              const ts = isHome ? m.homeTeam.score : m.awayTeam.score;
              const os = isHome ? m.awayTeam.score  : m.homeTeam.score;
              const r  = ts === null || os === null ? 'D' : ts > os ? 'W' : ts < os ? 'L' : 'D';
              return (
                <span key={m.id}
                  className={[styles.formDot, r === 'W' ? styles.formW : r === 'L' ? styles.formL : styles.formD].join(' ')}
                  title={r === 'W' ? 'Win' : r === 'L' ? 'Loss' : 'Draw'}
                >{r}</span>
              );
            })}
          </div>
          <div className={styles.recordGrid} style={{ marginTop: 12 }}>
            <div className={styles.recordCell}><span className={styles.recordNum} style={{ color: '#4ade80' }}>{wins}</span><span className={styles.recordLabel}>Won</span></div>
            <div className={styles.recordCell}><span className={styles.recordNum}>{draws}</span><span className={styles.recordLabel}>Drawn</span></div>
            <div className={styles.recordCell}><span className={styles.recordNum} style={{ color: '#f87171' }}>{losses}</span><span className={styles.recordLabel}>Lost</span></div>
          </div>
        </div>
      )}
    </aside>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TeamPage({ params }: Props) {
  const { teamId } = await params;
  const data = await fetchTeamDetail(teamId);
  if (!data) notFound();
  const d = data as TeamDetailData;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: d.info.name,
    sport: 'Football',
    url: `https://www.fanaticscores.com/en/team/${teamId}`,
    ...(d.info.founded && { foundingDate: String(d.info.founded) }),
    ...(d.info.venue && { location: { '@type': 'Place', name: d.info.venue } }),
    ...(d.info.crest && { logo: d.info.crest }),
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',      item: 'https://www.fanaticscores.com/en/today' },
      { '@type': 'ListItem', position: 2, name: d.info.name, item: `https://www.fanaticscores.com/en/team/${teamId}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      {/* ── DESKTOP ─────────────────────────────────────── */}
      <div className={styles.desktopOnly}>
        <div className={styles.desktop}>
          <Sidebar locale="en" />
          <main className={styles.main}>
            <Link href="/en/today" className={styles.backBtn} style={{ textDecoration: 'none' }}>
              <Icon name="chevron-left" size={14} /> Back
            </Link>
            <MainContent data={d} teamId={teamId} />
            <Footer />
          </main>
          <Rail data={d} teamId={teamId} />
        </div>
      </div>

      {/* ── MOBILE ──────────────────────────────────────── */}
      <div className={styles.mobileOnly}>
        <div className="screen">
          <div className={styles.mobTopBar}>
            <Link href="/en/today" className={styles.mobBackBtn} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              <Icon name="chevron-left" size={20} />
            </Link>
            <span className={styles.mobTitle}>{d.info.shortName || d.info.name}</span>
            <div />
          </div>
          <div className="scroll" style={{ paddingBottom: 40 }}>
            <MainContent data={d} teamId={teamId} />
            <div style={{ padding: '0 16px' }}><Footer /></div>
          </div>
          <MobileBottomNav locale="en" />
        </div>
      </div>
    </>
  );
}
