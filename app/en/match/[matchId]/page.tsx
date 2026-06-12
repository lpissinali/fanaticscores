import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchMatchDetail, fetchRelatedFixtures } from '@/lib/serverApi/matchDetails';
import type { MatchDetailData, MatchEvent, StandingRow, RelatedFixture } from '@/lib/serverApi/matchDetails';
import Sidebar from '@/src/components/layout/Sidebar/Sidebar';
import Footer from '@/src/components/layout/Footer/Footer';
import RailPromo from '@/src/components/shared/RailPromo/RailPromo';
import Icon from '@/src/components/shared/Icon/Icon';
import styles from '@/src/views/match/MatchPage.module.css';
import MobileBottomNav from '@/src/components/shared/MobileBottomNav/MobileBottomNav';
import LocalKickoff from '@/src/components/shared/LocalKickoff/LocalKickoff';
import LiveRefresh from '@/src/components/shared/LiveRefresh/LiveRefresh';
import Link from 'next/link';

interface Props { params: Promise<{ matchId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { matchId } = await params;
  const data = await fetchMatchDetail(matchId);
  if (!data) return { title: 'Match' };
  const score = data.home.score !== null && data.away.score !== null ? `${data.home.score}–${data.away.score}` : 'vs';
  const title = `${data.home.name} ${score} ${data.away.name} — ${data.competition}`;
  const description = `Match details for ${data.home.name} vs ${data.away.name} in ${data.competition}${data.venue ? ` at ${data.venue}` : ''}.`;
  const url = `/en/match/${matchId}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url }, twitter: { title, description } };
}

function ScoreHeader({ d, matchId }: { d: MatchDetailData; matchId: string }) {
  const statusChip =
    d.status === 'LIVE' ? <span className="chip live">Live{d.minute ? ` · ${d.minute}′` : ''}</span> :
    d.status === 'HT'   ? <span className="chip ht">Half Time</span> :
    d.status === 'FT'   ? <span className="chip ft">Full Time</span> :
                          <span className="chip"><LocalKickoff iso={d.kickoff} /></span>;
  return (
    <div className={styles.featured}>
      <div className={styles.featuredGlow} aria-hidden="true" />
      <div className={styles.featuredTop}>
        <div className={styles.featuredMeta}>
          {statusChip}
          <Link href={d.compCode ? `/en/competition/${d.compCode}` : '/en/competitions'} style={{ textDecoration: 'none' }}>
            <span className={styles.compLabel}>{d.compCountry ? `${d.compCountry} · ` : ''}{d.competition}</span>
          </Link>
          {d.matchday && <span className={styles.matchday}>MD {d.matchday}</span>}
        </div>
        <Link href={`/en/studio/${matchId}`} className="fs-btn ghost" style={{ height: 32, padding: '0 12px', fontSize: 12, textDecoration: 'none' }}>
          <Icon name="share" size={14} /> Share Studio
        </Link>
      </div>
      <div className={styles.scoreGrid}>
        <Link href={`/en/team/${d.home.id}`} className={styles.teamLeft} style={{ textDecoration: 'none' }}>
          {d.home.crest && <img src={d.home.crest} alt={d.home.name} width={56} height={56} style={{ objectFit: 'contain' }} />}
          <div><div className={styles.teamRole}>Home</div><div className={styles.teamName}>{d.home.name}</div></div>
        </Link>
        <div className={styles.scoreBlock}>
          <span className={styles.score}>{d.home.score ?? '–'}</span>
          <span className={styles.scoreDash}>–</span>
          <span className={styles.score}>{d.away.score ?? '–'}</span>
        </div>
        <Link href={`/en/team/${d.away.id}`} className={styles.teamRight} style={{ textDecoration: 'none' }}>
          <div style={{ textAlign: 'right' }}><div className={styles.teamRole}>Away</div><div className={styles.teamName}>{d.away.name}</div></div>
          {d.away.crest && <img src={d.away.crest} alt={d.away.name} width={56} height={56} style={{ objectFit: 'contain' }} />}
        </Link>
      </div>
      {d.halfTime.home !== null && (
        <div className={styles.htRow}>
          <span className={styles.htLabel}>Half-time</span>
          <span className={styles.htScore}>{d.halfTime.home} – {d.halfTime.away ?? 0}</span>
        </div>
      )}
    </div>
  );
}

function EventIcon({ type, detail }: { type: string; detail?: string }) {
  if (type === 'goal') {
    const cls = detail === 'own goal' ? styles.iconGoalOwn : detail === 'pen' ? styles.iconGoalPen : styles.iconGoal;
    return <span className={cls}>⚽</span>;
  }
  if (type === 'yellow') return <div className={styles.iconYellow} />;
  if (type === 'red')    return <div className={styles.iconRed} />;
  if (type === 'sub') return (
    <svg className={styles.iconSub} viewBox="0 0 16 16" fill="none">
      <path d="M8 2v5l3-3" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 14V9l-3 3" stroke="#e03131" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  return <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'monospace' }}>VAR</span>;
}

function EventsSection({ events }: { events: MatchEvent[] }) {
  if (events.length === 0) return null;
  const mainEvents = events.filter(e => e.type !== 'sub' && e.type !== 'var');
  const subs       = events.filter(e => e.type === 'sub');
  function EventRow({ e }: { e: MatchEvent }) {
    const text = (
      <div className={styles.eventTextWrap}>
        <span className={e.type === 'goal' ? styles.eventPlayerGoal : styles.eventPlayer}>{e.player}</span>
        {e.detail && <span className={styles.eventDetail}>{e.detail}</span>}
      </div>
    );
    const iconEl = <div className={styles.eventIconWrap}><EventIcon type={e.type} detail={e.detail} /></div>;
    const minCol = <div className={styles.eventMinCol}><span className={styles.eventMinBadge}>{e.min}′</span></div>;
    return (
      <div className={styles.eventRow}>
        {e.team === 'home' ? (
          <><div className={`${styles.eventCell} ${styles.eventCellHome}`}>{text}{iconEl}</div>{minCol}<div className={`${styles.eventCell} ${styles.eventCellEmpty}`} /></>
        ) : (
          <><div className={`${styles.eventCell} ${styles.eventCellEmpty}`} />{minCol}<div className={`${styles.eventCell} ${styles.eventCellAway}`}>{iconEl}{text}</div></>
        )}
      </div>
    );
  }
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Match Events</h2>
      <div className={styles.eventsGrid}>
        {mainEvents.map((e, i) => <EventRow key={i} e={e} />)}
        {subs.length > 0 && (
          <>
            <div className={styles.eventsDivider}><div className={styles.eventsDividerLine} /><span className={styles.eventsDividerLabel}>Substitutions</span><div className={styles.eventsDividerLine} /></div>
            {subs.map((e, i) => <EventRow key={i} e={e} />)}
          </>
        )}
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
          <span className={styles.colPos}>#</span><span className={styles.colTeam}>Club</span>
          <span className={styles.colNum}>P</span><span className={styles.colNum}>W</span>
          <span className={styles.colNum}>D</span><span className={styles.colNum}>L</span>
          <span className={styles.colNum}>GD</span><span className={styles.colPts}>Pts</span>
        </div>
        {rows.map(r => (
          <Link key={r.teamId} href={`/en/team/${r.teamId}`}
            className={[styles.tableRow, (r.teamId === homeId || r.teamId === awayId) ? styles.highlighted : ''].filter(Boolean).join(' ')}
            style={{ textDecoration: 'none' }}>
            <span className={styles.colPos}>{r.position}</span>
            <span className={styles.colTeam}><img src={r.teamCrest} alt={r.teamName} width={16} height={16} style={{ objectFit: 'contain', flexShrink: 0 }} />{r.teamName}</span>
            <span className={styles.colNum}>{r.played}</span><span className={styles.colNum}>{r.won}</span>
            <span className={styles.colNum}>{r.draw}</span><span className={styles.colNum}>{r.lost}</span>
            <span className={styles.colNum}>{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</span>
            <span className={styles.colPts}>{r.points}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function H2HSection({ d }: { d: MatchDetailData }) {
  if (!d.h2h) return null;
  const { homeWins, draws, awayWins, totalGoals, recent } = d.h2h;
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Head to Head</h2>
      <div className={styles.h2hBar}>
        <img src={d.home.crest} alt={d.home.name} width={22} height={22} style={{ objectFit: 'contain' }} />
        <div className={styles.h2hTrack}>
          {homeWins > 0 && <div className={styles.h2hHome} style={{ flex: homeWins }} />}
          {draws    > 0 && <div className={styles.h2hDraw} style={{ flex: draws }} />}
          {awayWins > 0 && <div className={styles.h2hAway} style={{ flex: awayWins }} />}
        </div>
        <img src={d.away.crest} alt={d.away.name} width={22} height={22} style={{ objectFit: 'contain' }} />
      </div>
      <div className={styles.h2hCounts}>
        <span className={styles.h2hWin}>{homeWins}W</span>
        <span className={styles.h2hDrawCount}>{draws}D</span>
        <span className={styles.h2hWin}>{awayWins}W</span>
      </div>
      <div className={styles.h2hGoals}>{totalGoals} goals in last {recent.length} meetings</div>
      <div className={styles.h2hList}>
        {recent.map(m => (
          <div key={m.id} className={styles.h2hRow}>
            <span className={styles.h2hDate}>{m.date}</span>
            <span className={styles.h2hName} style={{ textAlign: 'right' }}>{m.homeTeam}</span>
            <span className={styles.h2hResult}>{m.homeScore ?? '–'} – {m.awayScore ?? '–'}</span>
            <span className={styles.h2hName}>{m.awayTeam}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobMatchCard({ d, matchId }: { d: MatchDetailData; matchId: string }) {
  const statusChip =
    d.status === 'LIVE' ? <span className="chip live">Live{d.minute ? ` · ${d.minute}′` : ''}</span> :
    d.status === 'HT'   ? <span className="chip ht">Half Time</span> :
    d.status === 'FT'   ? <span className="chip ft">Full Time</span> :
                          <span className="chip"><LocalKickoff iso={d.kickoff} /></span>;
  return (
    <div className={styles.mobFeatured}>
      <div className={styles.featuredGlow} aria-hidden="true" />
      <div className={styles.mobFeaturedTop}>
        <div className={styles.mobFeaturedMeta}>
          {statusChip}
          <span className={styles.compLabel}>{d.compCountry ? `${d.compCountry} · ` : ''}{d.competition}</span>
        </div>
        <Link href={`/en/studio/${matchId}`} className="fs-btn ghost" style={{ height: 28, padding: '0 10px', fontSize: 12, textDecoration: 'none' }}>
          <Icon name="share" size={13} /> Share Studio
        </Link>
      </div>
      <div className={styles.mobScoreGrid}>
        <Link href={`/en/team/${d.home.id}`} className={styles.mobTeamLeft} style={{ textDecoration: 'none' }}>
          {d.home.crest && <img src={d.home.crest} alt={d.home.name} width={48} height={48} style={{ objectFit: 'contain' }} />}
          <div className={styles.mobTeamName}>{d.home.short || d.home.name}</div>
        </Link>
        <div className={styles.mobScoreBlock}>
          <span className={styles.mobScore}>{d.home.score ?? '–'}</span>
          <span className={styles.mobScoreDash}>–</span>
          <span className={styles.mobScore}>{d.away.score ?? '–'}</span>
        </div>
        <Link href={`/en/team/${d.away.id}`} className={styles.mobTeamRight} style={{ textDecoration: 'none' }}>
          {d.away.crest && <img src={d.away.crest} alt={d.away.name} width={48} height={48} style={{ objectFit: 'contain' }} />}
          <div className={styles.mobTeamName}>{d.away.short || d.away.name}</div>
        </Link>
      </div>
      {(d.status === 'FT' || d.status === 'HT') && d.halfTime.home !== null && (
        <div className={styles.mobHtRow}>
          <span className={styles.htLabel}>Half-time</span>
          <span className={styles.htScore}>{d.halfTime.home} – {d.halfTime.away ?? 0}</span>
        </div>
      )}
    </div>
  );
}

function RelatedFixturesRail({ fixtures, compCode, compName }: { fixtures: RelatedFixture[]; compCode: string; compName: string }) {
  if (fixtures.length === 0) return null;
  return (
    <div className={styles.infoCard} style={{ marginTop: 16 }}>
      <div className={styles.infoTitle}>
        <Link href={`/en/competition/${compCode}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          More in {compName}
        </Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        {fixtures.map(f => {
          const date = new Date(f.utcDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const time = new Date(f.utcDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const score = f.homeTeam.score !== null && f.awayTeam.score !== null
            ? `${f.homeTeam.score}–${f.awayTeam.score}`
            : time;
          return (
            <Link key={f.id} href={`/en/match/${f.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', color: 'inherit' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 30 }}>
                {f.homeTeam.crest && <img src={f.homeTeam.crest} alt={f.homeTeam.name} width={18} height={18} style={{ objectFit: 'contain' }} />}
                {f.awayTeam.crest && <img src={f.awayTeam.crest} alt={f.awayTeam.name} width={18} height={18} style={{ objectFit: 'contain', marginTop: 2 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.homeTeam.short}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.awayTeam.short}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div>{score}</div>
                <div style={{ fontWeight: 400, fontSize: 11 }}>{date}</div>
              </div>
            </Link>
          );
        })}
        <Link href={`/en/competition/${compCode}`} style={{ textDecoration: 'none', fontSize: 12, color: 'var(--orange)', fontWeight: 600, paddingTop: 4 }}>
          View all →
        </Link>
      </div>
    </div>
  );
}

function InfoCard({ d }: { d: MatchDetailData }) {
  if (!d.venue && !d.referee && !d.stage) return null;
  return (
    <div className={styles.infoCard}>
      <div className={styles.infoTitle}>Match info</div>
      {d.venue   && <div className={styles.infoRow}><span className={styles.infoLabel}>Venue</span><span className={styles.infoValue}>{d.venue}</span></div>}
      {d.referee && <div className={styles.infoRow}><span className={styles.infoLabel}>Referee</span><span className={styles.infoValue}>{d.referee}</span></div>}
      {d.stage   && <div className={styles.infoRow}><span className={styles.infoLabel}>Round</span><span className={styles.infoValue}>{d.stage}</span></div>}
    </div>
  );
}

export default async function MatchPage({ params }: Props) {
  const { matchId } = await params;
  const data = await fetchMatchDetail(matchId);
  if (!data) notFound();
  const d = data as MatchDetailData;
  const matchTitle = `${d.home.short || d.home.name} vs ${d.away.short || d.away.name}`;

  const relatedFixtures = d.compCode
    ? await fetchRelatedFixtures(d.compCode, matchId)
    : [];

  const hasScore = d.home.score !== null && d.away.score !== null;
  const scoreStr = hasScore ? `${d.home.score}–${d.away.score}` : null;
  const eventStatus =
    d.status === 'POSTPONED' ? 'https://schema.org/EventPostponed' :
    d.status === 'CANCELLED' ? 'https://schema.org/EventCancelled' :
                               'https://schema.org/EventScheduled';
  const matchDescription = hasScore
    ? `${d.home.name} ${scoreStr} ${d.away.name} — ${d.competition}${d.venue ? ` at ${d.venue}` : ''}.`
    : `${d.home.name} vs ${d.away.name} in ${d.competition}${d.venue ? ` at ${d.venue}` : ''}.`;

  const homeTeamLd = { '@type': 'SportsTeam', name: d.home.name, ...(d.home.crest ? { logo: d.home.crest } : {}) };
  const awayTeamLd = { '@type': 'SportsTeam', name: d.away.name, ...(d.away.crest ? { logo: d.away.crest } : {}) };

  // Search Console (Events rich results) wants endDate, image, performer and
  // location.address on every Event — all non-critical, but easy to satisfy.

  // Venue is stored as "Name, City" (joined in matchDetails.ts); split the
  // city back out so location can carry an address.
  const venueParts = d.venue ? d.venue.split(', ') : [];
  const venueName = venueParts[0] || null;
  const venueCity = venueParts.length > 1 ? venueParts[venueParts.length - 1] : null;

  // Football has no published end time; kickoff + 2.5h covers half-time,
  // stoppage and most extra time.
  const kickoffTs = d.kickoff ? Date.parse(d.kickoff) : NaN;
  const endDate = Number.isFinite(kickoffTs)
    ? new Date(kickoffTs + 2.5 * 60 * 60 * 1000).toISOString()
    : undefined;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${d.home.name} vs ${d.away.name}`,
    description: matchDescription,
    sport: 'Soccer',
    startDate: d.kickoff ?? undefined,
    endDate,
    eventStatus,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: [d.home.crest, d.away.crest, 'https://www.fanaticscores.com/og-default.png'].filter(Boolean),
    location: venueName
      ? {
          '@type': 'Place',
          name: venueName,
          address: venueCity
            ? { '@type': 'PostalAddress', addressLocality: venueCity }
            : venueName,
        }
      : undefined,
    homeTeam: homeTeamLd,
    awayTeam: awayTeamLd,
    competitor: [homeTeamLd, awayTeamLd],
    performer: [homeTeamLd, awayTeamLd],
    // NOTE: no `superEvent` here. A nested bare SportsEvent ({ name } only)
    // is validated by Google as its own Event item and reported with critical
    // "missing startDate / missing location" errors (it surfaced in Search
    // Console as a broken "World Cup" event). We don't reliably know any
    // competition's season dates, so the tournament is expressed through
    // `organizer` instead — which Events rich results also ask for.
    organizer: {
      '@type': 'SportsOrganization',
      name: d.competition,
      url: d.compCode
        ? `https://www.fanaticscores.com/en/competition/${d.compCode}`
        : 'https://www.fanaticscores.com/en/competitions',
    },
    url: `https://www.fanaticscores.com/en/match/${matchId}`,
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',        item: 'https://www.fanaticscores.com/en/today' },
      { '@type': 'ListItem', position: 2, name: d.competition,  item: d.compCode ? `https://www.fanaticscores.com/en/competition/${d.compCode}` : 'https://www.fanaticscores.com/en/competitions' },
      { '@type': 'ListItem', position: 3, name: `${d.home.name} vs ${d.away.name}`, item: `https://www.fanaticscores.com/en/match/${matchId}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, '\\u003c') }} />
      {/* Auto-update score/minute/events while the match is (or should be) in
          progress — refresh re-runs the server render; upstream stays capped
          by the 2-min live TTL regardless of viewer count. */}
      <LiveRefresh
        active={
          d.status === 'LIVE' || d.status === 'HT' ||
          (Number.isFinite(kickoffTs) &&
            Date.now() > kickoffTs - 30 * 60_000 &&
            Date.now() < kickoffTs + 4 * 3_600_000 &&
            !['FT', 'AET', 'PEN', 'POSTPONED', 'CANCELLED'].includes(d.status))
        }
      />
      <div className={styles.desktopOnly}>
        <div className={styles.desktop}>
          <Sidebar locale="en" />
          <main className={styles.main}>
            <ScoreHeader d={d} matchId={matchId} />
            <EventsSection events={d.events} />
            <H2HSection d={d} />
            <StandingsSection rows={d.standings} homeId={d.home.id} awayId={d.away.id} compName={d.competition} />
            <Footer />
          </main>
          <aside className={styles.rail}>
            <RailPromo locale="en" />
            <InfoCard d={d} />
            <RelatedFixturesRail fixtures={relatedFixtures} compCode={d.compCode} compName={d.competition} />
          </aside>
        </div>
      </div>
      <div className={styles.mobileOnly}>
        <div className="screen">
          <div className={styles.mobTopBar}>
            <Link href="/en/today" className={styles.mobBackBtn} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              <Icon name="chevron-left" size={20} />
            </Link>
            <span className={styles.mobTopTitle}>{matchTitle}</span>
            <Link href={`/en/studio/${matchId}`} className={styles.mobStudioBtn} style={{ textDecoration: 'none' }}>
              <Icon name="sparkles" size={16} /><span>Studio</span>
            </Link>
          </div>
          <div className="scroll" style={{ padding: '16px 16px 40px' }}>
            <MobMatchCard d={d} matchId={matchId} />
            <EventsSection events={d.events} />
            <H2HSection d={d} />
            <StandingsSection rows={d.standings} homeId={d.home.id} awayId={d.away.id} compName={d.competition} />
            <InfoCard d={d} />
            <Footer />
          </div>
          <MobileBottomNav locale="en" />
        </div>
      </div>
    </>
  );
}
