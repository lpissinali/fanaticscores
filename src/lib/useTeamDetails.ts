'use client';
import { useState, useEffect } from 'react';
import { fetchTeamDetail, type TeamDetailData } from './api/teamDetails';

interface TeamDetailsState {
  data: TeamDetailData | null;
  loading: boolean;
  error: string | null;
}

export function useTeamDetails(teamId: string): TeamDetailsState {
  const [state, setState] = useState<TeamDetailsState>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    fetchTeamDetail(teamId).then(data => {
      if (cancelled) return;
      if (!data) setState({ data: null, loading: false, error: 'Could not load team' });
      else        setState({ data, loading: false, error: null });
    });

    return () => { cancelled = true; };
  }, [teamId]);

  return state;
}
