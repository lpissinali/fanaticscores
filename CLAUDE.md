# FanaticScores — project map for agents

Next.js (App Router) live-football-scores site on **Firebase App Hosting** (Cloud Run).
Data comes from **api-football** (`v3.football.api-sports.io`) behind a Firestore-backed
cache, plus a per-minute Cloud Function scheduler.

> ⚠️ The project's central engineering constraint is the **shared api-football daily quota**
> (7,500/day, shared with PitaCopa). Most of the server code exists to keep usage under it.
> **Before changing anything in `lib/serverApi/` or `functions/`, read
> [`lib/serverApi/README.md`](lib/serverApi/README.md)** — it documents the quota model,
> every cache layer, the TTL tiers, and how often each endpoint hits upstream in every
> situation (live match, finished match, idle competition, crawler, OG image…).

## Where things live

| Area | Path | Notes |
|---|---|---|
| api-football fetch + cache + budget + TTLs | `lib/serverApi/config.ts` | `fetchAF()` — the one chokepoint all upstream calls pass through |
| Shared Firestore response cache | `lib/serverApi/sharedCache.ts` | collection `afCache` |
| Daily quota breaker | `lib/serverApi/dailyBudget.ts` | `DAILY_LIMIT = 6800`; counter `afDaily/{date}` |
| Per-IP rate limit | `lib/serverApi/rateLimit.ts` | `LIMIT = 1000`/IP/hour; collection `rateLimits` |
| Match / team / competition data | `lib/serverApi/matchDetails.ts`, `teamDetails.ts`, `competitionDetails.ts` | page data fetchers |
| Lightweight OG-image data | `lib/serverApi/ogData.ts` | minimal fetchers for `opengraph-image.tsx` routes |
| Date/today data (no upstream) | `lib/serverApi/matchdayDoc.ts` | reads `matchdays/{date}` Firestore doc |
| Scheduler (writes matchday docs) | `functions/src/scheduledFetch.ts`, `apiFootballFetch.ts` | runs every 1 min, self-throttled |
| Pages | `app/en/{today,[date],match/[matchId],team/[teamId],competition/[compCode]}/` | detail pages + their `opengraph-image.tsx` |
| Runtime config | `apphosting.yaml` | `minInstances: 1` (warm instance = the recurring GCP charge) |

## Quick facts

- **Date/`today` pages cost 0 api-football quota** — they read Firestore docs the scheduler writes.
- **When the daily budget (6,800) trips, `fetchAF()` serves stale cache** (any age) instead of calling upstream, so already-crawled detail pages stay up (200) for Googlebot rather than 404ing. Only a page whose endpoints were never cached fails. Date pages stay up regardless.
- Caching layers: shared Firestore cache → React per-request memo → per-instance single-flight. See the README.
- To clear a quota lockout: set `afDaily/{today-UTC}.count = 0` in Firestore.

## Conventions

- Build/typecheck locally (`npm run build`) before deploying; deploy via Firebase App Hosting.
- All upstream calls must go through `fetchAF()` so they're cached, budgeted, and counted.
- Don't cache api-football error bodies (they return HTTP 200 with an `errors` field).
- **Keep the docs in sync.** Any change to the behavior, limits, TTLs, cache layers, call
  graph, or scheduler cadence described in [`lib/serverApi/README.md`](lib/serverApi/README.md)
  (or this file) must update that documentation **in the same change** — e.g. editing
  `DAILY_LIMIT`, `LIMIT`, a TTL constant, or how a page fetches data.
- **Keep [`HANDOVER.md`](HANDOVER.md) current — on EVERY change (mandatory).** It is the
  living session/deploy-state doc (distinct from this architecture map). Whenever you edit
  code in a turn, update `HANDOVER.md` in the **same turn**:
  - Add what changed under the correct deploy target (**WEB** = App Hosting git push, or
    **FUNCTIONS** = `firebase deploy --only functions`), so "pending deploy" stays accurate.
  - Record any new gotcha or follow-up; remove items once the user confirms they're deployed/done.
  - The user should never have to ask for this — treat it as part of finishing any change.
  If `HANDOVER.md` is missing, create it (see its own header for structure).
