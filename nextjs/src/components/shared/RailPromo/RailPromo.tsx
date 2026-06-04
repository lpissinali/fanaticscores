'use client';
import Link from 'next/link';
;
import Icon from '../Icon/Icon';

interface RailPromoProps { locale: string; }

export default function RailPromo({ locale }: RailPromoProps) {
  return (
    <div style={{
      padding: 18,
      borderRadius: 14,
      background: 'linear-gradient(140deg, rgba(252,128,3,0.22), rgba(252,128,3,0.04))',
      border: '1px solid var(--orange-line)',
      position: 'relative' as const,
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon name="sparkles" size={16} style={{ color: 'var(--orange)' }} />
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.14em',
          textTransform: 'uppercase' as const, color: 'var(--orange)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          New &middot; Share Studio
        </span>
      </div>
      <p style={{
        fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em',
        lineHeight: 1.15, margin: '0 0 14px', color: 'var(--text)',
      }}>
        Turn any moment into a card you will want to post.
      </p>
      <Link href={`/${locale}/studio`} className="fs-btn primary" style={{ height: 34, fontSize: 12, textDecoration: 'none' }}>
        Open Studio &rarr;
      </Link>
    </div>
  );
}
