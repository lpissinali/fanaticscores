/**
 * HTTP Cloud Function — on-demand fetch for non-today dates.
 * Called by the client when a past/future date is not yet in Firestore.
 * Writes to Firestore and returns the document.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { fdApiKey, fetchMatchday, type MatchdayDoc } from './footballDataFetch';
import { getDb } from './adminInit';

const db = getDb;

// Simple in-flight dedup: prevent parallel fetches for the same date.
const inFlight = new Set<string>();

export const fetchMatchdayHttp = onRequest(
  { secrets: [fdApiKey], cors: true, timeoutSeconds: 120 },
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
      console.log(`[fetchMatchdayHttp] fetching ${date}`);
      const newDoc = await fetchMatchday(date, fdApiKey.value());

      // Guard: never overwrite good competition data with an empty array caused by rate limiting.
      let docToWrite: MatchdayDoc = newDoc;
      if (newDoc.hadErrors && newDoc.competitions.length === 0 && snap.exists) {
        const existing = snap.data() as MatchdayDoc;
        if (existing.competitions && existing.competitions.length > 0) {
          console.log(`[fetchMatchdayHttp] rate-limited with no results — preserving ${existing.competitions.length} existing comps`);
          docToWrite = {
            ...newDoc,
            competitions: existing.competitions,
            featured:     newDoc.featured ?? existing.featured ?? null,
          };
        }
      }

      await ref.set(docToWrite);
      console.log(`[fetchMatchdayHttp] wrote ${date} — comps=${docToWrite.competitions.length}`);
      res.json({ cached: false });
    } catch (err) {
      console.error('[fetchMatchdayHttp] error', err);
      res.status(500).json({ error: 'fetch failed' });
    } finally {
      inFlight.delete(date);
    }
  }
);
