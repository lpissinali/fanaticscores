import type { MetadataRoute } from 'next';

const BASE = 'https://www.fanaticscores.com';

// ── Competition entries ───────────────────────────────────────────────────────

const COMPETITIONS: { code: string; priority: number }[] = [
  { code: 'CL',   priority: 0.9 },
  { code: 'PL',   priority: 0.9 },
  { code: 'PD',   priority: 0.9 },
  { code: 'SA',   priority: 0.8 },
  { code: 'BL1',  priority: 0.8 },
  { code: 'FL1',  priority: 0.8 },
  { code: 'WC',   priority: 0.9 },
  { code: 'EURO', priority: 0.9 },
  { code: 'CWC',  priority: 0.8 },
  { code: 'CA',   priority: 0.8 },
  { code: 'EL',   priority: 0.8 },
  { code: 'UECL', priority: 0.7 },
  { code: 'LIBT', priority: 0.8 },
  { code: 'AFCN', priority: 0.7 },
  { code: 'UNL',  priority: 0.7 },
  { code: 'CSUD', priority: 0.7 },
  { code: 'DED',  priority: 0.7 },
  { code: 'PPL',  priority: 0.7 },
  { code: 'SPL',  priority: 0.6 },
  { code: 'JPL',  priority: 0.6 },
  { code: 'TSL',  priority: 0.7 },
  { code: 'BSA',  priority: 0.7 },
  { code: 'ARG',  priority: 0.7 },
  { code: 'MX',   priority: 0.6 },
  { code: 'MLS',  priority: 0.6 },
  { code: 'ACL',   priority: 0.7 },
  { code: 'CAFCL', priority: 0.7 },
  { code: 'CCL',   priority: 0.7 },
  { code: 'GOLD',  priority: 0.7 },
  { code: 'ASIAN', priority: 0.7 },
  { code: 'CNL',   priority: 0.6 },
  { code: 'USC',   priority: 0.6 },
  { code: 'CDB',   priority: 0.7 },
];

// ── Team fetching ─────────────────────────────────────────────────────────────

// Fetch team IDs from standings for these leagues (sequential to avoid rate
// limits; each /standings call is cached for a week, so this is ~free after
// the first warm-up). Broadened from 8 to all domestic leagues + the main
// continental/national competitions so every club/nation gets a team page in
// the sitemap — the single biggest source of new indexable URLs.
const TEAM_LEAGUE_IDS = [
  // Top-5 European leagues
  39, 140, 135, 78, 61,
  // Other European leagues
  88, 94, 179, 144, 203, 307,
  // European 2nd divisions
  40, 141, 136, 79, 62,
  // Americas
  71, 128, 262, 253, 239, 265,
  // Asia
  98, 169,
  // Continental club + national-team tournaments (populate during their seasons)
  2, 3, 13, 1,
];

function currentSeason(): number {
  const now = new Date();
  return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
}

async function fetchTeamIds(): Promise<string[]> {
  // Skip at build time / without creds for two reasons (mirrors
  // fetchRecentMatchIds below): (a) fetchAF pulls in the Firestore Admin SDK,
  // which must stay out of the `next build` worker (native gRPC bindings crash
  // it on Windows); (b) the previous raw-fetch version burned 8 *uncached*
  // /standings calls per build AND per cold Cloud Run instance, since
  // `next: { revalidate }` is per-instance only. Entries appear on the first
  // production revalidation, where the fleet-wide Firestore cache (already
  // kept warm by the competition pages) makes this ~zero extra quota.
  if (process.env.NEXT_PHASE === 'phase-production-build') return [];
  const hasCreds =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (!hasCreds) return [];

  const key = process.env.AF_API_KEY ?? '';
  if (!key) return [];

  const { fetchAF, hasBodyErrors } = await import('@/lib/serverApi/config');

  const season = currentSeason();
  const ids = new Set<string>();

  for (const leagueId of TEAM_LEAGUE_IDS) {
    try {
      // Read freshness of 1 week: standings entries are refreshed hourly by
      // competition-page traffic anyway; the sitemap only needs team IDs.
      const res = await fetchAF(`/standings?league=${leagueId}&season=${season}`, 604800);
      if (!res.ok) continue;

      const json = await res.json() as {
        errors?: unknown;
        response: Array<{
          league: { standings: Array<Array<{ team: { id: number } }>> };
        }>;
      };
      if (hasBodyErrors(json.errors)) continue;

      const groups = json.response?.[0]?.league?.standings ?? [];
      for (const group of groups) {
        for (const row of group) {
          if (row.team?.id) ids.add(String(row.team.id));
        }
      }
    } catch {
      // Skip this league silently — sitemap still works without it
    }
  }

  return Array.from(ids);
}

