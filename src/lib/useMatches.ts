'use client';
/**
 * useMatches — data hook with two modes:
 *
 * FIRESTORE MODE (production):
 *   Today   → onSnapshot for real-time push updates (no polling)
 *   Other   → getDoc once; if missing, triggers the on-demand HTTP function
 *             which fetches football-data.org server-side and writes to Firestore.
 *
 * PROXY MODE (fallback — used when Firebase env vars not set, e.g. local dev):
 *   Polls /api/fd directly from the browser, same as the original implementation.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  doc, getDoc, onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb, isFirebaseReady, isFirebaseConfigured } from './firebase';
import { fetchMatchesForDate } from './api/footballData';
import type { TodayData } from './api/footballData';
import type { Competition, Match, FeaturedMatch, MatchStatus } from './types';
import { cacheCompetitions } from './matchCache';
import { cacheGet, cacheSet, cacheDel } from './apiCache';

export interface MatchesState extends TodayData {
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

// ── Firestore document shape (mirrors functions/src/footballDataFetch.ts) ──

interface TeamData  { id: string; name: string; short: string; initial: string; color: string; crest?: string; score: number | null; }
interface MatchData { id: string; status: string; minute: string | number | null; kickoff?: string; kickoffIso?: string; competition?: string; home: TeamData; away: TeamData; }
interface CompData  { id: string; name: string; country: string; short: string; flag: string; stage?: string; matches: MatchData[]; }
export interface MatchdayDoc {
  competitions:       CompData[];
  featured:           MatchData | null;
  hadErrors:          boolean;
  hasLive:            boolean;
  fetchedAt:          number;
  nextFetchAfter:     number;
  aiBrief:            string | null;
  aiBriefGeneratedAt: number;
}

// ── Map Firestore doc → TodayData ──────────────────────────────────────────

/**
 * Format the raw ISO kickoff in the *viewer's* timezone. The doc's legacy
 * `kickoff` string was pre-formatted inside the Cloud Function (UTC), which
 * showed every visitor UTC times — 2h off in CEST, 3h off in Brasília.
 * Falls back to the legacy string when kickoffIso is absent (older docs).
 */
