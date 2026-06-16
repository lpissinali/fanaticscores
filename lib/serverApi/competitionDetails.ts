/**
 * Server-side competition details fetching.
 * Calls api-football directly — no browser caches, no proxy.
 * Used by the /en/competition/[compCode] Server Component.
 */

import { fetchAF, hasBodyErrors, currentSeason, COMP_CODE_TO_LEAGUE_ID, CUP_CODES, AF_LIVE_TTL_SECONDS, AF_HOT_TTL_SECONDS, AF_SCORERS_TTL_SECONDS, AF_STABLE_TTL_SECONDS } from './config';
import { isRateLimited } from './rateLimit';
import { isDailyBudgetExhausted } from './dailyBudget';

// ── Public types (mirrors src/lib/api/competitionDetails.ts) ─────────────────

export interface CompInfo {
  id: number; code: string; name: string; type: string; emblem: string | null;
  area: { name: string; code: string; flag: string | null };
  season: {
    startDate: string; endDate: string;
    currentMatchday: number | null;
    winner: { name: string; crest: string | null } | null;
  } | null;
}

export interface CompStandingRow {
  position: number; teamId: string; teamName: string; teamShort: string; teamCrest: string;
  played: number; won: number; draw: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number;
  points: number; form: string | null;
  /** api-football's per-ROW "last recomputed" stamp — rows update at
   *  different times, so the overlay guard must check each row's own stamp. */
  updatedAt?: string | null;
}

export interface CompStandingGroup {
  name: string;
  rows: CompStandingRow[];
  /** True for the cross-group "Best 3rd Place" ranking — shown in the main
   *  standings section but excluded from the Group Leaders rail. */
  isAggregate?: boolean;
}

export interface CompScorer {
  playerName: string; nationality: string; teamName: string; teamShort: string;
  teamCrest: string; goals: number; assists: number | null;
  penalties: number | null; playedMatches: number;
}

export interface CompFixture {
  id: number; utcDate: string; status: string; round: string | null;
  homeTeam: { id: number; name: string; crest: string; score: number | null };
  awayTeam: { id: number; name: string; crest: string; score: number | null };
}

export interface CompetitionDetailData {
  info: CompInfo;
  standingGroups: CompStandingGroup[];
  scorers: CompScorer[];
  upcomingFixtures: CompFixture[];
  recentResults: CompFixture[];
}

// ── Raw API types ─────────────────────────────────────────────────────────────

