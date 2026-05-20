/**
 * Scheduled Cloud Function -- runs every minute via Cloud Scheduler.
 * Checks whether today's Firestore doc needs refreshing and fetches if so.
 * Also generates an AI brief via Claude Haiku (rate-limited to 5 min).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { fdApiKey, fetchMatchday, type MatchdayDoc } from './footballDataFetch';
import { generateAiBrief } from './aiBrief';
import { getDb } from './adminInit';

export const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

const db = getDb;

export const scheduledMatchFetch = onSchedule(
  { schedule: 'every 1 minutes', secrets: [fdApiKey, anthropicApiKey], timeoutSeconds: 120 },
  async () => {
    const today = new Date().toISOString().slice(0, 10);
    const now   = Date.now();
    const ref   = db().collection('matchdays').doc(today);

    // Check whether a fetch is due.
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() as { nextFetchAfter?: number };
      if (data.nextFetchAfter && data.nextFetchAfter > now) {
        console.log('[scheduledFetch] skipping -- next fetch not yet due');
        return;
      }
    }

    console.log('[scheduledFetch] fetching ' + today);
    const newDoc = await fetchMatchday(today, fdApiKey.value());

    // Guard: never overwrite good competition data with an empty array caused by rate limiting.
    let docToWrite: MatchdayDoc = newDoc;
    if (newDoc.hadErrors && newDoc.competitions.length === 0 && snap.exists) {
      const existingDoc = snap.data() as MatchdayDoc;
      if (existingDoc.competitions && existingDoc.competitions.length > 0) {
        console.log('[scheduledFetch] rate-limited -- preserving ' + existingDoc.competitions.length + ' existing comps');
        docToWrite = {
          ...newDoc,
          competitions: existingDoc.competitions,
          featured:     newDoc.featured ?? existingDoc.featured ?? null,
        };
      }
    }

    // Generate AI brief (rate-limited internally to avoid excess Claude API calls).
    const existingData = snap.exists ? snap.data() as MatchdayDoc : null;
    const { brief, generatedAt } = await generateAiBrief(
      docToWrite.competitions,
      docToWrite.hasLive,
      existingData ? existingData.aiBrief : null,
      existingData ? existingData.aiBriefGeneratedAt : 0,
      anthropicApiKey.value(),
    );
    docToWrite = { ...docToWrite, aiBrief: brief, aiBriefGeneratedAt: generatedAt };

    await ref.set(docToWrite);
    console.log('[scheduledFetch] wrote ' + today + ' hasLive=' + docToWrite.hasLive + ' comps=' + docToWrite.competitions.length + ' brief=' + !!brief);
  }
);
