import { ImageResponse } from 'next/og';
import { fetchCompetitionOG } from '@/lib/serverApi/ogData';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props { params: Promise<{ compCode: string }> }

export default async function CompetitionOGImage({ params }: Props) {
  const { compCode } = await params;
  const data = await fetchCompetitionOG(compCode);

  const bg      = '#0f0f13';
  const surface = '#1a1a22';
  const orange  = '#fc8003';
  const white   = '#ffffff';
  const dim     = 'rgba(255,255,255,0.5)';

  if (!data) {
    return new ImageResponse(
      <div style={{ width: 1200, height: 630, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: dim, fontSize: 32 }}>Competition not found</span>
      </div>,
      { ...size }
    );
  }

  const season = data.season
    ? `${data.season.start.slice(0, 4)} / ${data.season.end.slice(0, 4)}`
    : null;

  const topTeams = data.topTeams ?? [];

  return new ImageResponse(
    <div style={{ width: 1200, height: 630, background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '0 80px' }}>

      {/* Emblem */}
      {data.emblem
        ? <img src={data.emblem} width={110} height={110} style={{ objectFit: 'contain', marginBottom: 32 }} />
        : <div style={{ width: 110, height: 110, background: surface, borderRadius: 16, marginBottom: 32 }} />
      }

      {/* Competition name */}
      <span style={{ color: white, fontSize: 60, fontWeight: 900, textAlign: 'center', lineHeight: 1.1, marginBottom: 16 }}>
        {data.name}
      </span>

      {/* Area + season */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 36 }}>
        {data.area && (
          <span style={{ background: surface, color: dim, fontSize: 18, padding: '6px 16px', borderRadius: 8 }}>
            {data.area}
          </span>
        )}
        {season && (
          <span style={{ background: surface, color: orange, fontSize: 18, fontWeight: 600, padding: '6px 16px', borderRadius: 8 }}>
            {season}
          </span>
        )}
      </div>

      {/* Top 3 teams */}
      {topTeams.length > 0 && (
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {topTeams.map((row, i) => (
            <div key={row.teamName} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: orange, fontSize: 16, fontWeight: 700, minWidth: 20 }}>{i + 1}</span>
              <img src={row.teamCrest} width={28} height={28} style={{ objectFit: 'contain' }} />
              <span style={{ color: i === 0 ? white : dim, fontSize: 18, fontWeight: i === 0 ? 700 : 400 }}>
                {row.teamShort || row.teamName}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>{row.points}pts</span>
            </div>
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
