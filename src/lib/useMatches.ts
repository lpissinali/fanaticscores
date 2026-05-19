import { useState, useEffect, useRef } from 'react';
import { fetchMatchesForDate } from './api/footballData';
import type { TodayData } from './api/footballData';

export interface MatchesState extends TodayData {
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// Only poll when viewing today — past/future dates are static.
const POLL_INTERVAL = 120_000; // 2 minutes

export function useMatches(date?: string): MatchesState {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const isToday = targetDate === today;

  const [state, setState] = useState<MatchesState>({
    competitions: [],
    featured: null,
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const cancelledRef = useRef(false);
  const fetchingRef  = useRef(false); // guard: skip tick if previous fetch still running

  useEffect(() => {
    cancelledRef.current = false;
    fetchingRef.current  = false;
    setState(prev => ({ ...prev, loading: true, error: null }));

    async function load() {
      if (fetchingRef.current) return; // previous fetch still in flight — skip
      fetchingRef.current = true;
      try {
        const data = await fetchMatchesForDate(targetDate);
        if (!cancelledRef.current) {
          setState({ ...data, loading: false, error: null, lastUpdated: new Date() });
        }
      } catch (err) {
        if (!cancelledRef.current) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load matches',
          }));
        }
      } finally {
        fetchingRef.current = false;
      }
    }

    load();

    // Only set up polling for today's matches (live scores change).
    // Historical/future dates are fetched once and left alone.
    const iv = isToday ? setInterval(load, POLL_INTERVAL) : undefined;
    return () => { cancelledRef.current = true; if (iv) clearInterval(iv); };
  }, [targetDate, isToday]);

  return state;
}
