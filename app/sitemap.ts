import type { MetadataRoute } from 'next';
import { getMatchdayDoc } from '@/lib/serverApi/matchdayDoc';

const BASE = 'https://www.fanaticscores.com';
const AF_BASE = 'https://v3.football.api-sports.io';

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
];

// ── Team fetching ─────────────────────────────────────────────────────────────

// Fetch team IDs from standings for these leagues (sequential to avoid rate limits)
const TEAM_LEAGUE_IDS = [
  39,   // Premier League
  140,  // La Liga
  135,  // Serie A
  78,   // Bundesliga
  61,   // Ligue 1
  2,    // UEFA Champions League
  13,   // Copa Libertadores
  71,   // Brasileirão
];

function currentSeason(): number {
  const now = new Date();
  return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
}

async function fetchTeamIds(): Promise<string[]> {
  const key = process.env.AF_API_KEY ?? '';
  if (!key) return [];

  const season = currentSeason();
  const ids = new Set<string>();

  for (const leagueId of TEAM_LEAGUE_IDS) {
    try {
      const res = await fetch(
        `${AF_BASE}/standings?league=${leagueId}&season=${season}`,
        {
          headers: { 'x-apisports-key': key },
          next: { revalidate: 604800 }, // cache for 1 week
        }
      );
      if (!res.ok) continue;

      const json = await res.json() as {
        response: Array<{
          league: { standings: Array<Array<{ team: { id: number } }>> };
        }>;
      };

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
// no extra api-football quota is used. Returns [] at build time / in local dev
// (no credentials) — populated on the daily production revalidation.
async function fetchRecentMatchIds(now: Date, days = 7): Promise<string[]> {
  const ids = new Set<string>();
  for (let i = 1; i <= days; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const ymd = d.toISOString().slice(0, 10);
    const doc = await getMatchdayDoc(ymd);
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
  const recentDateEntries: MetadataRoute.Sitemap = Array.from({ length: 14 }, (_, i) => {
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
