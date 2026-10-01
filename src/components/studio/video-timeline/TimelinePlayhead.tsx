'use client';

import { memo, useLayoutEffect, useRef } from 'react';

type Props = {
  time: number;
  pixelsPerSecond: number;
  height: number;
  onPointerDown?: (e: React.PointerEvent) => void;
  nodeRef?: React.Ref<HTMLDivElement>;
  /** When false, position is driven imperatively (playback / drag). */
  followProps?: boolean;
};

export const TimelinePlayhead = memo(function TimelinePlayhead({
  time,
  pixelsPerSecond,
  height,
  onPointerDown,
  nodeRef,
  followProps = true,
}: Props) {
  const localRef = useRef<HTMLDivElement | null>(null);

  const setRefs = (el: HTMLDivElement | null) => {
    localRef.current = el;
    if (typeof nodeRef === 'function') nodeRef(el);
    else if (nodeRef) (nodeRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (el) el.style.transform = `translate3d(${time * pixelsPerSecond}px, 0, 0)`;
  };

  useLayoutEffect(() => {
    if (!followProps) return;
    const el = localRef.current;
    if (el) el.style.transform = `translate3d(${time * pixelsPerSecond}px, 0, 0)`;
  }, [followProps, pixelsPerSecond, time]);

  return (
    <div
      ref={setRefs}
      className="pointer-events-none absolute top-0 left-0 z-20 will-change-transform"
      style={{ height }}
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
