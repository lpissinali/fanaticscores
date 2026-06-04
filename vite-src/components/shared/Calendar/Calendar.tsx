import { useState } from 'react';
import styles from './Calendar.module.css';

interface CalendarProps {
  selected: string;       // YYYY-MM-DD
  onSelect: (date: string) => void;
}

function toYMD(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function buildGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  // Monday-based week: 0=Mon … 6=Sun
  const startPad = (first.getDay() + 6) % 7;
  const days: Date[] = [];
  for (let i = startPad; i > 0; i--)  days.push(new Date(year, month, 1 - i));
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  const tail = 42 - days.length;
  for (let d = 1; d <= tail; d++) days.push(new Date(year, month + 1, d));
  return days;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS   = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

export default function Calendar({ selected, onSelect }: CalendarProps) {
  const todayStr = toYMD(new Date());
  const selDate  = new Date(selected + 'T00:00:00');

  const [view, setView] = useState<{ year: number; month: number }>({
    year:  selDate.getFullYear(),
    month: selDate.getMonth(),
  });

  const { year, month } = view;
  const grid = buildGrid(year, month);

  const prev = () => setView(v => {
    const d = new Date(v.year, v.month - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const next = () => setView(v => {
    const d = new Date(v.year, v.month + 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <button className={styles.navBtn} onClick={prev} aria-label="Previous month">&#8249;</button>
        <span className={styles.monthLabel}>{MONTHS[month]} {year}</span>
        <button className={styles.navBtn} onClick={next} aria-label="Next month">&#8250;</button>
      </div>

      <div className={styles.weekdays}>
        {WEEKDAYS.map(d => <span key={d} className={styles.weekday}>{d}</span>)}
      </div>

      <div className={styles.grid}>
        {grid.map((d, i) => {
          const ymd        = toYMD(d);
          const isOther    = d.getMonth() !== month;
          const isToday    = ymd === todayStr;
          const isSelected = ymd === selected;
          const cls = [
            styles.day,
            isOther    ? styles.otherMonth : '',
            isToday    ? styles.today      : '',
            isSelected ? styles.selected   : '',
          ].filter(Boolean).join(' ');

          return (
            <button key={i} className={cls} onClick={() => onSelect(ymd)} aria-label={ymd}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
