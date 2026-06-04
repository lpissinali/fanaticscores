/**
 * GET /api/search-teams?q=arsenal
 * Searches api-football for teams matching the query.
 * Runs server-side — AF_API_KEY is never exposed to the browser.
 */
import { NextRequest, NextResponse } from 'next/server';
import { LEAGUE_ID_TO_CODE } from '@/lib/serverApi/config';

const AF_BASE = 'https://v3.football.api-sports.io';

export interface TeamResult {
  id: string;
  name: string;
  crest: string;
  country: string;
  compCode: string;
  compName: string;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json([]);

  const key = process.env.AF_API_KEY ?? '';
  if (!key) return NextResponse.json([]);

  try {
    const res = await fetch(
      `${AF_BASE}/teams?search=${encodeURIComponent(q)}`,
      {
        headers: { 'x-apisports-key': key },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return NextResponse.json([]);

    const json = await res.json() as {
      response: Array<{
        team: { id: number; name: string; logo: string; country: string };
        venue: unknown;
      }>;
    };

    const results: TeamResult[] = (json.response ?? []).slice(0, 10).map(r => ({
      id:       String(r.team.id),
      name:     r.team.name,
      crest:    r.team.logo,
      country:  r.team.country ?? '',
      compCode: '',
      compName: '',
    }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
