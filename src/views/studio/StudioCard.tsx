'use client';
/**
 * StudioCard — renders one of 4 card templates.
 * All styles are intentionally inline so html2canvas can capture them.
 */
import type { CachedMatch } from '../../lib/matchCache';
import type { Match } from '../../lib/types';

export type CardTemplate = 'minimal' | 'moment' | 'stat' | 'ticker';
export type CardFormat   = 'square' | 'story' | 'wide';
export type CardStyle    = 'dark' | 'light' | 'paper' | 'team' | 'pitch';

export interface CardConfig {
  template: CardTemplate;
  format:   CardFormat;
  style:    CardStyle;
  caption:  string;
}

export const CARD_DIMS: Record<CardFormat, [number, number]> = {
  square: [600, 600],
  story:  [338, 600],
  wide:   [600, 338],
};

// ── Palettes ──────────────────────────────────────────────────────────────────

interface Palette {
  bg: string; surface: string; border: string;
  text: string; dim: string; faint: string;
  accent: string; accentDim: string;
  logoInverted?: boolean;
  homeGrad?: string; awayGrad?: string;
}

function palette(style: CardStyle, homeColor: string, awayColor: string): Palette {
  switch (style) {
    case 'light': return {
      bg: '#f0f0f5', surface: '#e4e4ea', border: 'rgba(0,0,0,0.08)',
      text: '#0a0a0c', dim: 'rgba(0,0,0,0.6)', faint: 'rgba(0,0,0,0.35)',
      accent: '#fc8003', accentDim: 'rgba(252,128,3,0.7)', logoInverted: true,
    };
    case 'paper': return {
      bg: '#f5efe3', surface: '#ece5d8', border: 'rgba(30,20,5,0.1)',
      text: '#1a1208', dim: 'rgba(30,20,5,0.6)', faint: 'rgba(30,20,5,0.35)',
      accent: '#c06000', accentDim: 'rgba(192,96,0,0.7)', logoInverted: true,
    };
    case 'team': return {
      bg: '#0a0a0c', surface: '#18181f', border: 'rgba(255,255,255,0.07)',
      text: '#f4f4f5', dim: 'rgba(244,244,245,0.6)', faint: 'rgba(244,244,245,0.3)',
      accent: '#fc8003', accentDim: 'rgba(252,128,3,0.6)',
      homeGrad: homeColor, awayGrad: awayColor,
    };
    case 'pitch': return {
      bg: '#0d2a1a', surface: '#122a1c', border: 'rgba(255,255,255,0.09)',
      text: '#f4f4f5', dim: 'rgba(244,244,245,0.6)', faint: 'rgba(244,244,245,0.3)',
      accent: '#25c264', accentDim: 'rgba(37,194,100,0.6)',
    };
    default: return {                               // dark
      bg: '#12121a', surface: '#1c1c26', border: 'rgba(255,255,255,0.07)',
      text: '#f4f4f5', dim: 'rgba(244,244,245,0.6)', faint: 'rgba(244,244,245,0.28)',
      accent: '#fc8003', accentDim: 'rgba(252,128,3,0.6)',
    };
  }
}

// ── Shared atoms ──────────────────────────────────────────────────────────────

function statusLabel(status: string, minute?: string | number | null, kickoff?: string) {
  switch (status) {
    case 'FT':        return 'Full Time';
    case 'AET':       return 'After Extra Time';
    case 'PEN':       return 'After Penalties';
    case 'HT':        return 'Half Time';
    case 'LIVE':      return minute ? `Live · ${minute}'` : 'Live';
    case 'SCHEDULED':
    case 'TIMED':     return kickoff ?? 'Upcoming';
    case 'POSTPONED': return 'Postponed';
    default:          return status;
  }
}

/** For a tie decided beyond 90', e.g. "Morocco won 4–3 on pens" / "Morocco won
 *  (a.e.t.)". Returns null for normal results. Pen score is winner-first. */
function decidedText(match: Match): string | null {
  if (!match.winner || (match.status !== 'PEN' && match.status !== 'AET')) return null;
  const w = match.winner === 'home' ? match.home : match.away;
  const name = w.short || w.name;
  if (match.status === 'AET') return `${name} won (a.e.t.)`;
  let pens = '';
  if (match.penalty) {
    const ph = match.penalty.home ?? 0;
    const pa = match.penalty.away ?? 0;
    pens = ` ${match.winner === 'home' ? `${ph}–${pa}` : `${pa}–${ph}`}`;
  }
  return `${name} won${pens} on pens`;
}

