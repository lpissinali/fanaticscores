/**
 * Scheduled Cloud Function — runs every minute via Cloud Scheduler.
 * Checks whether today's Firestore doc needs refreshing and fetches if so.
 * Interval is data-driven: 60 s with live matches, 2 min otherwise, 30 min if no matches.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { fdApiKey, fetchMatchday, type MatchdayDoc } from './footballDataFetch';
import { getDb } from './adminInit';

const db = getDb;

export const scheduledMatchFetch = onSchedule(
  { schedule: 'every 1 minutes', secrets: [fdApiKey], timeoutSeconds: 120 },
  async () => {
    const today = new Date().toISOString().slice(0, 10);
    const now   = Date.now();
    const ref   = db().collection('matchdays').doc(today);

    // Check whether a fetch is due.
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() as { nextFetchAfter?: number };
      if (data.nextFetchAfter && data.nextFetchAfter > now) {
        console.log(`[scheduledFetch] skipping — next fetch due in ${Math.round((data.nextFetchAfter - now) / 1000)}s`);
        return;
      }
    }

    console.log(`[scheduledFetch] fetching ${today}`);
    const newDoc = await fetchMatchday(today, fdApiKey.value());

    // Guard: never overwrite good competition data with an empty array caused by rate limiting.
    // If the new fetch got no competitions (all 429'd) but we have existing data, keep it.
    let docToWrite: MatchdayDoc = newDoc;
    if (newDoc.hadErrors && newDoc.competitions.length === 0 && snap.exists) {
      const existing = snap.data() as MatchdayDoc;
      if (existing.competitions && existing.competitions.length > 0) {
        console.log(`[scheduledFetch] rate-limited with no results — preserving ${existing.competitions.length} existing comps`);
        docToWrite = {
          ...newDoc,
          competitions: existing.competitions,
          featured:     newDoc.featured ?? existing.featured ?? null,
        };
      }
    }

    await ref.set(docToWrite);
    console.log(`[scheduledFetch] wrote ${today} — hasLive=${docToWrite.hasLive} hadErrors=${docToWrite.hadErrors} comps=${docToWrite.competitions.length}`);
  }
);
