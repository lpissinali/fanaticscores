/**
 * CookieBanner — GDPR / ePrivacy consent notice.
 *
 * Fanatic Scores uses localStorage (performance caching) and Firebase
 * operational cookies only — no advertising or tracking. The banner records
 * the user's choice in localStorage under the key `fs_consent`.
 *
 * Values:
 *   'all'       — user accepted all storage (same as essential-only in practice)
 *   'essential' — user chose essential only
 *
 * The banner is shown until a choice is made. Dismissing counts as 'essential'.
 */
import { useState, useEffect } from 'react';
import { enableAnalytics, disableAnalytics } from '../../../lib/useAnalytics';
import { Link } from 'react-router-dom';

const CONSENT_KEY = 'fs_consent';

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

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Delay slightly so it doesn't flash during hydration
    const t = setTimeout(() => {
      if (getConsent() === null) setVisible(true);
    }, 600);
    return () => clearTimeout(t);
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
          to="/en/cookies"
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
