'use client';
import { useState } from 'react';
import styles from './Crest.module.css';

type CrestSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

const SIZE_MAP: Record<CrestSize, { px: number; fs: number }> = {
  sm:  { px: 18,  fs: 8  },
  md:  { px: 20,  fs: 10 },
  lg:  { px: 36,  fs: 13 },
  xl:  { px: 52,  fs: 17 },
  xxl: { px: 72,  fs: 24 },
};

function contrastColor(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#111' : '#fff';
}

interface CrestProps {
  team: { initial: string; color: string; name?: string; crest?: string };
  size?: CrestSize;
  className?: string;
}

export default function Crest({ team, size = 'md', className }: CrestProps) {
  const { px, fs } = SIZE_MAP[size];
  const [imgError, setImgError] = useState(false);
  const showImg = !!team.crest && !imgError;

  return (
    <span
      className={[styles.crest, className].filter(Boolean).join(' ')}
      style={{
        width: px,
        height: px,
        fontSize: fs,
        backgroundColor: showImg ? 'transparent' : team.color,
        color: contrastColor(team.color),
      }}
      title={team.name}
      aria-label={team.name}
    >
      {showImg ? (
        <img
          src={team.crest}
          alt={team.name ?? ''}
          width={px}
          height={px}
          onError={() => setImgError(true)}
          style={{ objectFit: 'contain', display: 'block' }}
        />
      ) : (
        team.initial
      )}
    </span>
  );
}
