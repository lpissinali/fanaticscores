import { useRef } from 'react';
import styles from './MomentumGraph.module.css';

interface MomentumGraphProps {
  /**
   * Array of values in range -1..1 (or 0..100 home-pressure).
   * Positive = home pressure, negative = away pressure.
   * The mock data uses 0..100 scale; values are normalised internally.
   */
  series: number[];
  height?: number;
  className?: string;
}

/**
 * Sparkline-style momentum / pressure graph.
 * Area fills: orange tint above midline (home), red tint below (away).
 * Animates in via stroke-dashoffset draw.
 */
export default function MomentumGraph({
  series,
  height = 40,
  className,
}: MomentumGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 200; // internal SVG units — scales via viewBox

  if (!series || series.length < 2) return null;

  // Normalise values to 0..1 (handle both -1..1 and 0..100 inputs)
  const max = Math.max(...series);
  const normalised = max > 1
    ? series.map((v) => v / 100)   // 0..100 scale
    : series.map((v) => (v + 1) / 2); // -1..1 scale

  const step = width / (normalised.length - 1);
  const mid = height / 2;

  const points = normalised.map((v, i) => ({
    x: i * step,
    y: height - v * height,
  }));

  // Build smooth polyline path
  const linePath = points
    .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
    .join(' ');

  // Area fills (home = above midline, away = below)
  const homeArea =
    `M${points[0].x},${mid} ` +
    points.map((p) => `L${p.x},${Math.min(p.y, mid)}`).join(' ') +
    ` L${points[points.length - 1].x},${mid} Z`;

  const awayArea =
    `M${points[0].x},${mid} ` +
    points.map((p) => `L${p.x},${Math.max(p.y, mid)}`).join(' ') +
    ` L${points[points.length - 1].x},${mid} Z`;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={[styles.root, className].filter(Boolean).join(' ')}
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mg-home" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--orange)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--orange)" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="mg-away" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"   stopColor="var(--live)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--live)" stopOpacity="0.04" />
        </linearGradient>
      </defs>

      {/* Midline */}
      <line
        x1="0" y1={mid}
        x2={width} y2={mid}
        stroke="var(--border-strong)"
        strokeWidth="0.5"
      />

      {/* Area fills */}
      <path d={homeArea} fill="url(#mg-home)" />
      <path d={awayArea} fill="url(#mg-away)" />

      {/* Stroke line */}
      <path
        d={linePath}
        fill="none"
        stroke="var(--orange)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={styles.line}
      />
    </svg>
  );
}
