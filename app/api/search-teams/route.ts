/**
 * GET /api/search-teams?q=arsenal
 * Searches api-football for teams matching the query.
 * Runs server-side — AF_API_KEY is never exposed to the browser.
 *
 * Quota protection: every *distinct* query string is a potential upstream
 * call, and a typeahead emits one query per pause while typing. So:
 * - isRateLimited(): same per-IP/hour cap as the detail pages (typing a few
 *   searches stays far under it; bot enumeration trips it).
 * - fetchAF(): fleet-wide Firestore shared cache — identical queries from any
 *   visitor/instance within the hour cost one upstream call total. Queries are
 *   lowercased first so "Arsenal" and "arsenal" share a cache entry.
 * - min length 3 / max length 40: trims the burniest short prefixes and
 *   unbounded junk keys.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchAF, hasBodyErrors } from '@/lib/serverApi/config';
import { isRateLimited } from '@/lib/serverApi/rateLimit';
import { isDailyBudgetExhausted } from '@/lib/serverApi/dailyBudget';

export interface TeamResult {
  id: string;
  name: string;
  crest: string;
  country: string;
  compCode: string;
  compName: string;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? '';
  if (q.length < 3 || q.length > 40) return NextResponse.json([]);

  const key = process.env.AF_API_KEY ?? '';
  if (!key) return NextResponse.json([]);

  if (await isRateLimited()) return NextResponse.json([]);
  if (await isDailyBudgetExhausted()) return NextResponse.json([]);

  try {
    const res = await fetchAF(`/teams?search=${encodeURIComponent(q)}`);
    if (!res.ok) return NextResponse.json([]);

    const json = await res.json() as {
      errors?: unknown;
      response: Array<{
        team: { id: number; name: string; logo: string; country: string };
        venue: unknown;
      }>;
    };

    // api-football reports auth/quota problems inside a 200 body.
    if (hasBodyErrors(json.errors)) return NextResponse.json([]);

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
