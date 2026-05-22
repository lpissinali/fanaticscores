/**
 * Scheduled Cloud Function -- runs every minute via Cloud Scheduler.
 * Checks whether today's Firestore doc needs refreshing and fetches if so.
 * Also generates an AI brief via Claude Haiku (rate-limited to 5 min).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { afApiKey, fetchMatchday, type MatchdayDoc } from './apiFootballFetch';
import { generateAiBrief } from './aiBrief';
import { getDb } from './adminInit';

function briefIsInvalid(doc: MatchdayDoc): boolean {
  return !doc.aiBrief || doc.aiBrief === 'No matches scheduled today.' || doc.aiBrief === 'Unable to generate brief right now.';
}

export const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

const db = getDb;

export const scheduledMatchFetch = onSchedule(
  { schedule: 'every 1 minutes', secrets: [afApiKey, anthropicApiKey], timeoutSeconds: 120 },
  async () => {
    const today = new Date().toISOString().slice(0, 10);
    const now   = Date.now();
    const ref   = db().collection('matchdays').doc(today);

    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() as MatchdayDoc;
      if (data.nextFetchAfter && data.nextFetchAfter > now) {
        if (briefIsInvalid(data)) {
          console.log('[scheduledFetch] doc fresh but brief missing/invalid -- generating');
          const briefResult = await generateAiBrief(
            data.competitions, data.hasLive, null, 0, anthropicApiKey.value(),
            data.aiBriefStateHash,
          );
          if (briefResult.brief) {
            await ref.update({
              aiBrief:           briefResult.brief,
              aiBriefGeneratedAt: briefResult.generatedAt,
              aiBriefStateHash:   briefResult.stateHash ?? '',
            });
          }
        } else {
          console.log('[scheduledFetch] skipping -- next fetch not yet due');
        }
        return;
      }
    }

    console.log('[scheduledFetch] fetching ' + today);
    const newDoc = await fetchMatchday(today, afApiKey.value());

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

    const existingData = snap.exists ? snap.data() as MatchdayDoc : null;
    const briefResult = await generateAiBrief(
      docToWrite.competitions,
      docToWrite.hasLive,
      existingData && !briefIsInvalid(existingData) ? existingData.aiBrief : null,
      existingData && !briefIsInvalid(existingData) ? existingData.aiBriefGeneratedAt : 0,
      anthropicApiKey.value(),
      existingData?.aiBriefStateHash,
    );
    docToWrite = {
      ...docToWrite,
      aiBrief:           briefResult.brief,
      aiBriefGeneratedAt: briefResult.generatedAt,
      aiBriefStateHash:   briefResult.stateHash ?? '',
    };

    await ref.set(docToWrite);
    console.log('[scheduledFetch] wrote ' + today + ' hasLive=' + docToWrite.hasLive + ' comps=' + docToWrite.competitions.length + ' brief=' + !!briefResult.brief);
  }
);