interface AFLeagueSeason { year: number; start: string; end: string; current: boolean; }
interface AFLeagueEntry {
  league: { id: number; name: string; type: string; logo: string };
  country: { name: string; code: string | null; flag: string | null };
  seasons: AFLeagueSeason[];
}
interface AFStandingsEntry {
  rank: number; group: string | null;
  team: { id: number; name: string; logo: string };
  points: number; goalsDiff: number; form: string | null;
  update?: string; // when api-football last recomputed this table
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
}
interface AFScorer {
  player: { id: number; name: string; nationality: string };
  statistics: Array<{
    team: { id: number; name: string; logo: string };
    goals: { total: number | null; assists: number | null };
    penalty: { scored: number | null };
    games: { appearences: number | null };
  }>;
}
interface AFFixtureRaw {
  fixture: { id: number; date: string; status: { short: string } };
  league: { round: string | null };
  teams: { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } };
  goals: { home: number | null; away: number | null };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseMatchday(round: string | null | undefined): number | null {
  if (!round) return null;
  const m = round.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

function toShort(name: string) {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
}

// ── Adaptive freshness (PitaCopa-style) ──────────────────────────────────────

const LIVE_SHORTS = new Set(['1H', '2H', 'ET', 'BT', 'P', 'HT']);
const RECENT_FINISH_MS = 2 * 3_600_000; // events are fetched directly; 2h covers late FT status flips
const IMMINENT_MS = 30 * 60_000;        // pre-kickoff: catch lineups/state flips

/**
 * A competition is "hot" while one of its fixtures is live, kicked off within
 * the last 4h (in play or just finished — standings still updating), or kicks
 * off within 30 minutes. Hot competitions re-read their data at short TTLs
 * instead of the idle hour-long window.
 */
function isCompHot(fixtures: { upcoming: CompFixture[]; recent: CompFixture[] }): boolean {
  const now = Date.now();
  for (const f of [...fixtures.upcoming, ...fixtures.recent]) {
    if (LIVE_SHORTS.has(f.status)) return true;
    const t = Date.parse(f.utcDate);
    if (!Number.isFinite(t)) continue;
    if (t <= now && now - t < RECENT_FINISH_MS) return true;
    if (t > now && t - now < IMMINENT_MS) return true;
  }
  return false;
}

function mapFixture(f: AFFixtureRaw): CompFixture {
  return {
    id: f.fixture.id, utcDate: f.fixture.date,
    status: f.fixture.status.short, round: f.league.round ?? null,
    homeTeam: { id: f.teams.home.id, name: f.teams.home.name, crest: f.teams.home.logo, score: f.goals.home },
    awayTeam: { id: f.teams.away.id, name: f.teams.away.name, crest: f.teams.away.logo, score: f.goals.away },
  };
}

// ── Individual fetchers ───────────────────────────────────────────────────────

async function fetchCompInfo(code: string, leagueId: number): Promise<CompInfo | null> {
  try {
    const res  = await fetchAF(`/leagues?id=${leagueId}`);
    if (!res.ok) return null;
    const json = await res.json() as { response: AFLeagueEntry[]; errors: unknown };
    if (hasBodyErrors(json.errors)) return null;
    const entry  = json.response?.[0];
    if (!entry) return null;
    const season = entry.seasons.find(s => s.current) ?? entry.seasons.at(-1) ?? null;
    return {
      id: entry.league.id, code, name: entry.league.name,
      type: entry.league.type === 'Cup' ? 'CUP' : 'LEAGUE',
      emblem: entry.league.logo ?? null,
      area: { name: entry.country.name, code: entry.country.code ?? '', flag: entry.country.flag ?? null },
      season: season ? { startDate: season.start, endDate: season.end, currentMatchday: null, winner: null } : null,
    };
  } catch { return null; }
}

interface StandingsFetch {
  groups: CompStandingGroup[];
  currentMatchday: number | null;
  winner: { name: string; crest: string | null } | null;
  /** api-football's own "last recomputed" stamp for this table (see overlay). */
  updatedAt: string | null;
}

async function fetchStandingsForSeason(leagueId: number, season: number, ttlSeconds?: number): Promise<StandingsFetch | 'plan_error' | null> {
  try {
    const res  = await fetchAF(`/standings?league=${leagueId}&season=${season}`, ttlSeconds);
    if (!res.ok) return null;
    const data = await res.json() as {
      response: Array<{ league: { round: string | null; standings: AFStandingsEntry[][] } }>;
      errors: unknown;
    };
    if (hasBodyErrors(data.errors)) {
      const msg = JSON.stringify(data.errors);
      if (msg.includes('plan') || msg.includes('season') || msg.includes('subscription')) return 'plan_error';
      return null;
    }
    const league = data.response?.[0]?.league;
    if (!league) return null;
    const allTables = league.standings ?? [];
    if (allTables.length === 0 || allTables[0].length === 0) return null;

    let groups: CompStandingGroup[] = allTables.map(table => ({
      name: table[0]?.group ?? '',
      rows: table.map((r): CompStandingRow => ({
        position: r.rank, teamId: String(r.team.id), teamName: r.team.name,
        teamShort: toShort(r.team.name), teamCrest: r.team.logo,
        played: r.all.played, won: r.all.win, draw: r.all.draw, lost: r.all.lose,
        goalsFor: r.all.goals.for, goalsAgainst: r.all.goals.against,
        goalDifference: r.goalsDiff, points: r.points, form: r.form ?? null,
        updatedAt: r.update ?? null,
      })),
    }));

    // Multi-group comps (WC, EURO…): api-football prefixes names with
    // "Group Stage - " AND appends an extra aggregate table named just
    // "Group Stage" (the best-third-placed ranking, 12 rows for the WC).
    // Strip the prefix and FLAG the aggregate — it stays visible in the
    // standings section but is rebuilt from our recomputed groups (see
    // buildThirdPlaceTable) and excluded from the Group Leaders rail.
    if (groups.length > 1) {
      groups = groups.map(g => {
        const name = g.name.replace(/^Group Stage\s*[-–—:]\s*/i, '').trim();
        return name === '' || /^group stage$/i.test(name)
          ? { ...g, name: 'Best 3rd Place', isAggregate: true }
          : { ...g, name };
      });
    }

    const champion = allTables[0].find(r => r.rank === 1) ?? null;
    return {
      groups,
      currentMatchday: parseMatchday(league.round),
      winner: champion ? { name: champion.team.name, crest: champion.team.logo } : null,
      updatedAt: allTables[0]?.[0]?.update ?? null,
    };
  } catch { return null; }
}

/**
 * In-memory "this league has no usable standings" marker. A competition with no
 * standings table (knockout-only cups like AFCN, or seasons the plan doesn't
 * cover) otherwise re-runs the whole season loop — several uncached upstream
 * /standings calls — on EVERY render, because error/empty responses are never
 * written to the shared cache. We remember the empty result per league for an
 * hour so repeat crawls skip the loop entirely; cleared the moment a real table
 * appears. Per-instance and fail-safe: a cold instance simply does the loop once.
 */
const STANDINGS_EMPTY_TTL_MS = 60 * 60_000;
const emptyStandingsUntil = new Map<number, number>();

async function fetchStandings(code: string, leagueId: number, ttlSeconds?: number): Promise<StandingsFetch> {
  const empty: StandingsFetch = { groups: [], currentMatchday: null, winner: null, updatedAt: null };

  const negUntil = emptyStandingsUntil.get(leagueId);
  if (negUntil && Date.now() < negUntil) return empty;

  const calendarYear = new Date().getFullYear();
  const baseSeason   = currentSeason();
  // Current + just-ended seasons only. A live-scores site shows the active or
  // most-recently-finished table; trawling 5+ historical seasons just burned
  // quota on competitions that have no current table at all.
  const seasons = [...new Set([calendarYear, baseSeason, baseSeason - 1])];

  for (const season of seasons) {
    const result = await fetchStandingsForSeason(leagueId, season, ttlSeconds);
    if (result === 'plan_error') continue;
    if (result === null) continue;
    emptyStandingsUntil.delete(leagueId);
    return result;
  }
  emptyStandingsUntil.set(leagueId, Date.now() + STANDINGS_EMPTY_TTL_MS);
  return empty;
}

async function fetchScorers(leagueId: number, season: number, ttlSeconds?: number): Promise<CompScorer[]> {
  try {
    const res  = await fetchAF(`/players/topscorers?league=${leagueId}&season=${season}`, ttlSeconds);
    if (!res.ok) return [];
    const json = await res.json() as { response: AFScorer[]; errors: unknown };
    if (hasBodyErrors(json.errors)) return [];
    return (json.response ?? []).map(s => {
      const stats    = s.statistics[0];
      const teamName = stats?.team.name ?? '';
      return {
        playerName: s.player.name, nationality: s.player.nationality,
        teamName, teamShort: toShort(teamName), teamCrest: stats?.team.logo ?? '',
        goals: stats?.goals.total ?? 0, assists: stats?.goals.assists ?? null,
        penalties: stats?.penalty.scored ?? null, playedMatches: stats?.games.appearences ?? 0,
      };
    });
  } catch { return []; }
}

async function fetchFixtures(leagueId: number, season: number, isCup = false, ttlSeconds?: number): Promise<{ upcoming: CompFixture[]; recent: CompFixture[] }> {
  const limit = 5;
  try {
    const [upRes, reRes] = await Promise.all([
      fetchAF(`/fixtures?league=${leagueId}&season=${season}&next=${limit}`, ttlSeconds),
      fetchAF(`/fixtures?league=${leagueId}&season=${season}&last=${limit}`, ttlSeconds),
    ]);
    const upJson = upRes.ok ? await upRes.json() as { response: AFFixtureRaw[] } : { response: [] };
    const reJson = reRes.ok ? await reRes.json() as { response: AFFixtureRaw[] } : { response: [] };
    return {
      upcoming: (upJson.response ?? []).map(mapFixture),
      recent:   (reJson.response ?? []).reverse().map(mapFixture),
    };
  } catch { return { upcoming: [], recent: [] }; }
}

// ── Group-table recomputation ─────────────────────────────────────────────────
//
// Why recompute instead of trusting (or patching) api-football's tables:
// their WC standings lag hours behind full time, AND their per-row `update`
// stamps are unreliable — observed: a row updated with a 02:00 UTC result
// while still stamped 00:00 UTC. That makes any stamp-based "apply missing
// results" overlay either double-count or do nothing. So for multi-group
// competitions we use AF standings only for group MEMBERSHIP, and rebuild
// every row's stats from the season's fixture list — which is fresh (live
// TTL while matches run) and can't double-count by construction.

const FINISHED_SHORTS = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);

