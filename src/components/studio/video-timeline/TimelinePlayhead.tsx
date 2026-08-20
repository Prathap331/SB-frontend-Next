'use client';

import { memo } from 'react';

type Props = {
  time: number;
  pixelsPerSecond: number;
  height: number;
  onPointerDown?: (e: React.PointerEvent) => void;
};

export const TimelinePlayhead = memo(function TimelinePlayhead({
  time,
  pixelsPerSecond,
  height,
  onPointerDown,
}: Props) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-20"
      style={{ left: time * pixelsPerSecond, height }}
    >
      <div
        className="pointer-events-auto absolute -left-1.5 top-0 z-30 h-3 w-3 cursor-ew-resize touch-none rounded-sm bg-amber-500"
        onPointerDown={onPointerDown}
        title="Drag playhead"
      />
      <div className="absolute left-0 top-0 h-full w-0.5 bg-amber-500" />
    </div>
  );
});
