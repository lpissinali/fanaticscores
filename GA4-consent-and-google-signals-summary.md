# FanaticScores — GA4 Consent & Google Signals: what to implement

Handoff notes for the next session. Property: `fanaticscores-b6af4` · Measurement ID: `G-Z84TC8K72Q` · single web stream "fanaticscores".

---

## Current state (verified live)

- **Consent Mode is implemented** in `app/layout.tsx`:
  - Default: `gtag('consent','default', { analytics_storage:'denied', ad_storage:'denied', wait_for_update:500 })`
  - Config: `gtag('config','G-Z84TC8K72Q', { send_page_view:false })`
- **Cookie banner** (`src/components/shared/CookieBanner/CookieBanner.tsx`) stores `fs_consent` = `'all'` | `'essential'`.
  - "Accept all" → `enableAnalytics()` → `analytics_storage:'granted'`.
  - "Essential" or dismiss → `disableAnalytics()` → stays denied.
  - Banner only shows if no prior choice exists; once dismissed it never reappears.
- **Pageviews** come only from code (`send_page_view:false` + manual `page_view` in `src/lib/useAnalytics.ts`, mounted via `AnalyticsProvider`). Enhanced Measurement is OFF in GA.
- A live `www` hit was confirmed firing `page_view` to `G-Z84TC8K72Q` with `gcs=G101` (analytics granted). Tracking works — the reason most visits don't show is the consent gate below.

**Core problem:** analytics only counts users who explicitly click "Accept all." Anyone who picks "essential" or dismisses the banner stays in denied mode and is **not** counted in Realtime/reports → GA substantially undercounts.

---

## 1. Consent — what to update

### a. Complete Consent Mode v2 (code — required before Google Signals)
The default and the enable/disable calls only set `analytics_storage` (+ `ad_storage`). Consent Mode **v2** also expects `ad_user_data` and `ad_personalization`.

`app/layout.tsx` — update the default:
```js
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  wait_for_update: 500,
});
```

`src/lib/useAnalytics.ts` — update both functions:
```js
export function enableAnalytics() {
  window.gtag?.('consent', 'update', {
    analytics_storage: 'granted',
    // grant the two below ONLY if you enable Google Signals / demographics:
    ad_user_data: 'granted',
    ad_personalization: 'granted',
  });
}
export function disableAnalytics() {
  window.gtag?.('consent', 'update', {
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}
```
If you stay analytics-only (no Signals), keep `ad_user_data`/`ad_personalization` as `'denied'` in the update too — but still declare them in the default.

### b. Let users change their choice later
Right now a dismissed banner never returns, so a user stuck in "denied" can't opt in. Add a "Cookie settings" / "Manage consent" link (footer or the Cookies page) that clears `fs_consent` (or re-opens the banner) so people can change their mind.

### c. Reconsider "dismiss = essential"
Treating a passive dismiss as a consent decision suppresses analytics for most visitors. Options: make "Accept all" the prominent action, or don't record a choice until the user actually clicks one.

### d. Privacy policy
If you grant `ad_user_data`/`ad_personalization` and/or enable Google Signals, update `/en/privacy` to disclose Google Analytics, Google Signals, and demographics/interests collection.

---

## 2. Google Signals — what to implement

**What it adds:** cross-device measurement, plus Demographics & Interests reports (age, gender, interests) using data from signed-in Google users.

**Decide first whether you want it.** For a privacy-first "no tracking, no ads" brand it's a real tradeoff, and on a brand-new low-traffic site the reports are often hidden anyway (see caveats). If you don't plan to use remarketing/demographics, you can skip it.

**If you enable it:**
- GA path: **Admin → Data collection and modification → Data collection → Google signals data collection → Get started / turn on.**
- Prerequisites (do these first):
  1. Complete Consent Mode v2 (section 1a) **and** actually grant `ad_user_data` + `ad_personalization` on "Accept all" — otherwise Signals collects nothing for EEA/UK users.
  2. Update the privacy policy (section 1d).
- Caveats:
  - **Data thresholding:** with Signals on, GA hides rows/reports when traffic is too low to keep users anonymous. On a new site this means demographics reports may show little or nothing for a while.
  - It does not increase your total user count — it enriches existing users; it won't fix the undercounting (that's the consent gate).

**Recommendation:** finish the consent work first and confirm Realtime is counting consented users; enable Google Signals later once traffic grows and the privacy policy is updated. Keep it OFF until then if you want to avoid thresholding noise and the extra disclosure.

---

## 3. How consent and Signals interrelate
- `analytics_storage` → controls whether GA counts the user at all (Realtime, standard reports).
- `ad_user_data` / `ad_personalization` → control Google Signals, demographics, and any ads/remarketing features.
- Google Signals only collects for a user when those ad signals are **granted**. So Signals is only as effective as your consent UX.

---

## 4. Quick verification (after changes)
- Incognito (no ad blocker) → open `www.fanaticscores.com` → click **Accept all** → GA4 **Realtime** should show you within ~30s.
- Use GA4 **DebugView** (with the GA Debugger extension) to confirm `page_view` plus correct consent state (`gcs=G111` once ad signals are granted).
- Already done in this session: data retention set to 14 months; Search Console linked; duplicate "fanatic-next" stream removed.

## Also pending from this session (separate from consent/Signals)
- Add custom events (Share Studio open, team follow, match view, search, date change) → then mark them as **Key events** in GA. Nothing meaningful to convert on until these exist.
- Internal traffic filter still needs your public IP to finish.
