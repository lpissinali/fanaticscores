'use client';
import { useState, useEffect } from 'react';
import { fetchMatchDetail } from './api/matchDetails';
import type { MatchDetailData } from './api/matchDetails';

export interface MatchDetailState {
  data: MatchDetailData | null;
  loading: boolean;
  error: string | null;
}

export function useMatchDetails(matchId: string): MatchDetailState {
  const [state, setState] = useState<MatchDetailState>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    fetchMatchDetail(matchId).then((data: MatchDetailData | null) => {
      if (!cancelled) {
        if (data) setState({ data, loading: false, error: null });
        else setState({ data: null, loading: false, error: 'Match not found' });
      }
    }).catch((err: Error) => {
      if (!cancelled) setState({ data: null, loading: false, error: err.message });
    });

    return () => { cancelled = true; };
  }, [matchId]);

  return state;
}
