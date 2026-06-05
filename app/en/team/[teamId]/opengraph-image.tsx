import { ImageResponse } from 'next/og';
import { fetchTeamDetail } from '@/lib/serverApi/teamDetails';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props { params: Promise<{ teamId: string }> }

export default async function TeamOGImage({ params }: Props) {
  const { teamId } = await params;
  const data = await fetchTeamDetail(teamId);

  const bg      = '#0f0f13';
  const surface = '#1a1a22';
  const orange  = '#fc8003';
  const white   = '#ffffff';
  const dim     = 'rgba(255,255,255,0.5)';

  if (!data) {
    return new ImageResponse(
      <div style={{ width: 1200, height: 630, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: dim, fontSize: 32 }}>Team not found</span>
      </div>,
      { ...size }
    );
  }

  const { info } = data;
  const chips = [
    info.founded ? `Est. ${info.founded}` : null,
    info.venue   ? info.venue : null,
  ].filter(Boolean);

  const competitions = info.runningCompetitions?.slice(0, 3) ?? [];

  return new ImageResponse(
    <div style={{ width: 1200, height: 630, background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '0 80px' }}>

      {/* Crest */}
      {info.crest
        ? <img src={info.crest} width={120} height={120} style={{ objectFit: 'contain', marginBottom: 32 }} />
        : <div style={{ width: 120, height: 120, background: surface, borderRadius: 16, marginBottom: 32 }} />
      }

      {/* Team name */}
      <span style={{ color: white, fontSize: 64, fontWeight: 900, textAlign: 'center', lineHeight: 1.1, marginBottom: 20 }}>
        {info.name}
      </span>

      {/* Meta chips */}
      {chips.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
          {chips.map((chip, i) => (
            <span key={i} style={{ background: surface, color: dim, fontSize: 18, padding: '6px 16px', borderRadius: 8 }}>
              {chip}
            </span>
          ))}
        </div>
      )}

      {/* Competitions */}
      {competitions.length > 0 && (
        <div style={{ display: 'flex', gap: 12 }}>
          {competitions.map((c, i) => (
            <span key={i} style={{ color: orange, fontSize: 16, fontWeight: 600 }}>
              {c.name}{i < competitions.length - 1 ? '  ·' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Branding */}
      <div style={{ position: 'absolute', bottom: 36, right: 60, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: orange, fontSize: 18, fontWeight: 900, letterSpacing: '0.05em' }}>FANATIC</span>
        <span style={{ color: dim, fontSize: 18, fontWeight: 400 }}>SCORES</span>
      </div>

    </div>,
    { ...size }
  );
}
