import { useParams, useNavigate } from 'react-router-dom';
import { useMatchDetails } from '../../lib/useMatchDetails';
import type { MatchDetailData, StandingRow } from '../../lib/api/matchDetails';
import type { SupportedLocale } from '../../i18n';
import Sidebar from '../../components/layout/Sidebar/Sidebar';
import Crest from '../../components/shared/Crest/Crest';
import LiveDot from '../../components/shared/LiveDot/LiveDot';
import Icon from '../../components/shared/Icon/Icon';
import styles from './MatchPage.module.css';

interface MatchPageProps { locale: SupportedLocale; }

// ── Shared sub-components ─────────────────────────────────────────────────────

function H2HSection({ d }: { d: MatchDetailData }) {
  if (!d.h2h) return null;
  const { homeWins, draws, awayWins, totalGoals, recent } = d.h2h;
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Head to Head</h2>
      <div className={styles.h2hBar}>
        <img src={d.home.crest} alt={d.home.short} title={d.home.name} width={22} height={22}
          className={styles.h2hTeamCrest}
          onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
        <div className={styles.h2hTrack}>
          {homeWins > 0 && <div className={styles.h2hHome} style={{ flex: homeWins }} />}
          {draws    > 0 && <div className={styles.h2hDraw} style={{ flex: draws    }} />}
          {awayWins > 0 && <div className={styles.h2hAway} style={{ flex: awayWins }} />}
        </div>
        <img src={d.away.crest} alt={d.away.short} title={d.away.name} width={22} height={22}
          className={styles.h2hTeamCrest}
          onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
      </div>
      <div className={styles.h2hCounts}>
        <span className={styles.h2hWin}>{homeWins}W</span>
        <span className={styles.h2hDrawCount}>{draws}D</span>
        <span className={styles.h2hWin}>{awayWins}W</span>
      </div>
      <div className={styles.h2hGoals}>{totalGoals} goals in last {recent.length} meetings</div>

      <div className={styles.h2hList}>
        {recent.map((m: import('../../lib/api/matchDetails').H2HMatch) => (
          <div key={m.id} className={styles.h2hRow}>
            <span className={styles.h2hDate}>{m.date}</span>
            <span className={styles.h2hName} style={{ textAlign: 'right' }}>{m.homeTeam}</span>
            <span className={styles.h2hResult}>
              {m.homeScore ?? '–'} – {m.awayScore ?? '–'}
            </span>
            <span className={styles.h2hName}>{m.awayTeam}</span>
          </div>
        ))}
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
            <div key={r.teamId} className={[styles.tableRow, highlight ? styles.highlighted : ''].filter(Boolean).join(' ')}>
              <span className={styles.colPos}>{r.position}</span>
              <span className={styles.colTeam}>
                <img src={r.teamCrest} alt={r.teamName} width={16} height={16} style={{ objectFit: 'contain', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                {r.teamName}
              </span>
              <span className={styles.colNum}>{r.played}</span>
              <span className={styles.colNum}>{r.won}</span>
              <span className={styles.colNum}>{r.draw}</span>
              <span className={styles.colNum}>{r.lost}</span>
              <span className={styles.colNum}>{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</span>
              <span className={styles.colPts}>{r.points}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchInfoCard({ d }: { d: MatchDetailData }) {
  const rows = [
    d.referee  && { label: 'Referee',   value: d.referee },
    d.venue    && { label: 'Venue',     value: d.venue },
    d.matchday && { label: 'Matchday',  value: String(d.matchday) },
    d.stage    && { label: 'Stage',     value: d.stage.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()) },
  ].filter(Boolean) as { label: string; value: string }[];

  if (rows.length === 0) return null;
  return (
    <div className={styles.infoCard}>
      <div className={styles.infoTitle}>Match info</div>
      {rows.map(r => (
        <div key={r.label} className={styles.infoRow}>
          <span className={styles.infoLabel}>{r.label}</span>
          <span className={styles.infoValue}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function FormDot({ ch }: { ch: string }) {
  const color = ch === 'W' ? 'var(--green, #22c55e)' : ch === 'D' ? 'var(--yellow)' : 'var(--live)';
  return <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} title={ch === 'W' ? 'Win' : ch === 'D' ? 'Draw' : 'Loss'} />;
}

function FormCard({ d, rows }: { d: MatchDetailData; rows: StandingRow[] }) {
  const home = rows.find(r => r.teamId === d.home.id);
  const away = rows.find(r => r.teamId === d.away.id);
  if (!home?.form && !away?.form) return null;
  return (
    <div className={styles.infoCard}>
      <div className={styles.infoTitle}>Recent form</div>
      {[home, away].filter(Boolean).map(team => (
        <div key={team!.teamId} className={styles.formRow}>
          <span className={styles.formTeam}>{team!.teamName}</span>
          <div className={styles.formDots}>
            {(team!.form ?? '').split(',').slice(0, 5).map((ch: string, i: number) => <FormDot key={i} ch={ch} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Desktop featured card ─────────────────────────────────────────────────────
function MatchCard({ d }: { d: MatchDetailData }) {
  return (
    <div className={styles.featured}>
      <div className={styles.featuredGlow} aria-hidden="true" />
      <div className={styles.featuredTop}>
        <div className={styles.featuredMeta}>
          {d.status === 'LIVE' ? (
            <span className="chip live"><LiveDot />Live{d.minute ? ` · ${d.minute}′` : ''}</span>
          ) : d.status === 'HT' ? (
            <span className="chip ht">Half Time</span>
          ) : d.status === 'FT' ? (
            <span className="chip ft">Full Time</span>
          ) : (
            <span className="chip">{d.kickoff}</span>
          )}
          <span className={styles.compLabel}>{d.compCountry ? `${d.compCountry} · ` : ''}{d.competition}</span>
          {d.matchday && <span className={styles.matchday}>MD {d.matchday}</span>}
        </div>
        <button className="fs-btn ghost" style={{ height: 32, padding: '0 12px', fontSize: 12 }}>
          <Icon name="share" size={14} /> Share
        </button>
      </div>

      <div className={styles.scoreGrid}>
        <div className={styles.teamLeft}>
          <Crest team={d.home} size="xl" />
          <div>
            <div className={styles.teamRole}>Home</div>
            <div className={styles.teamName}>{d.home.name}</div>
          </div>
        </div>
        <div className={styles.scoreBlock}>
          <span className={styles.score}>{d.home.score ?? '–'}</span>
          <span className={styles.scoreDash}>–</span>
          <span className={styles.score}>{d.away.score ?? '–'}</span>
        </div>
        <div className={styles.teamRight}>
          <div style={{ textAlign: 'right' }}>
            <div className={styles.teamRole}>Away</div>
            <div className={styles.teamName}>{d.away.name}</div>
          </div>
          <Crest team={d.away} size="xl" />
        </div>
      </div>

      {(d.status === 'FT' || d.status === 'HT') && d.halfTime.home !== null && (
        <div className={styles.htRow}>
          <span className={styles.htLabel}>Half-time</span>
          <span className={styles.htScore}>
            {d.halfTime.home} – {d.halfTime.away ?? 0}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Mobile featured card ──────────────────────────────────────────────────────
function MobMatchCard({ d }: { d: MatchDetailData }) {
  return (
    <div className={styles.mobFeatured}>
      <div className={styles.featuredGlow} aria-hidden="true" />
      <div className={styles.mobFeaturedTop}>
        <div className={styles.mobFeaturedMeta}>
          {d.status === 'LIVE' ? (
            <span className="chip live"><LiveDot />Live{d.minute ? ` · ${d.minute}′` : ''}</span>
          ) : d.status === 'HT' ? (
            <span className="chip ht">Half Time</span>
          ) : d.status === 'FT' ? (
            <span className="chip ft">Full Time</span>
          ) : (
            <span className="chip">{d.kickoff}</span>
          )}
          <span className={styles.compLabel}>{d.compCountry ? `${d.compCountry} · ` : ''}{d.competition}</span>
        </div>
        <button className="fs-btn ghost" style={{ height: 28, padding: '0 10px', fontSize: 12 }}>
          <Icon name="share" size={13} /> Share
        </button>
      </div>

      <div className={styles.mobScoreGrid}>
        <div className={styles.mobTeamLeft}>
          <Crest team={d.home} size="lg" />
          <div className={styles.mobTeamName}>{d.home.short || d.home.name}</div>
        </div>
        <div className={styles.mobScoreBlock}>
          <span className={styles.mobScore}>{d.home.score ?? '–'}</span>
          <span className={styles.mobScoreDash}>–</span>
          <span className={styles.mobScore}>{d.away.score ?? '–'}</span>
        </div>
        <div className={styles.mobTeamRight}>
          <Crest team={d.away} size="lg" />
          <div className={styles.mobTeamName}>{d.away.short || d.away.name}</div>
        </div>
      </div>

      {(d.status === 'FT' || d.status === 'HT') && d.halfTime.home !== null && (
        <div className={styles.mobHtRow}>
          <span className={styles.htLabel}>Half-time</span>
          <span className={styles.htScore}>
            {d.halfTime.home} – {d.halfTime.away ?? 0}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MatchPage({ locale }: MatchPageProps) {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { data, loading, error } = useMatchDetails(matchId ?? '');

  const matchTitle = data ? `${data.home.short || data.home.name} vs ${data.away.short || data.away.name}` : 'Match';

  return (
    <>
      {/* ── DESKTOP ─────────────────────────────────────── */}
      <div className={styles.desktopOnly}>
        <div className={styles.desktop}>
          <Sidebar locale={locale} />

          <main className={styles.main}>
            <button className={styles.backBtn} onClick={() => navigate(-1)}>
              <Icon name="chevron-left" size={14} /> Back to matches
            </button>

            {loading && <div className={styles.placeholder}>Loading match…</div>}
            {error && (
              <div className={styles.placeholder}>
                {error === 'Match not found'
                  ? 'Go back to the home page and click a match to view details.'
                  : error}
              </div>
            )}
            {data && (
              <>
                <MatchCard d={data} />
                <H2HSection d={data} />
                <StandingsSection
                  rows={data.standings}
                  homeId={data.home.id}
                  awayId={data.away.id}
                  compName={data.competition}
                />
              </>
            )}
          </main>

          <aside className={styles.rail}>
            {data && <MatchInfoCard d={data} />}
            {data && <FormCard d={data} rows={data.standings} />}
          </aside>
        </div>
      </div>

      {/* ── MOBILE ──────────────────────────────────────── */}
      <div className={styles.mobileOnly}>
        <div className={styles.mobScreen}>
          <div className={styles.mobTopBar}>
            <button className={styles.mobBackBtn} onClick={() => navigate(-1)}>
              <Icon name="chevron-left" size={16} /> Back
            </button>
            <span className={styles.mobTopTitle}>{matchTitle}</span>
            <button
              className={styles.mobStudioBtn}
              onClick={() => navigate(`/${locale}/studio`)}
              title="Share Studio"
            >
              <Icon name="sparkles" size={16} />
              <span>Studio</span>
            </button>
          </div>

          <div className={styles.mobContent}>
            {loading && <div className={styles.placeholder}>Loading match…</div>}
            {error && (
              <div className={styles.placeholder}>
                {error === 'Match not found'
                  ? 'Go back and click a match to view details.'
                  : error}
              </div>
            )}
            {data && (
              <>
                <MobMatchCard d={data} />
                <H2HSection d={data} />
                <StandingsSection
                  rows={data.standings}
                  homeId={data.home.id}
                  awayId={data.away.id}
                  compName={data.competition}
                />
                <MatchInfoCard d={data} />
                <FormCard d={data} rows={data.standings} />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
