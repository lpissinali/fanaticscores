/**
 * GET /robots.txt — host-aware.
 *
 * Why dynamic: the same Cloud Run service answers on several hostnames —
 * www.fanaticscores.com (canonical), the bare run.app URL, and App Hosting's
 * per-build *tagged* revision URLs (t-XXXXXXXXX---fanaticscores-….run.app).
 * Googlebot discovered a tagged URL and crawled the whole site through it
 * (~3.8k requests in one morning), burning the api-football quota on
 * duplicate /en/team and /en/match renders. A static public/robots.txt served
 * "Allow: /" identically on every host, inviting exactly that.
 *
 * Canonical host  → normal rules (AI crawlers blocked, /api/ and
 *                   personalised pages excluded, sitemap advertised).
 * Any other host  → "Disallow: /": crawlers drop the host entirely.
 *
 * NOTE: middleware.ts excludes /robots.txt from its matcher so every host
 * serves its own robots file instead of redirecting to the canonical one
 * (a redirected robots.txt would make Google apply the canonical — i.e.
 * permissive — rules to the non-canonical host).
 */
import { headers } from 'next/headers';

const CANONICAL_HOST = 'www.fanaticscores.com';

// Grouping note: a robots.txt "group" is a User-agent line plus the records
// that follow it — a Disallow after a blank line with no User-agent of its
// own is ignored by parsers. The previous static file had that bug (its
// /api/ and /en/studio blocks were never applied); everything for "*" must
// live in one contiguous group.
const CANONICAL_ROBOTS = `# AI training crawlers — no SEO value, heavy load on api-football quota
User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: *
Disallow: /api/
Disallow: /en/following
Disallow: /en/studio
Disallow: /en/studio/
Crawl-delay: 5

Sitemap: https://www.fanaticscores.com/sitemap.xml
`;

const NON_CANONICAL_ROBOTS = `User-agent: *
Disallow: /
`;

export async function GET() {
  const h = await headers();
  const raw = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const hostname = raw.split(',')[0].trim().split(':')[0];
  const isCanonical =
    hostname === CANONICAL_HOST ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local');

  return new Response(isCanonical ? CANONICAL_ROBOTS : NON_CANONICAL_ROBOTS, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      // Belt & braces on non-canonical hosts: even if a page slips into the
      // index from before, X-Robots-Tag on robots itself is harmless, and the
      // Disallow stops further crawling (and thus the quota burn) outright.
    },
  });
}
