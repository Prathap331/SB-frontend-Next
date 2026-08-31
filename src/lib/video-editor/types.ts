/** Clip / track types for the non-linear video timeline. */

export type TimelineTrackType =
  | 'video'
  | 'broll'
  | 'text'
  | 'caption'
  | 'voiceover'
  | 'music'
  | 'infographic';

export type TimelineClip = {
  id: string;
  trackId: string;
  type: TimelineTrackType;
  name: string;

  sourceUrl?: string;
  thumbnailUrl?: string;
  /** Distinguishes still images from playable video (esp. B-roll stock assets). */
  mediaKind?: 'video' | 'image';

  /** Position on the final timeline (seconds). */
  start: number;
  duration: number;

  /** Portion of original source media being used (seconds). */
  sourceStart: number;
  sourceDuration: number;
  /** Full original media length when known. */
  originalSourceDuration?: number;

  /** Optional link back to AI/story scene. */
  sceneId?: string;
  /** Backend "beat" id for b-roll clips — `s{sceneNum}_b{nth}` — used by the split/insert endpoints. */
  beatId?: string;

  zIndex?: number;
  volume?: number;
  opacity?: number;

  text?: string;

  locked?: boolean;
  hidden?: boolean;

  /** Infographic / text placement hints from AI. */
  placement?: string | null;
  mode?: 'overlay' | 'fullscreen' | null;

  /**
   * Remotion-backed infographic (composition_id + frame duration).
   * Timeline still stores start/duration in seconds; Remotion uses frames.
   */
  remotion?: {
    /** Identity metadata only — do not use for renderer lookup. */
    compositionId: string;
    /** Determines which Remotion renderer to use. */
    animationType: string;
    props: Record<string, unknown>;
    durationFrames: number;
    trigger?: string;
    placement?: string;
    renderEngineHint?: string;
  } | null;

  /** Lightweight waveform peaks (0–1), when available. */
  waveformPeaks?: number[];

  /** Word-level timing for a voiceover clip (scene-local seconds) — drives burned-in captions. */
  wordSegments?: { word: string; start: number; end: number }[];
};

export type TimelineTrack = {
  id: string;
  type: TimelineTrackType;
  name: string;
  clips: TimelineClip[];
  muted: boolean;
  locked: boolean;
  visible: boolean;
  collapsed?: boolean;
  height?: 'compact' | 'normal' | 'expanded';
};

export type TimelineState = {
  duration: number;
  currentTime: number;
  tracks: TimelineTrack[];
  selectedClipIds: string[];
  pixelsPerSecond: number;
};

export type SceneBoundary = {
  sceneId: string;
  title: string;
  start: number;
  end: number;
};

export type EditorHistorySnapshot = {
  timeline: TimelineState;
};

export const DEFAULT_TRACK_IDS = {
  video: 'track-video',
  broll: 'track-broll',
  text: 'track-text',
  caption: 'track-caption',
  voiceover: 'track-voiceover',
  music: 'track-music',
  infographic: 'track-infographic',
} as const;

export const MIN_CLIP_DURATION = 0.1;
export const SNAP_THRESHOLD_PX = 8;
export const MIN_PPS = 20;
export const MAX_PPS = 320;
export const DEFAULT_PPS = 80;
