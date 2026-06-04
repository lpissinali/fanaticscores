/**
 * GET /api/match-cache/:matchId
 * Returns a CachedMatch-shaped object so the studio page can seed
 * the client-side match cache when navigating from an SSR match page.
 */
import { NextRequest, NextResponse } from 'next/server';
import { LEAGUE_ID_TO_CODE, CUP_CODES } from '@/lib/serverApi/config';

const AF_BASE = 'https://v3.football.api-sports.io';

function toShort(name: string) { return name.split(/\s+/)[0]; }
function toInitial(name: string) { return name.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 3).toUpperCase(); }

function mapStatus(short: string): string {
  switch (short) {
    case 'FT': case 'AWD': return 'FT';
    case 'AET': return 'AET';
    case 'PEN': return 'PEN';
    case 'HT':  return 'HT';
    case '1H': case '2H': case 'ET': case 'BT': case 'P': return 'LIVE';
    case 'PST': return 'POSTPONED';
    case 'CANC': case 'ABD': return 'CANCELLED';
    default: return 'SCHEDULED';
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  const key = process.env.AF_API_KEY ?? '';
  if (!key) return NextResponse.json(null, { status: 503 });

  try {
    const res = await fetch(`${AF_BASE}/fixtures?id=${matchId}`, {
      headers: { 'x-apisports-key': key },
      next: { revalidate: 60 },
    });
    if (!res.ok) return NextResponse.json(null, { status: 502 });

    const json = await res.json() as {
      response: Array<{
        fixture: { id: number; date: string; status: { short: string; elapsed: number | null } };
        league:  { id: number; name: string; country: string };
        teams:   { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } };
        goals:   { home: number | null; away: number | null };
      }>;
    };

    const f = json.response?.[0];
    if (!f) return NextResponse.json(null, { status: 404 });

    const compCode = LEAGUE_ID_TO_CODE[f.league.id] ?? '';
    const compType = CUP_CODES.has(compCode) ? 'CUP' : 'LEAGUE';
    const status   = mapStatus(f.fixture.status.short);

    const cachedMatch = {
      match: {
        id:      String(f.fixture.id),
        status,
        minute:  f.fixture.status.elapsed ?? undefined,
        kickoff: status === 'SCHEDULED'
          ? new Date(f.fixture.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : undefined,
        home: {
          id:      String(f.teams.home.id),
          name:    f.teams.home.name,
          short:   toShort(f.teams.home.name),
          initial: toInitial(f.teams.home.name),
          color:   '#3a3a48',
          crest:   f.teams.home.logo,
          score:   f.goals.home,
        },
        away: {
          id:      String(f.teams.away.id),
          name:    f.teams.away.name,
          short:   toShort(f.teams.away.name),
          initial: toInitial(f.teams.away.name),
          color:   '#3a3a48',
          crest:   f.teams.away.logo,
          score:   f.goals.away,
        },
      },
      competition: f.league.name,
      compCountry: f.league.country,
      compCode,
      compType,
    };

    return NextResponse.json(cachedMatch);
  } catch {
    return NextResponse.json(null, { status: 500 });
  }
}
