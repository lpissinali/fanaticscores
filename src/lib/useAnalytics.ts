'use client';
/**
 * useAnalytics — GA4 Consent Mode integration.
 *
 * GA4 loads with analytics_storage: 'denied' by default (set in layout.tsx).
 * Call enableAnalytics() to grant consent and start collecting.
 * Call disableAnalytics() to revoke.
 *
 * useAnalytics() fires page_view on every route change, but only if consent
 * has been granted.
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getConsent } from '../components/shared/CookieBanner/CookieBanner';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function enableAnalytics(): void {
  if (typeof window.gtag !== 'function') return;
  // Consent Mode v2: declare all four signals on every update. We run
  // analytics-only (no ads, no Google Signals), so the two ad signals stay
  // denied even on "Accept all". If Google Signals is ever enabled in GA,
  // flip ad_user_data + ad_personalization to 'granted' here AND update the
  // privacy policy first (see GA4-consent-and-google-signals-summary.md).
  window.gtag('consent', 'update', {
    analytics_storage: 'granted',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}

export function disableAnalytics(): void {
  if (typeof window.gtag !== 'function') return;
  window.gtag('consent', 'update', {
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}

function trackPageView(path: string) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', { page_path: path, page_title: document.title });
}

export function useAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (getConsent() === 'all') enableAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);
}
