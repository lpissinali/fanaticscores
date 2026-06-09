/**
 * Server-side read of a `matchdays/{date}` document via the Firebase Admin SDK.
 *
 * This runs only in Server Components / Route Handlers (never shipped to the
 * browser). It lets `/en/today` and `/en/[date]` server-render real fixtures
 * and the AI brief into the initial HTML — the exact same data the client
 * reads from Firestore — so Googlebot indexes real content instead of an
 * empty "Loading…" shell.
 *
 * On App Hosting the runtime service account provides Application Default
 * Credentials automatically. If credentials are unavailable (e.g. at build
 * time) or the doc is missing, this returns null and the page falls back to
 * its previous client-only behaviour — so it can never break the page.
 */

import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { MatchdayDoc } from '@/src/lib/useMatches';

function ensureApp(): void {
  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
}

/**
 * Whether Application Default Credentials are expected to be available.
 * - App Hosting / Cloud Run runtime: NODE_ENV === 'production' (creds come from
 *   the metadata server).
 * - Local dev: only if you've pointed GOOGLE_APPLICATION_CREDENTIALS at a
 *   service-account key (or run `gcloud auth application-default login`).
 * When false we skip the Admin read entirely, so `next dev` doesn't hang ~9s
 * on a doomed credential lookup — the client-side Firestore listener still
 * loads matches in the browser, exactly as before.
 */
function adminCredsLikely(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
    Boolean(process.env.GOOGLE_CLOUD_PROJECT && process.env.K_SERVICE)
  );
}

export async function getMatchdayDoc(date: string): Promise<MatchdayDoc | null> {
  // Never touch the Admin SDK during `next build`. Credential resolution can
  // spawn an external helper (gcloud) on machines without ADC and crash the
  // build (spawn UNKNOWN). At runtime on App Hosting, ADC is supplied by the
  // metadata server, so this guard only affects build-time prerendering.
  if (process.env.NEXT_PHASE === 'phase-production-build') return null;

  // No credentials available (typical local `next dev`): skip silently and let
  // the client render. SSR fixtures still work in production where ADC exists.
  if (!adminCredsLikely()) return null;

  try {
    ensureApp();
    const snap = await getFirestore().collection('matchdays').doc(date).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data) return null;
    // Guarantee a plain, JSON-serialisable object for the Server→Client prop
    // boundary (strips any Firestore field types / undefineds).
    return JSON.parse(JSON.stringify(data)) as MatchdayDoc;
  } catch (err) {
    // Keep the log to a single concise line (no stack) so production logs
    // aren't spammed if a transient read fails — the page still renders.
    const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
    console.warn('[getMatchdayDoc] SSR fixtures unavailable for', date, '—', msg);
    return null;
  }
}
