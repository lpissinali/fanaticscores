'use client';
import { useState, useEffect } from 'react';
import { fetchCompetitionDetail } from './api/competitionDetails';
import type { CompetitionDetailData } from './api/competitionDetails';

interface State {
  data:    CompetitionDetailData | null;
  loading: boolean;
  error:   string | null;
}

export function useCompetitionDetails(code: string): State {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    fetchCompetitionDetail(code).then(data => {
      if (cancelled) return;
      if (!data) setState({ data: null, loading: false, error: 'Competition not found' });
      else        setState({ data, loading: false, error: null });
    });

    return () => { cancelled = true; };
  }, [code]);

  return state;
}
