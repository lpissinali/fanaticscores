/**
 * HTTP Cloud Function -- on-demand fetch for non-today dates.
 * Called by the client when a past/future date is not yet in Firestore.
 * Writes to Firestore and returns the document.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { afApiKey, fetchMatchday, type MatchdayDoc } from './apiFootballFetch';
import { generateAiBrief } from './aiBrief';
import { getDb } from './adminInit';

export const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

const db = getDb;

// Simple in-flight dedup: prevent parallel fetches for the same date.
const inFlight = new Set<string>();

export const fetchMatchdayHttp = onRequest(
  { secrets: [afApiKey, anthropicApiKey], cors: true, timeoutSeconds: 120 },
  async (req, res) => {
    const date = (req.query.date as string) ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date param required (YYYY-MM-DD)' });
      return;
    }

    const now = Date.now();
    const ref = db().collection('matchdays').doc(date);

    // Return cached doc if still fresh.
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() as { nextFetchAfter?: number };
      if (data.nextFetchAfter && data.nextFetchAfter > now) {
        res.json({ cached: true });
        return;
      }
    }

    // Deduplicate concurrent requests for same date.
    if (inFlight.has(date)) {
      res.json({ cached: false, inflight: true });
      return;
    }
    inFlight.add(date);

    try {
      console.log('[fetchMatchdayHttp] fetching ' + date);
      const newDoc = await fetchMatchday(date, afApiKey.value());

      // Guard: never overwrite good competition data with an empty array caused by rate limiting.
      let docToWrite: MatchdayDoc = newDoc;
      if (newDoc.hadErrors && newDoc.competitions.length === 0 && snap.exists) {
        const existingDoc = snap.data() as MatchdayDoc;
        if (existingDoc.competitions && existingDoc.competitions.length > 0) {
          console.log('[fetchMatchdayHttp] rate-limited -- preserving ' + existingDoc.competitions.length + ' existing comps');
          docToWrite = {
            ...newDoc,
            competitions: existingDoc.competitions,
            featured:     newDoc.featured ?? existingDoc.featured ?? null,
          };
        }
      }

      // Generate AI brief (rate-limited internally).
      const existingData = snap.exists ? snap.data() as MatchdayDoc : null;
      const briefResult = await generateAiBrief(
        docToWrite.competitions,
        docToWrite.hasLive,
        existingData ? existingData.aiBrief : null,
        existingData ? existingData.aiBriefGeneratedAt : 0,
        anthropicApiKey.value(),
      );
      docToWrite = { ...docToWrite, aiBrief: briefResult.brief, aiBriefGeneratedAt: briefResult.generatedAt };

      await ref.set(docToWrite);
      console.log('[fetchMatchdayHttp] wrote ' + date + ' comps=' + docToWrite.competitions.length + ' brief=' + !!briefResult.brief);
      res.json({ cached: false });
    } catch (err) {
      console.error('[fetchMatchdayHttp] error', err);
      res.status(500).json({ error: 'fetch failed' });
    } finally {
      inFlight.delete(date);
    }
  }
);
