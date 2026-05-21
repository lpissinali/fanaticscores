import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSEO } from '../../lib/useSEO';
import { useTeamDetails } from '../../lib/useTeamDetails';
import type { TeamPlayer, TeamMatch } from '../../lib/api/teamDetails';
import type { SupportedLocale } from '../../i18n';
import Sidebar from '../../components/layout/Sidebar/Sidebar';
import Footer from '../../components/layout/Footer/Footer';
import Icon from '../../components/shared/Icon/Icon';
import MobileBottomNav from '../../components/shared/MobileBottomNav/MobileBottomNav';
import styles from './TeamPage.module.css';

interface TeamPageProps { locale: SupportedLocale; }

// ── Position order ─────────────────────────────────────────────────────────────

const POSITION_ORDER = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Unknown'] as const;

// ── Position meta ──────────────────────────────────────────────────────────────

const POSITION_META: Record<string, { label: string; abbr: string; color: string; bg: string }> = {
  Goalkeeper: { label: 'Goalkeepers', abbr: 'GK', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  Defender:   { label: 'Defenders',   abbr: 'DF', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  Midfielder: { label: 'Midfielders', abbr: 'MF', color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  Forward:    { label: 'Forwards',    abbr: 'FW', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  Unknown:    { label: 'Other',       abbr: '–',  color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

// ── Squad section ──────────────────────────────────────────────────────────────

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
              {/* Group header */}
              <div className={styles.positionHeader} style={{ borderLeftColor: meta.color }}>
                <span className={styles.positionAbbr} style={{ color: meta.color, background: meta.bg }}>
                  {meta.abbr}
                </span>
                <span className={styles.positionLabel}>{meta.label}</span>
                <span className={styles.positionCount}>{players.length}</span>
              </div>
              {/* Player rows */}
              <div className={styles.playerList}>
                {players.map((p, i) => (
                  <div key={p.id} className={styles.playerRow}>
                    <span className={styles.playerIndex}>{i + 1}</span>
                    <span className={styles.playerRowName}>{p.name}</span>
                    <span className={styles.playerNat}>{p.nationality ?? ''}</span>
                    {p.age != null && (
                      <span className={styles.playerAge}>{p.age}</span>
                    )}
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

// ── Match row ──────────────────────────────────────────────────────────────────

function MatchRow({ m, teamId, locale }: { m: TeamMatch; teamId: string; locale: string }) {
  const isHome    = m.homeTeam.id === teamId;
  const opponent  = isHome ? m.awayTeam : m.homeTeam;
  const teamScore = isHome ? m.homeTeam.score : m.awayTeam.score;
  const oppScore  = isHome ? m.awayTeam.score  : m.homeTeam.score;
  const isScheduled = m.status === 'SCHEDULED' || m.status === 'TIMED';

  let resultTag: 'W' | 'D' | 'L' | null = null;
  if (!isScheduled && teamScore !== null && oppScore !== null) {
    if (teamScore > oppScore) resultTag = 'W';
    else if (teamScore < oppScore) resultTag = 'L';
    else resultTag = 'D';
  }

  const kickoffDate = new Date(m.utcDate).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  const kickoffTime = new Date(m.utcDate).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <Link to={`/${locale}/match/${m.id}`} className={styles.matchRow}>
      <div className={styles.matchDateCell}>
        <span className={styles.matchDate}>{kickoffDate}</span>
        {isScheduled && <span className={styles.matchTime}>{kickoffTime}</span>}
      </div>
      <div className={styles.matchVenue}>{isHome ? 'H' : 'A'}</div>
      <img
        src={opponent.crest} alt={opponent.name} width={20} height={20}
        className={styles.matchCrest}
        onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
      />
      <div className={styles.matchOpponent}>{opponent.name}</div>
      <div className={styles.matchComp}>{m.competition}</div>
      {!isScheduled && (
        <div className={styles.matchScore}>
          {teamScore ?? '–'} – {oppScore ?? '–'}
        </div>
      )}
      {resultTag && (
        <span className={[styles.resultTag, styles['result' + resultTag]].join(' ')}>{resultTag}</span>
      )}
    </Link>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function TeamPage({ locale }: TeamPageProps) {
  const { teamId = '' } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { data, loading, error } = useTeamDetails(teamId);

  useSEO({
    title: data ? `${data.info.name} — Results & Stats` : 'Team',
    description: data ? `Fixtures, results and stats for ${data.info.name}.` : undefined,
    canonical: `/en/team/${teamId}`,
  });

  const content = (_isMobile: boolean) => {
    if (loading) return (
      <div className={styles.stateBox}>
        <span style={{ color: 'var(--text-faint)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
          Loading team…
        </span>
      </div>
    );
    if (error || !data) return (
      <div className={styles.stateBox}>
        <Icon name="x" size={24} style={{ color: 'var(--text-faint)' }} />
        <span style={{ color: 'var(--text-faint)', fontSize: 13, marginTop: 8 }}>{error ?? 'Team not found'}</span>
      </div>
    );

    const { info, recentMatches, upcomingMatches } = data;

    return (
      <>
        {/* ── Hero ── */}
        <div className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroInner}>
            {info.crest ? (
              <img src={info.crest} alt={info.name} className={styles.crest}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className={styles.crestPlaceholder}><Icon name="trophy" size={32} /></div>
            )}
            <div className={styles.heroText}>
              {info.tla && <div className={styles.heroTla}>{info.tla}</div>}
              <h1 className={styles.heroName}>{info.name}</h1>
              <div className={styles.heroChips}>
                {info.founded && <span className="chip">Est. {info.founded}</span>}
                {info.venue   && <span className="chip"><Icon name="home" size={11} style={{ marginRight: 4 }} />{info.venue}</span>}
              </div>
              {/* Running competitions */}
              {info.runningCompetitions.length > 0 && (
                <div className={styles.compChips}>
                  {info.runningCompetitions.map(c => (
                    <Link key={c.id} to={`/${locale}/competition/${c.code}`} className={styles.compChip}>
                      {c.emblem && (
                        <img src={c.emblem} alt={c.name} width={14} height={14}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      )}
                      {c.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Info grid ── */}
        {(info.coach || info.website) && (
          <div className={styles.infoGrid}>
            {info.coach && (
              <div className={styles.infoCard}>
                <div className={styles.infoLabel}>Head Coach</div>
                <div className={styles.infoValue}>{info.coach.name}</div>
                {info.coach.nationality && <div className={styles.infoSub}>{info.coach.nationality}</div>}
                {info.coach.contractUntil && (
                  <div className={styles.infoSub}>Contract until {info.coach.contractUntil.slice(0, 4)}</div>
                )}
              </div>
            )}
            {info.website && (
              <div className={styles.infoCard}>
                <div className={styles.infoLabel}>Website</div>
                <a href={info.website} target="_blank" rel="noopener noreferrer" className={styles.websiteLink}>
                  {info.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  <Icon name="arrow-right" size={11} style={{ marginLeft: 4 }} />
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── Upcoming fixtures ── */}
        {upcomingMatches.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Upcoming Fixtures</h2>
            <div className={styles.matchList}>
              {upcomingMatches.map(m => (
                <MatchRow key={m.id} m={m} teamId={teamId} locale={locale} />
              ))}
            </div>
          </div>
        )}

        {/* ── Recent results ── */}
        {recentMatches.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Recent Results</h2>
            <div className={styles.matchList}>
              {recentMatches.map(m => (
                <MatchRow key={m.id} m={m} teamId={teamId} locale={locale} />
              ))}
            </div>
          </div>
        )}

        {/* ── Squad ── */}
        <SquadSection squad={info.squad} />
      </>
    );
  };

  return (
    <>
      {/* ── DESKTOP ─────────────────────────────────────────────────────────── */}
    
      <div className={styles.desktopOnly}>
        <div className={styles.desktop}>
          <Sidebar locale={locale} />
          <main className={styles.main}>
            <button className={styles.backBtn} onClick={() => navigate(-1)}>
              <Icon name="chevron-left" size={14} /> Back
            </button>
            {content(false)}
            <Footer />
          </main>

          {data && (() => {
            const recent = data.recentMatches;
            const wins   = recent.filter(m => { const isHome = m.homeTeam.id === teamId; const ts = isHome ? m.homeTeam.score : m.awayTeam.score; const os = isHome ? m.awayTeam.score : m.homeTeam.score; return ts !== null && os !== null && (ts as number) > (os as number); }).length;
            const draws  = recent.filter(m => { const isHome = m.homeTeam.id === teamId; const ts = isHome ? m.homeTeam.score : m.awayTeam.score; const os = isHome ? m.awayTeam.score : m.homeTeam.score; return ts !== null && os !== null && (ts as number) === (os as number); }).length;
            const losses = recent.length - wins - draws;
            return (
              <aside className={styles.rail}>
                {recent.length > 0 && (
                  <div className={styles.railCard}>
                    <div className={styles.railCardTitle}>Recent Form</div>
                    <div className={styles.formDots}>
                      {recent.map(m => {
                        const isHome = m.homeTeam.id === teamId;
                        const ts = isHome ? m.homeTeam.score : m.awayTeam.score;
                        const os = isHome ? m.awayTeam.score : m.homeTeam.score;
                        const r = ts === null || os === null ? 'D' : (ts as number) > (os as number) ? 'W' : (ts as number) < (os as number) ? 'L' : 'D';
                        return (
                          <span key={m.id} className={[styles.formDot, r === 'W' ? styles.formW : r === 'L' ? styles.formL : styles.formD].join(' ')} title={r === 'W' ? 'Win' : r === 'L' ? 'Loss' : 'Draw'}>
                            {r}
                          </span>
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
          })()}
        </div>
      </div>

      {/* ── MOBILE ──────────────────────────────────────────────────────────── */}
      <div className={styles.mobileOnly}>
        <div className="screen">
          <div className={styles.mobTopBar}>
            <button className="fs-btn ghost"
              style={{ width: 36, height: 36, padding: 0, borderColor: 'transparent' }}
              onClick={() => navigate(-1)}>
              <Icon name="chevron-left" size={20} />
            </button>
            <span className={styles.mobTitle}>{data?.info.shortName ?? 'Team'}</span>
            <div style={{ width: 36 }} />
          </div>
          <div className="scroll" style={{ paddingBottom: 40 }}>
            {content(true)}
            <div style={{ padding: '0 16px' }}><Footer /></div>
          </div>
          <MobileBottomNav locale={locale} />
        </div>
      </div>
    </>
  );
}