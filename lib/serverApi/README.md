# api-football usage & caching architecture

_Last updated: 2026-06-16_

This document describes how FanaticScores calls **api-football** (`v3.football.api-sports.io`),
how every call is cached, and **how often each endpoint actually hits upstream in every
situation** (live match, finished match, idle competition, crawler re-visit, etc.).

If you're picking this project back up, read this first — it's the map of where the
api-football quota goes.

> 📝 **Keep this doc current.** Any change to the values, behavior, or call graph documented
> here — TTL constants, `DAILY_LIMIT`, the per-IP `LIMIT`, how a page fetches data, the
> scheduler cadence, the cache layers — must be reflected here **in the same change**.
> Update the changelog (§9) and the "Last updated" date above when you do.

---

## 1. The quota model (why all of this exists)

- **One api-football key** is shared between **FanaticScores** and **PitaCopa**.
- Plan quota: **7,500 requests/day**, resets at **00:00 UTC**.
- FanaticScores' web tier is hard-capped at **`DAILY_LIMIT = 6,800`** (`dailyBudget.ts`).
- The remaining ~700 is headroom for:
  - the **scheduler** Cloud Function (self-throttled to ~50–150/day, see §6), and
  - **PitaCopa** (own server, own cache; a few hundred on match days).

When the web tier crosses 6,800 in a UTC day, the api-football-backed **detail pages
render 404** until the next reset. The date/`today` pages keep working (they read
Firestore, not upstream — see §5).

The original 404 incident (2026-06-15) was the daily counter hitting 6,801/6,800. The
counter lives in Firestore at **`afDaily/{YYYY-MM-DD}`** and can be manually reset to 0.

---

## 2. The call path: layers a request passes through

Every upstream call goes through `fetchAF()` in **`config.ts`**, which stacks four
protections. In order:

1. **Per-IP rate limit** (`rateLimit.ts`) — guards detail pages *before* any quota is
   spent. `LIMIT = 1000` distinct detail-page requests per IP per hour, Firestore-backed
   (`rateLimits` collection), fail-open. Over-limit looks identical to "not found" → 404.
2. **Daily budget breaker** (`dailyBudget.ts`) — fleet-wide counter `afDaily/{date}`,
   memoized 60 s per instance, fail-open. Over `DAILY_LIMIT` → detail pages 404.
