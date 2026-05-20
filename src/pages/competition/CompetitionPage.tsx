import { useParams, useNavigate } from 'react-router-dom';
import { useCompetitionDetails } from '../../lib/useCompetitionDetails';
import type { CompStandingRow, CompScorer, CompInfo } from '../../lib/api/competitionDetails';
import type { SupportedLocale } from '../../i18n';
import Sidebar from '../../components/layout/Sidebar/Sidebar';
import Icon from '../../components/shared/Icon/Icon';
import styles from './CompetitionPage.module.css';

interface CompetitionPageProps { locale: SupportedLocale; }

// ── Hero card ─────────────────────────────────────────────────────────────────
function HeroCard({ info }: { info: CompInfo }) {
  const seasonLabel = info.season
    ? `${info.season.startDate.slice(0, 4)} / ${info.season.endDate.slice(0, 4)}`
    : null;

  return (
    <div className={styles.hero}>
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroInner}>
        {info.emblem ? (
          <img
            src={info.emblem}
            alt={info.name}
            className={styles.emblem}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className={styles.emblemPlaceholder}>
            <Icon name="trophy" size={32} />
          </div>
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
              <img src={info.season.winner.crest} alt={info.season.winner.name} width={18} height={18}
                style={{ objectFit: 'contain' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <span className={styles.winnerName}>{info.season.winner.name}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Standings table ───────────────────────────────────────────────────────────
function StandingsTable({ rows }: { rows: CompStandingRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Standings</h2>
      <div className={styles.table}>
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
          <div key={r.teamId} className={styles.tableRow}>
            <span className={styles.colPos}>{r.position}</span>
            <span className={styles.colTeam}>
              <img src={r.teamCrest} alt={r.teamName} width={16} height={16}
                style={{ objectFit: 'contain', flexShrink: 0 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
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
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top scorers ───────────────────────────────────────────────────────────────
function ScorersTable({ scorers }: { scorers: CompScorer[] }) {
  if (scorers.length === 0) return null;
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Top Scorers</h2>
      <div className={styles.scorersTable}>
        <div className={styles.scorersHead}>
          <span className={styles.scorerRank}>#</span>
          <span className={styles.scorerPlayer}>Player</span>
          <span className={styles.scorerNum}>G</span>
          <span className={styles.scorerNum}>A</span>
          <span className={styles.scorerNum}>P</span>
          <span className={styles.scorerNum}>MP</span>
        </div>
        {scorers.map((s, i) => (
          <div key={i} className={styles.scorerRow}>
            <span className={styles.scorerRank}>{i + 1}</span>
            <span className={styles.scorerPlayer}>
              <img src={s.teamCrest} alt={s.teamName} width={16} height={16}
                style={{ objectFit: 'contain', flexShrink: 0 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span>
                <span className={styles.scorerName}>{s.playerName}</span>
                <span className={styles.scorerTeam}>{s.teamName}</span>
              </span>
            </span>
            <span className={styles.scorerNum}>{s.goals}</span>
            <span className={styles.scorerNum}>{s.assists ?? '–'}</span>
            <span className={styles.scorerNum}>{s.penalties ?? '–'}</span>
            <span className={styles.scorerNum}>{s.playedMatches}</span>
          </div>
        ))}
      </div>
      <div className={styles.scorersLegend}>G = Goals · A = Assists · P = Penalties · MP = Matches played</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CompetitionPage({ locale }: CompetitionPageProps) {
  const { compCode } = useParams<{ compCode: string }>();
  const navigate = useNavigate();
  const { data, loading, error } = useCompetitionDetails(compCode ?? '');

  const title = data?.info.name ?? 'Competition';

  return (
    <>
      {/* ── DESKTOP ─────────────────────────────────────── */}
      <div className={styles.desktopOnly}>
        <div className={styles.desktop}>
          <Sidebar locale={locale} />

          <main className={styles.main}>
            <button className={styles.backBtn} onClick={() => navigate(-1)}>
              <Icon name="chevron-left" size={14} /> Back
            </button>

            {loading && <div className={styles.placeholder}>Loading competition…</div>}
            {error   && <div className={styles.placeholder}>{error}</div>}
            {data && (
              <>
                <HeroCard info={data.info} />
                <StandingsTable rows={data.standings} />
                <ScorersTable scorers={data.scorers} />
              </>
            )}
          </main>
        </div>
      </div>

      {/* ── MOBILE ──────────────────────────────────────── */}
      <div className={styles.mobileOnly}>
        <div className={styles.mobScreen}>
          <div className={styles.mobTopBar}>
            <button className={styles.mobBackBtn} onClick={() => navigate(-1)}>
              <Icon name="chevron-left" size={16} /> Back
            </button>
            <span className={styles.mobTopTitle}>{title}</span>
          </div>

          <div className={styles.mobContent}>
            {loading && <div className={styles.placeholder}>Loading competition…</div>}
            {error   && <div className={styles.placeholder}>{error}</div>}
            {data && (
              <>
                <HeroCard info={data.info} />
                <StandingsTable rows={data.standings} />
                <ScorersTable scorers={data.scorers} />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
