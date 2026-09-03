'use client';

import { memo } from 'react';
import { buildRulerMarks, rulerMajorInterval } from '@/lib/video-editor/math';
import { formatRulerLabel } from '@/lib/video-editor/timecode';

type Props = {
  duration: number;
  pixelsPerSecond: number;
  width: number;
  timeOrigin?: number;
  onSeek: (time: number) => void;
};

export const TimelineRuler = memo(function TimelineRuler({
  duration,
  pixelsPerSecond,
  width,
  timeOrigin = 0,
  onSeek,
}: Props) {
  const major = rulerMajorInterval(pixelsPerSecond);
  const marks = buildRulerMarks(duration, pixelsPerSecond);

  return (
    <div
      className="relative h-7 cursor-pointer border-b border-gray-200 bg-[#fafafa]"
      style={{ width }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const sec = Math.max(0, (e.clientX - rect.left) / pixelsPerSecond);
        onSeek(sec);
      }}
      role="presentation"
    >
      {marks.map((t) => (
        <span
          key={t}
          className="absolute top-0 h-full border-l border-gray-200 pl-1 text-[10px] tabular-nums text-[#a1a1a6]"
          style={{ left: t * pixelsPerSecond }}
        >
          {formatRulerLabel(t + timeOrigin, major)}
        </span>
      ))}
    </div>
  );
});
