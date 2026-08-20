import {
  MIN_CLIP_DURATION,
  SNAP_THRESHOLD_PX,
  type TimelineClip,
  type TimelineState,
  type TimelineTrack,
} from './types';

export function roundTime(sec: number, precision = 100): number {
  if (!Number.isFinite(sec)) return 0;
  return Math.round(sec * precision) / precision;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function isValidClip(clip: TimelineClip): boolean {
  return (
    Boolean(clip.id) &&
    Boolean(clip.trackId) &&
    Number.isFinite(clip.start) &&
    clip.start >= 0 &&
    Number.isFinite(clip.duration) &&
    clip.duration >= MIN_CLIP_DURATION &&
    Number.isFinite(clip.sourceStart) &&
    clip.sourceStart >= 0 &&
    Number.isFinite(clip.sourceDuration) &&
    clip.sourceDuration >= MIN_CLIP_DURATION
  );
}

export function normalizeClip(clip: TimelineClip): TimelineClip {
  const duration = Math.max(MIN_CLIP_DURATION, roundTime(clip.duration));
  const sourceDuration = Math.max(MIN_CLIP_DURATION, roundTime(clip.sourceDuration || duration));
  let sourceStart = Math.max(0, roundTime(clip.sourceStart));
  const original = clip.originalSourceDuration;

  if (original != null && Number.isFinite(original) && original > 0) {
    sourceStart = clamp(sourceStart, 0, Math.max(0, original - MIN_CLIP_DURATION));
    const maxDur = Math.max(MIN_CLIP_DURATION, original - sourceStart);
    return {
      ...clip,
      start: Math.max(0, roundTime(clip.start)),
      duration: Math.min(duration, maxDur),
      sourceStart,
      sourceDuration: Math.min(sourceDuration, maxDur),
      originalSourceDuration: original,
    };
  }

  return {
    ...clip,
    start: Math.max(0, roundTime(clip.start)),
    duration,
    sourceStart,
    sourceDuration: Math.min(sourceDuration, duration),
  };
}

export function clampClipToSource(clip: TimelineClip): TimelineClip {
  return normalizeClip(clip);
}

export function calculateClipMove(
  clip: TimelineClip,
  deltaSeconds: number,
): Pick<TimelineClip, 'start'> {
  return {
    start: Math.max(0, roundTime(clip.start + deltaSeconds)),
  };
}

/**
 * Trim left edge: timeline start moves forward, sourceStart advances, duration shrinks.
 */
export function calculateTrimLeft(
  clip: TimelineClip,
  deltaSeconds: number,
): Pick<TimelineClip, 'start' | 'duration' | 'sourceStart' | 'sourceDuration'> {
  const maxTrim = Math.max(0, clip.duration - MIN_CLIP_DURATION);
  let trim = clamp(deltaSeconds, -clip.start, maxTrim);

  // Cannot trim past available source on the left.
  if (trim < 0) {
    // Expanding left: need source before sourceStart
    const expandable = clip.sourceStart;
    trim = Math.max(trim, -expandable);
  } else {
    const original = clip.originalSourceDuration;
    if (original != null) {
      const maxSourceAdvance = Math.max(0, original - clip.sourceStart - MIN_CLIP_DURATION);
      trim = Math.min(trim, maxSourceAdvance);
    }
  }

  const nextDuration = roundTime(clip.duration - trim);
  const nextSourceDuration = roundTime(clip.sourceDuration - trim);
  return {
    start: Math.max(0, roundTime(clip.start + trim)),
    duration: Math.max(MIN_CLIP_DURATION, nextDuration),
    sourceStart: Math.max(0, roundTime(clip.sourceStart + trim)),
    sourceDuration: Math.max(MIN_CLIP_DURATION, nextSourceDuration),
  };
}

/**
 * Trim right edge: only duration / sourceDuration change.
 */
export function calculateTrimRight(
  clip: TimelineClip,
  deltaSeconds: number,
): Pick<TimelineClip, 'duration' | 'sourceDuration'> {
  let nextDuration = roundTime(clip.duration + deltaSeconds);
  nextDuration = Math.max(MIN_CLIP_DURATION, nextDuration);

  const original = clip.originalSourceDuration;
  if (original != null && Number.isFinite(original)) {
    const maxDur = Math.max(MIN_CLIP_DURATION, original - clip.sourceStart);
    nextDuration = Math.min(nextDuration, maxDur);
  }

  return {
    duration: nextDuration,
    sourceDuration: nextDuration,
  };
}

export function splitClip(
  clip: TimelineClip,
  splitAtTimeline: number,
): { left: TimelineClip; right: TimelineClip } | null {
  const splitOffset = roundTime(splitAtTimeline - clip.start);
  if (splitOffset <= MIN_CLIP_DURATION || splitOffset >= clip.duration - MIN_CLIP_DURATION) {
    return null;
  }

  const leftDuration = splitOffset;
  const rightDuration = roundTime(clip.duration - splitOffset);

  const left: TimelineClip = normalizeClip({
    ...clip,
    id: `${clip.id}-a`,
    duration: leftDuration,
    sourceDuration: leftDuration,
  });

  const right: TimelineClip = normalizeClip({
    ...clip,
    id: `${clip.id}-b`,
    start: roundTime(clip.start + leftDuration),
    duration: rightDuration,
    sourceStart: roundTime(clip.sourceStart + leftDuration),
    sourceDuration: rightDuration,
  });

  return { left, right };
}

export function duplicateClip(clip: TimelineClip, newId: string): TimelineClip {
  return normalizeClip({
    ...clip,
    id: newId,
    start: roundTime(clip.start + clip.duration),
  });
}

export type SnapTarget = {
  time: number;
  kind: 'zero' | 'playhead' | 'clip-start' | 'clip-end' | 'scene' | 'marker' | 'grid';
};

export function collectSnapTargets(params: {
  currentTime: number;
  tracks: TimelineTrack[];
  excludeClipIds?: Set<string>;
  sceneBoundaries?: { start: number; end: number }[];
  gridInterval?: number;
  duration: number;
}): SnapTarget[] {
  const { currentTime, tracks, excludeClipIds, sceneBoundaries, gridInterval, duration } = params;
  const targets: SnapTarget[] = [
    { time: 0, kind: 'zero' },
    { time: currentTime, kind: 'playhead' },
  ];

  for (const track of tracks) {
    for (const clip of track.clips) {
      if (excludeClipIds?.has(clip.id)) continue;
      targets.push({ time: clip.start, kind: 'clip-start' });
      targets.push({ time: clip.start + clip.duration, kind: 'clip-end' });
    }
  }

  if (sceneBoundaries) {
    for (const b of sceneBoundaries) {
      targets.push({ time: b.start, kind: 'scene' });
      targets.push({ time: b.end, kind: 'scene' });
    }
  }

  if (gridInterval && gridInterval > 0) {
    for (let t = 0; t <= duration + gridInterval; t += gridInterval) {
      targets.push({ time: roundTime(t), kind: 'grid' });
    }
  }

  return targets;
}

export function snapTime(
  time: number,
  targets: SnapTarget[],
  pixelsPerSecond: number,
  thresholdPx = SNAP_THRESHOLD_PX,
  disabled = false,
): { time: number; snappedTo: SnapTarget | null } {
  if (disabled || pixelsPerSecond <= 0) {
    return { time: roundTime(Math.max(0, time)), snappedTo: null };
  }
  const thresholdSec = thresholdPx / pixelsPerSecond;
  let best: SnapTarget | null = null;
  let bestDist = Infinity;
  for (const t of targets) {
    const dist = Math.abs(t.time - time);
    if (dist <= thresholdSec && dist < bestDist) {
      bestDist = dist;
      best = t;
    }
  }
  if (!best) return { time: roundTime(Math.max(0, time)), snappedTo: null };
  return { time: roundTime(Math.max(0, best.time)), snappedTo: best };
}

export function recomputeTimelineDuration(tracks: TimelineTrack[], min = 1): number {
  let max = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      max = Math.max(max, clip.start + clip.duration);
    }
  }
  return Math.max(min, roundTime(max));
}

