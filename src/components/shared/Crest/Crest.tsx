import styles from './Crest.module.css';

type CrestSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

const SIZE_MAP: Record<CrestSize, { px: number; fs: number }> = {
  sm:  { px: 16, fs: 8  },
  md:  { px: 20, fs: 10 },
  lg:  { px: 28, fs: 12 },
  xl:  { px: 44, fs: 16 },
  xxl: { px: 64, fs: 22 },
};

/** Auto-contrast: returns black or white for a given hex color background. */
function contrastColor(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#111' : '#fff';
}

interface CrestProps {
  /** Team object or raw values */
  team: { initial: string; color: string; name?: string };
  size?: CrestSize;
  className?: string;
}

/**
 * Circular team crest placeholder — colored circle with the team initial.
 * Replace with real SVG crests in production.
 */
export default function Crest({ team, size = 'md', className }: CrestProps) {
  const { px, fs } = SIZE_MAP[size];
  return (
    <span
      className={[styles.crest, className].filter(Boolean).join(' ')}
      style={{
        width: px,
        height: px,
        fontSize: fs,
        backgroundColor: team.color,
        color: contrastColor(team.color),
      }}
      title={team.name}
      aria-label={team.name}
    >
      {team.initial}
    </span>
  );
}
