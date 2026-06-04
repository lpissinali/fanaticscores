'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
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
  liveCount?: number;
  activeFilter?: 'all' | 'live';
  onFilterChange?: (f: 'all' | 'live') => void;
}

export default function Sidebar({ locale, onScheduleClick, liveCount, activeFilter = 'all', onFilterChange }: SidebarProps) {
  const followedTeams = useAllFollowed();
  const [showSchedule, setShowSchedule] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  const navItems: NavItem[] = [
    { id: 'today',        label: 'Today',        icon: 'home',     path: `/${locale}/today` },
    { id: 'schedule',     label: 'Schedule',     icon: 'calendar', path: `/${locale}/schedule` },
    { id: 'competitions', label: 'Competitions', icon: 'trophy',   path: `/${locale}/competitions` },
    { id: 'following',    label: 'Following',    icon: 'star',     path: `/${locale}/following` },
    { id: 'studio',       label: 'Share Studio', icon: 'sparkles', path: `/${locale}/studio`, accent: true },
  ];

  function isActive(item: NavItem): boolean {
    if (item.id === 'today') return pathname === `/${locale}/today` || pathname === `/${locale}/`;
    return pathname.startsWith(item.path);
  }

  return (
    <>
      <aside className={styles.sidebar}>
        <Link href={`/${locale}/today`} className={styles.logoLink}>
          <FSLogo size={36} showWordmark />
        </Link>

        <nav className={styles.nav} aria-label="Main navigation">
          {navItems.map((item) => (
            <div key={item.id}>
              {item.id === 'schedule' ? (
                <button
                  className={[styles.navItem, styles.navButton, item.accent ? styles.accentItem : ''].filter(Boolean).join(' ')}
                  onClick={() => { if (onScheduleClick) onScheduleClick(); else setShowSchedule(true); }}
                >
                  <Icon name={item.icon} size={16} />
                  {item.label}
                </button>
              ) : (
                <Link
                  href={item.path}
                  className={[styles.navItem, isActive(item) ? styles.active : '', item.accent ? styles.accentItem : ''].filter(Boolean).join(' ')}
                >
                  <Icon name={item.icon} size={16} />
                  {item.label}
                </Link>
              )}

              {item.id === 'today' && (
                <button
                  className={[styles.navItem, styles.navButton, activeFilter === 'live' ? styles.active : ''].filter(Boolean).join(' ')}
                  onClick={() => {
                    if (onFilterChange) onFilterChange(activeFilter === 'live' ? 'all' : 'live');
                    else router.push(`/${locale}/today`);
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

        {mounted && followedTeams.length > 0 && (
          <div className={styles.following}>
            <span className={styles.followLabel}>Following</span>
            {followedTeams.map((team) =>
              team.id ? (
                <Link
                  key={team.name}
                  href={`/${locale}/team/${team.id}`}
                  className={[
                    styles.followRow,
                    pathname.startsWith(`/${locale}/team/${team.id}`) ? styles.followRowActive : '',
                  ].filter(Boolean).join(' ')}
                >
                  <Crest team={team} size="md" />
                  <span classNa