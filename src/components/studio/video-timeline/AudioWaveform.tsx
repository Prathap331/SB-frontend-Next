'use client';

import { memo, useMemo } from 'react';

type Props = {
  peaks?: number[];
  className?: string;
};

/** Lightweight SVG waveform from normalized peaks (0–1). */
export const AudioWaveform = memo(function AudioWaveform({ peaks, className }: Props) {
  const path = useMemo(() => {
    const data =
      peaks && peaks.length > 1
        ? peaks
        : Array.from({ length: 48 }, (_, i) => 0.25 + 0.55 * Math.abs(Math.sin(i * 0.55)));
    const w = 100;
    const h = 100;
    const step = w / (data.length - 1);
    let d = `M 0 ${h / 2}`;
    data.forEach((p, i) => {
      const x = i * step;
      const amp = Math.max(0.05, Math.min(1, p)) * (h * 0.42);
      d += ` L ${x} ${h / 2 - amp}`;
    });
    for (let i = data.length - 1; i >= 0; i--) {
      const x = i * step;
      const amp = Math.max(0.05, Math.min(1, data[i])) * (h * 0.42);
      d += ` L ${x} ${h / 2 + amp}`;
    }
    d += ' Z';
    return d;
  }, [peaks]);

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className ?? 'h-full w-full opacity-70'}
      aria-hidden
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
});
