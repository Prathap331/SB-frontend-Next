import {
  DEFAULT_PPS,
  DEFAULT_TRACK_IDS,
  type TimelineClip,
  type TimelineState,
  type TimelineTrack,
  type TimelineTrackType,
} from './types';
import { normalizeClip, recomputeTimelineDuration, roundTime } from './math';
import {
  remotionDurationSeconds,
  remotionInfographicLabel,
  remotionPayloadFromSpec,
  type RemotionInfographicSpec,
  type SeededTextOverlay,
} from './infographics';
import { DEFAULT_CAPTION_STYLE, type CaptionStyle, type CaptionWord } from './captions';

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
  wordSegments?: CaptionWord[];
  /** Caption look (position, color, animation) from caption_word.style / scene.caption_style. */
  captionStyle?: CaptionStyle | null;
  /** Natural start of speech within the generated voiceover audio (leading silence varies per take, e.g. 0.3–0.6s). */
  voiceStart?: number;
  /** Backend-selected b-roll segments for this scene — auto-placed on the timeline by default. */
  beats?: {
    beatId: string;
    start: number;
    end: number;
    assetUrl: string;
    source: 'video' | 'image';
    motionType?: string;
    kenBurns?: TimelineClip['kenBurns'];
  }[];
  /** text_list overlays — auto-placed on the Text track. */
  seededTextOverlays?: SeededTextOverlay[];
  /** infographics_list overlays — auto-placed on the Infographics track. */
  seededInfographics?: RemotionInfographicSpec[];
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
    { id: DEFAULT_TRACK_IDS.broll, type: 'broll', name: 'Videos', height: 'normal' },
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

function buildTextClipsFromOverlays(scene: LegacySceneLike): TimelineClip[] {
  return (scene.seededTextOverlays ?? []).map((item, i) =>
    normalizeClip({
      id: item.overlayId ? `txt-${item.overlayId}` : `txt-${scene.id}-${i}`,
      trackId: DEFAULT_TRACK_IDS.text,
      type: 'text',
      name: item.text.slice(0, 48) || 'Text',
      text: item.text,
      start: roundTime(item.start),
      duration: Math.max(0.1, roundTime(item.duration)),
      sourceStart: 0,
      sourceDuration: Math.max(0.1, roundTime(item.duration)),
      originalSourceDuration: Math.max(0.1, roundTime(item.duration)),
      sceneId: scene.id,
      overlayId: item.overlayId,
      beatId: item.beatId,
      placement: item.placement,
      textColor: item.textColor,
      offsetX: item.offsetX,
      offsetY: item.offsetY,
      animationStyle: item.animationStyle,
      remotion: item.remotion ? remotionPayloadFromSpec(item.remotion) : undefined,
    }),
  );
}

function buildInfographicClipsFromOverlays(scene: LegacySceneLike): TimelineClip[] {
  return (scene.seededInfographics ?? []).flatMap((spec) => {
    const durSec = remotionDurationSeconds(spec.durationFrames);
    if (durSec <= 0) return [];
    const start = spec.startSeconds != null ? Math.max(0, spec.startSeconds) : 0;
    const isFull =
      spec.placement === 'full_frame' ||
      spec.placement === 'fullscreen' ||
      spec.placement === 'full_screen';
    const label = remotionInfographicLabel(spec);
    return [
      normalizeClip({
        id: spec.overlayId ? `info-${spec.overlayId}` : `info-remotion-${scene.id}-${spec.compositionId}`,
        trackId: DEFAULT_TRACK_IDS.infographic,
        type: 'infographic',
        name: label,
        text: label,
        start: roundTime(start),
        duration: durSec,
        sourceStart: 0,
        sourceDuration: durSec,
        originalSourceDuration: durSec,
        sceneId: scene.id,
        overlayId: spec.overlayId,
        beatId: spec.beatId,
        placement: spec.placement,
        mode: isFull ? 'fullscreen' : 'overlay',
        remotion: remotionPayloadFromSpec(spec),
      }),
    ];
  });
}