3. **Shared Firestore cache** (`sharedCache.ts`) — collection `afCache`, doc id =
   `base64url(path)`. Makes "cache for TTL" mean **one upstream call per TTL window across
   the entire Cloud Run fleet**, not once per instance. Only well-formed, error-free
   bodies are cached (so a transient quota/auth error isn't frozen in for an hour).
4. **In-request + in-flight dedup** (`config.ts`):
   - `React.cache()` — dedupes identical calls **within a single request**
     (e.g. `generateMetadata` + the page body sharing one fetch).
   - **single-flight map** — dedupes identical calls **across concurrent requests on the
     same instance**, keyed by `path|ttl|retries|delay`. Stops a burst (crawler spike,
     tournament kickoff) from firing N upstream calls for the same uncached endpoint.

Upstream fetch itself is `cache: 'no-store'` (NOT Next's data cache — that broke freshness
on warm instances; see the long comment in `config.ts`). Retries 429 twice with
exponential back-off; **every network attempt (incl. retries/errors) increments the daily
budget**, because api-football bills them.

---

## 3. TTL tiers (defined in `config.ts`)

| Constant | Value | Used for |
|---|---|---|
| `AF_STABLE_TTL_SECONDS` | **7 days** | Finished matches, team identity, H2H history, finished-match stats/events |
| `AF_SLOW_TTL_SECONDS` | **24 h** | Squads |
| `AF_TEAM_FIXTURES_TTL_SECONDS` | **6 h** | Team & competition fixture lists (`next`/`last`) |
| `AF_CACHE_TTL_SECONDS` (default) | **1 h** | Anything that doesn't pass an explicit TTL (e.g. `/leagues`) |
| `AF_SCORERS_TTL_SECONDS` | **15 min** | Top scorers between match rounds |
| `AF_HOT_TTL_SECONDS` | **5 min** | Standings/scorers of a competition with a live / imminent / just-finished match |
| `AF_LIVE_TTL_SECONDS` | **2 min** | In-progress fixture status, live stats, live-match events |

The read TTL only controls **how fresh a cached copy must be to be served**. Writes always
re-stamp the same cache entry, so a 7-day reader and a 2-min reader transparently share one
record — a live re-check just forces a refetch when the stored copy is older than 2 min.

---

## 4. Per-page upstream cost (cold cache miss → warm re-visit)

"Cold" = nothing in the shared cache. "Warm" = within TTL → Firestore reads only, **0
upstream**. Crawler re-visits of finished content are almost always warm.

| Page | Endpoints (cold) | Cold calls | Warm |
|---|---|---|---|
| `/en/today`, `/en/[date]` | none — reads `matchdays/{date}` Firestore doc (§5) | **0** | 0 |
| `/en/team/[id]` | `/teams?id` + `/players/squads?team` + `/fixtures?team&last=6` + `&next=5` | **4** | 0 |
| `/en/match/[id]` | `/fixtures?id` + `/fixtures/statistics` + `/fixtures/headtohead` + `/standings`¹ (+ related fixtures²) | **4–6** | 0 |
| `/en/competition/[code]` — single group (PL, CL…) | `/leagues?id` + `/standings`¹ + `/fixtures next=5` + `/fixtures last=5` + `/players/topscorers` | **~5** (+up to 4 when hot) | 0–4 |
| `/en/competition/[code]` — multi-group (WC, EURO…) | `/leagues?id` + `/standings` + one full-season `/fixtures?league&season` + **one `/fixtures/events` per finished/live match** | **~3 + N** | live matches' events only |
| OG image (each detail page) | lightweight — see §4a | **1–2** | 0 |

¹ `fetchStandings` tries the current + two recent seasons, and **negative-caches** an empty
result for 1 h so empty competitions don't re-loop every render (see §7).
² Related fixtures (`/fixtures?league&season&next=10` + `last=10`, 2 calls) only when the
match page needs the "More in [competition]" rail.

### 4a. OpenGraph images (`opengraph-image.tsx`) — `ogData.ts`

Each detail page's OG image renders in its **own request**, separate from the page. It used
to re-run the *full* detail fetcher (a second full fan-out just to draw a card). Now it uses
the minimal fetchers in `ogData.ts`:

- **Match OG** → `fetchMatchOG`: 1 call (`/fixtures?id`). Re-reads at live TTL if in-play.
- **Team OG** → `fetchTeamOG`: 1 call (`/teams?id`). (No squad/fixtures → no competitions row.)
- **Competition OG** → `fetchCompetitionOG`: 2 calls (`/leagues` + one `/standings` for top 3).
  Previously triggered the entire multi-group recompute — dozens of calls on a WC OG.

All share the same Firestore cache, rate limiter and budget guard as the page, so a warm OG
request is just Firestore reads.

---

## 5. Date / `today` pages have ZERO upstream cost

`/en/today` and `/en/[date]` do **not** call api-football. They read the
`matchdays/{date}` Firestore document via `matchdayDoc.ts` (Admin SDK, server-only). That
document is written by the scheduler Cloud Function (§6). This is the single most important
decoupling: the highest-traffic pages cost no quota and stay up even when the budget trips.

`/en/[date]` uses `revalidate = 60`; `/en/today` is `force-dynamic`.

---

## 6. The scheduler (`functions/src/scheduledFetch.ts`)

- Cloud Function, **runs every 1 minute** via Cloud Scheduler.
- Self-throttles using `nextFetchAfter` stored in the matchday doc (`calcNextFetch` in
  `apiFootballFetch.ts`):
  - today, **has live or near-kickoff → every 5 min**
  - today, no live → every 30 min
  - future date → every 2 h · past date → every 24 h (30 min on error)
- Each fetch is **one** `/fixtures?date=YYYY-MM-DD&timezone=UTC` call (all leagues at once),
  then writes the matchday doc + an AI brief (Claude Haiku, rate-limited to 5 min).
- **Effective volume: ~48/day idle, up to ~150 on busy live days.**
- **Important:** the scheduler does NOT pass through `fetchAF`, so it does **not** count
  against the 6,800 web budget — but it DOES count against the real 7,500 api-football quota.
  That's what the headroom in §1 protects.

---

## 7. How often each situation actually fetches upstream

Once the shared cache is warm, upstream calls per situation settle to:

- **Finished match page** (bulk of crawler traffic): fixture cached 7 days → re-crawls are
  **~0 upstream**. Only the first crawl of a novel id pays ~4.
- **Live match page**: fixture + stats re-read every **2 min**; league standings every
  **5 min** while the competition is "hot". Events for the match every 2 min.
- **Scheduled / pre-kickoff match**: 1-h window; inside the kickoff window (−30 min to +4 h)
  it's treated as live and flips to the 2-min cadence even before api-football marks it live.
- **Team page**: identity 7 days, squad 24 h, fixture lists 6 h.
- **Idle competition (single group)**: `/leagues` + standings + fixtures at 1 h, scorers
  15 min. An empty competition (no current table) → **negative-cached for 1 h**, so 0 calls.
- **Hot competition (single group)**: fixtures + standings re-read at 5 min, scorers 5 min.
- **Hot multi-group (WC/EURO)**: season list every 2 min, standings every 5 min, each
  finished match's events cached 7 days (so paid once), each live match's events every 2 min.
- **Date / today pages**: always **0 upstream** (Firestore matchday doc).
- **OG images**: 1–2 cheap calls, shared with the page's cache.

---

## 8. Firestore collections used

| Collection | Written by | Purpose |
|---|---|---|
| `afCache` | `sharedCache.ts` | Fleet-wide api-football response cache |
| `afDaily/{date}` | `dailyBudget.ts` | Daily upstream-call counter (reset here to clear a 404 lockout) |
| `rateLimits` | `rateLimit.ts` | Per-IP/hour request counters (TTL-expirable) |
| `matchdays/{date}` | scheduler (`functions/`) | Pre-rendered fixtures + AI brief for date/today pages |

---

## 9. Changelog of quota optimizations

- **2026-06-16** — single-flight dedup in `fetchAF` (`config.ts`); standings season-loop
  capped 7→3 seasons + 1-h negative cache for empty tables (`competitionDetails.ts`,
  `matchDetails.ts`); lightweight OG fetchers (`ogData.ts`) so OG images stop re-running the
  full fan-out (WC OG: dozens of calls → 2).
- **2026-06-15** — H2H TTL → 7 days; related fixtures → 6 h; competition fixtures capped at
  5 for all types; per-IP `LIMIT` 300→1000 (Googlebot was tripping it); `[fetchFixture]`
  diagnostic logging. Daily counter manually reset after the 6,801/6,800 lockout.
- Earlier — shared Firestore cache; daily budget breaker; adaptive hot/live TTLs;
  multi-group standings/scorers recompute from fixtures+events; date pages served from
  Firestore.

---

## 10. Known gaps & future levers

- **Multi-group competition page has no cross-instance stampede protection.** Single-flight
  only dedupes within one instance. The robust fix is to **precompute the WC/EURO
  aggregation in the scheduler** and write it to a Firestore doc (like matchdays), so the
  page reads one doc instead of fanning out to N event endpoints.
- **Negative caches and single-flight are per-instance, in-memory** — they reset on cold
  start. Fail-safe (a cold instance just does the work once), but not fleet-wide.
- **"Discovered – currently not indexed" pages** (~39: `/en/competition/AFCN`, some date
  pages) render thin/empty when a competition is off-season. **Partly addressed (2026-06-16):**
  evergreen `LEAGUE_BLURBS` were added in `app/en/competition/[compCode]/page.tsx` for every
  sitemap competition that lacked one (AFCN, UNL, CSUD, DED, PPL, SPL, JPL, TSL, MX), so each
  page now carries unique descriptive prose even with no live data. Still open (deferred):
  conditionally `noindex` a competition/date page that has zero data *and* no blurb, and only
  listing date pages in the sitemap that actually had matches.
- **If the daily count still exceeds 6,800** after these changes, `DAILY_LIMIT` can be
  raised toward **7,200** (leave ≥300 headroom for scheduler + PitaCopa under the 7,500 hard
  cap).

---

## 11. Operational notes

- **Billing:** the recurring "non-Firebase" Google Cloud charge (~9–28 CZK/mo) is almost
  entirely Cloud Run **"Min Instance Memory"** — i.e. `minInstances: 1` in `apphosting.yaml`
  keeping one instance warm (deliberate: avoids cold-start TTFB that hurt crawl rate).
  Setting `minInstances: 0` removes it at the cost of cold starts.
- **Clear a quota lockout:** set `afDaily/{today-UTC}.count` to 0 in Firestore.
- **Build/deploy:** `npm run build` then deploy via Firebase App Hosting. Always typecheck
  locally before pushing.
