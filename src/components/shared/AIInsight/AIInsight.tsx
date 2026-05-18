import styles from './AIInsight.module.css';
import AISigil from '../AISigil/AISigil';

interface AIInsightProps {
  title?: string;
  body: string;
  /** Show action buttons ("Ask anything" / "Tonight's read") */
  showActions?: boolean;
  className?: string;
}

/**
 * AI Pulse card — orange-tinted card with sparkles header and animated shimmer text.
 */
export default function AIInsight({
  title = 'AI Pulse',
  body,
  showActions = false,
  className,
}: AIInsightProps) {
  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <div className={styles.header}>
        <AISigil size={14} />
        <span className={styles.title}>{title}</span>
      </div>
      <p className={`${styles.body} ai-shimmer`}>{body}</p>
      {showActions && (
        <div className={styles.actions}>
          <button className="fs-btn ghost sm">Ask anything</button>
          <button className="fs-btn ghost sm">Tonight's read</button>
        </div>
      )}
    </div>
  );
}
