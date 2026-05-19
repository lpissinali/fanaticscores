import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ScheduleModal.module.css';
import Calendar from '../Calendar/Calendar';
import type { SupportedLocale } from '../../../i18n';

interface ScheduleModalProps {
  locale: SupportedLocale;
  onClose: () => void;
}

function toYMD(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

const TODAY     = () => toYMD(new Date());
const YESTERDAY = () => toYMD(new Date(Date.now() - 86400000));
const TOMORROW  = () => toYMD(new Date(Date.now() + 86400000));

const QUICK = [
  { label: 'Yesterday', ymd: YESTERDAY },
  { label: 'Today',     ymd: TODAY     },
  { label: 'Tomorrow',  ymd: TOMORROW  },
];

export default function ScheduleModal({ locale, onClose }: ScheduleModalProps) {
  const [selected] = useState(TODAY());
  const navigate = useNavigate();

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  function handleSelect(ymd: string) {
    const path = ymd === TODAY()
      ? `/${locale}/today`
      : `/${locale}/${ymd}`;
    navigate(path);
    onClose();
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Pick a date">
        <div className={styles.header}>
          <span className={styles.title}>Schedule</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className={styles.body}>
          <div className={styles.quickJump}>
            {QUICK.map(({ label, ymd }) => {
              const d = ymd();
              return (
                <button
                  key={label}
                  className={[styles.pill, selected === d ? styles.activePill : ''].join(' ')}
                  onClick={() => handleSelect(d)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <Calendar selected={selected} onSelect={handleSelect} />
        </div>
      </div>
    </div>
  );
}
