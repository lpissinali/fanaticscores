'use client';
/**
 * LocalKickoff — renders a kickoff time in the viewer's timezone.
 *
 * Server components can't know the visitor's timezone: formatting an ISO
 * datetime during SSR uses the server clock (UTC on Cloud Run), which showed
 * every visitor UTC times. This client component renders the same UTC string
 * on the server pass (so crawlers still see a time) and re-renders in the
 * local timezone after hydration; suppressHydrationWarning bridges the two.
 */

interface Props {
  /** Raw ISO datetime (e.g. fixture.date from api-football). */
  iso?: string | null;
  /** 'time' → "09:00 PM" · 'date' → "Thu, Jun 11". Default 'time'. */
  mode?: 'time' | 'date';
  /** Shown when iso is missing/invalid. */
  fallback?: string;
}

export default function LocalKickoff({ iso, mode = 'time', fallback = 'Upcoming' }: Props) {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return <>{fallback}</>;
  const d = new Date(t);
  return (
    <span suppressHydrationWarning>
      {mode === 'date'
        ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}
