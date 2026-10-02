'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { formatTimecode, parseTimecode } from '@/lib/video-editor/timecode';

export function TimecodeInput({
  time,
  duration,
  onSeek,
  className = '',
  liveTimeRef,
  isPlaying = false,
}: {
  time: number;
  duration: number;
  onSeek: (seconds: number) => void;
  className?: string;
  liveTimeRef?: MutableRefObject<number>;
  isPlaying?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (editing) return;
    const el = inputRef.current;
    if (!el) return;
    if (isPlaying && liveTimeRef) {
      let raf = 0;
      const tick = () => {
        const node = inputRef.current;
        if (node && document.activeElement !== node) {
          node.value = formatTimecode(liveTimeRef.current);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    el.value = formatTimecode(time);
  }, [time, isPlaying, editing, liveTimeRef]);

  const commit = (raw: string) => {
    setEditing(false);
    const parsed = parseTimecode(raw);
    if (parsed == null) {
      const el = inputRef.current;
      if (el) el.value = formatTimecode(liveTimeRef?.current ?? time);
      return;
    }
    const max = Number.isFinite(duration) && duration > 0 ? duration : parsed;
    onSeek(Math.max(0, Math.min(max, parsed)));
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      spellCheck={false}
      aria-label="Current time"
      title="Jump to a time (mm:ss.cs)"
      defaultValue={formatTimecode(time)}
      onFocus={() => setEditing(true)}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setEditing(false);
          if (inputRef.current) inputRef.current.value = formatTimecode(liveTimeRef?.current ?? time);
          e.currentTarget.blur();
        }
      }}
      className={`w-[8.6ch] rounded-lg border border-gray-200 bg-[#f5f5f7] px-2 py-1 text-center text-xs tabular-nums text-[#1d1d1f] outline-none focus:border-gray-400 focus:bg-white ${className}`}
    />
  );
}
