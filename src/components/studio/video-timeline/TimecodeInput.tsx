'use client';

import { useState } from 'react';
import { formatTimecode, parseTimecode } from '@/lib/video-editor/timecode';

export function TimecodeInput({
  time,
  duration,
  onSeek,
  className = '',
}: {
  time: number;
  duration: number;
  onSeek: (seconds: number) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const display = formatTimecode(time);

  const commit = () => {
    const parsed = parseTimecode(draft);
    setEditing(false);
    if (parsed == null) return;
    const max = Number.isFinite(duration) && duration > 0 ? duration : parsed;
    onSeek(Math.max(0, Math.min(max, parsed)));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      spellCheck={false}
      aria-label="Current time"
      title="Jump to a time (mm:ss.cs)"
      value={editing ? draft : display}
      onFocus={() => {
        setDraft(display);
        setEditing(true);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setEditing(false);
          e.currentTarget.blur();
        }
      }}
      className={`w-[8.6ch] rounded-lg border border-gray-200 bg-[#f5f5f7] px-2 py-1 text-center text-xs tabular-nums text-[#1d1d1f] outline-none focus:border-gray-400 focus:bg-white ${className}`}
    />
  );
}
