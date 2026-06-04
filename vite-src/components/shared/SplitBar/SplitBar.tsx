import styles from './SplitBar.module.css';

interface SplitBarProps {
  label: string;
  homeValue: number;
  awayValue: number;
  homeColor?: string;
  awayColor?: string;
  /** If true, values are percentages (shown as-is). If false, totals to 100%. Default true. */
  isPercent?: boolean;
}

/**
 * Horizontal split bar — home value (left) and away value (right)
 * with a proportional fill and team colors.
 */
export default function SplitBar({
  label,
  homeValue,
  awayValue,
  homeColor = 'var(--orange)',
  awayColor = 'var(--live)',
  isPercent = false,
}: SplitBarProps) {
  const total = homeValue + awayValue;
  const homePct = total > 0 ? (homeValue / total) * 100 : 50;
  const awayPct = 100 - homePct;

  const displayHome = isPercent ? `${homeValue}%` : homeValue;
  const displayAway = isPercent ? `${awayValue}%` : awayValue;

  return (
    <div className={styles.root}>
      <span className={styles.valHome}>{displayHome}</span>
      <div className={styles.track}>
        <div
          className={styles.fillHome}
          style={{ width: `${homePct}%`, background: homeColor, opacity: 0.7 }}
        />
        <div
          className={styles.fillAway}
          style={{ width: `${awayPct}%`, background: awayColor, opacity: 0.7 }}
        />
      </div>
      <span className={styles.valAway}>{displayAway}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
