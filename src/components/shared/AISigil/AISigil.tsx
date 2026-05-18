import styles from './AISigil.module.css';

interface AISigilProps {
  size?: number;
  className?: string;
}

/**
 * Animated sparkles glyph — brand mark for AI features.
 * Uses CSS animation for a subtle shimmer/pulse.
 */
export default function AISigil({ size = 16, className }: AISigilProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={[styles.sigil, className].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      {/* Large star */}
      <path
        d="M12 2 L13.5 9 L20 10.5 L13.5 12 L12 19 L10.5 12 L4 10.5 L10.5 9 Z"
        fill="var(--orange)"
        className={styles.starLarge}
      />
      {/* Small top-right star */}
      <path
        d="M19 2 L19.8 5 L22 5.8 L19.8 6.6 L19 9 L18.2 6.6 L16 5.8 L18.2 5 Z"
        fill="var(--orange)"
        opacity="0.7"
        className={styles.starSmall}
      />
      {/* Tiny bottom-left dot */}
      <circle cx="5" cy="18" r="1.2" fill="var(--orange)" opacity="0.5" />
    </svg>
  );
}