/** Builds normalized b-roll clips from a scene's backend-selected beats. */
function buildBrollClipsFromBeats(scene: LegacySceneLike): TimelineClip[] {
  return (scene.beats ?? []).map((beat) => {
    const dur = Math.max(0.1, roundTime(beat.end - beat.start));
    return normalizeClip({
      id: `br-${beat.beatId}`,
      trackId: DEFAULT_TRACK_IDS.broll,
      type: 'broll',
      name: beat.beatId,
      sourceUrl: beat.assetUrl,
      mediaKind: beat.source,
      start: roundTime(beat.start),
      duration: dur,
      sourceStart: 0,
      sourceDuration: dur,
      originalSourceDuration: dur,
      sceneId: scene.id,
      beatId: beat.beatId,
      kenBurns: beat.kenBurns,
    });
  });
}

/** Drop legacy music / caption tracks from cached timelines; keep the active editor tracks. */
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
 * Build a per-scene timeline: voiceover, backend-selected b-roll, and overlay
 * list items (text_list / infographics_list) seeded by default.
 * Captions burn in on the preview from the voiceover's word timing — no Captions track.
 * Timeline duration follows the voiceover / scene length.
 */
export function createSceneTimeline(scene: LegacySceneLike): TimelineState {
  const tracks = emptyTracks();
  const duration = Math.max(0.5, roundTime(scene.duration || 5));

  if (scene.voiceoverUrl) {
    // Always seed the full, untrimmed clip by default so every scene has a working
    // voiceover on the timeline without the user needing to add or fix anything —
    // any natural leading-silence trim is offered as a suggestion in the trim UI
    // instead (see StudioVideoEditingPanel's trim defaults), not baked in here.
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
        wordSegments: scene.wordSegments,
        captionStyle: scene.captionStyle ?? DEFAULT_CAPTION_STYLE,
      }),
    );
  }

  if (scene.beats?.length) {
    // B-roll comes back pre-selected by the backend — placed on the timeline by default,
    // same as the voiceover, so there's nothing the user has to add manually.
    const brollTrack = tracks.find((t) => t.id === DEFAULT_TRACK_IDS.broll)!;
    brollTrack.clips.push(...buildBrollClipsFromBeats(scene));
  }

  const textClips = buildTextClipsFromOverlays(scene);
  if (textClips.length) {
    const textTrack = tracks.find((t) => t.id === DEFAULT_TRACK_IDS.text)!;
    textTrack.clips.push(...textClips);
  }

  const infoClips = buildInfographicClipsFromOverlays(scene);
  if (infoClips.length) {
    const infoTrack = tracks.find((t) => t.id === DEFAULT_TRACK_IDS.infographic)!;
    infoTrack.clips.push(...infoClips);
  }

  return {
    duration,
    currentTime: 0,
    tracks,
    selectedClipIds: [],
    pixelsPerSecond: DEFAULT_PPS,
  };
}

/**
 * Backfills a scene's voiceover clip onto an existing timeline if it's missing (e.g. a
 * project cached before a mapper fix, or before voiceover generation finished) — leaves
 * every other track/clip untouched so it never clobbers the user's own edits.
 */
export function ensureVoiceoverClip(state: TimelineState, scene: LegacySceneLike): TimelineState {
  if (!scene.voiceoverUrl) return state;
  const voTrack = state.tracks.find((t) => t.id === DEFAULT_TRACK_IDS.voiceover);
  if (!voTrack || voTrack.clips.some((c) => c.type === 'voiceover')) return state;

  const duration = Math.max(0.5, roundTime(scene.duration || 5));
  const tracks = state.tracks.map((t) =>
    t.id !== DEFAULT_TRACK_IDS.voiceover
      ? t
      : {
          ...t,
          clips: [
            ...t.clips,
            normalizeClip({
              id: `vo-${scene.id}`,
              trackId: DEFAULT_TRACK_IDS.voiceover,
              type: 'voiceover',
              name: `${scene.title} VO`,
              sourceUrl: scene.voiceoverUrl!,
              start: 0,
              duration,
              sourceStart: 0,
              sourceDuration: duration,
              originalSourceDuration: duration,
              sceneId: scene.id,
              volume: 1,
              wordSegments: scene.wordSegments,
              captionStyle: scene.captionStyle ?? DEFAULT_CAPTION_STYLE,
            }),
          ],
        },
  );
  return { ...state, tracks, duration: recomputeTimelineDuration(tracks, state.duration) };
}

/**
 * Backfills any of a scene's backend-selected beats that are missing from the b-roll track
 * (matched by beat id) — leaves clips the user already has (edited or not) untouched.
 */
