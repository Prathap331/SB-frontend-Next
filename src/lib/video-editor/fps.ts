/** Authoritative editor FPS — matches the studio preview chrome (`30fps`). */
export const EDITOR_FPS = 30;

export function framesToSeconds(frames: number, fps: number = EDITOR_FPS): number {
  if (!Number.isFinite(frames) || frames <= 0) return 0;
  if (!Number.isFinite(fps) || fps <= 0) return 0;
  return frames / fps;
}

export function secondsToFrame(seconds: number, fps: number = EDITOR_FPS): number {
  if (!Number.isFinite(seconds) || !Number.isFinite(fps) || fps <= 0) return 0;
  return Math.floor(seconds * fps);
}