interface SeasonResult {
  fixtureId: number;
  round: string; utcDate: string; status: string;
  homeId: string; awayId: string;
  homeGoals: number | null; awayGoals: number | null;
  // Display fields — used to build CompFixture for upcoming/recent rails
  // without a separate next/last endpoint call for multi-group competitions.
  homeName: string; homeCrest: string;
  awayName: string; awayCrest: string;
}

interface AFEventRaw {
  team: { id: number; name: string; logo: string };
  player: { id: number; name: string };
  assist: { id: number | null; name: string | null };
  type: string;   // "Goal" | "Card" | "subst" | ...
  detail: string; // "Normal Goal" | "Own Goal" | "Penalty" | ...
}

/**
 * Derives upcoming and recent fixture rails from the already-fetched season
 * list, avoiding a separate /fixtures?next=N and /fixtures?last=N call for
 * multi-group competitions (WC, EURO…) that already fetch the full season.
 */
function fixturesFromSeasonResults(
  results: SeasonResult[],
  isCup: boolean,
): { upcoming: CompFixture[]; recent: CompFixture[] } {
  const limit = 5;
  const now = Date.now();

  const toFixture = (r: SeasonResult): CompFixture => ({
    id: r.fixtureId, utcDate: r.utcDate, status: r.status, round: r.round || null,
    homeTeam: { id: parseInt(r.homeId), name: r.homeName, crest: r.homeCrest, score: r.homeGoals },
    awayTeam: { id: parseInt(r.awayId), name: r.awayName, crest: r.awayCrest, score: r.awayGoals },
  });

  // Upcoming: not-yet-finished, sorted soonest-first
  const upcoming = results
    .filter(r => !FINISHED_SHORTS.has(r.status))
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate))
    .slice(0, limit)
    .map(toFixture);

  // Recent: finished, sorted most-recent-first (mirrors the ?last=N endpoint)
  const recent = results
    .filter(r => FINISHED_SHORTS.has(r.status))
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate))
    .slice(0, limit)
    .map(toFixture);

  // isCompHot needs to inspect live fixtures too; include those in upcoming
  // (they won't be in FINISHED_SHORTS) so the live-status check fires correctly.
  void now; // suppress unused warning

  return { upcoming, recent };
}

