import { ImageResponse } from 'next/og';
import { fetchMatchOG } from '@/lib/serverApi/ogData';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props { params: Promise<{ matchId: string }> }

export default async function MatchOGImage({ params }: Props) {
  const { matchId } = await params;
  const d = await fetchMatchOG(matchId);

  const bg      = '#0f0f13';
  const surface = '#1a1a22';
  const orange  = '#fc8003';
  const white   = '#ffffff';
  const dim     = 'rgba(255,255,255,0.5)';

  if (!d) {
    return new ImageResponse(
      <div style={{ width: 1200, height: 630, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: dim, fontSize: 32 }}>Match not found</span>
      </div>,
      { ...size }
    );
  }

  const score = d.home.score !== null && d.away.score !== null
    ? `${d.home.score} – ${d.away.score}`
    : 'vs';

  const statusLabel =
    d.status === 'LIVE' ? `LIVE${d.minute ? ` · ${d.minute}'` : ''}` :
    d.status === 'HT'   ? 'HALF TIME' :
    d.status === 'FT'   ? 'FULL TIME' : '';

  return new ImageResponse(
    <div style={{ width: 1200, height: 630, background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '0 80px' }}>

      {/* Competition + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 48 }}>
        <span style={{ color: orange, fontSize: 20, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {d.competition}
        </span>
        {statusLabel && (
          <span style={{ background: d.status === 'LIVE' ? orange : surface, color: d.status === 'LIVE' ? '#000' : dim, fontSize: 14, fontWeight: 700, padding: '4px 10px', borderRadius: 6, letterSpacing: '0.08em' }}>
            {statusLabel}
          </span>
        )}
      </div>

      {/* Teams + score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 48, width: '100%' }}>

        {/* Home */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, flex: 1 }}>
          {d.home.crest
            ? <img src={d.home.crest} width={100} height={100} style={{ objectFit: 'contain' }} />
            : <div style={{ width: 100, height: 100, background: surface, borderRadius: 12 }} />
          }
          <span style={{ color: white, fontSize: 28, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>{d.home.name}</span>
        </div>

        {/* Score */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 180 }}>
          <span style={{ color: white, fontSize: 72, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>{score}</span>
          {d.venue && <span style={{ color: dim, fontSize: 16 }}>{d.venue}</span>}
        </div>

        {/* Away */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, flex: 1 }}>
          {d.away.crest
            ? <img src={d.away.crest} width={100} height={100} style={{ objectFit: 'contain' }} />
            : <div style={{ width: 100, height: 100, background: surface, borderRadius: 12 }} />
          }
          <span style={{ color: white, fontSize: 28, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>{d.away.name}</span>
        </div>

      </div>

      {/* Branding */}
      <div style={{ position: 'absolute', bottom: 36, right: 60, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: orange, fontSize: 18, fontWeight: 900, letterSpacing: '0.05em' }}>FANATIC</span>
        <span style={{ color: dim, fontSize: 18, fontWeight: 400 }}>SCORES</span>
      </div>

    </div>,
    { ...size }
  );
}
