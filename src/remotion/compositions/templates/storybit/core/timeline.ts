/**
 * Beat-synced timing (pure).
 *
 * Every Storybit template runs 3–8 seconds (90–240 frames @ 30fps) — the length of the voice beat
 * it covers. Elements enter in order; each can be pinned to a cue time (seconds from the start of the
 * template, e.g. when the narrator says the matching word, taken from WhisperX timestamps).
 * Uncued elements keep their natural spacing. If everything doesn't fit before the hold + exit,
 * the whole entrance is compressed proportionally, so any duration in range works.
 */
export const FPS = 30;
export const MIN_FRAMES = 90; // 3s
export const MAX_FRAMES = 240; // 8s
export const MIN_HOLD = 12; // everything is fully visible for at least 0.4s before the exit
export const MIN_ANIM = 6; // no element animates faster than 0.2s

export const clampDuration = (frames: number) => Math.max(MIN_FRAMES, Math.min(MAX_FRAMES, Math.round(frames)));
export const exitFrames = (duration: number) => (duration >= 120 ? 10 : 8);

export type Unit = {
  key: string;
  label: string;
  /** Natural start (frames) if nothing is cued. */
  start: number;
  /** Natural animation length (frames). */
  dur: number;
  /** Index into cue_times this unit follows (omit for decorative units that just follow their anchor). */
  cue?: number;
  /** Decorative units follow another unit: start = anchor.start + offset × scale. */
  follows?: { key: string; offset: number };
};

export type Window = { key: string; label: string; start: number; dur: number; cue?: number; follows?: string };

export type Plan = {
  duration: number;
  windows: Record<string, Window>;
  list: Window[];
  exit: { start: number; dur: number };
  /** Compression applied to the entrance (1 = natural speed). */
  scale: number;
  cued: boolean;
};

/**
 * @param duration   actual clip length in frames (clamped to 3–8s for planning)
 * @param units      elements in reveal order
 * @param cueTimes   optional seconds from template start, indexed by Unit.cue
 */
export function planTimeline(duration: number, units: Unit[], cueTimes?: number[]): Plan {
  const D = Math.max(1, Math.round(duration));
  const exitDur = exitFrames(clampDuration(D));
  const exitStart = D - exitDur;
  const budget = Math.max(MIN_ANIM * 2, exitStart - MIN_HOLD);
  const cues = (cueTimes ?? []).map((s) => (Number.isFinite(s) ? Math.max(0, s * FPS) : NaN));
  const cued = cues.some((c) => Number.isFinite(c));

  // 1) place primary units: cued ones at their cue, uncued ones keep natural spacing from the previous unit
  const starts: Record<string, number> = {};
  let prevNatural = 0;
  let prevPlaced = 0;
  for (const u of units) {
    if (u.follows) continue;
    const cue = u.cue !== undefined ? cues[u.cue] : NaN;
    let s = Number.isFinite(cue) ? cue : prevPlaced + (u.start - prevNatural);
    s = Math.max(s, prevPlaced === 0 && Object.keys(starts).length === 0 ? 0 : prevPlaced + 2);
    starts[u.key] = s;
    prevNatural = u.start;
    prevPlaced = s;
  }

  // 2) decorative units follow their anchor
  for (const u of units) {
    if (!u.follows) continue;
    const a = starts[u.follows.key];
    starts[u.key] = Math.max(0, (a ?? u.start) + (a !== undefined ? u.follows.offset : 0));
  }

  // 3) compress the whole entrance proportionally if it would run into the hold/exit
  const end = Math.max(1, ...units.map((u) => starts[u.key] + u.dur));
  const scale = end > budget ? budget / end : 1;

  const windows: Record<string, Window> = {};
  for (const u of units) {
    const dur = Math.max(MIN_ANIM, Math.round(u.dur * scale));
    const start = Math.max(0, Math.min(Math.round(starts[u.key] * scale), budget - dur));
    windows[u.key] = { key: u.key, label: u.label, start, dur, cue: u.cue, follows: u.follows?.key };
  }

  return {
    duration: D,
    windows,
    list: units.map((u) => windows[u.key]),
    exit: { start: exitStart, dur: exitDur },
    scale,
    cued,
  };
}

/** Read cue times from props: `cue_times` (seconds) or `cue_frames`. */
export function readCues(props: Record<string, unknown>): number[] | undefined {
  const toNums = (v: unknown) => (Array.isArray(v) ? v.map((x) => (typeof x === 'number' ? x : typeof x === 'string' && x.trim() ? Number(x) : NaN)) : undefined);
  const secs = toNums(props.cue_times);
  if (secs && secs.some(Number.isFinite)) return secs;
  const frames = toNums(props.cue_frames);
  if (frames && frames.some(Number.isFinite)) return frames.map((f) => f / FPS);
  return undefined;
}
