'use client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSEO } from '../../lib/useSEO';
import { useMatchDetails } from '../../lib/useMatchDetails';
import type { MatchDetailData, StandingRow } from '../../lib/api/matchDetails';
import type { MatchEvent } from '../../lib/types';
import type { SupportedLocale } from '../../i18n';
import Sidebar from '../../components/layout/Sidebar/Sidebar';
import Footer from '../../components/layout/Footer/Footer';
import RailPromo from '../../components/shared/RailPromo/RailPromo';
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

// ── Events timeline ───────────────────────────────────────────────────────────

function EventIcon({ type, detail }: { type: string; detail?: string }) {
  if (type === 'goal') {
    const cls = detail === 'own goal' ? styles.iconGoalOwn : detail === 'pen' ? styles.iconGoalPen : styles.iconGoal;
    return <span className={cls} aria-hidden="true">⚽</span>;
  }
  if (type === 'yellow') return <div className={styles.iconYellow} aria-label="Yellow card" />;
  if (type === 'red')    return <div className={styles.iconRed}    aria-label="Red card" />;
  if (type === 'sub') {
    return (
      <svg className={styles.iconSub} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 2v5l3-3" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 14V9l-3 3"  stroke="#e03131" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  // VAR / fallback
  return <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'monospace' }}>VAR</span>;
}

function EventRow({ e }: { e: MatchEvent; homeShort: string; awayShort: string }) {
  const isGoal = e.type === 'goal';

  const playerCls = [
    styles.eventPlayer,
    isGoal ? styles.eventPlayerGoal : '',
  ].filter(Boolean).join(' ');

  const content = (
    <div className={styles.eventTextWrap}>
      <span className={playerCls}>{e.player}</span>
      {e.detail && <span className={styles.eventDetail}>{e.detail}</span>}
    </div>
  );

  const icon = <div className={styles.eventIconWrap}><EventIcon type={e.type} detail={e.detail} /></div>;

  const minBadge = (
    <div className={styles.eventMinCol}>
      <span className={styles.eventMinBadge}>{e.min}&prime;</span>
    </div>
  );

  return (
    <div className={styles.eventRow}>
      {e.team === 'home' ? (
        <>
          <div className={`${styles.eventCell} ${styles.eventCellHome}`}>{content}{icon}</div>
          {minBadge}
          <div className={`${styles.eventCell} ${styles.eventCellEmpty}`} />
        </>
      ) : (
        <>
          <div className={`${styles.eventCell} ${styles.eventCellEmpty}`} />
          {minBadge}
          <div className={`${styles.eventCell} ${styles.eventCellAway}`}>{icon}{content}</div>
        </>
      )}
    </div>
  );
}

