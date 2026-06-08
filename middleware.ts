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

/**
 * Google-impersonation guard.
 *
 * Cloud Logging shows ~12,800 requests/day labeled `userAgent: Google`
 * systematically enumerating /en/team/{id}, /en/match/{id} and
 * /en/competition/{code} — almost all 404s, at roughly 1-2 req/sec around
 * the clock. Search Console's own Crawl Stats report shows genuine Googlebot
 * activity totalling ~120 requests over two weeks, so this volume cannot be
 * real Google — it's a spoofed user-agent. Each hit still triggers
 * fetchTeamDetail/fetchMatchDetail, which calls fetchAF upstream (cache miss
 * -> live api-football fetch -> empty response -> 404) before failing,
 * burning real quota on IDs that mostly don't exist.
 *
 * Google publishes the IP ranges its crawlers use specifically so sites can
 * verify a crawler without reverse-DNS (which Edge middleware can't do —
 * there's no `dns` module here):
 * https://developers.google.com/search/docs/crawling-indexing/verifying-googlebot
 *
 * Any request whose user-agent claims to be Google but whose IP isn't in
 * that published list gets a 403 before it ever reaches page code (and
 * therefore before it can trigger an api-football call). Genuine Googlebot —
 * which Search Console confirms always crawls from listed IPs — passes
 * straight through, untouched.
 */

const GOOGLE_UA_PATTERN = /google/i;
const GOOGLE_IP_RANGES_URL = 'https://developers.google.com/static/search/apis/ipranges/googlebot.json';
const RANGES_TTL_MS = 24 * 60 * 60 * 1000; // Google updates this list infrequently — daily refresh is plenty

interface GoogleIpRangesResponse {
  prefixes: Array<{ ipv4Prefix?: string; ipv6Prefix?: string }>;
}

let cachedPrefixes: { values: string[]; fetchedAt: number } | null = null;

async function googleIpPrefixes(): Promise<string[]> {
  if (cachedPrefixes && Date.now() - cachedPrefixes.fetchedAt < RANGES_TTL_MS) {
    return cachedPrefixes.values;
  }
  try {
    const res = await fetch(GOOGLE_IP_RANGES_URL);
    if (!res.ok) return cachedPrefixes?.values ?? [];
    const data = await res.json() as GoogleIpRangesResponse;
    const values = data.prefixes
      .map(p => p.ipv4Prefix ?? p.ipv6Prefix)
      .filter((p): p is string => Boolean(p));
    cachedPrefixes = { values, fetchedAt: Date.now() };
    return values;
  } catch {
    // Network hiccup fetching Google's list -- fall back to whatever we had,
    // or an empty list (which makes the guard fail open, see below).
    return cachedPrefixes?.values ?? [];
  }
}

// ── Minimal CIDR matching ─────────────────────────────────────────────────────
// No external deps on purpose: this needs to run in the Edge runtime, where
// Node's `net`/`dns` modules aren't available.

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const v = Number(part);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt === null || baseInt === null || Number.isNaN(bits)) return false;
  if (bits <= 0) return true;
  const mask = bits >= 32 ? 0xffffffff : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function ipv6ToBigInt(ip: string): bigint | null {
  let head = ip;
  let tail = '';
  if (ip.includes('::')) {
    const idx = ip.indexOf('::');
    head = ip.slice(0, idx);
    tail = ip.slice(idx + 2);
  }
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const fillCount = 8 - headParts.length - tailParts.length;
  if (fillCount < 0) return null;
  const groups = [...headParts, ...Array(fillCount).fill('0'), ...tailParts];
  if (groups.length !== 8) return null;
  let result = 0n;
  for (const g of groups) {
    const v = parseInt(g === '' ? '0' : g, 16);
    if (Number.isNaN(v) || v < 0 || v > 0xffff) return null;
    result = (result << 16n) | BigInt(v);
  }
  return result;
}

function ipv6InCidr(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const ipInt = ipv6ToBigInt(ip);
  const baseInt = ipv6ToBigInt(base);
  if (ipInt === null || baseInt === null || Number.isNaN(bits)) return false;
  if (bits <= 0) return true;
  const shift = BigInt(128 - bits);
  return (ipInt >> shift) === (baseInt >> shift);
}

function ipMatchesAny(ip: string, prefixes: string[]): boolean {
  const isV6 = ip.includes(':');
  for (const prefix of prefixes) {
    const prefixIsV6 = prefix.includes(':');
    if (isV6 !== prefixIsV6) continue;
    if (isV6 ? ipv6InCidr(ip, prefix) : ipv4InCidr(ip, prefix)) return true;
  }
  return false;
}

function clientIp(req: NextRequest): string | null {
  // App Hosting/Cloud Run sit behind Google's front end, which sets these.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip');
}

async function claimsGoogleButIsnt(req: NextRequest): Promise<boolean> {
  const ua = req.headers.get('user-agent') ?? '';
  if (!GOOGLE_UA_PATTERN.test(ua)) return false;

  const ip = clientIp(req);
  if (!ip) return false; // can't verify -- fail open rather than risk blocking real Google

  const prefixes = await googleIpPrefixes();
  if (prefixes.length === 0) return false; // list unavailable -- fail open

  return !ipMatchesAny(ip, prefixes);
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  if (await claimsGoogleButIsnt(req)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

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
