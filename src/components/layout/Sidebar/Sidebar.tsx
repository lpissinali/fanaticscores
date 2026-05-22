import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import styles from './Sidebar.module.css';
import FSLogo from '../../shared/FSLogo/FSLogo';
import Icon from '../../shared/Icon/Icon';
import Crest from '../../shared/Crest/Crest';
import ScheduleModal from '../../shared/ScheduleModal/ScheduleModal';
import { useAllFollowed } from '../../../lib/useFollowing';
import type { SupportedLocale } from '../../../i18n';

interface NavItem {
  id: string;
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  path: string;
  accent?: boolean;
}

interface SidebarProps {
  locale: SupportedLocale;
  onScheduleClick?: () => void;
  /** Live match count shown on the Live button (defaults to 0 when not provided) */
  liveCount?: number;
  activeFilter?: 'all' | 'live';
  onFilterChange?: (f: 'all' | 'live') => void;
}

export default function Sidebar({ locale, onScheduleClick, liveCount, activeFilter = 'all', onFilterChange }: SidebarProps) {
  const followedTeams = useAllFollowed();
  const [showSchedule, setShowSchedule] = useState(false);
  const navigate = useNavigate();

  const navItems: NavItem[] = [
    { id: 'today',        label: 'Today',        icon: 'home',     path: `/${locale}/` },
    { id: 'schedule',     label: 'Schedule',     icon: 'calendar', path: `/${locale}/schedule` },
    { id: 'competitions', label: 'Competitions', icon: 'trophy',   path: `/${locale}/competitions` },
    { id: 'following',    label: 'Following',    icon: 'star',     path: `/${locale}/following` },
    { id: 'studio',       label: 'Share Studio', icon: 'sparkles', path: `/${locale}/studio`, accent: true },
  ];

  return (
    <>
    <aside className={styles.sidebar}>
      <NavLink to={`/${locale}/`} className={styles.logoLink}>
        <FSLogo size={36} showWordmark />
      </NavLink>

      <nav className={styles.nav} aria-label="Main navigation">
        {navItems.map((item) => (
          <div key={item.id}>
            <NavLink
              to={item.path}
              end={item.id === 'today'}
              onClick={item.id === 'schedule'
                ? (e) => { e.preventDefault(); if (onScheduleClick) onScheduleClick(); else setShowSchedule(true); }
                : undefined
              }
              className={({ isActive }) =>
                [styles.navItem, isActive && item.id !== 'schedule' ? styles.active : '', item.accent ? styles.accentItem : '']
                  .filter(Boolean).join(' ')
              }
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </NavLink>

            {/* Live filter button — always visible under Today */}
            {item.id === 'today' && (
              <button
                className={[styles.navItem, styles.navButton, activeFilter === 'live' ? styles.active : ''].filter(Boolean).join(' ')}
                onClick={() => {
                  if (onFilterChange) {
                    onFilterChange(activeFilter === 'live' ? 'all' : 'live');
                  } else {
                    navigate(`/${locale}/`);
                  }
                }}
                aria-pressed={activeFilter === 'live'}
              >
                <Icon name="zap" size={16} />
                Live
                <span className={styles.navBadge}>{liveCount ?? 0}</span>
              </button>
            )}
          </div>
        ))}
      </nav>

      {followedTeams.length > 0 && (
        <div className={styles.following}>
          <span className={styles.followLabel}>Following</span>
          {followedTeams.map((team) => (
            team.id ? (
              <NavLink key={team.name} to={`/${locale}/team/${team.id}`} className={({ isActive }) =>
                [styles.followRow, isActive ? styles.followRowActive : ''].filter(Boolean).join(' ')
              }>
                <Crest team={team} size="md" />
                <span className={styles.followName}>{team.name}</span>
              </NavLink>
            ) : (
              <div key={team.name} className={styles.followRow}>
                <Crest team={team} size="md" />
                <span className={styles.followName}>{team.name}</span>
              </div>
            )
          ))}
        </div>
      )}
    </aside>

    {showSchedule && (
      <ScheduleModal locale={locale} onClose={() => setShowSchedule(false)} />
    )}
    </>
  );
}
