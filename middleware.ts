import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Host-header guard.
 *
 * Firebase App Hosting exposes the backend at BOTH the custom domain
 * (fanaticscores.com / www.fanaticscores.com) AND a raw, publicly-reachable
 * Cloud Run URL like https://t-XXXXXXXX---fanaticscores-xxxxx.a.run.app.
 *
 * Crawlers (Googlebot, GPTBot, etc.) discover and crawl BOTH origins,
 * effectively doubling our request volume — and every page render fires
 * several api-football calls before it can even respond, so duplicate
 * crawling burns through the daily API quota twice as fast.
 *
 * Any request that doesn't arrive on a canonical hostname gets redirected
 * (308, permanent) to the canonical domain. This consolidates crawl budget
 * and search-engine signals onto a single origin, and stops the raw backend
 * URL from being indexed as a separate site.
 */

const CANONICAL_HOST = 'www.fanaticscores.com';

const ALLOWED_HOSTNAMES = new Set([
  'fanaticscores.com',
  'www.fanaticscores.com',
  'localhost',
  '127.0.0.1',
]);

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const hostname = host.split(':')[0];

  if (ALLOWED_HOSTNAMES.has(hostname) || hostname.endsWith('.local')) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.protocol = 'https';
  url.host = CANONICAL_HOST;
  url.port = '';
  return NextResponse.redirect(url, 308);
}

export const config = {
  // Skip the check for static assets and API/internal routes (server-to-server
  // calls and proxies shouldn't be redirected based on Host).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
