'use client';
/**
 * LiveRefresh — makes a server-rendered page behave like the live-updating
 * today page while a match is in progress.
 *
 * Calls router.refresh() on an interval, which re-runs the Server Component
 * render. Quota-safe by design: the re-render reads the Firestore shared
 * cache, and real upstream api-football calls stay capped by the live TTL
 * (one per 2 minutes fleet-wide) no matter how many viewers are refreshing.
 *
 * `active` is computed server-side per render (live status or inside the
 * kickoff window); when the match ends, the next refresh renders with
 * active=false and the interval unwinds itself. Background tabs skip
 * refreshes via the visibility check.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  active: boolean;
  intervalMs?: number;
}

export default function LiveRefresh({ active, intervalMs = 60_000 }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);

  return null;
}