/** One call for the whole season's fixtures (104 for the WC) — shared-cached. */
async function fetchSeasonResults(leagueId: number, season: number, ttlSeconds?: number): Promise<SeasonResult[]> {
  try {
    const res = await fetchAF(`/fixtures?league=${leagueId}&season=${season}`, ttlSeconds);
    if (!res.ok) return [];
    const json = await res.json() as { response: AFFixtureRaw[]; errors: unknown };
    if (hasBodyErrors(json.errors)) return [];
    return (json.response ?? []).map(f => ({
      fixtureId: f.fixture.id,
      round: f.league.round ?? '', utcDate: f.fixture.date, status: f.fixture.status.short,
      homeId: String(f.teams.home.id), awayId: String(f.teams.away.id),
      homeGoals: f.goals.home, awayGoals: f.goals.away,
      homeName: f.teams.home.name, homeCrest: f.teams.home.logo,
      awayName: f.teams.away.name, awayCrest: f.teams.away.logo,
    }));
  } catch { return []; }
}

const rankRows = (rows: CompStandingRow[]): void => {
  rows.sort((x, y) =>
    y.points - x.points || y.goalDifference - x.goalDifference ||
    y.goalsFor - x.goalsFor || x.teamName.localeCompare(y.teamName));
  rows.forEach((r, i) => { r.position = i + 1; });
};