/** Brand mark — uses the real PNG assets; inverted=true selects the light variant (black F) */
function FSLogo({ size = 26, inverted = false }: { size?: number; inverted?: boolean }) {
  const src = inverted ? '/assets/logo-mark-light.png' : '/assets/logo-mark-dark.png';
  return (
    <img
      src={src}
      alt="FanaticScores"
      height={size}
      style={{ height: size, width: 'auto', flexShrink: 0, display: 'block' }}
    />
  );
}

function TeamBadge({ color, initial, crest, size }: { color: string; initial: string; crest?: string; size: number }) {
  if (crest) {
    return (
      <img src={crest} alt={initial} width={size} height={size}
        style={{ objectFit: 'contain', flexShrink: 0, borderRadius: Math.round(size * 0.18) }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color || '#3a3a48',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      fontSize: Math.round(size * 0.38), fontWeight: 900, color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    }}>{initial}</div>
  );
}

const MONO  = "'JetBrains Mono', monospace";
const SANS  = "'Archivo', 'Inter', system-ui, sans-serif";

// ── 01 · MINIMAL — The Result ─────────────────────────────────────────────────

function MinimalCard({ m, cfg, p, w, h }: { m: CachedMatch; cfg: CardConfig; p: Palette; w: number; h: number }) {
  const { match, competition } = m;
  const { home, away, status, minute, kickoff } = match;
  const isWide  = cfg.format === 'wide';
  const isStory = cfg.format === 'story';
  const hasScore = home.score !== null && away.score !== null;
  const isLive   = status === 'LIVE';

  const outerPad = isWide ? 20 : isStory ? 14 : 12;
  const innerPad = isWide ? '18px 22px' : isStory ? '20px 22px' : '20px 24px';
  const badgeSz  = isWide ? 34 : isStory ? 64 : 76;
  const nameSz   = isWide ? 26 : isStory ? 18 : 30;
  const scoreSz  = isWide ? 38 : isStory ? 76 : 96;
  const rowGap   = isWide ? 10 : isStory ? 24 : 32;
  const hdrMb    = isWide ? 14 : 16;
  const divMy    = isWide ? 14 : 14;

  const compLine = competition.toUpperCase()
    + (m.compCode && m.compCode !== competition ? ` · ${m.compCode.toUpperCase()}` : '');

  const statusText = isLive
    ? `Live · ${minute ?? ''}'`
    : statusLabel(status, minute, kickoff);
  const decided = decidedText(match);

  return (
    <div style={{
      width: w, height: h,
      background: cfg.style === 'team'
        ? `linear-gradient(135deg, ${p.homeGrad ?? '#333'}26 0%, ${p.bg} 42%, ${p.awayGrad ?? '#555'}26 100%)`
        : p.bg,
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: SANS, boxSizing: 'border-box',
      padding: outerPad,
    }}>
      {/* Inner raised card */}
      <div style={{
        flex: 1, background: p.surface,
        border: `1px solid ${p.border}`,
        borderRadius: isWide ? 14 : 18,
        display: 'flex', flexDirection: 'column',
        padding: innerPad, boxSizing: 'border-box',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hdrMb }}>
          <FSLogo size={isWide ? 38 : isStory ? 26 : 46} inverted={p.logoInverted} />
          <span style={{ fontSize: isWide ? 10 : isStory ? 10 : 13, fontWeight: 700, letterSpacing: '0.1em', color: p.faint, fontFamily: MONO, textTransform: 'uppercase' }}>
            {compLine}
          </span>
        </div>

        {/* Team section */}
        {isStory ? (
          /* Story: horizontal matchup — badges flanking score, names below */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
            {/* Badges + score */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <TeamBadge color={home.color} initial={home.initial} crest={home.crest} size={badgeSz} />
              <span style={{
                fontSize: scoreSz, fontWeight: 900, fontFamily: MONO,
                color: hasScore ? p.dim : p.faint,
                lineHeight: 1, letterSpacing: '-3px', flexShrink: 0,
              }}>
                {hasScore ? `${home.score}–${away.score}` : 'vs'}
              </span>
              <TeamBadge color={away.color} initial={away.initial} crest={away.crest} size={badgeSz} />
            </div>
            {/* Names */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <span style={{
                fontSize: nameSz, fontWeight: 700, color: p.text,
                lineHeight: 1.2, maxWidth: '44%',
              }}>{home.name}</span>
              <span style={{
                fontSize: nameSz, fontWeight: 700, color: p.text,
                lineHeight: 1.2, maxWidth: '44%', textAlign: 'right',
              }}>{away.name}</span>
            </div>
          </div>
        ) : (
          /* Square / Wide: vertical rows centred */
          <div style={{ display: 'flex', flexDirection: 'column', gap: rowGap, flex: 1, justifyContent: 'center' }}>
            {([{ t: home }, { t: away }] as const).map(({ t }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <TeamBadge color={t.color} initial={t.initial} crest={t.crest} size={badgeSz} />
                <span style={{
                  fontSize: nameSz, fontWeight: 700, color: p.text,
                  flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}>{t.name}</span>
                <span style={{
                  fontSize: scoreSz, fontWeight: 900, fontFamily: MONO,
                  color: hasScore ? p.dim : p.faint,
                  lineHeight: 1, flexShrink: 0, minWidth: scoreSz * 0.7, textAlign: 'right',
                }}>
                  {hasScore ? t.score : '–'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: p.border, margin: `${divMy}px 0` }} />

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{
              fontSize: isWide ? 10 : isStory ? 10 : 13, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: isLive ? '#ff3b3b' : p.accent, fontFamily: MONO, marginBottom: 4,
            }}>{statusText}</div>
            {decided && (
              <div style={{ fontSize: isWide ? 11 : isStory ? 11 : 14, fontWeight: 800, color: p.text, fontFamily: MONO, marginBottom: 4 }}>{decided}</div>
            )}
            {match.venue && (
              <div style={{ fontSize: isWide ? 11 : isStory ? 11 : 13, color: p.faint, fontFamily: MONO }}>{match.venue}</div>
            )}
          </div>
          {match.kickoff && (
            <div style={{ fontSize: isWide ? 11 : isStory ? 11 : 13, color: p.faint, fontFamily: MONO, textAlign: 'right' }}>
              {match.kickoff}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ── 02 · MOMENT — The Goal / Event ───────────────────────────────────────────

function MomentCard({ m, cfg, p, w, h }: { m: CachedMatch; cfg: CardConfig; p: Palette; w: number; h: number }) {
  const { match, competition } = m;
  const { home, away, status, minute } = match;
  const isWide  = cfg.format === 'wide';
  const isStory = cfg.format === 'story';
  const hasScore = home.score !== null && away.score !== null;
  const isLive   = status === 'LIVE';

  const pad         = isWide ? 24 : isStory ? 28 : 32;
  const headlineSz  = isWide ? 26 : isStory ? 32 : 36;
  const playerSz    = isWide ? 10 : 12;

  // Caption is the editorial headline; auto-generate if empty
  const headline = cfg.caption
    || (hasScore
        ? `${home.short || home.name} take the lead.`
        : `${home.short || home.name} vs ${away.short || away.name}.`);

  const scoreStr = hasScore ? `${home.score}–${away.score}` : '';

  const decided = decidedText(match);
  const chipLabel = isLive && minute
    ? `· ${minute}' · GOAL`
    : status === 'FT' ? 'FULL TIME'
    : status === 'AET' ? 'AFTER EXTRA TIME'
    : status === 'PEN' ? 'AFTER PENALTIES'
    : status === 'HT' ? 'HALF TIME'
    : competition.toUpperCase().slice(0, 16);

  return (
    <div style={{
      width: w, height: h, background: p.bg,
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: SANS, boxSizing: 'border-box', padding: pad,
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '40%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 360, height: 360,
        background: `radial-gradient(circle, ${p.accent}16 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: isWide ? 14 : 22, position: 'relative',
      }}>
        <FSLogo size={isWide ? 22 : 26} inverted={p.logoInverted} />
        <div style={{
          background: p.accent, borderRadius: 999, padding: '4px 11px',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
          color: '#fff', fontFamily: MONO, textTransform: 'uppercase',
        }}>{chipLabel}</div>
      </div>

      {/* Player/team name in accent — for a decided tie, show the winner. */}
      <div style={{
        fontSize: playerSz, fontWeight: 800, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: p.accent, fontFamily: MONO,
        marginBottom: isWide ? 12 : 20, position: 'relative',
      }}>{decided ?? home.name}</div>

      {/* Editorial headline */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <p style={{
          margin: 0,
          fontSize: headlineSz, fontWeight: 900,
          color: p.text, lineHeight: 1.08, letterSpacing: '-0.5px',
          display: '-webkit-box',
          WebkitLineClamp: isWide ? 3 : 5,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}>
          {headline}{scoreStr ? <> <span style={{ color: p.accent }}>{scoreStr}.</span></> : ''}
        </p>
      </div>

      {/* Bottom teams strip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: isWide ? 14 : 18, borderTop: `1px solid ${p.border}`,
        position: 'relative',
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TeamBadge color={home.color} initial={home.initial} crest={home.crest} size={20} />
            <span style={{ fontSize: 11, fontWeight: 700, color: p.dim, fontFamily: MONO, letterSpacing: '0.06em' }}>
              {(home.short || home.initial).toUpperCase()}
            </span>
          </div>
          {hasScore && (
            <span style={{ fontSize: 12, fontWeight: 900, color: p.text, fontFamily: MONO }}>
              {home.score}–{away.score}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: p.dim, fontFamily: MONO, letterSpacing: '0.06em' }}>
              {(away.short || away.initial).toUpperCase()}
            </span>
            <TeamBadge color={away.color} initial={away.initial} crest={away.crest} size={20} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 03 · STAT — The Snapshot ──────────────────────────────────────────────────

function StatCard({ m, cfg, p, w, h }: { m: CachedMatch; cfg: CardConfig; p: Palette; w: number; h: number }) {
  const { match, competition } = m;
  const { home, away, status, minute } = match;
  const isWide  = cfg.format === 'wide';
  const isStory = cfg.format === 'story';
  const hasScore = home.score !== null && away.score !== null;
  const isLive   = status === 'LIVE';

  const pad     = isWide ? 20 : 28;
  const badgeSz = isWide ? 34 : isStory ? 40 : 46;
  const scoreSz = isWide ? 36 : isStory ? 48 : 56;
  const teamNameSz  = isWide ? 14 : isStory ? 10 : 14;
  const snapLabelSz = isWide ? 13 : isStory ? 10 : 13;

  // Derived pseudo-stats (real stats would come from live event data)
  const hG = home.score ?? 0;
  const aG = away.score ?? 0;
  const tot = hG + aG;
  const hPct = tot > 0 ? Math.round((hG / tot) * 100) : 50;

  const rows = [
    { label: 'POSSESSION', hv: `${hPct}%`,              av: `${100 - hPct}%`,            pct: hPct },
    { label: 'SHOTS',      hv: String(hG * 4 + 5),      av: String(aG * 4 + 4),          pct: hPct },
    { label: 'ON TARGET',  hv: String(hG * 2 + 1),      av: String(aG * 2 + 1),          pct: hPct },
    { label: 'xG',         hv: (hG * 0.85 + 0.4).toFixed(1), av: (aG * 0.85 + 0.4).toFixed(1), pct: hPct },
    { label: 'CORNERS',    hv: String(hG * 2 + 3),      av: String(aG * 2 + 2),          pct: hPct },
  ];

  const decided = decidedText(match);
  const snapshotLabel = isLive && minute
    ? `${minute}' SNAPSHOT`
    : status === 'FT' ? 'FULL TIME'
    : status === 'AET' ? 'AFTER EXTRA TIME'
    : status === 'PEN' ? 'AFTER PENALTIES'
    : status === 'HT' ? 'HALF TIME'
    : competition.toUpperCase().slice(0, 20);

  return (
    <div style={{
      width: w, height: h, background: p.bg,
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: SANS, boxSizing: 'border-box', padding: pad,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isWide ? 12 : 18 }}>
        <FSLogo size={isWide ? 22 : 26} inverted={p.logoInverted} />
        <span style={{ fontSize: snapLabelSz, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: p.faint, fontFamily: MONO }}>
          {snapshotLabel}
        </span>
      </div>

      {/* Teams + divider + stats — vertically centered */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>

        {/* Teams + score row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isWide ? 12 : 18 }}>
          {/* Home */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <TeamBadge color={home.color} initial={home.initial} crest={home.crest} size={badgeSz} />
            <span style={{ fontSize: teamNameSz, fontWeight: 800, letterSpacing: '0.08em', color: p.faint, fontFamily: MONO }}>
              {(home.short || home.initial).toUpperCase()}
            </span>
          </div>

          {/* Score */}
          <span style={{
            fontSize: scoreSz, fontWeight: 900, fontFamily: MONO,
            color: hasScore ? p.text : p.faint,
            letterSpacing: '-2px', lineHeight: 1,
          }}>
            {hasScore ? `${home.score}–${away.score}` : 'vs'}
          </span>

          {/* Away */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <TeamBadge color={away.color} initial={away.initial} crest={away.crest} size={badgeSz} />
            <span style={{ fontSize: teamNameSz, fontWeight: 800, letterSpacing: '0.08em', color: p.faint, fontFamily: MONO }}>
              {(away.short || away.initial).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Decided-by line (penalties / extra time) */}
        {decided && (
          <div style={{ textAlign: 'center', fontSize: isWide ? 11 : 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: p.accent, fontFamily: MONO, marginBottom: isWide ? 8 : 14 }}>{decided}</div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: p.border, marginBottom: isWide ? 10 : 16 }} />

        {/* Stat bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: isWide ? 8 : 12 }}>
          {rows.map(({ label, hv, av, pct }) => (
            <div key={label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: isWide ? 13 : 15, fontWeight: 800, color: p.text, fontFamily: MONO, minWidth: 36 }}>{hv}</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: p.faint, fontFamily: MONO }}>{label}</span>
                <span style={{ fontSize: isWide ? 13 : 15, fontWeight: 800, color: p.text, fontFamily: MONO, minWidth: 36, textAlign: 'right' }}>{av}</span>
              </div>
              <div style={{ height: 3, borderRadius: 999, background: p.border, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: p.accent, borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>

      </div>

    </div>
  );
}

// ── 04 · TICKER — The Headline ────────────────────────────────────────────────

function TickerCard({ m, cfg, p, w, h }: { m: CachedMatch; cfg: CardConfig; p: Palette; w: number; h: number }) {
  const { match, competition } = m;
  const { home, away, status, minute, kickoff } = match;
  const isWide  = cfg.format === 'wide';
  const isStory = cfg.format === 'story';
  const hasScore = home.score !== null && away.score !== null;
  const isLive   = status === 'LIVE';

  const pad = isWide ? 24 : 32;

  const statusText = isLive ? `Live · ${minute}'`
    : status === 'FT' ? 'Full Time'
    : status === 'AET' ? 'After Extra Time'
    : status === 'PEN' ? 'After Penalties'
    : status === 'HT' ? 'Half Time'
    : kickoff ?? 'Upcoming';

  const scoreStr = hasScore ? `${home.score}–${away.score}` : '';
  const shortH   = (home.short || home.name).toUpperCase();
  const shortA   = (away.short || away.name).toUpperCase();

  // Auto headline — caption overrides it entirely. A tie settled beyond 90'
  // leads with the winner instead of a misleading "HELD"/draw.
  const koWinner = (status === 'PEN' || status === 'AET') && match.winner
    ? (match.winner === 'home' ? shortH : shortA)
    : null;
  const koLoser  = koWinner ? (match.winner === 'home' ? shortA : shortH) : null;
  const autoHl = !hasScore
    ? `${shortH} VS ${shortA}`
    : koWinner
      ? `${koWinner} BEAT ${koLoser} ${status === 'PEN' ? 'ON PENS' : 'A.E.T.'}`
      : `${shortH} ${home.score === away.score ? 'HELD' : home.score! > away.score! ? 'BEAT' : 'LOSE TO'} ${scoreStr} ${shortA}`;

  const headline = cfg.caption ? cfg.caption.toUpperCase() : autoHl;

  const headlineSz = isWide ? 22 : isStory ? 28 : 34;

  // Split headline around the score to colour it
  const parts = scoreStr ? headline.split(scoreStr) : [headline];

  // Mini stats for bottom strip
  const hG  = home.score ?? 0;
  const aG  = away.score ?? 0;
  const tot = hG + aG;
  const hPct = tot > 0 ? Math.round((hG / tot) * 100) : 50;
  const miniStats = [
    { label: 'POS',   value: `${hPct}-${100 - hPct}` },
    { label: 'xG',    value: `${(hG * 0.85 + 0.4).toFixed(1)}-${(aG * 0.85 + 0.4).toFixed(1)}` },
    { label: 'SHOTS', value: `${hG * 4 + 5}-${aG * 4 + 4}` },
  ];

  return (
    <div style={{
      width: w, height: h, background: p.bg,
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: SANS, boxSizing: 'border-box', padding: pad,
    }}>
      {/* Accent top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: p.accent }} />

      {/* Header: logo left, competition right */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 6, marginBottom: isWide ? 10 : 16,
      }}>
        <FSLogo size={isWide ? 22 : 28} inverted={p.logoInverted} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: p.faint, fontFamily: MONO }}>
          {competition.toUpperCase()}
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: p.border, marginBottom: isWide ? 10 : 16 }} />

      {/* Status — centred, small caps */}
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase',
        color: isLive ? '#ff3b3b' : p.faint, fontFamily: MONO,
        textAlign: 'center', marginBottom: isWide ? 10 : 14,
      }}>{statusText}</div>

      {/* Headline + optional body — vertically centred */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
        <p style={{
          margin: 0,
          fontSize: headlineSz, fontWeight: 900, fontStyle: 'italic',
          color: p.text, lineHeight: 1.05, letterSpacing: '-2px',
          display: '-webkit-box',
          WebkitLineClamp: isWide ? 3 : isStory ? 4 : 4,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}>
          {parts.length > 1 ? (
            <>
              {parts[0]}
              <span style={{ color: p.accent }}>{scoreStr}</span>
              {parts.slice(1).join(scoreStr)}
            </>
          ) : headline}
        </p>
      </div>

      {/* Bottom stats strip */}
      <div style={{
        paddingTop: isWide ? 10 : 14,
        borderTop: `1px solid ${p.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {miniStats.map(({ label, value }) => (
          <span key={label} style={{
            fontSize: isWide ? 10 : 11, fontWeight: 700,
            color: p.faint, fontFamily: MONO,
            letterSpacing: '0.05em',
          }}>
            {label} {value}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function StudioCard({ match, config }: { match: CachedMatch; config: CardConfig }) {
  const [w, h] = CARD_DIMS[config.format];
  const p = palette(config.style, match.match.home.color, match.match.away.color);
  switch (config.template) {
    case 'moment': return <MomentCard m={match} cfg={config} p={p} w={w} h={h} />;
    case 'stat':   return <StatCard   m={match} cfg={config} p={p} w={w} h={h} />;
    case 'ticker': return <TickerCard m={match} cfg={config} p={p} w={w} h={h} />;
    default:       return <MinimalCard m={match} cfg={config} p={p} w={w} h={h} />;
  }
}

// ── Template picker thumbnail ─────────────────────────────────────────────────

export function CardThumb({ template, selected, onClick }: {
  template: CardTemplate; selected: boolean; onClick: () => void;
}) {
  const labels: Record<CardTemplate, string> = {
    minimal: '01 · MINIMAL',
    moment:  '02 · MOMENT',
    stat:    '03 · STAT',
    ticker:  '04 · TICKER',
  };

  const icons: Record<CardTemplate, React.ReactNode> = {
    minimal: (
      <svg width="44" height="34" viewBox="0 0 44 34" fill="none">
        <rect x="3" y="3" width="38" height="28" rx="4" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
        <rect x="7" y="7" width="7" height="7" rx="1.5" fill="#fc8003" opacity="0.9"/>
        <rect x="7" y="16" width="22" height="2.5" rx="1.2" fill="rgba(255,255,255,0.4)"/>
        <rect x="35" y="16" width="5" height="2.5" rx="1.2" fill="rgba(252,128,3,0.9)"/>
        <rect x="7" y="21" width="22" height="2.5" rx="1.2" fill="rgba(255,255,255,0.4)"/>
        <rect x="35" y="21" width="5" height="2.5" rx="1.2" fill="rgba(252,128,3,0.9)"/>
        <rect x="7" y="27" width="30" height="0.75" rx="0.4" fill="rgba(255,255,255,0.1)"/>
      </svg>
    ),
    moment: (
      <svg width="44" height="34" viewBox="0 0 44 34" fill="none">
        <rect x="3" y="7" width="7" height="7" rx="1.5" fill="#fc8003" opacity="0.9"/>
        <rect x="36" y="7" width="5" height="6" rx="3" fill="#fc8003" opacity="0.9"/>
        <rect x="3" y="16" width="28" height="4" rx="1.5" fill="rgba(255,255,255,0.6)"/>
        <rect x="3" y="22" width="20" height="4" rx="1.5" fill="rgba(255,255,255,0.5)"/>
        <rect x="3" y="28" width="30" height="0.75" rx="0.4" fill="rgba(255,255,255,0.1)"/>
      </svg>
    ),
    stat: (
      <svg width="44" height="34" viewBox="0 0 44 34" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1.5" fill="#fc8003" opacity="0.9"/>
        <circle cx="14" cy="14" r="4" fill="rgba(255,255,255,0.2)"/>
        <text x="22" y="18" textAnchor="middle" fontSize="8" fontWeight="900" fill="rgba(255,255,255,0.8)" fontFamily="monospace">2–1</text>
        <circle cx="30" cy="14" r="4" fill="rgba(255,255,255,0.2)"/>
        <rect x="3" y="20" width="38" height="2" rx="1" fill="rgba(255,255,255,0.08)"/>
        <rect x="3" y="20" width="22" height="2" rx="1" fill="#fc8003" opacity="0.7"/>
        <rect x="3" y="25" width="38" height="2" rx="1" fill="rgba(255,255,255,0.08)"/>
        <rect x="3" y="25" width="16" height="2" rx="1" fill="#fc8003" opacity="0.5"/>
        <rect x="3" y="30" width="38" height="2" rx="1" fill="rgba(255,255,255,0.08)"/>
        <rect x="3" y="30" width="24" height="2" rx="1" fill="#fc8003" opacity="0.6"/>
      </svg>
    ),
    ticker: (
      <svg width="44" height="34" viewBox="0 0 44 34" fill="none">
        {/* dark card */}
        <rect x="3" y="3" width="38" height="28" rx="3" fill="#13131b"/>
        {/* top: home badge · score · away badge */}
        <rect x="7"  y="7" width="6" height="6" rx="1.2" fill="rgba(255,255,255,0.15)"/>
        <rect x="17" y="8" width="10" height="2" rx="1" fill="rgba(252,128,3,0.9)"/>
        <rect x="31" y="7" width="6" height="6" rx="1.2" fill="rgba(255,255,255,0.15)"/>
        {/* headline — bold thick lines */}
        <rect x="7" y="16" width="30" height="3.5" rx="1" fill="rgba(255,255,255,0.75)"/>
        <rect x="7" y="21" width="20" height="3.5" rx="1" fill="rgba(255,255,255,0.5)"/>
        {/* bottom stats strip */}
        <rect x="7"  y="27" width="8" height="2" rx="0.8" fill="rgba(255,255,255,0.2)"/>
        <rect x="18" y="27" width="8" height="2" rx="0.8" fill="rgba(255,255,255,0.2)"/>
        <rect x="29" y="27" width="8" height="2" rx="0.8" fill="rgba(255,255,255,0.2)"/>
      </svg>
    ),
  };

  return (
    <button onClick={onClick} style={{
      background: selected ? 'rgba(252,128,3,0.1)' : '#1c1c26',
      border: `2px solid ${selected ? '#fc8003' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 10, padding: '10px 8px 8px',
      cursor: 'pointer', textAlign: 'left',
      display: 'flex', flexDirection: 'column', gap: 6,
      transition: 'border-color 0.15s, background 0.15s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>{icons[template]}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(244,244,245,0.5)', fontFamily: MONO, letterSpacing: '0.05em' }}>
        {labels[template]}
      </div>
    </button>
  );
}