function localKickoff(iso?: string, legacy?: string): string | undefined {
  if (iso) {
    const t = Date.parse(iso);
    if (Number.isFinite(t)) {
      return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }
  return legacy;
}

export function mapDoc(doc: MatchdayDoc): TodayData {
  const competitions: Competition[] = doc.competitions.map(c => ({
    id:      c.id,
    name:    c.name,
    country: c.country,
    short:   c.short,
    flag:    c.flag,
    stage:   c.stage,
    matches: c.matches.map(m => ({
      id:      m.id,
      status:  m.status as MatchStatus,
      minute:  m.minute ?? undefined,
      kickoff: localKickoff(m.kickoffIso, m.kickoff),
      home:    { ...m.home },
      away:    { ...m.away },
    } as Match)),
  }));

  let featured: FeaturedMatch | null = null;
  if (doc.featured) {
    const m = doc.featured;
    const compName = m.competition ?? '';
    const compCountry = doc.competitions.find(c => c.name === compName)?.country ?? '';
    featured = {
      id:             m.id,
      status:         m.status as MatchStatus,
      minute:         m.minute ?? undefined,
      kickoff:        localKickoff(m.kickoffIso, m.kickoff),
      competition:    compName,
      compCountry,
      home:           { ...m.home },
      away:           { ...m.away },
      stats:          { possession: [50, 50], shots: [0, 0], xG: [0, 0] },
      events:         [],
      aiPulse:        '',
      momentumSeries: [],
    };
  }

  return { competitions, featured, hadErrors: doc.hadErrors, aiBrief: doc.aiBrief ?? null };
}

// ── One-shot fetch for any date (used by Studio match picker) ──────────────
// In Firestore mode: single document read (fast, free).
// In proxy/dev mode: falls back to the multi-competition API fetch.

export async function fetchMatchday(date: string): Promise<TodayData> {
  if (isFirebaseReady()) {
    try {
      const snap = await getDoc(doc(getDb(), 'matchdays', date));
      if (snap.exists()) return mapDoc(snap.data() as MatchdayDoc);
    } catch { /* fall through to proxy */ }
  }
  return fetchMatchesForDate(date);
}

// ── On-demand trigger for non-today dates ──────────────────────────────────

const FETCH_FN_URL = `/api/fetchMatchday`;

async function triggerFetch(date: string): Promise<void> {
  try {
    await fetch(`${FETCH_FN_URL}?date=${date}`);
  } catch { /* network error — Firestore listener will still fire when data arrives */ }
}

// ── Legacy proxy constants (fallback mode) ─────────────────────────────────

const POLL_INTERVAL = 30 * 60_000;   // 30 min — matches Cloud Function cadence
const TTL_TODAY     = 30 * 60_000;   // 30 min
const TTL_PAST      = 24 * 3_600_000;
const TTL_FUTURE    =  2 * 3_600_000;
const TTL_PARTIAL   = 32 * 60_000;   // slightly longer than poll interval
const MAX_RETRIES   = 2;

function dateTTL(targetDate: string, hadErrors: boolean): number {
  if (hadErrors) return TTL_PARTIAL;
  const today = new Date().toISOString().slice(0, 10);
  if (targetDate === today) return TTL_TODAY;
  return targetDate < today ? TTL_PAST : TTL_FUTURE;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useMatches(date?: string, initialDoc?: MatchdayDoc | null): MatchesState {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const today  = new Date().toISOString().slice(0, 10);
  const isToday = targetDate === today;
  const isPast  = targetDate < today;

  // Seed from a server-fetched matchday doc when available. This makes the
  // server-rendered HTML contain real fixtures + AI brief (crawlable by Google)
  // instead of an empty "Loading…" shell. The same initializer runs on the
  // client's first render, so hydration matches exactly; live Firestore updates
  // then take over in the effect below.
  const [state, setState] = useState<MatchesState>(() => {
    if (initialDoc) {
      return {
        ...mapDoc(initialDoc),
        loading: false, error: null, lastUpdated: null,
        refresh: () => {},
      };
    }
    return {
      competitions: [], featured: null, hadErrors: false, aiBrief: null,
      loading: true, error: null, lastUpdated: null,
      refresh: () => {},
    };
  });

  // ── refs shared across both modes
  const cancelledRef   = useRef(false);
  const fetchingRef    = useRef(false);
  const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryCountRef  = useRef(0);
  const unsubRef       = useRef<Unsubscribe | null>(null);
  // True only for the first effect run when we have SSR-seeded data, so we can
  // keep that data on screen (no flash) instead of clearing it to "Loading…".
  const seededRef      = useRef(Boolean(initialDoc));
  const cacheKey = `matches:${targetDate}`;

  // ── FIRESTORE MODE ─────────────────────────────────────────────────────

  const setupFirestore = useCallback(() => {
    const db  = getDb();
    const ref = doc(db, 'matchdays', targetDate);

    // Poll Firestore for up to 15 s after triggering a server fetch.
    function pollUntilDoc(onFound: (fsDoc: MatchdayDoc) => void) {
      let attempts = 0;
      const iv = setInterval(async () => {
        attempts++;
        const s = await getDoc(ref);
        if (s.exists() || attempts >= 15) {
          clearInterval(iv);
          if (s.exists() && !cancelledRef.current) {
            onFound(s.data() as MatchdayDoc);
          } else if (!cancelledRef.current) {
            setState(prev => ({ ...prev, loading: false, error: 'Could not load matches' }));
          }
        }
      }, 1_000);
    }

    // Apply a fetched Firestore doc to state, then schedule a retry if needed.
    function applyDoc(fsDoc: MatchdayDoc) {
      const data = mapDoc(fsDoc);
      cacheCompetitions(data.competitions);
      setState(prev => ({
        ...prev, ...data,
        loading: false,
        error: data.hadErrors && !isPast ? 'Some matches may be missing' : null,
        lastUpdated: new Date(fsDoc.fetchedAt),
      }));

      // For future dates: if rate-limited with no competitions, retry after TTL.
      if (!isToday && !isPast && data.hadErrors && data.competitions.length === 0) {
        const retryIn = Math.max(5_000, fsDoc.nextFetchAfter - Date.now() + 1_000);
        retryTimerRef.current = setTimeout(async () => {
          if (cancelledRef.current) return;
          setState(prev => ({ ...prev, loading: true }));
          await triggerFetch(targetDate);
          pollUntilDoc(applyDoc);
        }, retryIn);
      }
    }

    if (isToday) {
      // Real-time listener — Firestore pushes every write from the scheduler.
      let fetchTriggered = false;
      unsubRef.current = onSnapshot(ref, (snap) => {
        if (cancelledRef.current) return;
        if (!snap.exists()) {
          // Clear stale match rows and featured card so the UI doesn't show
          // outdated LIVE data while the refetch is in progress.
          setState(prev => ({ ...prev, competitions: [], featured: null, loading: true }));
          // Doc missing — kick off an on-demand fetch (once) so the scheduler
          // doesn't have to run before today's matches appear.
          if (!fetchTriggered) {
            fetchTriggered = true;
            triggerFetch(targetDate);
          }
          return;
        }
        const fsDoc = snap.data() as MatchdayDoc;
        // Doc exists but has no competitions — always re-trigger once.
        // (Handles stale docs from old function versions with incompatible data.)
        if (!fetchTriggered && fsDoc.competitions.length === 0) {
          fetchTriggered = true;
          triggerFetch(targetDate);
        }
        const data = mapDoc(fsDoc);
        cacheCompetitions(data.competitions);
        setState(prev => ({
          ...prev, ...data,
          loading: false, error: null, lastUpdated: new Date(),
        }));
      }, (err) => {
        if (cancelledRef.current) return;
        console.error('[useMatches] Firestore error', err);
        setState(prev => ({ ...prev, loading: false, error: 'Live update error — refresh to retry' }));
      });
    } else {
      // One-time read; trigger server fetch if doc missing or stale.
      getDoc(ref).then((snap) => {
        if (cancelledRef.current) return;
        if (snap.exists()) {
          const fsDoc = snap.data() as MatchdayDoc;
          const now   = Date.now();
          applyDoc(fsDoc);
          // Re-fetch whenever nextFetchAfter has passed.
          // For past dates with some data: refresh silently and re-read when done.
          // For past dates with no data: show loading spinner and wait.
          const needsRefresh = fsDoc.nextFetchAfter < now;
          if (needsRefresh) {
            if (isPast && fsDoc.hadErrors && fsDoc.competitions.length === 0) {
              // Past date with errors and no data — re-fetch actively and wait for result.
              setState(prev => ({ ...prev, loading: true }));
              triggerFetch(targetDate).then(() => {
                if (!cancelledRef.current) pollUntilDoc(applyDoc);
              });
            } else {
              // Stale — trigger background refresh then re-read to update UI.
              triggerFetch(targetDate).then(async () => {
                if (cancelledRef.current) return;
                try {
                  const updatedSnap = await getDoc(ref);
                  if (updatedSnap.exists() && !cancelledRef.current) {
                    applyDoc(updatedSnap.data() as MatchdayDoc);
                  }
                } catch { /* ignore — stale data still shown */ }
              });
            }
          }
        } else {
          // Not in Firestore yet — trigger on-demand server fetch then wait.
          triggerFetch(targetDate).then(() => {
            if (cancelledRef.current) return;
            pollUntilDoc(applyDoc);
          });
        }
      }).catch(() => {
        if (!cancelledRef.current)
          setState(prev => ({ ...prev, loading: false, error: 'Could not load matches' }));
      });
    }
  }, [targetDate, isToday, isPast, cacheKey]);

  // ── PROXY MODE (fallback) ──────────────────────────────────────────────

  const proxyLoad = useCallback(async (force = false) => {
    if (fetchingRef.current) return;
    if (force) {
      cacheDel(cacheKey);
      retryCountRef.current = 0;
      if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = undefined; }
      setState(prev => ({ ...prev, loading: true, error: null }));
    }
    fetchingRef.current = true;
    try {
      const data = await fetchMatchesForDate(targetDate);
      if (!cancelledRef.current) {
        cacheSet(cacheKey, data, dateTTL(targetDate, data.hadErrors));
        cacheCompetitions(data.competitions);
        const canRetry = !isPast && !isToday && data.hadErrors && retryCountRef.current < MAX_RETRIES;
        const showError = data.hadErrors && !isPast;
        setState(prev => ({
          ...prev, ...data, loading: false,
          error: showError ? (canRetry ? 'Some matches may be missing — retrying' : 'Some matches may be missing') : null,
          lastUpdated: new Date(),
        }));

        // Proxy mode: trigger the Cloud Function to generate/update the aiBrief
        // in Firestore, then poll until the brief appears (up to ~30s).
        if (isFirebaseConfigured()) {
          triggerFetch(targetDate).then(() => {
            let attempts = 0;
            const iv = setInterval(async () => {
              attempts++;
              try {
                const snap = await getDoc(doc(getDb(), 'matchdays', targetDate));
                if (snap.exists()) {
                  const brief = (snap.data() as MatchdayDoc).aiBrief;
                  if (brief && !cancelledRef.current) {
                    setState(prev => ({ ...prev, aiBrief: brief }));
                    clearInterval(iv);
                    return;
                  }
                }
              } catch { /* ignore */ }
              if (attempts >= 10) clearInterval(iv); // give up after ~30s
            }, 3_000);
          }).catch(() => {});
        }

        if (canRetry) {
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(() => {
            if (!cancelledRef.current) { fetchingRef.current = false; proxyLoad(); }
          }, TTL_PARTIAL + 2_000);
        }
      }
    } catch (err) {
      if (!cancelledRef.current)
        setState(prev => ({ ...prev, loading: false, error: err instanceof Error ? err.message : 'Failed to load matches' }));
    } finally {
      fetchingRef.current = false;
    }
  }, [targetDate, isToday, isPast, cacheKey]);

  const refresh = useCallback(() => {
    if (isFirebaseReady()) {
      triggerFetch(targetDate);
    } else {
      proxyLoad(true);
    }
  }, [targetDate, proxyLoad]);

  // ── Effect ─────────────────────────────────────────────────────────────

  useEffect(() => {
    cancelledRef.current  = false;
    fetchingRef.current   = false;
    retryCountRef.current = 0;
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = undefined; }
    if (unsubRef.current)      { unsubRef.current(); unsubRef.current = null; }

    if (seededRef.current) {
      // First run with SSR-seeded data: keep it visible, just wire `refresh`.
      // Live updates still attach below and overwrite with fresh data.
      seededRef.current = false;
      setState(prev => ({ ...prev, refresh }));
    } else {
      setState(prev => ({ ...prev, competitions: [], featured: null, aiBrief: null, loading: true, error: null, refresh }));
    }

    if (isFirebaseReady()) {
      setupFirestore();
      return () => {
        cancelledRef.current = true;
        if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = undefined; }
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
      };
    }

    // ── Proxy / local-dev fallback ────────────────────────────────────
    const cached = cacheGet<TodayData>(cacheKey);
    if (cached) {
      const showError = cached.hadErrors && !isPast;
      setState(prev => ({
        ...prev, ...cached, loading: false,
        error: showError ? 'Some matches may be missing — retrying' : null,
        lastUpdated: null, refresh,
      }));
      cacheCompetitions(cached.competitions);
      if (!isToday && (!cached.hadErrors || isPast)) return;
    }

    proxyLoad();

    if (!isToday) {
      return () => {
        cancelledRef.current = true;
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      };
    }

    const iv = setInterval(proxyLoad, POLL_INTERVAL);
    function onVisibility() {
      if (document.visibilityState === 'visible' && !cacheGet<TodayData>(cacheKey)) proxyLoad();
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelledRef.current = true;
      clearInterval(iv);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [targetDate, isToday, isPast, cacheKey, setupFirestore, proxyLoad, refresh]);

  return state;
}
