/** Timecode helpers for the video editor. */

export function formatTimecode(sec: number): string {
  const safe = Number.isFinite(sec) ? Math.max(0, sec) : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.round((safe % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

export function formatTimecodeShort(sec: number): string {
  const safe = Number.isFinite(sec) ? Math.max(0, sec) : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatRulerLabel(sec: number, majorInterval: number): string {
  if (majorInterval < 1) return formatTimecode(sec);
  return formatTimecodeShort(sec);
}
