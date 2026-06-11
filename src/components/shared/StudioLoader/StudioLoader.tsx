'use client';
/**
 * StudioLoader — seeds the match cache from the API when navigating
 * directly to /en/studio/:matchId from an SSR match page, then renders
 * StudioPage which reads from that cache.
 */
import { useEffect, useState } from 'react';
import { getCachedMatch, cacheMatch } from '../../../lib/matchCache';
import StudioPage from '../../../views/studio/StudioPage';
import type { SupportedLocale } from '../../../i18n';

interface Props {
  locale: SupportedLocale;
  matchId?: string;
}

export default function StudioLoader({ locale, matchId }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!matchId) { setReady(true); return; }

    // If already in cache, nothing to do
    if (getCachedMatch(matchId)) { setReady(true); return; }

    // Fetch from server API and seed the cache
    fetch(`/api/match-cache/${matchId}`)
      .then(r => r.json())
      .then(data => {
        if (data) {
          // The API sends kickoff as raw ISO; format it here, in the
          // browser, so the studio shows the viewer's local time.
          if (data.match?.kickoff) {
            const t = Date.parse(data.match.kickoff);
            if (Number.isFinite(t)) {
              data.match.kickoff = new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
          }
          cacheMatch(data);
        }
      })
      .catch(() => { /* ignore — studio will show picker */ })
      .finally(() => setReady(true));
  }, [matchId]);

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-faint)', fontSize: 13, fontFamily: 'monospace' }}>
        Loading…
      </div>
    );
  }

  return <StudioPage locale={locale} />;
}
