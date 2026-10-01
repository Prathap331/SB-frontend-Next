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

/** Parse `MM:SS.cs`, `M:SS`, or a plain seconds value. Returns null if invalid. */
export function parseTimecode(value: string): number | null {
  const raw = value.trim().replace(',', '.');
  if (!raw) return null;
  const colon = raw.match(/^(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?$/);
  if (colon) {
    const minutes = Number(colon[1]);
    const seconds = Number(colon[2]);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) return null;
    const frac = colon[3] != null ? Number(colon[3].padEnd(2, '0').slice(0, 2)) / 100 : 0;
    if (!Number.isFinite(frac)) return null;
    return minutes * 60 + seconds + frac;
  }
  const plain = Number(raw);
  return Number.isFinite(plain) && plain >= 0 ? plain : null;
}
