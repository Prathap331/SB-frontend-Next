import { EDITOR_FPS } from './fps';

function asFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export type TrackWindowSeconds = {
  start: number;
  end: number;
  duration: number;
};

/** Audio tracks: scene-local seconds from `start_sec` / `end_sec`. */
export function audioWindowSeconds(raw: unknown): TrackWindowSeconds | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const start = asFiniteNumber(rec.start_sec) ?? asFiniteNumber(rec.startSec);
  const end = asFiniteNumber(rec.end_sec) ?? asFiniteNumber(rec.endSec);
  if (start == null || end == null || end <= start) return null;
  return { start: Math.max(0, start), end, duration: Math.max(0.1, end - start) };
}

/**
 * B-roll and animation tracks: scene-local seconds from `startFrame` / `endFrame`
 * at the editor FPS (30).
 */
export function frameWindowSeconds(
  raw: unknown,
  fps: number = EDITOR_FPS,
): TrackWindowSeconds | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const startF = asFiniteNumber(rec.startFrame) ?? asFiniteNumber(rec.start_frame);
  const endF = asFiniteNumber(rec.endFrame) ?? asFiniteNumber(rec.end_frame);
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : EDITOR_FPS;
  if (startF == null || endF == null || endF <= startF) return null;
  const start = startF / safeFps;
  const end = endF / safeFps;
  return { start: Math.max(0, start), end, duration: Math.max(0.1, end - start) };
}

export function hasFrameWindow(raw: unknown): boolean {
  return frameWindowSeconds(raw) != null;
}

/**
 * Map a project-absolute time onto a 0-based scene timeline.
 * If `time` is already scene-local (before the origin), it is left as-is.
 */
export function toSceneLocalSeconds(time: number, origin: number): number {
  if (!Number.isFinite(time)) return 0;
  const start = Number.isFinite(origin) && origin > 0.05 ? origin : 0;
  if (start > 0 && time >= start - 0.05) return Math.max(0, time - start);
  return Math.max(0, time);
}
