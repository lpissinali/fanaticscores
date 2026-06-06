/**
 * Competition page — Server Component.
 * Google receives real HTML with standings, fixtures and top scorers.
 * generateMetadata produces server-rendered <title> and <meta> tags.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchCompetitionDetail } from '@/lib/serverApi/competitionDetails';
import type { CompetitionDetailData, CompInfo, CompStandingGroup, CompScorer, CompFixture } from '@/lib/serverApi/competitionDetails';
import Sidebar from '@/src/components/layout/Sidebar/Sidebar';
import Footer from '@/src/components/layout/Footer/Footer';
import RailPromo from '@/src/components/shared/RailPromo/RailPromo';
import MobileBottomNav from '@/src/components/shared/MobileBottomNav/MobileBottomNav';
import Icon from '@/src/components/shared/Icon/Icon';
import styles from '@/src/views/competition/CompetitionPage.module.css';
import Link from 'next/link';

interface Props { params: Promise<{ compCode: string }> }

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { compCode } = await params;
  const data = await fetchCompetitionDetail(compCode);
  if (!data) return { title: 'Competition' };
  const title = `${data.info.name} — Standings & Results`;
  const description = `Live standings, upcoming fixtures and top scorers for ${data.info.name} ${data.info.season?.startDate?.slice(0,4) ?? ''}.`;
  const url = `/en/competition/${compCode}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    twitter:   { title, description },
  };
}

// Competition pages render on-demand; fetch responses are cached for 1 hour
// via revalidate: 3600 in fetchAF. Removed generateStaticParams to avoid
// bursting the api-football per-minute rate limit at build time.

// ── Sub-components (pure JSX — server-renderable) ─────────────────────────────

function formatDate(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatTime(utcDate: string) {
  return new Date(utcDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function HeroCard({ info }: { info: CompInfo }) {
  const seasonLabel = info.season
    ? `${info.season.startDate.slice(0, 4)} / ${info.season.endDate.slice(0, 4)}`
    : null;
  return (
    <div className={styles.hero}>
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroInner}>
        {info.emblem && (
          <img src={info.emblem} alt={info.name} className={styles.emblem} width={64} height={64} />
        )}
        <div className={styles.heroText}>
          <div className={styles.heroCountry}>{info.area.name}</div>
          <h1 className={styles.heroName}>{info.name}</h1>
          <div className={styles.heroMeta}>
            {info.type === 'LEAGUE' && <span className="chip">League</span>}
            {info.type === 'CUP'    && <span className="chip">Cup</span>}
            {seasonLabel && <span className={styles.heroSeason}>{seasonLabel}</span>}
            {info.season?.currentMatchday && (
              <span className={styles.heroMatchday}>Matchday {info.season.currentMatchday}</span>
            )}
          </div>
        </div>
      </div>
      {info.season?.winner && (
        <div className={styles.winnerRow}>
          <span className={styles.winnerLabel}>Reigning champion</span>
          <div className={styles.winnerTeam}>
            {info.season.winner.crest && (
              <img src={info.season.winner.crest} alt={info.season.winner.name} width={18} height={18} style={{ objectFit: 'contain' }} />
            )}
            <span className={styles.winnerName}>{info.season.winner.name}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StandingsTable({ groups }: { groups: CompStandingGroup[] }) {
  if (groups.length === 0) return null;
  const isGrouped = groups.length > 1;
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Standings</h2>
      {isGrouped ? (
        <div className={styles.groupsGrid}>
          {groups.map(g => (
            <div key={g.name} className={styles.standingGroup}>
              {g.name && <div className={styles.standingGroupName}>{g.name}</div>}
              <StandingRows rows={g.rows} />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.table}><StandingRows rows={groups[0].rows} /></div>
      )}
    </div>
  );
}

function StandingRows({ rows }: { rows: CompStandingGroup['rows'] }) {
  return (
    <>
      <div className={styles.tableHead}>
        <span className={styles.colPos}>#</span>
        <span className={styles.colTeam}>Club</span>
        <span className={styles.colNum}>P</span>
        <span className={styles.colNum}>W</span>
        <span className={styles.colNum}>D</span>
        <span className={styles.colNum}>L</span>
        <span className={styles.colNum}>GF</span>
        <span className={styles.colNum}>GA</span>
        <span className={styles.colNum}>GD</span>
        <span className={styles.colPts}>Pts</span>
      </div>
      {rows.map(r => (
        <Link key={r.teamId} href={`/en/team/${r.teamId}`} className={styles.tableRow} style={{ textDecoration: 'none' }}>
          <span className={styles.colPos}>{r.position}</span>
          <span className={styles.colTeam}>
            <img src={r.teamCrest} alt={r.teamName} width={16} height={16} style={{ objectFit: 'contain', flexShrink: 0 }} />
            {r.teamName}
          </span>
          <span className={styles.colNum}>{r.played}</span>
          <span className={styles.colNum}>{r.won}</span>
          <span className={styles.colNum}>{r.draw}</span>
          <span className={styles.colNum}>{r.lost}</span>
          <span className={styles.colNum}>{r.goalsFor}</span>
          <span className={styles.colNum}>{r.goalsAgainst}</span>
          <span className={styles.colNum}>{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</span>
          <span className={styles.colPts}>{r.points}</span>
        </Link>
      ))}
    </>
  );
}

function SeasonInfoCard({ info }: { info: CompInfo }) {
  if (!info.season) return null;
  const { startDate, endDate, currentMatchday, winner } = info.season;
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return (
    <div className={styles.railScorerCard}>
      <div className={styles.railCardTitle}>Season</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--text-faint)' }}>Period</span>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmt(startDate)} – {fmt(endDate)}</span>
        </div>
        {currentMatchday != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-faint)' }}>Matchday</span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>MD {currentMatchday}</span>
          </div>
        )}
        {winner && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-faint)' }}>Champion</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--orange)', fontWeight: 700 }}>
              {winner.crest && <img src={winner.crest} alt={winner.name} width={16} height={16} style={{ objectFit: 'contain' }} />}
              {winner.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function TableLeadersCard({ groups }: { groups: CompStandingGroup[] }) {
  if (groups.length === 0) return null;
  const isGrouped = groups.length > 1;
  const title = isGrouped ? 'Group Leaders' : 'Top 3';

  const entries = isGrouped
    ? groups.map(g => ({ label: g.name, row: g.rows[0] })).filter(e => e.row)
    : groups[0].rows.slice(0, 3).map((row, i) => ({ label: String(i + 1), row }));

  return (
    <div className={styles.railScorerCard}>
      <div className={styles.railCardTitle}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {entries.map(({ label, row }) => (
          <Link key={row.teamId} href={`/en/team/${row.teamId}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', minWidth: 16, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
              {isGrouped ? label.replace('Group ', '') : label}
            </span>
            <img src={row.teamCrest} alt={row.teamName} width={16} height={16} style={{ objectFit: 'contain', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.teamName}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange)' }}>{row.points}pts</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ScorersSection({ scorers, compact = false }: { scorers: CompScorer[]; compact?: boolean }) {
  if (scorers.length === 0) return null;

  if (compact) {
    // Rail version — matches the original railScorerCard style
    return (
      <div className={styles.railScorerCard}>
        <div className={styles.railCardTitle}>Top Scorers</div>
        <div className={styles.railScorerHead}>
          <span className={styles.scorerRank}>#</span>
          <span>Player</span>
          <span className={styles.railScorerNum}>G</span>
          <span className={styles.railScorerNum}>A</span>
        </div>
        {scorers.slice(0, 10).map((s, i) => (
          <div key={i} className={styles.railScorerRow}>
            <span className={styles.scorerRank}>{i + 1}</span>
            <span className={styles.railScorerInfo}>
              <img src={s.teamCrest} alt={s.teamName} width={14} height={14}
                style={{ objectFit: 'contain', flexShrink: 0 }} />
              <span>
                <span className={styles.railScorerName}>{s.playerName}</span>
                <span className={styles.railScorerTeam}>{s.teamName}</span>
              </span>
            </span>
            <span className={styles.railScorerNum}>{s.goals}</span>
            <span className={styles.railScorerNum}>{s.assists ?? '–'}</span>
          </div>
        ))}
      </div>
    );
  }

  // Main column version — G and A only to avoid horizontal scroll
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Top Scorers</h2>
      <div className={styles.scorersTable}>
        <div className={styles.scorersHead}>
          <span className={styles.scorerRank}>#</span>
          <span className={styles.scorerPlayer}>Player</span>
          <span className={styles.scorerNum}>G</span>
          <span className={styles.scorerNum}>A</span>
        </div>
        {scorers.map((s, i) => (
          <div key={i} className={styles.scorerRow}>
            <span className={styles.scorerRank}>{i + 1}</span>
            <span className={styles.scorerPlayer}>
              <img src={s.teamCrest} alt={s.teamName} width={16} height={16} style={{ objectFit: 'contain', flexShrink: 0 }} />
              <span>
                <span className={styles.scorerName}>{s.playerName}</span>
                <span className={styles.scorerTeam}>{s.teamName}</span>
              </span>
            </span>
            <span className={styles.scorerNum}>{s.goals}</span>
            <span className={styles.scorerNum}>{s.assists ?? '–'}</span>
          </div>
        ))}
      </div>
      <div className={styles.scorersLegend}>G = Goals · A = Assists</div>
    </div>
  );
}

function FixtureSection({ title, fixtures }: { title: string; fixtures: CompFixture[] }) {
  if (!fixtures || fixtures.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.matchList}>
        {fixtures.map(f => {
          const isScheduled = f.homeTeam.score === null || f.awayTeam.score === null;
          return (
            <Link key={f.id} href={`/en/match/${f.id}`} className={styles.fixtureRow} style={{ textDecoration: 'none' }}>
              <div className={styles.dateCell}>
                <span className={styles.dateText}>{formatDate(f.utcDate)}</span>
                {isScheduled && <span className={styles.timeText}>{formatTime(f.utcDate)}</span>}
              </div>
              <span className={[styles.teamName, styles.teamNameRight].join(' ')}>{f.homeTeam.name}</span>
              <img src={f.homeTeam.crest} alt={f.homeTeam.name} className={styles.teamCrest} width={20} height={20} />
              {isScheduled ? (
                <div className={styles.vsSep}>vs</div>
              ) : (
                <div className={styles.scoreCell}>
                  <span>{f.homeTeam.score ?? '–'}</span>
                  <span className={styles.scoreDash}>–</span>
                  <span>{f.awayTeam.score ?? '–'}</span>
                </div>
              )}
              <img src={f.awayTeam.crest} alt={f.awayTeam.name} className={styles.teamCrest} width={20} height={20} />
              <span className={styles.teamName}>{f.awayTeam.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ─────────
// ── Static league descriptions (indexed by Google regardless of JS rendering) ─

const LEAGUE_BLURBS: Record<string, string> = {
  PL:   'The Premier League is England\'s top football division, featuring 20 clubs competing from August to May. Home to some of the world\'s biggest clubs — Manchester City, Arsenal, Liverpool, Chelsea and Manchester United — it is widely regarded as the most-watched football league on the planet.',
  PD:   'La Liga is Spain\'s premier football division, renowned for producing some of football\'s greatest talent. Barcelona and Real Madrid have historically dominated the competition, but clubs like Atlético de Madrid, Sevilla and Athletic Club regularly compete for European places.',
  SA:   'Serie A is Italy\'s top professional football league. Juventus, Inter Milan and AC Milan are the most decorated clubs, while Napoli, Roma, Lazio and Fiorentina provide fierce competition each season. The league is known for its tactical depth and defensive excellence.',
  BL1:  'The Bundesliga is Germany\'s premier football competition. Bayern Munich have dominated modern German football, but Borussia Dortmund, Bayer Leverkusen and RB Leipzig consistently challenge for the title and European spots.',
  FL1:  'Ligue 1 is the top tier of French football. Paris Saint-Germain have been the dominant force in recent seasons, while Lyon, Monaco, Marseille and Lille compete for European qualification each year.',
  CL:   'The UEFA Champions League is Europe\'s most prestigious club competition, contested annually by the top clubs from each UEFA member association. The knockout tournament culminates in a final that regularly draws hundreds of millions of viewers worldwide.',
  EL:   'The UEFA Europa League is the second tier of European club football, providing a route to European silverware for clubs that finish below the Champions League places in their domestic leagues.',
  UECL: 'The UEFA Europa Conference League is the third tier of European club competition, giving more clubs across the continent the chance to compete in European knockout football.',
  WC:   'The FIFA World Cup is the most prestigious international football tournament, held every four years and featuring national teams from across the globe competing for the ultimate prize in football.',
  EURO: 'The UEFA European Championship, held every four years, is the premier international tournament for European national teams. Past winners include Germany, Spain, France and Italy.',
  CWC:  'The FIFA Club World Cup brings together the champion clubs from each of the six continental confederations to determine the best club team in the world.',
  CA:   'The CONMEBOL Copa América is the oldest international football tournament in the world, contested by South American national teams. Brazil and Argentina are the most successful nations in the competition\'s history.',
  LIBT: 'The CONMEBOL Libertadores is South America\'s most prestigious club competition, equivalent to the UEFA Champions League. Brazilian and Argentine clubs have historically dominated the tournament.',
  BSA:  'The Campeonato Brasileiro Série A is Brazil\'s top professional football league, featuring 20 clubs. Flamengo, Palmeiras, Santos and Corinthians are among the most storied clubs in Brazilian football history.',
  MLS:  'Major League Soccer is the top professional football league in the United States and Canada, featuring clubs from across North America competing in Eastern and Western Conferences.',
  ARG:  'The Liga Profesional de Fútbol is Argentina\'s premier football division. River Plate and Boca Juniors are the country\'s most iconic clubs, while Independiente, Racing Club and San Lorenzo also boast rich histories.',
};

export default async function CompetitionPage({ params }: Props) {
  const { compCode } = await params;
  const data = await fetchCompetitionDetail(compCode);
  if (!data) notFound();
  const d = data as CompetitionDetailData;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name: d.info.name,
    sport: 'Football',
    url: `https://www.fanaticscores.com/en/competition/${compCode}`,
    ...(d.info.emblem && { logo: d.info.emblem }),
    ...(d.info.area?.name && { location: { '@type': 'Place', name: d.info.area.name } }),
  };

  const blurb = LEAGUE_BLURBS[compCode] ?? null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── DESKTOP ─────────────────────────────────────── */}
      <div className={styles.desktopOnly}>
        <div className={styles.desktop}>
          <Sidebar locale="en" />
          <main className={styles.main}>
            <HeroCard info={d.info} />
            <FixtureSection title="Upcoming Fixtures" fixtures={d.upcomingFixtures} />
            <FixtureSection title="Recent Results"   fixtures={d.recentResults} />
            <StandingsTable groups={d.standingGroups} />
            {blurb && (
              <p style={{ padding: '24px 0', color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.7, maxWidth: 680 }}>
                {blurb}
              </p>
            )}
            <Footer />
          </main>
          <aside className={styles.rail}>
            <RailPromo locale="en" />
            <SeasonInfoCard info={d.info} />
            <TableLeadersCard groups={d.standingGroups} />
            <ScorersSection scorers={d.scorers} compact />
          </aside>
        </div>
      </div>

      {/* ── MOBILE ──────────────────────────────────────── */}
      <div className={styles.mobileOnly}>
        <div className="screen">
          <div className="scroll" style={{ padding: '16px 16px 40px' }}>
            <HeroCard info={d.info} />
            <FixtureSection title="Upcoming Fixtures" fixtures={d.upcomingFixtures} />
            <FixtureSection title="Recent Results"   fixtures={d.recentResults} />
            <StandingsTable groups={d.standingGroups} />
            <ScorersSection scorers={d.scorers} />
            {blurb && (
              <p style={{ padding: '24px 0', color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.7, maxWidth: 680 }}>
                {blurb}
              </p>
            )}
            <Footer />
          </div>
          <MobileBottomNav locale="en" />
        </div>
      </div>
    </>
  );
}