/** Rebuild every non-aggregate group's stats from finished group-stage results. */
function recomputeGroupTables(groups: CompStandingGroup[], results: SeasonResult[]): void {
  const rowByTeam = new Map<string, CompStandingRow>();
  for (const g of groups) {
    if (g.isAggregate) continue;
    for (const r of g.rows) {
      r.played = 0; r.won = 0; r.draw = 0; r.lost = 0;
      r.goalsFor = 0; r.goalsAgainst = 0; r.goalDifference = 0; r.points = 0;
      rowByTeam.set(r.teamId, r);
    }
  }

  const formByTeam = new Map<string, string[]>();
  const finished = results
    .filter(m => /group/i.test(m.round) && FINISHED_SHORTS.has(m.status) && m.homeGoals !== null && m.awayGoals !== null)
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));

  for (const m of finished) {
    const home = rowByTeam.get(m.homeId);
    const away = rowByTeam.get(m.awayId);
    if (!home || !away) continue;
    const h = m.homeGoals as number;
    const a = m.awayGoals as number;

    home.played += 1; away.played += 1;
    home.goalsFor += h; home.goalsAgainst += a;
    away.goalsFor += a; away.goalsAgainst += h;
    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;

    let homeLetter = 'D', awayLetter = 'D';
    if (h > a)      { home.won += 1;  away.lost += 1; home.points += 3; homeLetter = 'W'; awayLetter = 'L'; }
    else if (h < a) { away.won += 1;  home.lost += 1; away.points += 3; homeLetter = 'L'; awayLetter = 'W'; }
    else            { home.draw += 1; away.draw += 1; home.points += 1; away.points += 1; }

    const fh = formByTeam.get(m.homeId) ?? []; fh.push(homeLetter); formByTeam.set(m.homeId, fh);
    const fa = formByTeam.get(m.awayId) ?? []; fa.push(awayLetter); formByTeam.set(m.awayId, fa);
  }

  for (const [teamId, row] of rowByTeam) {
    const letters = formByTeam.get(teamId);
    row.form = letters && letters.length ? letters.slice(-5).join('') : null;
  }

  for (const g of groups) {
    if (!g.isAggregate) rankRows(g.rows);
  }
}

/** Cross-group "Best 3rd Place" ranking, built from the recomputed groups. */
function buildThirdPlaceTable(groups: CompStandingGroup[]): CompStandingGroup | null {
  const real = groups.filter(g => !g.isAggregate && g.rows.length >= 3);
  if (real.length < 2) return null;
  const thirds = real.map(g => ({ ...g.rows[2] }));
  rankRows(thirds);
  return { name: 'Best 3rd Place', rows: thirds, isAggregate: true };
}

