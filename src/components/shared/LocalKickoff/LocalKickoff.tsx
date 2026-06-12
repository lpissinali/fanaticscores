'use client';
/**
 * LocalKickoff — renders a kickoff date/time in the viewer's timezone.
 *
 * Server components can't know the visitor's timezone, so SSR emits a
 * deterministic UTC string (explicit timeZone so server HTML and the first
 * client render match exactly — no hydration mismatch), and an effect then
 * re-renders with the local-timezone value after mount.
 *
 * NOTE: do NOT "fix" this back to suppressHydrationWarning — that attribute
 * makes React keep the SERVER text on mismatch (it suppresses the patch, not
 * just the warning), so the UTC time would stick forever. The state+effect
 * re-render is what actually swaps in the local time.
 */
import { useEffect, useState } from 'react';

interface Props {
  /** Raw ISO datetime (e.g. fixture.date from api-football). */
  iso?: string | null;
  /** 'time' → "09:00 PM" · 'date' → "Thu, Jun 11". Default 'time'. */
  mode?: 'time' | 'date';
  /** Shown when iso is missing/invalid. */
  fallback?: string;
}

function format(d: Date, mode: 'time' | 'date', timeZone?: string): string {
  return mode === 'date'
    ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone })
    : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone });
}

export default function LocalKickoff({ iso, mode = 'time', fallback = 'Upcoming' }: Props) {
  const t = iso ? Date.parse(iso) : NaN;
  const valid = Number.isFinite(t);

  const [localText, setLocalText] = useState<string | null>(null);
  useEffect(() => {
    if (valid) setLocalText(format(new Date(t), mode)); // no timeZone → viewer's own
  }, [t, mode, valid]);

  if (!valid) return <>{fallback}</>;
  return <span>{localText ?? format(new Date(t), mode, 'UTC')}</span>;
}
