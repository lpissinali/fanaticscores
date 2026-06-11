'use client';
import Link from 'next/link';
/**
 * CookieBanner — GDPR / ePrivacy consent notice.
 *
 * Fanatic Scores uses localStorage (performance caching) and Firebase
 * operational cookies only — no advertising or tracking. The banner records
 * the user's choice in localStorage under the key `fs_consent`.
 *
 * Values:
 *   'all'       — user accepted all storage (enables GA4 analytics_storage)
 *   'essential' — user chose essential only (analytics stays denied)
 *
 * The banner stays visible until the user explicitly clicks one of the two
 * buttons — there is no passive dismiss, so no choice is ever assumed.
 * A stored choice can be changed later via openCookieSettings() (wired to
 * the footer "Cookie settings" link), as GDPR requires withdrawal to be as
 * easy as consent.
 */
import { useState, useEffect } from 'react';
import { enableAnalytics, disableAnalytics } from '../../../lib/useAnalytics';
;

const CONSENT_KEY = 'fs_consent';
const REOPEN_EVENT = 'fs-open-cookie-settings';

export type ConsentValue = 'all' | 'essential';

export function getConsent(): ConsentValue | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === 'all' || v === 'essential') return v;
  } catch { /* private browsing */ }
  return null;
}

function setConsent(value: ConsentValue) {
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* private browsing */ }
}

/**
 * Re-opens the consent banner so the user can change a previous choice
 * (GDPR requires consent to be as easy to withdraw/change as to give).
 * Call from anywhere client-side — e.g. the footer "Cookie settings" link.
 */
export function openCookieSettings(): void {
  window.dispatchEvent(new Event(REOPEN_EVENT));
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Delay slightly so it doesn't flash during hydration
    const t = setTimeout(() => {
      if (getConsent() === null) setVisible(true);
    }, 600);
    // Allow "Cookie settings" links to re-open the banner after a choice
    // was already stored.
    const reopen = () => setVisible(true);
    window.addEventListener(REOPEN_EVENT, reopen);
    return () => { clearTimeout(t); window.removeEventListener(REOPEN_EVENT, reopen); };
  }, []);

  if (!visible) return null;

  const accept = (value: ConsentValue) => {
    setConsent(value);
    if (value === 'all') enableAnalytics();
    else disableAnalytics();
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-modal="false"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        background: 'var(--surface, #1c1c26)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '16px 20px',
        display: 'flex', gap: 16,
        alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Text */}
      <p style={{
        margin: 0, flex: 1, minWidth: 240,
        fontSize: 13, lineHeight: 1.55,
        color: 'var(--text-dim, rgba(244,244,245,0.6))',
      }}>
        We use browser storage to cache match data and keep the app fast.
        No tracking, no ads.{' '}
        <Link
          href="/en/cookies"
          style={{ color: 'var(--orange, #fc8003)', textDecoration: 'none', fontWeight: 600 }}
        >
          Cookies policy
        </Link>
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => accept('essential')}
          style={{
            height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
            background: 'transparent', color: 'var(--text-faint, rgba(244,244,245,0.4))',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Essential only
        </button>
        <button
          onClick={() => accept('all')}
          style={{
            height: 34, padding: '0 18px', borderRadius: 8, border: 'none',
            background: 'var(--orange, #fc8003)', color: '#1a0d04',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Accept all
        </button>
      </div>
    </div>
  );
}
