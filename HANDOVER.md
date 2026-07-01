# Handover / live state — FanaticScores

> **Living doc — agent-maintained.** Per the convention in [`CLAUDE.md`](CLAUDE.md)
> ("Keep HANDOVER.md current — on EVERY change"), the agent updates this file in the
> same turn as any code change: what changed, under which deploy target, plus new
> gotchas/follow-ups. Items under "Done — pending deploy" move out once the user
> confirms a deploy. It captures session/deploy state only; durable architecture
> (quota model, cache layers, file map, conventions) lives in `CLAUDE.md` and
> [`lib/serverApi/README.md`](lib/serverApi/README.md).

## ⚠️ Deploy state

- **FUNCTIONS — ✅ deployed 2026-07-01** via `firebase deploy --only functions` (predeploy build hook active).
- **WEB — ⏳ HOTFIX PENDING (git push).** The 2026-07-01 web deploy OOM'd the sitemap route ("connection termination") — 512 MiB + ~90 concurrent matchday-doc reads. Fix on disk, needs redeploy: sitemap no longer does heavy I/O (match window 90→**30 days**, batched, standings `retries=0`; date URLs are pure date-math, widened to **90 days**), so `memoryMiB` stays at **512**. Everything else from the 2026-07-01 web deploy is live.

(Reminder: `firebase deploy` does NOT deploy the Next.js web app — git push; build locally first, `ignoreBuildErrors` is on.)

## WEB — ✅ DEPLOYED 2026-07-01 (App Hosting push)

**SEO**
- Date/today page H1s → "Football Scores · {date}" / "Today's Football Scores" (+ Yesterday/Tomorrow). Competition `<title>` → "{name} Scores, Results & Standings". (`HomePage.tsx`, `competition/[compCode]/page.tsx`)
- Synced the 9 new competitions into the hardcoded `COMPETITIONS` list in `src/views/competitions/CompetitionsPage.tsx`.
- Deleted orphaned `app/en/competition/[compCode]/CompetitionSearch.tsx`.
- **Sitemap** (`app/sitemap.ts`): hardcoded competitions (~33) + computed date URLs (90 days, zero I/O) + team pages from ~27 comps (standings, `retries=0`) + recent match pages (**30-day** window, batched). Kept deliberately light — past-date matchday docs are sparse, so old match URLs aren't read; those pages are found via internal links from competition/date pages. **Resubmit in Search Console after the hotfix deploy.**

**Penalties / AET / winner feature**
- Types + data flow: `src/lib/types.ts` (`MatchStatus` += 'AET'|'PEN', `winner`, `penalty`), `useMatches.ts` mapDoc, dev fetcher `src/lib/api/footballData.ts`.
- Cards: `MatchRow.tsx` — "AP"/"AET" label, bold winner + dimmed loser, PEN/AET tag on winner. `StatusChip.tsx`, `StudioPage.tsx` finished filter/labels.
- Featured hero (`HomePage.tsx`): clickable → match page; winner emphasis; "Penalties X–Y" line (rendered **below** the score, not inline).
- Match details (`app/en/match/[matchId]/page.tsx` + `lib/serverApi/matchDetails.ts`): AET/PEN chips, "Penalties" row below Half-time (dashes aligned via `1fr/auto/1fr` grid), winner emphasis; **Penalty Shootout folded into the Match Events card** as a divider with the goal-ball glyph (solid = scored, faded = missed).
- Competition page (`competition/[compCode]/page.tsx` + `competitionDetails.ts`): "AP" label, winner bold/dim, pen score stacked **below** the regular score (fixed 54px column stays aligned).
- Share cards (`StudioCard.tsx`): all 4 templates show After Penalties/AET and a "who won" line (`decidedText`).

**Cost / crawl-health**
- `apphosting.yaml`: `memoryMiB 512` (halves the dominant min-instance cost). First 512 attempt OOM'd via the heavy sitemap read; that read is now removed, so 512 is back on. **Watch Cloud Run logs for 503 / "connection termination" after deploy**; bump to 1024 if any recur.
- **Budget lockout no longer 404s**: `config.ts` `fetchAF` serves stale cache (any age) when `DAILY_LIMIT` trips; removed the budget early-return from `matchDetails/competitionDetails/teamDetails` fetchers (kept the per-IP rate limit). Docs updated (`CLAUDE.md`, `lib/serverApi/README.md`, `dailyBudget.ts`).

## FUNCTIONS — ✅ DEPLOYED 2026-07-01 (`firebase deploy --only functions`)

- `apiFootballFetch.ts`: emit distinct `AET`/`PEN` status (was collapsing to FT); write `winner` + `penalty` per match.
- `aiBrief.ts`: knockout/penalty context (stage, shootout winner, "advance/eliminated") + editorial rule so it stops calling a shootout a "draw"; cache reuse fixed to `fresh && unchanged`.
- `captionRewrite.ts`: AET/PEN labels.
- `firebase.json`: added functions `predeploy` build hook.

## Gotchas

- **Two deploy targets** (see top). functions predeploy now auto-builds.
- **Sandbox bash mount is stale/truncated** — its `tsc`/`git` output can't be trusted (it silently cut file tails, producing phantom "unclosed tag / unterminated literal" errors). The Read/Edit file tools are authoritative; local `npm run build` is the real check.
- **Local data mode**: proxy mode (no `NEXT_PUBLIC_FIREBASE_*` in `.env.local`) uses `footballData.ts` and shows the new data immediately; Firestore mode reads the **prod scheduler doc**, so card/brief changes need functions deployed to appear.
- **Past-date matchday docs** are cached ~24h; delete `matchdays/{date}` in Firestore to force a refresh through new code.

## Open / follow-ups

- Deploy web + functions; resubmit sitemap; watch Search Console **Pages** (Indexed vs "Crawled – not indexed") and **Crawl stats** (404/5xx should flatten).
- Watch Cloud Run for OOM at 512 MiB.
- **Cost**: confirmed ~94% is the always-on warm Cloud Run min-instance (memory 66.7 Kč + CPU 21.7 Kč of ~94 Kč / 2wk). Firestore is free-tier (0 Kč) — the client-side live-clock optimization is **not needed for cost**. Decide `minInstances: 1` (keep warm for crawl) vs `0` (near-zero cost, cold starts) later, once indexed.
- **Optional cost hygiene** (console/gcloud, not code): Artifact Registry cleanup policy (keep last 3, delete untagged >7d) + GCS lifecycle rule on the Cloud Build bucket. ~1.3 Kč, low priority.
- **GA www-vs-apex** verification (from the original handoff) was never finished.
- Uptime check scheduled task exists (`fanaticscores-uptime-check`) — pings WC/today/CL/PL hourly, alerts on 500s.