// ── Sitemap ───────────────────────────────────────────────────────────────────

// ── Recent match IDs ───────────────────────────────────────────────────────

// Collect match IDs from the last `days` matchday docs (the same curated
// matches the site renders). Reads come from Firestore via the Admin SDK, so
// no extra api-football quota is used.
//
// IMPORTANT: firebase-admin is loaded with a *dynamic* import inside this
// function, never at module top-level. The sitemap route is executed during
// `next build`, and pulling the Admin SDK's native gRPC bindings into the build
// worker crashes it on Windows (exit 0xC0000409). Bailing out before the import
// at build time / when no credentials exist keeps the Admin SDK out of the
// build entirely. Returns [] then — populated on the daily production
// revalidation, where ADC is available.
async function fetchRecentMatchIds(now: Date, days = 90): Promise<string[]> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return [];
  const hasCreds =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (!hasCreds) return [];

  const { getMatchdayDoc } = await import('@/lib/serverApi/matchdayDoc');

  // Read the last `days` matchday docs in parallel (Firestore reads are free
  // and fast). Accumulating ~90 days of finished matches keeps every result
  // page — unique long-tail content — in the sitemap instead of rolling it off
  // after a week, so the URL set grows steadily as the site ages.
  const ymds = Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - (i + 1));
    return d.toISOString().slice(0, 10);
  });
  const docs = await Promise.all(ymds.map(ymd => getMatchdayDoc(ymd)));

  const ids = new Set<string>();
  for (const doc of docs) {
    if (!doc) continue;
    for (const c of doc.competitions ?? []) {
      for (const m of c.matches ?? []) {
        if (m?.id) ids.add(String(m.id));
      }
    }
  }
  return Array.from(ids);
}

export const revalidate = 86400; // regenerate daily

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const teamIds = await fetchTeamIds();
  const now = new Date();
  const matchIds = await fetchRecentMatchIds(now);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE}/en/today`,        lastModified: now, changeFrequency: 'daily',  priority: 1.0 },
    { url: `${BASE}/en/competitions`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    // NOTE: /en/studio is intentionally NOT listed — it is Disallowed in
    // robots.txt, and submitting a blocked URL triggers "Submitted URL blocked
    // by robots.txt" errors in Search Console.
    { url: `${BASE}/en/terms`,        lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/en/privacy`,      lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/en/cookies`,      lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Recent date pages (/en/YYYY-MM-DD). These are now server-rendered with that
  // day's fixtures/results, so each is unique, indexable content. Start at
  // yesterday and go back 14 days — today is already covered by /en/today
  // (which carries its own canonical), so we skip it to avoid duplication.
  const recentDateEntries: MetadataRoute.Sitemap = Array.from({ length: 45 }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - (i + 1));
    return {
      url: `${BASE}/en/${d.toISOString().slice(0, 10)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    };
  });

  const competitionEntries: MetadataRoute.Sitemap = COMPETITIONS.map(({ code, priority }) => ({
    url: `${BASE}/en/competition/${code}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority,
  }));

  const teamEntries: MetadataRoute.Sitemap = teamIds.map(id => ({
    url: `${BASE}/en/team/${id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  // Recent match pages (/en/match/{id}) — server-rendered result pages that
  // make good evergreen, long-tail content (e.g. "Team A vs Team B result").
  const matchEntries: MetadataRoute.Sitemap = matchIds.map(id => ({
    url: `${BASE}/en/match/${id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  return [...staticEntries, ...recentDateEntries, ...competitionEntries, ...teamEntries, ...matchEntries];
}
