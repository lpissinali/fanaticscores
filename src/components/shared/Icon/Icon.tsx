/**
 * Inline SVG icon set — single-stroke, 1.6px.
 * All icons use currentColor so they inherit from the parent.
 */

type IconName =
  | 'home'
  | 'calendar'
  | 'trophy'
  | 'star'
  | 'star-filled'
  | 'sparkles'
  | 'search'
  | 'share'
  | 'chevron-right'
  | 'chevron-left'
  | 'flame'
  | 'bell'
  | 'user'
  | 'x'
  | 'check'
  | 'copy'
  | 'arrow-right'
  | 'download'
  | 'zap';

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

const PATHS: Record<IconName, string> = {
  home:           'M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z M9 21V12h6v9',
  calendar:       'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  trophy:         'M8 21h8M12 17v4M5 3H3v4a5 5 0 005 5m8-9h2v4a5 5 0 01-5 5M7 3h10v6a5 5 0 01-5 5 5 5 0 01-5-5V3z',
  star:           'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  'star-filled':  'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  sparkles:       'M12 3v2M12 19v2M3 12H1M23 12h-2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 8a4 4 0 100 8 4 4 0 000-8z',
  search:         'M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z',
  share:          'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13',
  'chevron-right':'M9 18l6-6-6-6',
  'chevron-left': 'M15 18l-6-6 6-6',
  flame:          'M12 2c0 0-6 5.686-6 10a6 6 0 0012 0c0-4.314-6-10-6-10zM9.5 16.5c-.828 0-1.5-.895-1.5-2 0-2 2-4 2-4s2 2 2 4c0 1.105-.672 2-1.5 2z',
  bell:           'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
  user:           'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  x:              'M18 6L6 18M6 6l12 12',
  check:          'M20 6L9 17l-5-5',
  copy:           'M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2M8 4a2 2 0 002 2h4a2 2 0 002-2M8 4a2 2 0 012-2h4a2 2 0 012 2',
  'arrow-right':  'M5 12h14M12 5l7 7-7 7',
  download:       'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  zap:            'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
};

export default function Icon({
  name,
  size = 16,
  strokeWidth = 1.6,
  className,
  style,
}: IconProps) {
  const filled = name === 'star-filled';
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={filled ? 'currentColor' : 'none'}
      className={className}
      style={style}
      aria-hidden="true"
    >
      {PATHS[name].split('M').filter(Boolean).map((d, i) => (
        <path key={i} d={`M${d}`} />
      ))}
    </svg>
  );
}
