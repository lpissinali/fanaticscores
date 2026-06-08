import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
