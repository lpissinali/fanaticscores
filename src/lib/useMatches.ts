import { useState, useEffect, useRef } from 'react';
import { fetchTodayData } from './api/footballData';
import type { TodayData } from './api/footballData';

export interface MatchesState extends TodayData {
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const POLL_INTERVAL = 60_000; // 1 minute

export function useMatches(): MatchesState {
  const [state, setState] = useState<MatchesState>({
    competitions: [],
    featured: null,
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    async function load() {
      try {
        const data = await fetchTodayData();
        if (!cancelledRef.current) {
          setState({
            ...data,
            loading: false,
            error: null,
            lastUpdated: new Date(),
          });
        }
      } catch (err) {
        if (!cancelledRef.current) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load matches',
          }));
        }
      }
    }

    load();
    const iv = setInterval(load, POLL_INTERVAL);

    return () => {
      cancelledRef.current = true;
      clearInterval(iv);
    };
  }, []);

  return state;
}
