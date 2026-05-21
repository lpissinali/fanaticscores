/**
 * Firebase client SDK initialisation.
 * Config comes from VITE_ env vars (set in .env.local, never committed).
 * isFirebaseReady() lets callers fall back to the API proxy if not configured.
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

const cfg = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            ?? '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        ?? '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         ?? '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             ?? '',
};

export function isFirebaseReady(): boolean {
  // Set VITE_FORCE_PROXY=true in .env.local to bypass Firestore and use the
  // api-football proxy directly (useful when functions aren't yet deployed).
  if (import.meta.env.VITE_FORCE_PROXY === 'true') return false;
  return Boolean(cfg.projectId && cfg.apiKey);
}

/** True if Firebase credentials are present, regardless of FORCE_PROXY.
 *  Used for optional side-reads (e.g. aiBrief) even in proxy mode. */
export function isFirebaseConfigured(): boolean {
  return Boolean(cfg.projectId && cfg.apiKey);
}

let _app: FirebaseApp | null  = null;
let _db:  Firestore   | null  = null;

export function getDb(): Firestore {
  if (!_db) {
    _app = getApps().length === 0 ? initializeApp(cfg) : getApps()[0];
    _db  = getFirestore(_app);
  }
  return _db;
}