export function findClip(
  state: TimelineState,
  clipId: string,
): { track: TimelineTrack; clip: TimelineClip; trackIndex: number; clipIndex: number } | null {
  for (let ti = 0; ti < state.tracks.length; ti++) {
    const track = state.tracks[ti];
    const ci = track.clips.findIndex((c) => c.id === clipId);
    if (ci >= 0) {
      return { track, clip: track.clips[ci], trackIndex: ti, clipIndex: ci };
    }
  }
  return null;
}

export function updateClipInState(
  state: TimelineState,
  clipId: string,
  patch: Partial<TimelineClip>,
): TimelineState {
  const tracks = state.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) =>
      clip.id === clipId ? normalizeClip({ ...clip, ...patch }) : clip,
    ),
  }));
  return {
    ...state,
    tracks,
    duration: recomputeTimelineDuration(tracks, state.duration),
  };
}

export function replaceTrackClips(
  state: TimelineState,
  trackId: string,
  clips: TimelineClip[],
): TimelineState {
  const tracks = state.tracks.map((track) =>
    track.id === trackId ? { ...track, clips: clips.map(normalizeClip) } : track,
  );
  return {
    ...state,
    tracks,
    duration: recomputeTimelineDuration(tracks, state.duration),
  };
}

export function getActiveClipsAtTime(state: TimelineState, time: number): TimelineClip[] {
  const active: TimelineClip[] = [];
  for (const track of state.tracks) {
    if (!track.visible) continue;
    for (const clip of track.clips) {
      if (clip.hidden) continue;
      if (time >= clip.start && time < clip.start + clip.duration) {
        active.push(clip);
      }
    }
  }
  return active;
}

/** Adaptive major tick interval for the ruler (seconds). */
export function rulerMajorInterval(pixelsPerSecond: number): number {
  const targetPx = 80;
  const raw = targetPx / pixelsPerSecond;
  const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  for (const c of candidates) {
    if (c >= raw) return c;
  }
  return 300;
}

export function buildRulerMarks(duration: number, pixelsPerSecond: number): number[] {
  const major = rulerMajorInterval(pixelsPerSecond);
  const marks: number[] = [];
  const end = Math.max(duration, major);
  for (let t = 0; t <= end + major; t = roundTime(t + major)) {
    marks.push(t);
  }
  return marks;
}
