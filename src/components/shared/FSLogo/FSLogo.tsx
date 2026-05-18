import styles from './FSLogo.module.css';

interface FSLogoProps {
  /** Pixel height of the mark image. Width scales automatically. Default 44 */
  size?: number;
  /** When true uses the light (dark-F) mark — for light backgrounds */
  light?: boolean;
  /** Show the FANATIC / SCORES wordmark beside the mark. Default true */
  showWordmark?: boolean;
  className?: string;
}

/**
 * Fanatic Scores primary logo lockup.
 * Mark + optional Saira-italic wordmark (desktop sidebar variant).
 */
export default function FSLogo({
  size = 44,
  light = false,
  showWordmark = false,
  className,
}: FSLogoProps) {
  const markSrc = light ? '/assets/logo-mark-light.png' : '/assets/logo-mark-dark.png';

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <img
        src={markSrc}
        alt="Fanatic Scores"
        height={size}
        style={{ height: size, width: 'auto' }}
        className={styles.mark}
      />
      {showWordmark && (
        <div className={styles.wordmark} style={{ fontSize: size * 0.27 }}>
          <span className={styles.line1}>FANATIC</span>
          <span className={styles.line2}>SCORES</span>
        </div>
      )}
    </div>
  );
}
