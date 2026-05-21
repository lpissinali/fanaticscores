import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './MobileBottomNav.module.css';
import Icon from '../Icon/Icon';
import SearchModal from '../SearchModal/SearchModal';
import type { SupportedLocale } from '../../../i18n';

interface MobileBottomNavProps {
  locale: SupportedLocale;
  activeTab?: 'home' | 'comp' | 'follow';
}

const TABS = [
  { id: 'home',   label: 'Today',        icon: 'home'     as const },
  { id: 'comp',   label: 'Competitions', icon: 'trophy'   as const },
  { id: 'share',  label: 'Share',        icon: 'sparkles' as const, accent: true },
  { id: 'follow', label: 'Following',    icon: 'star'     as const },
  { id: 'search', label: 'Search',       icon: 'search'   as const },
];

export default function MobileBottomNav({ locale, activeTab }: MobileBottomNavProps) {
  const navigate = useNavigate();
  const [showSearch, setShowSearch] = useState(false);

  return (
    <>
      <nav className={styles.bottomTabs} aria-label="Main navigation">
        {TABS.map((t) =>
          t.accent ? (
            <Link key={t.id} to={`/${locale}/studio`} className="fs-btn" style={{
              flexDirection: 'column', gap: 2, height: 50, padding: 0,
              borderColor: 'transparent', background: 'var(--orange)', color: '#1a0d04',
              textDecoration: 'none',
            }}>
              <Icon name={t.icon} size={20} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em' }}>{t.label}</span>
            </Link>
          ) : (
            <button key={t.id} className="fs-btn ghost"
              onClick={
                t.id === 'search' ? () => setShowSearch(true) :
                t.id === 'home'   ? () => navigate(`/${locale}/today`) :
                t.id === 'comp'   ? () => navigate(`/${locale}/competitions`) :
                undefined
              }
              style={{
                flexDirection: 'column', gap: 4, height: 50, padding: 0,
                borderColor: 'transparent',
                color: t.id === activeTab ? 'var(--text)' : 'var(--text-faint)',
              }}
            >
              <Icon name={t.icon} size={20} />
              <span style={{ fontSize: 10, fontWeight: 600 }}>{t.label}</span>
            </button>
          )
        )}
      </nav>
      {showSearch && <SearchModal locale={locale} onClose={() => setShowSearch(false)} />}
    </>
  );
}