function EventsSection({ d }: { d: MatchDetailData }) {
  if (d.events.length === 0) return null;

  const mainEvents = d.events.filter(e => e.type !== 'sub' && e.type !== 'var');
  const subEvents  = d.events.filter(e => e.type === 'sub');

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Match Events</h2>

      {/* Column headers */}
      <div className={styles.eventRow} style={{ marginBottom: 4 }}>
        <div className={styles.eventCell} style={{ justifyContent: 'flex-end', paddingBottom: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.08em', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>
            {d.home.short || d.home.name}
          </span>
        </div>
        <div />
        <div className={styles.eventCell} style={{ paddingBottom: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.08em', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>
            {d.away.short || d.away.name}
          </span>
        </div>
      </div>

      <div className={styles.eventsGrid}>
        {mainEvents.map((e: MatchEvent, i: number) => (
          <EventRow key={i} e={e} homeShort={d.home.short} awayShort={d.away.short} />
        ))}

        {subEvents.length > 0 && (
          <>
            <div className={styles.eventsDivider}>
              <div className={styles.eventsDividerLine} />
              <span className={styles.eventsDividerLabel}>Substitutions</span>
              <div className={styles.eventsDividerLine} />
            </div>
            {subEvents.map((e: MatchEvent, i: number) => (
              <EventRow key={`sub-${i}`} e={e} homeShort={d.home.short} awayShort={d.away.short} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Stats bars ────────────────────────────────────────────────────────────────

interface StatBarDef { label: string; home: number; away: number; isPercent?: boolean; decimals?: number; }

function StatsSection({ d }: { d: MatchDetailData }) {
  const s = d.stats;
  if (!s) return null;

  const statRows: StatBarDef[] = [
    { label: 'Possession',  home: s.possession[0],     away: s.possession[1],     isPercent: true },
    { label: 'Total Shots', home: s.shots[0],           away: s.shots[1] },
    ...(s.shotsOnTarget ? [{ label: 'On Target',  home: s.shotsOnTarget[0], away: s.shotsOnTarget[1] }] : []),
    { label: 'xG',          home: s.xG[0],              away: s.xG[1],             decimals: 2 },
    ...(s.corners ? [{ label: 'Corners',  home: s.corners[0], away: s.corners[1] }] : []),
    ...(s.fouls   ? [{ label: 'Fouls',    home: s.fouls[0],   away: s.fouls[1]   }] : []),
  ];

  const hasAnyData = statRows.some(r => r.home > 0 || r.away > 0);
  if (!hasAnyData) return null;

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Match Statistics</h2>
      <div className={styles.statsList}>
        {statRows.map(row => {
          const t = row.home + row.away || 1;
          const homePct = (row.home / t) * 100;
          const fmt = (v: number) =>
            row.isPercent ? `${v}%` :
            row.decimals  ? v.toFixed(row.decimals) :
            String(v);
          return (
            <div key={row.label} className={styles.statRow}>
              <div className={styles.statMeta}>
                <span className={`${styles.statVal} ${styles.statValHome}`}>{fmt(row.home)}</span>
                <span className={styles.statLabel}>{row.label}</span>
                <span className={`${styles.statVal} ${styles.statValAway}`}>{fmt(row.away)}</span>
              </div>
              <div className={styles.statBarTrack}>
                <div className={styles.statBarHome} style={{ width: `${homePct}%` }} />
                <div className={styles.statBarAway} style={{ width: `${100 - homePct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Desktop featured card ─────────────────────────────────────────────────────
function MatchCard({ d, locale, matchId }: { d: MatchDetailData; locale: string; matchId: string }) {
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
        <Link href={`/${locale}/studio/${matchId}`} className="fs-btn ghost" style={{ height: 32, padding: '0 12px', fontSize: 12, textDecoration: 'none' }}>
          <Icon name="share" size={14} /> Share Studio
        </Link>
      </div>

      <div className={styles.scoreGrid}>
        <Link href={`/${locale}/team/${d.home.id}`} className={styles.teamLeft} style={{ textDecoration: 'none' }}>
          <Crest team={d.home} size="xl" />
          <div>
            <div className={styles.teamRole}>Home</div>
            <div className={styles.teamName}>{d.home.name}</div>
          </div>
        </Link>
        <div className={styles.scoreBlock}>
          <span className={styles.score}>{d.home.score ?? '–'}</span>
          <span className={styles.scoreDash}>–</span>
          <span className={styles.score}>{d.away.score ?? '–'}</span>
        </div>
        <Link href={`/${locale}/team/${d.away.id}`} className={styles.teamRight} style={{ textDecoration: 'none' }}>
          <div style={{ textAlign: 'right' }}>
            <div className={styles.teamRole}>Away</div>
            <div className={styles.teamName}>{d.away.name}</div>
          </div>
          <Crest team={d.away} size="xl" />
        </Link>
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
function MobMatchCard({ d, locale, matchId }: { d: MatchDetailData; locale: string; matchId: string }) {
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
        <Link href={`/${locale}/studio/${matchId}`} className="fs-btn ghost" style={{ height: 28, padding: '0 10px', fontSize: 12, textDecoration: 'none' }}>
          <Icon name="share" size={13} /> Share Studio
        </Link>
      </div>

      <div className={styles.mobScoreGrid}>
        <Link href={`/${locale}/team/${d.home.id}`} className={styles.mobTeamLeft} style={{ textDecoration: 'none' }}>
          <Crest team={d.home} size="lg" />
          <div className={styles.mobTeamName}>{d.home.short || d.home.name}</div>
        </Link>
        <div className={styles.mobScoreBlock}>
          <span className={styles.mobScore}>{d.home.score ?? '–'}</span>
          <span className={styles.mobScoreDash}>–</span>
          <span className={styles.mobScore}>{d.away.score ?? '–'}</span>
        </div>
        <Link href={`/${locale}/team/${d.away.id}`} className={styles.mobTeamRight} style={{ textDecoration: 'none' }}>
          <Crest team={d.away} size="lg" />
          <div className={styles.mobTeamName}>{d.away.short || d.away.name}</div>
        </Link>
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
  const { matchId } = useParams() as { matchId: string };
  const router = useRouter();
  const { data, loading, error } = useMatchDetails(matchId ?? '');

  useSEO({
    title: data ? `${data.home.short || data.home.name} vs ${data.away.short || data.away.name} — ${data.competition}` : 'Match',
    description: data ? `Live score: ${data.home.name} vs ${data.away.name}. ${data.competition}.` : undefined,
    canonical: `/en/match/${matchId}`,
  });

  const matchTitle = data ? `${data.home.short || data.home.name} vs ${data.away.short || data.away.name}` : 'Match';

  return (
    <>
      {/* ── DESKTOP ─────────────────────────────────────── */}
      <div className={styles.desktopOnly}>
        <div className={styles.desktop}>
          <Sidebar locale={locale} />

          <main className={styles.main}>
            <button className={styles.backBtn} onClick={() => router.back()}>
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
                <MatchCard d={data} locale={locale} matchId={matchId ?? ''} />
                <EventsSection d={data} />
                <StatsSection d={data} />
                <H2HSection d={data} />
                <StandingsSection
                  rows={data.standings}
                  homeId={data.home.id}
                  awayId={data.away.id}
                  compName={data.competition}
                />
              </>
            )}
            <Footer />
          </main>

          <aside className={styles.rail}>
            <RailPromo locale={locale} />
            {data && <MatchInfoCard d={data} />}
            {data && <FormCard d={data} rows={data.standings} />}
          </aside>
        </div>
      </div>

      {/* ── MOBILE ──────────────────────────────────────── */}
      <div className={styles.mobileOnly}>
        <div className={styles.mobScreen}>
          <div className={styles.mobTopBar}>
            <button className={styles.mobBackBtn} onClick={() => router.back()}>
              <Icon name="chevron-left" size={20} />
            </button>
            <span className={styles.mobTopTitle}>{matchTitle}</span>
            <Link
              href={`/${locale}/studio/${matchId}`}
              className={styles.mobStudioBtn}
              title="Share Studio"
            >
              <Icon name="sparkles" size={16} />
              <span>Studio</span>
            </Link>
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
                <MobMatchCard d={data} locale={locale} matchId={matchId ?? ''} />
                <EventsSection d={data} />
                <StatsSection d={data} />
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
            <Footer />
          </div>
        </div>
      </div>
    </>
  );
}
