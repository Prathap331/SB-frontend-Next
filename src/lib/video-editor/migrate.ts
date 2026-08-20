import {
  DEFAULT_PPS,
  DEFAULT_TRACK_IDS,
  type TimelineClip,
  type TimelineState,
  type TimelineTrack,
  type TimelineTrackType,
} from './types';
import { normalizeClip, recomputeTimelineDuration, roundTime } from './math';
import type { RemotionInfographicSpec } from './infographics';

export type LegacySceneLike = {
  id: string;
  title: string;
  desc: string;
  start: number;
  duration: number;
  mainParts?: { filename: string; url?: string; thumbnailUrl?: string }[];
  broll?: { label: string; url?: string | null; thumbnailUrl?: string | null } | null;
  infographic?: {
    label: string;
    mode?: 'overlay' | 'fullscreen' | null;
    placement?: string | null;
  } | null;
  /** Parsed Remotion infographic from backend `infographics` (or legacy animation). */
  remotionInfographic?: RemotionInfographicSpec | null;
  voiceoverUrl?: string | null;
  /** Caption / on-screen text from AI */
  onScreenText?: string | null;
  wordSegments?: { word: string; start: number; end: number }[];
};

const ACTIVE_TRACK_TYPES: TimelineTrackType[] = [
  'video',
  'broll',
  'text',
  'infographic',
  'voiceover',
];

function emptyTracks(): TimelineTrack[] {
  const defs: { id: string; type: TimelineTrackType; name: string; height: TimelineTrack['height'] }[] = [
    { id: DEFAULT_TRACK_IDS.video, type: 'video', name: 'Video', height: 'expanded' },
    { id: DEFAULT_TRACK_IDS.broll, type: 'broll', name: 'B-roll', height: 'normal' },
    { id: DEFAULT_TRACK_IDS.text, type: 'text', name: 'Text', height: 'compact' },
    { id: DEFAULT_TRACK_IDS.infographic, type: 'infographic', name: 'Infographics', height: 'compact' },
    { id: DEFAULT_TRACK_IDS.voiceover, type: 'voiceover', name: 'Voiceover', height: 'normal' },
  ];
  return defs.map((d) => ({
    id: d.id,
    type: d.type,
    name: d.name,
    clips: [],
    muted: false,
    locked: false,
    visible: true,
    collapsed: false,
    height: d.height,
  }));
}

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Drop legacy caption/music tracks from cached timelines. */
export function sanitizeTimelineTracks(state: TimelineState): TimelineState {
  const allowed = new Set(ACTIVE_TRACK_TYPES);
  const existing = state.tracks.filter((t) => allowed.has(t.type));
  const byType = new Map(existing.map((t) => [t.type, t]));
  const tracks = emptyTracks().map((blank) => {
    const prev = byType.get(blank.type);
    if (!prev) return blank;
    return {
      ...blank,
      ...prev,
      id: blank.id,
      type: blank.type,
      name: blank.name,
      // Never carry auto-seeded broll/text from old caches when sanitizing fresh migrate;
      // keep clips that user already placed.
      clips: prev.clips.filter((c) => c.type === blank.type),
    };
  });
  return {
    ...state,
    tracks,
    duration: recomputeTimelineDuration(tracks, state.duration),
  };
}

/**
 * Build a per-scene timeline: voiceover only seeded.
 * Video / B-roll / Text / Infographics stay empty until the user inserts them.
 * Timeline duration follows the voiceover / scene length.
 */
export function createSceneTimeline(scene: LegacySceneLike): TimelineState {
  const tracks = emptyTracks();
  const duration = Math.max(0.5, roundTime(scene.duration || 5));

  if (scene.voiceoverUrl) {
    const voTrack = tracks.find((t) => t.id === DEFAULT_TRACK_IDS.voiceover)!;
    voTrack.clips.push(
      normalizeClip({
        id: `vo-${scene.id}`,
        trackId: DEFAULT_TRACK_IDS.voiceover,
        type: 'voiceover',
        name: `${scene.title} VO`,
        sourceUrl: scene.voiceoverUrl,
        start: 0,
        duration,
        sourceStart: 0,
        sourceDuration: duration,
        originalSourceDuration: duration,
        sceneId: scene.id,
        volume: 1,
      }),
    );
  }

  return {
    duration,
    currentTime: 0,
    tracks,
    selectedClipIds: [],
    pixelsPerSecond: DEFAULT_PPS,
  };
}

/** Create a map of per-scene timelines (VO only / empty layers). */
export function createSceneTimelinesMap(scenes: LegacySceneLike[]): Record<string, TimelineState> {
  const map: Record<string, TimelineState> = {};
  for (const scene of scenes) {
    map[scene.id] = createSceneTimeline(scene);
  }
  return map;
}

/**
 * @deprecated Prefer createSceneTimeline / createSceneTimelinesMap for scene-by-scene editing.
 * Kept for any legacy full-project views.
 */
export function migrateScenesToTimeline(scenes: LegacySceneLike[]): TimelineState {
  if (scenes.length === 1) return createSceneTimeline(scenes[0]);
  // Default to first scene timeline for compatibility.
  if (scenes[0]) return createSceneTimeline(scenes[0]);
  return createEmptyTimeline();
}

export function createEmptyTimeline(duration = 30): TimelineState {
  return {
    duration,
    currentTime: 0,
    tracks: emptyTracks(),
    selectedClipIds: [],
    pixelsPerSecond: DEFAULT_PPS,
  };
}

export function addClipToTrack(
  state: TimelineState,
  trackId: string,
  clip: Omit<TimelineClip, 'trackId'> & { trackId?: string },
): TimelineState {
  const tracks = state.tracks.map((track) => {
    if (track.id !== trackId) return track;
    const id = clip.id || makeId(track.type);
    // Prevent accidental duplicates of the same clip id on a track.
    if (track.clips.some((c) => c.id === id)) {
      return {
        ...track,
        clips: track.clips.map((c) =>
          c.id === id ? normalizeClip({ ...c, ...clip, trackId, id }) : c,
        ),
      };
    }
    return {
      ...track,
      clips: [...track.clips, normalizeClip({ ...clip, trackId, id })],
    };
  });
  return {
    ...state,
    tracks,
    duration: recomputeTimelineDuration(tracks, state.duration),
  };
}
