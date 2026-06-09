import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CANONICAL_HOST = 'www.fanaticscores.com';

// Hosts that are served as-is. The bare apex (fanaticscores.com) is
// intentionally NOT here: it is 308-redirected to the canonical www host
// below so there is a single indexable host (matches the canonical tag,
// og:url and sitemap, all of which point to www).
const ALLOWED_HOSTNAMES = new Set([
  'www.fanaticscores.com',
  'localhost',
  '127.0.0.1',
]);

export function middleware(req: NextRequest) {
  // Behind App Hosting's CDN/proxy the originally requested domain arrives in
  // `x-forwarded-host`; `host` may be normalised to an internal/canonical
  // value. Prefer the forwarded host so apex requests are detected correctly.
  const rawHost =
    req.headers.get('x-forwarded-host') ??
    req.headers.get('host') ??
    '';
  const host = rawHost.split(',')[0].trim();
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
