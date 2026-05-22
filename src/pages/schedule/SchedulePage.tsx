import { useState } from 'react';
import styles from './SchedulePage.module.css';
import type { SupportedLocale } from '../../i18n';
import type { Competition, Match } from '../../lib/types';
import { useMatches } from '../../lib/useMatches';

import Sidebar from '../../components/layout/Sidebar/Sidebar';
import RailPromo from '../../components/shared/RailPromo/RailPromo';
import Calendar from '../../components/shared/Calendar/Calendar';
import MatchRow from '../../components/shared/MatchRow/MatchRow';
import Icon from '../../components/shared/Icon/Icon';

interface SchedulePageProps {
  locale: SupportedLocale;
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  const today = toYMD(new Date());
  const tomorrow = toYMD(new Date(Date.now() + 86400000));
  const yesterday = toYMD(new Date(Date.now() - 86400000));
  if (ymd === today)     return 'Today';
  if (ymd === tomorrow)  return 'Tomorrow';
  if (ymd === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function CompBlock({ comp }: { comp: Competition }) {
  const handleClick = (_m: Match) => {};
  return (
    <div className={styles.compBlock}>
      <div className={styles.compHeader}>
        <div className="lh-title">
          <span className="lh-flag" style={{ backgroundColor: comp.flag }} aria-hidden="true" />
          {comp.name}
          {comp.stage && (
            <span className={styles.compStage}>&middot; {comp.stage}</span>
          )}
        </div>
        <Icon name="chevron-right" size={14} style={{ color: 'var(--text-faint)' }} />
      </div>
      {comp.matches.map(m => (
        <MatchRow key={m.id} match={m} onClick={handleClick} />
      ))}
    </div>
  );
}

export default function SchedulePage({ locale }: SchedulePageProps) {
  const [selectedDate, setSelectedDate] = useState(toYMD(new Date()));
  const { competitions, loading } = useMatches(selectedDate);

  const dateLabel = formatDateLabel(selectedDate);
  const eyebrow = new Date(selectedDate + 'T00:00:00')
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className={styles.page}>
      <Sidebar locale={locale} />

      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <div className={styles.eyebrow}>{eyebrow}</div>
          <h1 className={styles.pageTitle}>{dateLabel}</h1>
        </div>

        <div className={styles.content}>
          {/* Left: calendar */}
          <Calendar selected={selectedDate} onSelect={setSelectedDate} />

          {/* Right: match list */}
          <div className={styles.matchesCol}>
            {loading ? (
              <div className={styles.empty}>
                <span style={{ color: 'var(--text-faint)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
                  Loading matches&hellip;
                </span>
              </div>
            ) : competitions.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>&#128308;</div>
                <strong>No matches scheduled</strong>
                <span>Try another date or check back later.</span>
              </div>
            ) : (
              competitions.map(comp => <CompBlock key={comp.id} comp={comp} />)
            )}
          </div>
        </div>
      </main>

      <aside className={styles.rail}>
        <RailPromo locale={locale} />
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)', fontFamily: 'JetBrains Mono, monospace' }}>
          Quick jump
        </div>
        {[
          { label: 'Yesterday', offset: -1 },
          { label: 'Today',     offset:  0 },
          { label: 'Tomorrow',  offset:  1 },
          { label: 'This weekend', offset: null },
        ].map(({ label, offset }) => {
          let ymd: string;
          if (offset === null) {
            const d = new Date();
            const day = d.getDay();
            const daysUntilSat = (6 - day + 7) % 7 || 7;
            ymd = toYMD(new Date(Date.now() + daysUntilSat * 86400000));
          } else {
            ymd = toYMD(new Date(Date.now() + offset * 86400000));
          }
          return (
            <button
              key={label}
              onClick={() => setSelectedDate(ymd)}
              className="fs-btn ghost"
              style={{
                justifyContent: 'flex-start',
                height: 36,
                fontSize: 13,
                background: selectedDate === ymd ? 'var(--surface)' : 'transparent',
                borderColor: selectedDate === ymd ? 'var(--border)' : 'transparent',
              }}
            >
              {label}
            </button>
          );
        })}
      </aside>
    </div>
  );
}