// ── Events-based scorer computation ──────────────────────────────────────────
//
// AF's /players/topscorers endpoint lags match events by 1–3 hours after FT —
// the same problem as their standings tables, which we already fix by
// recomputing from season results. For multi-group competitions (WC, EURO…)
// we do the same for scorers: fetch each finished match's events at a stable
// TTL (events never change once a match ends), aggregate goals + assists per
// player, and sort. This gives accurate, real-time scorer stats that update
// the moment AF writes the fixture events (usually within minutes of FT).

async function fetchMatchEvents(fixtureId: number, ttlSeconds: number): Promise<AFEventRaw[]> {
  try {
    const res = await fetchAF(`/fixtures/events?fixture=${fixtureId}`, ttlSeconds);
    if (!res.ok) return [];
    const json = await res.json() as { response: AFEventRaw[]; errors: unknown };
    if (hasBodyErrors(json.errors)) return [];
    return json.response ?? [];
  } catch { return []; }
}

interface ScorerAccum {
  playerName: string; teamName: string; teamCrest: string;
  goals: number; assists: number; penalties: number;
}

function buildScorersFromEvents(
  results: SeasonResult[],
  eventsByFixture: Map<number, AFEventRaw[]>,
): CompScorer[] {
  // Only count goals from active (live or finished) matches
  const ACTIVE = new Set([...FINISHED_SHORTS, ...LIVE_SHORTS]);

  const map = new Map<number, ScorerAccum>(); // keyed by AF player ID

  for (const result of results) {
    if (!ACTIVE.has(result.status)) continue;
    const events = eventsByFixture.get(result.fixtureId) ?? [];

    for (const e of events) {
      if (e.type !== 'Goal' || e.detail === 'Own Goal') continue;

      // Goal scorer
      const pid = e.player.id;
      if (!map.has(pid)) {
        map.set(pid, {
          playerName: e.player.name, teamName: e.team.name, teamCrest: e.team.logo,
          goals: 0, assists: 0, penalties: 0,
        });
      }
      const s = map.get(pid)!;
      s.goals += 1;
      if (e.detail === 'Penalty') s.penalties += 1;

      // Assist (may be null)
      if (e.assist.id != null) {
        const aid = e.assist.id;
        if (!map.has(aid)) {
          map.set(aid, {
            playerName: e.assist.name ?? 'Unknown', teamName: e.team.name, teamCrest: e.team.logo,
            goals: 0, assists: 0, penalties: 0,
          });
        }
        map.get(aid)!.assists += 1;
      }
    }
  }

  return [...map.values()]
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.playerName.localeCompare(b.playerName))
    .map(s => ({
      playerName: s.playerName,
      nationality: '',            // not available from events; not shown in the UI
      teamName: s.teamName,
      teamShort: toShort(s.teamName),
      teamCrest: s.teamCrest,
      goals: s.goals,
      assists: s.assists > 0 ? s.assists : null,
      penalties: s.penalties > 0 ? s.penalties : null,
      playedMatches: 0,           // not derivable from events without extra calls
    }));
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function fetchCompetitionDetail(code: string): Promise<CompetitionDetailData | null> {
  const leagueId = COMP_CODE_TO_LEAGUE_ID[code];
  if (!leagueId) return null;

  if (await isRateLimited()) return null;
  if (await isDailyBudgetExhausted()) return null;

  const [info, standingsFirst] = await Promise.all([
    fetchCompInfo(code, leagueId),
    fetchStandings(code, leagueId),
  ]);

  if (!info) return null;

  const seasonYear = info.season?.startDate
    ? parseInt(info.season.startDate.slice(0, 4), 10)
    : currentSeason();

  const isCup = CUP_CODES.has(code);
  const isMultiGroup = standingsFirst.groups.filter(g => !g.isAggregate).length > 1;

  // ── Hotness detection ─────────────────────────────────────────────────────
  // Multi-group (WC, EURO…): fetch the full-season list at default TTL.
  //   • We need it for standings + scorer recompute anyway.
  //   • We derive upcoming/recent from it — no separate ?next=N / ?last=N call.
  //   → saves 2 upstream endpoints per page render vs the old approach.
  // Single-group (PL, CL…): full-season list would be huge (380 matches for PL)
  //   and we don't do local recompute for those, so keep the cheap ?next/?last.
  let seasonResults0: SeasonResult[] = [];
  let fixtures0: { upcoming: CompFixture[]; recent: CompFixture[] };

  if (isMultiGroup) {
    seasonResults0 = await fetchSeasonResults(leagueId, seasonYear);
    fixtures0 = fixturesFromSeasonResults(seasonResults0, isCup);
  } else {
    fixtures0 = await fetchFixtures(leagueId, seasonYear, isCup);
  }

  const hot = isCompHot(fixtures0);

  // ── Hot re-read ──────────────────────────────────────────────────────────────────────────────
  let fixtures: { upcoming: CompFixture[]; recent: CompFixture[] };
  let seasonResults: SeasonResult[];
  let standingsFetch: StandingsFetch;
  let scorers: CompScorer[];

  if (isMultiGroup) {
    if (hot) {
      [seasonResults, standingsFetch] = await Promise.all([
        fetchSeasonResults(leagueId, seasonYear, AF_LIVE_TTL_SECONDS),
        fetchStandings(code, leagueId, AF_HOT_TTL_SECONDS),
      ]);
      fixtures = fixturesFromSeasonResults(seasonResults, isCup);
    } else {
      seasonResults = seasonResults0;
      fixtures = fixtures0;
      standingsFetch = standingsFirst;
    }
    scorers = []; // filled in by events recompute below
  } else {
    const fetched = await Promise.all([
      hot ? fetchFixtures(leagueId, seasonYear, isCup, AF_LIVE_TTL_SECONDS) : Promise.resolve(fixtures0),
      hot ? fetchStandings(code, leagueId, AF_HOT_TTL_SECONDS) : Promise.resolve(standingsFirst),
      fetchScorers(leagueId, seasonYear, hot ? AF_HOT_TTL_SECONDS : AF_SCORERS_TTL_SECONDS),
    ]);
    fixtures = fetched[0];
    standingsFetch = fetched[1];
    scorers = fetched[2];
    seasonResults = [];
  }

  // ── Multi-group recompute ─────────────────────────────────────────────────────────────────────
  const realGroups = standingsFetch.groups.filter(g => !g.isAggregate);
  if (realGroups.length > 1 && seasonResults.length > 0) {
    recomputeGroupTables(standingsFetch.groups, seasonResults);
    const thirdPlace = buildThirdPlaceTable(standingsFetch.groups);
    standingsFetch = {
      ...standingsFetch,
      groups: [...realGroups, ...(thirdPlace ? [thirdPlace] : [])],
    };

    const activeFixtures = seasonResults.filter(
      r => FINISHED_SHORTS.has(r.status) || LIVE_SHORTS.has(r.status),
    );
    if (activeFixtures.length > 0) {
      const eventPairs = await Promise.all(
        activeFixtures.map(async r => {
          const ttl = LIVE_SHORTS.has(r.status) ? AF_LIVE_TTL_SECONDS : AF_STABLE_TTL_SECONDS;
          const events = await fetchMatchEvents(r.fixtureId, ttl);
          return [r.fixtureId, events] as const;
        }),
      );
      const eventsScorers = buildScorersFromEvents(seasonResults, new Map(eventPairs));
      if (eventsScorers.length > 0) scorers = eventsScorers;
    }
  }

  if (info.season) {
    info.season.currentMatchday = standingsFetch.currentMatchday;
    const topRow    = standingsFetch.groups[0]?.rows[0];
    const seasonOver = topRow && topRow.played >= 34;
    if (seasonOver) info.season.winner = standingsFetch.winner;
  }

  return {
    info, standingGroups: standingsFetch.groups,
    scorers, upcomingFixtures: fixtures.upcoming, recentResults: fixtures.recent,
  };
}
