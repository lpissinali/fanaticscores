/**
 * GET /api/match-cache/:matchId
 * Returns a CachedMatch-shaped object so the studio page can seed
 * the client-side match cache when navigating from an SSR match page.
 *
 * Quota protection (this endpoint maps 1 novel matchId → 1 upstream call, so
 * it is exactly as enumerable as the /en/match/{id} pages were):
 * - isRateLimited(): same per-IP/hour Firestore counter as the detail pages.
 *   Over-limit returns 404 before any upstream call.
 * - fetchAF(): the fleet-wide Firestore shared cache, NOT a raw fetch — repeat
 *   IDs cost zero upstream calls across all instances. The cache key
 *   (/fixtures?id=N) is shared with fetchMatchDetail, so a match page visit
 *   pre-warms this endpoint and vice versa.
 * - Two-phase freshness, mirroring matchDetails.ts: read at the default
 *   hour-long TTL first; only if that copy says the match is live re-read at
 *   the short live TTL for a fresh score.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  fetchAF,
  AF_LIVE_TTL_SECONDS,
  hasBodyErrors,
  LEAGUE_ID_TO_CODE,
  CUP_CODES,
} from '@/lib/serverApi/config';
import { isRateLimited } from '@/lib/serverApi/rateLimit';

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

  // Junk IDs never reach upstream; over-limit IPs get the same 404 the
  // detail pages give them (no signal that a limiter exists).
  if (!/^\d{1,10}$/.test(matchId)) return NextResponse.json(null, { status: 404 });
  if (await isRateLimited()) return NextResponse.json(null, { status: 404 });

  try {
    const path = `/fixtures?id=${matchId}`;
    let res = await fetchAF(path);
    if (!res.ok) return NextResponse.json(null, { status: 502 });

    let json = await res.json() as {
      response: Array<{
        fixture: { id: number; date: string; status: { short: string; elapsed: number | null } };
        league:  { id: number; name: string; country: string };
        teams:   { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } };
        goals:   { home: number | null; away: number | null };
      }>;
    };

    // api-football reports auth/quota problems inside a 200 body.
    if (hasBodyErrors((json as { errors?: unknown }).errors)) {
      return NextResponse.json(null, { status: 502 });
    }

    let f = json.response?.[0];
    if (!f) return NextResponse.json(null, { status: 404 });

    // The hour-old cached copy says the match is in progress → re-read at the
    // live TTL (120 s) so the studio doesn't seed a stale score. Costs at most
    // one upstream call per 2 minutes fleet-wide, and only while live.
    const LIVE_SHORTS = new Set(['1H', '2H', 'ET', 'BT', 'P', 'HT']);
    if (LIVE_SHORTS.has(f.fixture.status.short)) {
      res = await fetchAF(path, AF_LIVE_TTL_SECONDS);
      if (res.ok) {
        const fresh = await res.json() as typeof json;
        if (!hasBodyErrors((fresh as { errors?: unknown }).errors) && fresh.response?.[0]) {
          json = fresh;
          f = fresh.response[0];
        }
      }
    }

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
