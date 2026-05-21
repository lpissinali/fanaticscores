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

const inFlight = new Set<string>();

function briefIsInvalid(doc: MatchdayDoc): boolean {
  return !doc.aiBrief || doc.aiBrief === 'No matches scheduled today.' || doc.aiBrief === 'Unable to generate brief right now.';
}

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

    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() as MatchdayDoc;
      // Treat a doc with no competitions as stale — force a refetch.
      const hasComps = data.competitions && data.competitions.length > 0;
      if (hasComps && data.nextFetchAfter && data.nextFetchAfter > now) {
        // Doc is fresh — regenerate brief if missing or invalid.
        if (briefIsInvalid(data)) {
          console.log('[fetchMatchdayHttp] doc fresh but brief invalid -- generating');
          const briefResult = await generateAiBrief(
            data.competitions, data.hasLive, null, 0, anthropicApiKey.value(),
          );
          if (briefResult.brief) {
            await ref.update({ aiBrief: briefResult.brief, aiBriefGeneratedAt: briefResult.generatedAt });
          }
        }
        res.json({ cached: true });
        return;
      }
    }

    if (inFlight.has(date)) {
      res.json({ cached: false, inflight: true });
      return;
    }
    inFlight.add(date);

    try {
      console.log('[fetchMatchdayHttp] fetching ' + date);
      const newDoc = await fetchMatchday(date, afApiKey.value());

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

      const existingData = snap.exists ? snap.data() as MatchdayDoc : null;
      const briefResult = await generateAiBrief(
        docToWrite.competitions,
        docToWrite.hasLive,
        existingData && !briefIsInvalid(existingData) ? existingData.aiBrief : null,
        existingData && !briefIsInvalid(existingData) ? existingData.aiBriefGeneratedAt : 0,
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
