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
import styles from '@/src/pages/competition/CompetitionPage.module.css';
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

// ── Static params (pre-render the 25 known competitions at build time) ────────

const KNOWN_CODES = [
  'WC','CWC','EURO','CA','AFCN','UNL',
  'CL','EL','UECL','LIBT','CSUD',
  'PL','PD','SA','BL1','FL1',
  'DED','PPL','SPL','JPL','TSL',
  'BSA','ARG','MX','MLS',
];

export function generateStaticParams() {
  return KNOWN_CODES.map(compCode => ({ compCode }));
}

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
export default async function CompetitionPage({ params }: Props) {
  const { compCode } = await params;
  const data = await fetchCompetitionDetail(compCode);
  if (!data) notFound();
  const d = data as CompetitionDetailData;

  return (
    <div className={styles.desktop}>
      <Sidebar locale="en" />
      <main className={styles.main}>
        <Link href="/en/competitions" className={styles.backBtn} style={{ textDecoration: 'none' }}>
          ← Back
        </Link>
        <HeroCard info={d.info} />
        <FixtureSection title="Upcoming Fixtures" fixtures={d.upcomingFixtures} />
        <FixtureSection title="Recent Results"   fixtures={d.recentResults} />
        <StandingsTable groups={d.standingGroups} />
        <ScorersSection scorers={d.scorers} />
        <Footer />
      </main>
      <aside className={styles.rail}>
        <RailPromo locale="en" />
        <ScorersSection scorers={d.scorers} compact />
      </aside>
    </div>
  );
}
