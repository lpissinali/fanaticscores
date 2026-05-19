import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';
import FSLogo from '../../shared/FSLogo/FSLogo';
import Icon from '../../shared/Icon/Icon';
import Crest from '../../shared/Crest/Crest';
import type { SupportedLocale } from '../../../i18n';

interface NavItem {
  id: string;
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  path: string;
  accent?: boolean;
}

interface FollowedTeam {
  name: string;
  initial: string;
  color: string;
}

interface SidebarProps {
  locale: SupportedLocale;
  followedTeams?: FollowedTeam[];
  onScheduleClick?: () => void;
}

export default function Sidebar({ locale, followedTeams = [], onScheduleClick }: SidebarProps) {
  const navItems: NavItem[] = [
    { id: 'today',        label: 'Today',        icon: 'home',     path: `/${locale}/` },
    { id: 'schedule',     label: 'Schedule',     icon: 'calendar', path: `/${locale}/schedule` },
    { id: 'competitions', label: 'Competitions', icon: 'trophy',   path: `/${locale}/competitions` },
    { id: 'following',    label: 'Following',    icon: 'star',     path: `/${locale}/following` },
    { id: 'studio',       label: 'Share Studio', icon: 'sparkles', path: `/${locale}/studio`, accent: true },
  ];

  return (
    <aside className={styles.sidebar}>
      <NavLink to={`/${locale}/`} className={styles.logoLink}>
        <FSLogo size={36} showWordmark />
      </NavLink>

      <nav className={styles.nav} aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.id === 'today'}
            onClick={item.id === 'schedule' && onScheduleClick
              ? (e) => { e.preventDefault(); onScheduleClick(); }
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
        ))}
      </nav>

      {followedTeams.length > 0 && (
        <div className={styles.following}>
          <span className={styles.followLabel}>Following</span>
          {followedTeams.map((team) => (
            <div key={team.name} className={styles.followRow}>
              <Crest team={team} size="md" />
              <span className={styles.followName}>{team.name}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
