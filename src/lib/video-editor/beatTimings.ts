/**
 * Beat timings from the backend's `scenes[].directions` — used to bring the timeline back in
 * line after /move and /split, which also shift neighbouring beats (every word of a scene
 * belongs to exactly one beat, so cut points are shared) and snap cuts to word starts.
 */
import { isFullFramePlacement } from '@/remotion/placement';
import { DEFAULT_TRACK_IDS, type TimelineClip, type TimelineState } from './types';
import { recomputeTimelineDuration } from './math';

export type BeatTiming = {
  id: string;
  start: number;
  end: number;
  overlayStart: number | null;
  overlayEnd: number | null;
  fullScreen: boolean;
};

const EPS = 0.001;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function num(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function idOf(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** The scene record (`{ directions: [...] }`) for `sceneId` anywhere in a response / timeline. */
function findScene(raw: unknown, sceneId: string, depth = 0): Record<string, unknown> | null {
  const rec = asRecord(raw);
  if (!rec || depth > 4) return null;
  if (Array.isArray(rec.directions)) {
    const own = idOf(rec.id) || idOf(rec.scene_id);
    if (!own || own === sceneId) return rec;
  }
  if (Array.isArray(rec.scenes)) {
    const scenes = rec.scenes.map(asRecord).filter((s): s is Record<string, unknown> => Boolean(s));
    const match = scenes.find((s) => idOf(s.id) === sceneId || idOf(s.scene_id) === sceneId);
    if (match && Array.isArray(match.directions)) return match;
  }
  for (const key of ['scene', 'data', 'result', 'video', 'timeline']) {
    const found = findScene(rec[key], sceneId, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Beat timings of one scene, or null when the payload does not carry that scene. */
export function beatTimingsFromPayload(raw: unknown, sceneId: string): BeatTiming[] | null {
  const scene = findScene(raw, sceneId);
  if (!scene) return null;
  const out: BeatTiming[] = [];
  for (const item of scene.directions as unknown[]) {
    const dir = asRecord(item);
    if (!dir) continue;
    const id = idOf(dir.id) || idOf(dir.beat_id);
    const start = num(dir.start);
    const end = num(dir.end);
    if (!id || start == null || end == null || end <= start) continue;
    const overlayStart = num(dir.overlay_start);
    const overlayEnd = num(dir.overlay_end);
    const kind = String(dir.type ?? '').toLowerCase();
    out.push({
      id,
      start,
      end,
      overlayStart: overlayStart != null && overlayEnd != null && overlayEnd > overlayStart ? overlayStart : null,
      overlayEnd: overlayStart != null && overlayEnd != null && overlayEnd > overlayStart ? overlayEnd : null,
      fullScreen: kind.includes('full_screen') || kind.includes('fullscreen'),
    });
  }
  return out;
}

function isBrollClip(clip: TimelineClip): boolean {
  return clip.type === 'broll' || clip.trackId === DEFAULT_TRACK_IDS.broll;
}

function isOverlayClip(clip: TimelineClip): boolean {
  return clip.type === 'infographic' || clip.type === 'text';
}

/** Where a clip of this beat belongs: the whole beat, or the animation window inside it. */
function rangeFor(clip: TimelineClip, t: BeatTiming): { start: number; end: number } | null {
  if (isBrollClip(clip)) return { start: t.start, end: t.end };
  if (!isOverlayClip(clip)) return null;
  const fullFrame = t.fullScreen || isFullFramePlacement(clip.placement || clip.remotion?.placement);
  if (fullFrame || t.overlayStart == null || t.overlayEnd == null) return { start: t.start, end: t.end };
  return { start: t.overlayStart, end: t.overlayEnd };
}

/**
 * Re-times every clip whose beat is in `timings`. After a split, `splitRightClipId` (the new
 * right half, still on a placeholder beat id) takes the one beat id no clip uses yet.
 */
export function applyBeatTimings(
  timeline: TimelineState,
  timings: BeatTiming[],
  opts: { splitRightClipId?: string } = {},
): { timeline: TimelineState; newBeatId: string | null; changed: boolean } {
  const byId = new Map(timings.map((t) => [t.id, t]));
  let newBeatId: string | null = null;

  if (opts.splitRightClipId) {
    const all = timeline.tracks.flatMap((t) => t.clips);
    const right = all.find((c) => c.id === opts.splitRightClipId);
    if (right) {
      const used = new Set(
        all.filter((c) => c.id !== right.id && c.beatId).map((c) => c.beatId as string),
      );
      const fresh = timings
        .filter((t) => !used.has(t.id))
        .sort((a, b) => Math.abs(a.start - right.start) - Math.abs(b.start - right.start));
      newBeatId = fresh[0]?.id ?? null;
    }
  }

  let changed = false;
  const tracks = timeline.tracks.map((track) => {
    let trackChanged = false;
    const clips = track.clips.map((clip) => {
      const beatId = newBeatId && clip.id === opts.splitRightClipId ? newBeatId : clip.beatId;
      const timing = beatId ? byId.get(beatId) : undefined;
      if (!timing) return clip;
      const range = rangeFor(clip, timing);
      if (!range) return clip;
      const duration = range.end - range.start;
      const sameTime =
        Math.abs(clip.start - range.start) < EPS && Math.abs(clip.duration - duration) < EPS;
      if (sameTime && beatId === clip.beatId) return clip;
      trackChanged = true;
      return {
        ...clip,
        beatId,
        start: range.start,
        duration,
        sourceDuration: isBrollClip(clip) ? Math.max(clip.sourceDuration, duration) : duration,
      };
    });
    if (!trackChanged) return track;
    changed = true;
    return { ...track, clips };
  });

  if (!changed) return { timeline, newBeatId, changed };
  return {
    timeline: { ...timeline, tracks, duration: recomputeTimelineDuration(tracks, timeline.duration) },
    newBeatId,
    changed,
  };
}
