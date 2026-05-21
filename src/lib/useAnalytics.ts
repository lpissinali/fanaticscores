/**
 * useAnalytics — GA4 Consent Mode integration.
 *
 * GA4 loads with analytics_storage: 'denied' by default (set in index.html).
 * Call enableAnalytics() to grant consent and start collecting.
 * Call disableAnalytics() to revoke.
 *
 * useAnalytics() fires page_view on every route change, but only if consent
 * has been granted.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getConsent } from '../components/shared/CookieBanner/CookieBanner';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Grant analytics consent — call when user clicks "Accept all". */
export function enableAnalytics(): void {
  if (typeof window.gtag !== 'function') return;
  window.gtag('consent', 'update', { analytics_storage: 'granted' });
}

/** Revoke analytics consent — call when user clicks "Essential only". */
export function disableAnalytics(): void {
  if (typeof window.gtag !== 'function') return;
  window.gtag('consent', 'update', { analytics_storage: 'denied' });
}

/** Fire a page_view event (only lands if consent is granted). */
function trackPageView(path: string) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_path:  path,
    page_title: document.title,
  });
}

/**
 * Hook — place once inside BrowserRouter.
 * Restores consent for returning visitors and tracks route changes.
 */
export function useAnalytics() {
  const location = useLocation();

  // Restore consent on first load for returning visitors who already accepted.
  useEffect(() => {
    if (getConsent() === 'all') enableAnalytics();
  }, []);

  // Track every route change.
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);
}