export function ensureBrollBeats(state: TimelineState, scene: LegacySceneLike): TimelineState {
  const missing = (scene.beats ?? []).filter(
    (beat) => !state.tracks.some((t) => t.id === DEFAULT_TRACK_IDS.broll && t.clips.some((c) => c.beatId === beat.beatId)),
  );
  if (!missing.length) return state;

  const newClips = buildBrollClipsFromBeats({ ...scene, beats: missing });
  const tracks = state.tracks.map((t) =>
    t.id !== DEFAULT_TRACK_IDS.broll ? t : { ...t, clips: [...t.clips, ...newClips] },
  );
  return { ...state, tracks, duration: recomputeTimelineDuration(tracks, state.duration) };
}

/**
 * Drops any leftover Captions track and bakes word timing / style onto the voiceover
 * so captions still render in the preview.
 */
export function ensureCaptionClip(state: TimelineState, scene: LegacySceneLike): TimelineState {
  const captionTrack = state.tracks.find((t) => t.type === 'caption' || t.id === DEFAULT_TRACK_IDS.caption);
  const captionClip = captionTrack?.clips.find((c) => c.type === 'caption');
  const words = (captionClip?.wordSegments?.length ? captionClip.wordSegments : scene.wordSegments) ?? [];
  const style = captionClip?.captionStyle ?? scene.captionStyle ?? undefined;
  const tracks = state.tracks
    .filter((t) => t.type !== 'caption' && t.id !== DEFAULT_TRACK_IDS.caption)
    .map((t) => {
      if (t.id !== DEFAULT_TRACK_IDS.voiceover) return t;
      return {
        ...t,
        clips: t.clips.map((c) => {
          if (c.type !== 'voiceover') return c;
          return {
            ...c,
            wordSegments: c.wordSegments?.length ? c.wordSegments : words,
            captionStyle: c.captionStyle ?? style,
          };
        }),
      };
    });
  return { ...state, tracks, duration: recomputeTimelineDuration(tracks, state.duration) };
}

/**
 * Backfills text_list / infographics_list clips onto an existing timeline when missing,
 * and refreshes Remotion payloads on clips that are already placed.
 */
export function ensureOverlayClips(state: TimelineState, scene: LegacySceneLike): TimelineState {
  const textClips = buildTextClipsFromOverlays(scene);
  const infoClips = buildInfographicClipsFromOverlays(scene);

  const missingText = textClips.filter(
    (clip) =>
      !state.tracks.some(
        (t) =>
          t.id === DEFAULT_TRACK_IDS.text &&
          t.clips.some((c) => (clip.overlayId ? c.overlayId === clip.overlayId : c.id === clip.id)),
      ),
  );
  const missingInfo = infoClips.filter(
    (clip) =>
      !state.tracks.some(
        (t) =>
          t.id === DEFAULT_TRACK_IDS.infographic &&
          t.clips.some((c) => (clip.overlayId ? c.overlayId === clip.overlayId : c.id === clip.id)),
      ),
  );

  const tracks = state.tracks.map((t) => {
    if (t.id === DEFAULT_TRACK_IDS.text) {
      const clips = t.clips.map((c) => {
        const fresh = textClips.find((n) =>
          c.overlayId && n.overlayId ? c.overlayId === n.overlayId : n.beatId && c.beatId === n.beatId,
        );
        if (!fresh?.remotion) return c;
        return {
          ...c,
          remotion: fresh.remotion,
          placement: fresh.placement ?? c.placement,
          textColor: fresh.textColor ?? c.textColor,
          animationStyle: fresh.animationStyle ?? c.animationStyle,
        };
      });
      return { ...t, clips: missingText.length ? [...clips, ...missingText] : clips };
    }
    if (t.id === DEFAULT_TRACK_IDS.infographic) {
      const clips = t.clips.map((c) => {
        const fresh = infoClips.find((n) =>
          c.overlayId && n.overlayId ? c.overlayId === n.overlayId : n.beatId && c.beatId === n.beatId,
        );
        if (!fresh?.remotion) return c;
        return {
          ...c,
          remotion: fresh.remotion,
          name: fresh.name || c.name,
          text: fresh.text || c.text,
          placement: fresh.placement ?? c.placement,
          mode: fresh.mode ?? c.mode,
        };
      });
      return { ...t, clips: missingInfo.length ? [...clips, ...missingInfo] : clips };
    }
    return t;
  });
  return { ...state, tracks, duration: recomputeTimelineDuration(tracks, state.duration) };
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
