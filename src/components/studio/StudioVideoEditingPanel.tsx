'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Upload,
  Volume2,
  Pause,
  Play,
  SkipBack,
  MoreHorizontal,
  Check,
  AlertTriangle,
  Sparkles,
  Film,
  BarChart3,
  Link2,
  ChevronUp,
  ChevronDown,
  X,
  UserRound,
  UserRoundX,
  Mic,
  Loader2,
  Video,
  Scissors,
  Search,
  Image as ImageIcon,
  Type,
  Layers,
  Trash2,
  Copy,
  Crop,
  Pipette,
  Download,
  Subtitles,
} from 'lucide-react';
import type { MouseEvent } from 'react';
import {
  VoiceCard,
  CLONED_VOICE_WASH,
  fetchPreMadeVoices,
  fetchClonedVoiceFromProfile,
  type VoicePreset,
} from '@/components/studio/StudioAudioPanel';
import { VoiceCloneModal } from '@/components/studio/VoiceCloneModal';
import { canUseVoiceCloning, saveClonedVoiceProfile } from '@/lib/voice-clone';
import { estimateSpeechDurationSeconds } from '@/lib/credits';
import { supabase } from '@/lib/supabaseClient';
import { getScriptVideoUrl, saveScriptVideoUrl } from '@/lib/script-persistence';
import {
  ApiService,
  type EditVideoResponse,
  type EditVideoScene,
  type EditVideoInfographicAnimationType,
  type SceneStyleUpdate,
  type SceneInfographicUpdate,
  type BeatAnimationUpdateResponse,
  type EditVideoTextVerticalPosition,
  type EditVideoTextHorizontalPosition,
  type EditVideoTextAnimationStyle,
  type EditVideoCaptionAnimationType,
  type EditVideoTextListItem,
} from '@/services/api';
import { useVideoTimeline } from '@/hooks/useVideoTimeline';
import {
  DEFAULT_TRACK_IDS,
  createEmptyTimeline,
  createSceneTimeline,
  createSceneTimelinesMap,
  ensureVoiceoverClip,
  ensureBrollBeats,
  ensureCaptionClip,
  ensureOverlayClips,
  fetchVideosProject,
  videosRowToEditVideoResponse,
  hydrateSceneTimelinesFromVideosRow,
  resolveBeatAsset,
  brollDisplayName,
  clipMediaKind,
} from '@/lib/video-editor';
import {
  listPickedBroll,
  setBrollPickListener,
  startBrollPickSession,
  type PickedBrollItem,
} from '@/lib/video-editor/broll-pick';
import type { TimelineState, TimelineClip } from '@/lib/video-editor/types';
import { readInfographicFromEditScene, parseRemotionInfographic, remotionInfographicLabel, remotionDurationSeconds, resolveInfographicStartSeconds, seededTextFromOverlayItem, kenBurnsFromTrack, mergeOverlayTrackOntoItem, rebaseOverlaySpec, rebaseSeededText, isOverlayGraphicTrack, collectSceneGraphicsOverlays, buildBeatAnimationUpdate, overlayDisplayTextForEditor, displayTextPayloadFromEditor, placementToPreviewOffsets, type RemotionInfographicSpec, type SeededTextOverlay } from '@/lib/video-editor/infographics';
import { audioWindowSeconds, frameWindowSeconds, toSceneLocalSeconds } from '@/lib/video-editor/timings';
import { TimelinePanel, TimelinePreview, TimelineClipView } from '@/components/studio/video-timeline';
import { TRACK_ROW_HEIGHT } from '@/components/studio/video-timeline/trackLayout';
import { RemotionInfographicPreview } from '@/remotion/RemotionInfographicPreview';
import { LucideIconView } from '@/remotion/icons';
import { placementToDesignPx } from '@/remotion/placement';
import { formatTimecode, formatTimecodeShort } from '@/lib/video-editor/timecode';
import { EDITOR_FPS } from '@/lib/video-editor/fps';
import {
  captionStyleForScene,
  captionWordsForScene,
  findAudioTrack,
  DEFAULT_CAPTION_STYLE,
  type CaptionStyle,
} from '@/lib/video-editor/captions';

/* ── Types ─────────────────────────────────────────────────────────────────── */

type SceneStatus = 'ready' | 'working' | 'needs';
type JoinStatus = 'single' | 'join';
type InfographicMode = 'overlay' | 'fullscreen';

type MainPart = { filename: string; url?: string; thumbnailUrl?: string };
type BrollClip = {
  label: string;
  url?: string | null;
  thumbnailUrl?: string | null;
};
type InfographicClip = {
  label: string;
  mode: InfographicMode;
  placement: string | null;
};

type Scene = {
  id: string;
  num: string;
  title: string;
  desc: string;
  start: number;
  duration: number;
  status: SceneStatus;
  mainParts: MainPart[];
  joinStatus: JoinStatus;
  broll: BrollClip | null;
  infographic: InfographicClip | null;
  /** Remotion infographic from backend `infographics` (composition + frames). */
  remotionInfographic?: RemotionInfographicSpec | null;
  /** Generated voiceover clip URL for this scene, when available */
  voiceoverUrl?: string | null;
  /** Error message from generation for this scene (e.g. voiceover failed), when present */
  generationError?: string | null;
  onScreenText?: string | null;
  wordSegments?: { word: string; start: number; end: number }[];
  captionStyle?: CaptionStyle | null;
  /** Natural (scene-local) start/end of the voiceover audio — same as this scene's own `start`/`end`. */
  voiceStart?: number;
  sceneEndSec?: number;
  /** Backend-selected b-roll segments for this scene — auto-placed on the timeline (see createSceneTimeline). */
  beats?: {
    beatId: string;
    start: number;
    end: number;
    assetUrl: string;
    source: 'video' | 'image';
    motionType?: string;
    kenBurns?: TimelineClip['kenBurns'];
  }[];
  seededTextOverlays?: SeededTextOverlay[];
  seededInfographics?: RemotionInfographicSpec[];
};

type Suggestion = {
  label: string;
  meta: string;
  start: number;
  dur: number;
  matchedScene: string;
  matchPct: number;
  mode?: InfographicMode;
  mediaKind?: 'video' | 'image';
  /** Thumbnail shown on the card */
  previewUrl?: string | null;
  /** Full asset played/shown in the preview popup */
  assetUrl?: string | null;
  /** Pexels asset id — present for AI-suggested media, used to persist the pick via PATCH .../broll */
  assetId?: number | null;
  source?: 'video' | 'image' | null;
  /** True when the user picked this from Pexels via Find more — persist via POST .../broll/insert. */
  fromPexels?: boolean;
  /** Backend beat id when this card was previously on the timeline and then removed. */
  beatId?: string;
  /** Lucide names from infographics_list — shown on the card thumbnail. */
  icons?: string[];
};

type PendingSplit = {
  beatId: string;
  leftClipId: string;
  rightClipId: string;
  splitAtLocal: number;
  newBeatId: string;
};

type PendingDelete = {
  sceneId: string;
  kind: 'broll' | 'overlay';
  beatId?: string;
  overlayId?: string;
  contentType?: 'video' | 'image';
};

/** Backend edits accumulated per scene while the user is working on it, flushed when they move on. */
type PendingSceneEdits = {
  /** Burned-in captions — PATCH .../scene/{scene_id}/style. */
  captionStyle?: boolean;
  /** Text / infographic overlay clip ids — PATCH .../beat/{beat_id}/animation. */
  overlayClipIds?: string[];
  infographic?: SceneInfographicUpdate;
  /** B-roll clips to upsert via select/insert using their current start/end. */
  brollClipIds?: string[];
  trim?: { start: number; end: number };
  splits?: PendingSplit[];
};

type LibraryTab = 'broll-videos' | 'broll-images' | 'infographics' | 'text' | 'captions';
type ColorPickerTarget =
  | 'text'
  | 'background'
  | 'caption-text'
  | 'caption-outline'
  | 'caption-bg'
  | 'info-color';

function assetUrlKey(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
  } catch {
    return trimmed.split('?')[0].split('#')[0];
  }
}

function urlsMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const ka = assetUrlKey(a);
  const kb = assetUrlKey(b);
  return Boolean(ka && kb && ka === kb);
}

function clipMatchesSuggestion(clip: TimelineClip, item: Suggestion): boolean {
  const itemUrls = [item.assetUrl, item.previewUrl];
  const clipUrls = [clip.sourceUrl, clip.thumbnailUrl];
  if (itemUrls.some((iu) => clipUrls.some((cu) => urlsMatch(iu, cu)))) return true;
  if (item.label && (clip.name === item.label || clip.beatId === item.label)) return true;
  return false;
}

const LIBRARY_TABS: { id: LibraryTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'broll-videos', label: 'Videos', icon: Film },
  { id: 'broll-images', label: 'Images', icon: ImageIcon },
  { id: 'infographics', label: 'Infographics', icon: BarChart3 },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'captions', label: 'Captions', icon: Subtitles },
];

type TextStyle = {
  /** Distance from the left edge of the frame, as a % of frame width. */
  offsetX: number;
  /** Distance from the bottom edge of the frame, as a % of frame height — matches `margin_bottom_percent` 1:1. */
  offsetY: number;
  background: boolean;
  bgColor: string;
  textColor: string;
  fontSize: number;
  /** CSS font-family value, e.g. "Inter". */
  fontStyle: string;
  animationStyle: EditVideoTextAnimationStyle;
};

const TEXT_ANIMATIONS: { id: EditVideoTextAnimationStyle; label: string }[] = [
  { id: 'fade_in', label: 'Fade in' },
  { id: 'slide_in_left', label: 'Slide in — left' },
  { id: 'slide_in_right', label: 'Slide in — right' },
  { id: 'slide_up', label: 'Slide up' },
  { id: 'slide_down', label: 'Slide down' },
  { id: 'zoom_in', label: 'Zoom in' },
  { id: 'bounce', label: 'Bounce' },
  { id: 'pop', label: 'Pop' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'wipe', label: 'Wipe' },
];

const CAPTION_ANIMATIONS: { id: EditVideoCaptionAnimationType; label: string }[] = [
  { id: 'static_line', label: 'Static line' },
  { id: 'kinetic_caption', label: 'Kinetic' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'word_pop', label: 'Word pop' },
];

const INFOGRAPHIC_PLACEMENTS: { id: string; label: string }[] = [
  { id: 'top_left', label: 'Top left' },
  { id: 'top', label: 'Top' },
  { id: 'top_right', label: 'Top right' },
  { id: 'center_left', label: 'Middle left' },
  { id: 'center', label: 'Center' },
  { id: 'center_right', label: 'Middle right' },
  { id: 'bottom_left', label: 'Bottom left' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'bottom_right', label: 'Bottom right' },
  { id: 'full_frame', label: 'Full frame' },
];

/** Builds a b-roll "beat" id: `s{sceneNum}_b{nth}` — the nth b-roll clip in that scene. */
function makeBrollBeatId(sceneNum: string, nth: number): string {
  const n = parseInt(sceneNum, 10) || 1;
  return `s${n}_b${nth}`;
}

function makeTextBeatId(sceneNum: string): string {
  const n = parseInt(sceneNum, 10) || 1;
  return `s${n}_txt_${Date.now().toString(36)}`;
}

function makeOverlayBeatId(sceneNum: string, kind: 'txt' | 'gfx'): string {
  const n = parseInt(sceneNum, 10) || 1;
  return `s${n}_${kind}_${Date.now().toString(36)}`;
}

/** Maps the draggable vertical offset (% from bottom) to the backend's coarse position zone. */
function verticalPositionFromOffsetY(offsetY: number): EditVideoTextVerticalPosition {
  if (offsetY >= 65) return 'top';
  if (offsetY <= 30) return 'bottom';
  return 'middle';
}

/** Maps the draggable horizontal offset (% from left) to the backend's coarse position zone. */
function horizontalPositionFromOffsetX(offsetX: number): EditVideoTextHorizontalPosition {
  if (offsetX <= 30) return 'left';
  if (offsetX >= 70) return 'right';
  return 'center';
}

function marginHorizontalPercent(offsetX: number, horizontal: EditVideoTextHorizontalPosition): number {
  if (horizontal === 'right') return Math.round(Math.max(0, Math.min(100, 100 - offsetX)));
  return Math.round(Math.max(0, Math.min(100, offsetX)));
}

function findTimelineClip(timeline: TimelineState, clipId: string): TimelineClip | undefined {
  for (const track of timeline.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return clip;
  }
  return undefined;
}

function overlayIdFromBeatResponse(res: BeatAnimationUpdateResponse): string | undefined {
  const animation = res.animation && typeof res.animation === 'object' ? res.animation : null;
  return (
    asOverlayId(res.overlay_id) ??
    asOverlayId(res.text_id) ??
    asOverlayId(animation?.id) ??
    asOverlayId(animation?.overlay_id)
  );
}

function collectSyncedIds(timelines: TimelineState[]): { beats: Set<string>; overlays: Set<string> } {
  const beats = new Set<string>();
  const overlays = new Set<string>();
  for (const tl of timelines) {
    for (const track of tl.tracks) {
      for (const clip of track.clips) {
        if (clip.beatId) beats.add(clip.beatId);
        if (clip.overlayId) overlays.add(clip.overlayId);
      }
    }
  }
  return { beats, overlays };
}

function offsetYForVertical(position: EditVideoTextVerticalPosition): number {
  if (position === 'top') return 82;
  if (position === 'middle') return 48;
  return 12;
}

function offsetXForHorizontal(position: EditVideoTextHorizontalPosition): number {
  if (position === 'left') return 8;
  if (position === 'right') return 92;
  return 50;
}

/* ── Dummy data ────────────────────────────────────────────────────────────── */

/** Curated Google Fonts — loaded via the Google Fonts CSS API so the picker actually renders each face. */
const GOOGLE_FONTS: { label: string; family: string }[] = [
  { label: 'Inter — clean', family: 'Inter' },
  { label: 'Roboto — clean', family: 'Roboto' },
  { label: 'Poppins — rounded', family: 'Poppins' },
  { label: 'Montserrat — geometric', family: 'Montserrat' },
  { label: 'Playfair Display — editorial', family: 'Playfair Display' },
  { label: 'Merriweather — serif', family: 'Merriweather' },
  { label: 'Lora — serif', family: 'Lora' },
  { label: 'Source Code Pro — technical', family: 'Source Code Pro' },
  { label: 'JetBrains Mono — technical', family: 'JetBrains Mono' },
  { label: 'Oswald — condensed', family: 'Oswald' },
  { label: 'Bebas Neue — bold display', family: 'Bebas Neue' },
  { label: 'Anton — ultra bold', family: 'Anton' },
  { label: 'Archivo Black — bold display', family: 'Archivo Black' },
  { label: 'Pacifico — script', family: 'Pacifico' },
  { label: 'Caveat — handwriting', family: 'Caveat' },
];

const GOOGLE_FONTS_HREF = `https://fonts.googleapis.com/css2?${GOOGLE_FONTS.map(
  (f) => `family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:wght@400;600;700`,
).join('&')}&display=swap`;

/** Placeholder library shown before the user generates voice + scenes. */
const BROLL_SUGGESTIONS: Suggestion[] = [
  {
    label: 'Flooded coastal village, aerial',
    meta: '4K · 12s · warm grade',
    start: 0,
    dur: 6,
    matchedScene: 'Sample',
    matchPct: 94,
    mediaKind: 'video',
    previewUrl: 'https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=640&q=80',
  },
  {
    label: 'Relief camp, wide shot',
    meta: '4K · 9s · cool grade',
    start: 15,
    dur: 5,
    matchedScene: 'Sample',
    matchPct: 88,
    mediaKind: 'video',
    previewUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=640&q=80',
  },
  {
    label: 'City skyline at dusk',
    meta: '1080p · 15s · flat grade',
    start: 20,
    dur: 7,
    matchedScene: 'Sample',
    matchPct: 81,
    mediaKind: 'video',
    previewUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=640&q=80',
  },
  {
    label: 'Abandoned structure, dusk',
    meta: '4K · 10s · cool grade',
    start: 37,
    dur: 6,
    matchedScene: 'Sample',
    matchPct: 76,
    mediaKind: 'video',
    previewUrl: 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=640&q=80',
  },
];

const BROLL_IMAGE_SUGGESTIONS: Suggestion[] = [
  {
    label: 'Map overlay still',
    meta: 'Still · 4K · flat grade',
    start: 0,
    dur: 4,
    matchedScene: 'Sample',
    matchPct: 91,
    mediaKind: 'image',
    previewUrl: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=640&q=80',
    assetUrl: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1280&q=80',
  },
  {
    label: 'Crowd from above',
    meta: 'Still · 4K · warm grade',
    start: 8,
    dur: 4,
    matchedScene: 'Sample',
    matchPct: 84,
    mediaKind: 'image',
    previewUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=640&q=80',
    assetUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1280&q=80',
  },
  {
    label: 'Rain on window glass',
    meta: 'Still · 1080p · cool grade',
    start: 16,
    dur: 4,
    matchedScene: 'Sample',
    matchPct: 77,
    mediaKind: 'image',
    previewUrl: 'https://images.unsplash.com/photo-1428593397321-470c9f6f2d1e?w=640&q=80',
    assetUrl: 'https://images.unsplash.com/photo-1428593397321-470c9f6f2d1e?w=1280&q=80',
  },
  {
    label: 'Empty hallway light',
    meta: 'Still · 4K · soft grade',
    start: 24,
    dur: 4,
    matchedScene: 'Sample',
    matchPct: 72,
    mediaKind: 'image',
    previewUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=640&q=80',
    assetUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1280&q=80',
  },
];

/** Default solid colour grid for the text/background colour picker. */
const PRESET_COLORS = [
  '#000000', '#404040', '#595959', '#808080', '#a6a6a6', '#d9d9d9', '#ffffff',
  '#ff3b30', '#ff6961', '#ff69b4', '#dda0dd', '#b565d8', '#8a4fd1', '#5e3fc7',
  '#1a8fd1', '#29b6d8', '#5bd1e0', '#4a90e2', '#3355d1', '#1a3fa8', '#141e8c',
  '#1fa055', '#6fce6c', '#b9ec6c', '#f7e04d', '#f7b84d', '#f2924d', '#f2662d',
];

/** Small lookup so the colour search box accepts common colour names, not just hex. */
const NAMED_COLORS: Record<string, string> = {
  black: '#000000', white: '#ffffff', gray: '#808080', grey: '#808080',
  red: '#ff3b30', pink: '#ff69b4', purple: '#8a4fd1', violet: '#b565d8',
  blue: '#3355d1', navy: '#1a3fa8', teal: '#29b6d8', cyan: '#5bd1e0',
  green: '#1fa055', lime: '#b9ec6c', yellow: '#f7e04d',
  orange: '#f2924d', amber: '#f7b84d', brown: '#8a4fd1',
};

/* ── Setup / face-scene flow types ────────────────────────────────────────── */

type Stage = 'setup' | 'scenes' | 'editor';
type VideoKind = 'faceless' | 'with-face';

type FaceSceneDraft = {
  id: string;
  num: string;
  title: string;
  script: string;
  filename: string | null;
};

/**
 * Stub for the scene-wise script breakdown endpoint — splits the script into
 * roughly even chunks until that endpoint is wired up.
 */
function stubSplitScriptIntoScenes(script: string): FaceSceneDraft[] {
  const cleaned = script.trim();
  if (!cleaned) return [];
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  const perScene = Math.max(1, Math.ceil(sentences.length / 6));
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += perScene) {
    chunks.push(sentences.slice(i, i + perScene).join(' '));
  }
  return chunks.slice(0, 8).map((text, i) => ({
    id: `face-scene-${i}`,
    num: String(i + 1).padStart(2, '0'),
    title: `Scene ${i + 1}`,
    script: text,
    filename: null,
  }));
}

function deriveSceneTitle(scene: EditVideoScene, index: number): string {
  const tag = scene.on_screen_text?.split('|')[0]?.trim();
  if (tag) return tag;
  const bracket = scene.vo_text?.match(/^\[([^\]]+)\]/);
  if (bracket?.[1]) return bracket[1];
  return `Scene ${index + 1}`;
}

/** Prefers a lightweight mp4 file; falls back to the first available link. */
function pickVideoAssetUrl(
  files: { quality: string | null; file_type: string; link: string }[] | undefined,
  fallback: string,
): string {
  if (!files?.length) return fallback;
  const sd = files.find((f) => f.quality === 'sd' && f.file_type?.includes('mp4'));
  if (sd) return sd.link;
  const anyMp4 = files.find((f) => f.file_type?.includes('mp4'));
  return anyMp4?.link || files[0]?.link || fallback;
}

function beatsMediaVideos(beats: EditVideoScene['beats']) {
  return (beats ?? []).flatMap((b) => b.media?.videos?.results ?? []);
}

function beatsMediaImages(beats: EditVideoScene['beats']) {
  return (beats ?? []).flatMap((b) => b.media?.images?.results ?? []);
}

function mapEditVideoResponse(res: EditVideoResponse): {
  scenes: Scene[];
  brollVideoSuggestions: Record<string, Suggestion[]>;
  brollImageSuggestions: Record<string, Suggestion[]>;
} {
  const brollVideoSuggestions: Record<string, Suggestion[]> = {};
  const brollImageSuggestions: Record<string, Suggestion[]> = {};

  /** Fallback placement (sequential, 5s each) for scenes whose start/end came back null. */
  let cursor = 0;
  const FALLBACK_DURATION = 5;
  const fps = res.timeline?.fps || EDITOR_FPS;
  const timelineTracks = res.timeline?.tracks ?? [];

  const scenes: Scene[] = (res.scenes ?? []).map((s, i) => {
    const audioTrack = findAudioTrack(timelineTracks, s.scene_id);
    const audioWin =
      audioWindowSeconds(audioTrack) ??
      audioWindowSeconds(s) ??
      audioWindowSeconds({ start_sec: s.scene_start_sec, end_sec: s.scene_end_sec });
    const origin = audioWin?.start ?? (s.start != null ? Number(s.start) || 0 : cursor);
    const hasTiming = audioWin != null || (s.start != null && s.end != null);
    const start = origin;
    const end = hasTiming ? (audioWin ? audioWin.end : Number(s.end) || start) : start + FALLBACK_DURATION;
    const duration =
      audioWin != null
        ? Math.max(0.5, Math.round(audioWin.duration * 10) / 10)
        : s.duration_seconds != null
          ? Math.max(1, Math.round(Number(s.duration_seconds) * 10) / 10)
          : Math.max(1, Math.round((end - start) * 10) / 10);
    cursor = start + duration;
    const rebaseStart = origin;

    const title = deriveSceneTitle(s, i);
    const keywords = s.broll_keywords?.length ? s.broll_keywords : s.media?.keywords ?? [];
    const beatVideoResults = beatsMediaVideos(s.beats);
    const beatImageResults = beatsMediaImages(s.beats);
    const videoResults = s.media?.videos?.results?.length ? s.media.videos.results : beatVideoResults;
    const imageResults = s.media?.images?.results?.length ? s.media.images.results : beatImageResults;

    if (videoResults.length) {
      brollVideoSuggestions[s.scene_id] = videoResults.slice(0, 6).map((r, ri) => ({
        label: keywords[ri] || keywords[0] || `Matched clip ${ri + 1}`,
        meta: `${r.width}×${r.height} · ${r.duration}s`,
        start: 0,
        dur: Math.min(duration, r.duration || duration),
        matchedScene: title,
        matchPct: Math.max(60, 96 - ri * 6),
        mediaKind: 'video',
        previewUrl: r.thumbnail,
        assetUrl: pickVideoAssetUrl(r.video_files, r.url),
        assetId: r.id,
        source: 'video',
      }));
    }

    if (imageResults.length) {
      brollImageSuggestions[s.scene_id] = imageResults.slice(0, 6).map((r, ri) => ({
        label: keywords[ri] || keywords[0] || `Matched image ${ri + 1}`,
        meta: `${r.width}×${r.height}${r.photographer?.name ? ` · ${r.photographer.name}` : ''}`,
        start: 0,
        dur: Math.min(duration, 3),
        matchedScene: title,
        matchPct: Math.max(60, 94 - ri * 6),
        mediaKind: 'image',
        previewUrl: r.src?.medium || r.src?.small || r.url,
        assetUrl: r.src?.large2x || r.src?.large || r.src?.original || r.url,
        assetId: r.id,
        source: 'image',
      }));
    }

    // Real responses don't send `media` candidate lists — b-roll comes pre-picked per `beats`
    // instead. When there's no `media`, surface each beat's own pick as the sidebar suggestion
    // (it's already on the timeline, but this keeps "already inserted" / re-pick working).
    const beats = s.beats ?? [];
    if (!videoResults.length && !imageResults.length && beats.length) {
      const videoBeats = beats.filter((b) => resolveBeatAsset(b)?.source === 'video' && resolveBeatAsset(b)?.file_url);
      const imageBeats = beats.filter((b) => resolveBeatAsset(b)?.source === 'image' && resolveBeatAsset(b)?.file_url);
      if (videoBeats.length) {
        brollVideoSuggestions[s.scene_id] = videoBeats.map((b, bi) => {
          const asset = resolveBeatAsset(b)!;
          return {
            label: brollDisplayName({ keywords: b.keywords, mediaKind: 'video', index: bi }),
            meta: `${asset.width ?? '?'}×${asset.height ?? '?'}`,
            start: 0,
            dur: Math.max(0.5, b.end - b.start),
            matchedScene: title,
            matchPct: Math.max(60, 90 - bi * 4),
            mediaKind: 'video' as const,
            previewUrl: asset.file_url,
            assetUrl: asset.file_url,
            assetId: asset.asset_id,
            source: 'video' as const,
          };
        });
      }
      if (imageBeats.length) {
        brollImageSuggestions[s.scene_id] = imageBeats.map((b, bi) => {
          const asset = resolveBeatAsset(b)!;
          return {
            label: brollDisplayName({ keywords: b.keywords, mediaKind: 'image', index: bi }),
            meta: `${asset.width ?? '?'}×${asset.height ?? '?'}`,
            start: 0,
            dur: Math.max(0.5, b.end - b.start),
            matchedScene: title,
            matchPct: Math.max(60, 90 - bi * 4),
            mediaKind: 'image' as const,
            previewUrl: asset.file_url,
            assetUrl: asset.file_url,
            assetId: asset.asset_id,
            source: 'image' as const,
          };
        });
      }
    }

    const topLabel =
      brollVideoSuggestions[s.scene_id]?.[0]?.label ??
      brollImageSuggestions[s.scene_id]?.[0]?.label ??
      null;

    const remotionInfographic = readInfographicFromEditScene(s);
    const wordSegments = captionWordsForScene({
      tracks: timelineTracks,
      sceneId: s.scene_id,
      fps,
      sceneDuration: duration,
      fallbackWords: s.word_segments,
    });
    const captionStyle = captionStyleForScene({
      tracks: timelineTracks,
      sceneId: s.scene_id,
      fallbackStyle: s.caption_style,
    });

    const kenByBeat = new Map<string, NonNullable<ReturnType<typeof kenBurnsFromTrack>>>();
    for (const track of timelineTracks) {
      if (typeof track.scene_id === 'string' && track.scene_id !== s.scene_id) continue;
      const kb = kenBurnsFromTrack(track);
      if (kb) kenByBeat.set(kb.beatId, kb);
    }

    const seededInfographics = (collectSceneGraphicsOverlays(res.infographics_list, timelineTracks)[s.scene_id] ?? []).map(
      (spec) => rebaseOverlaySpec(spec, rebaseStart, duration),
    );

    const seededTextOverlays: SeededTextOverlay[] = [];
    const seenTextKeys = new Set<string>();
    const pushText = (seeded: SeededTextOverlay | null) => {
      if (!seeded) return;
      const rebased = rebaseSeededText(seeded, rebaseStart, duration);
      const key = rebased.overlayId || rebased.beatId || rebased.text;
      if (seenTextKeys.has(key)) return;
      seenTextKeys.add(key);
      seededTextOverlays.push(rebased);
    };
    for (const item of res.text_list ?? []) {
      if (item.scene_id !== s.scene_id) continue;
      pushText(seededTextFromOverlayItem(mergeOverlayTrackOntoItem(item, timelineTracks, s.scene_id)));
    }
    for (const track of timelineTracks) {
      if (typeof track.scene_id === 'string' && track.scene_id !== s.scene_id) continue;
      if (track.type !== 'animation' && track.type !== 'overlay' && track.type !== 'text') continue;
      if (kenBurnsFromTrack(track) && !track.display_text) continue;
      if (isOverlayGraphicTrack(track)) continue;
      pushText(seededTextFromOverlayItem(track));
    }

    return {
      id: s.scene_id || `scene-${i}`,
      num: String(i + 1).padStart(2, '0'),
      title,
      desc: s.vo_text?.trim() || '',
      start,
      duration,
      status: s.error ? 'needs' : topLabel ? 'ready' : 'needs',
      mainParts: [],
      joinStatus: 'single' as const,
      broll: null,
      /** Remotion payload from backend — shown in library; inserted onto timeline by the user. */
      remotionInfographic,
      infographic: null,
      voiceoverUrl: s.voice_url ?? s.file_url ?? s.voiceover?.url ?? null,
      generationError: s.error ?? null,
      onScreenText: s.on_screen_text ?? null,
      wordSegments: wordSegments.length ? wordSegments : undefined,
      captionStyle,
      // Audio `start_sec`/`end_sec` are project-absolute (scene 2 begins where scene 1 ended).
      // Clips on this scene's timeline are 0-based; the ruler shows `start` as the origin.
      voiceStart: wordSegments[0]?.start ?? 0,
      sceneEndSec: duration,
      // B-roll `startFrame`/`endFrame` ÷ 30, then shifted by this scene's audio origin.
      beats: beats
        .filter((b) => resolveBeatAsset(b)?.file_url)
        .map((b, bi) => {
          const asset = resolveBeatAsset(b)!;
          const kb = kenByBeat.get(b.beat_id);
          const brollTrack = timelineTracks.find(
            (t) =>
              t.type === 'broll' &&
              t.beat_id === b.beat_id &&
              (typeof t.scene_id !== 'string' || t.scene_id === s.scene_id),
          );
          const frameWin = frameWindowSeconds(brollTrack, fps) ?? frameWindowSeconds(b, fps);
          const beatStart = frameWin
            ? toSceneLocalSeconds(frameWin.start, origin)
            : Math.max(0, b.start - origin);
          const beatEnd = frameWin
            ? Math.max(beatStart + 0.1, toSceneLocalSeconds(frameWin.end, origin))
            : Math.max(beatStart + 0.1, b.end - origin);
          return {
            beatId: b.beat_id,
            name: brollDisplayName({
              keywords: b.keywords,
              mediaKind: asset.source === 'image' ? 'image' : 'video',
              index: bi,
            }),
            start: beatStart,
            end: beatEnd,
            assetUrl: asset.file_url,
            source: (asset.source === 'image' ? 'image' : 'video') as 'video' | 'image',
            motionType: b.motion_type,
            kenBurns: kb
              ? {
                  startX: kb.startX,
                  startY: kb.startY,
                  endX: kb.endX,
                  endY: kb.endY,
                  colorHint: kb.colorHint,
                }
              : undefined,
          };
        }),
      seededTextOverlays,
      seededInfographics,
    };
  });

  return { scenes, brollVideoSuggestions, brollImageSuggestions };
}

/** Groups the response's top-level `text_list` (full-screen/callout text overlays) by scene. */
function extractSceneTextOverlays(
  res: EditVideoResponse | null | undefined,
): Record<string, EditVideoTextListItem[]> {
  const map: Record<string, EditVideoTextListItem[]> = {};
  for (const item of res?.text_list ?? []) {
    if (!item?.scene_id) continue;
    (map[item.scene_id] ??= []).push(item);
  }
  return map;
}

/** Groups the response's top-level `infographics_list` (graphic infographics) by scene. */
function extractSceneGraphicsOverlays(
  res: EditVideoResponse | null | undefined,
): Record<string, RemotionInfographicSpec[]> {
  return collectSceneGraphicsOverlays(res?.infographics_list, res?.timeline?.tracks);
}

/** Best-effort adapter: a text_list item into a RemotionInfographicSpec so it reuses the same insert/render pipeline. */
function textListItemToSpec(item: EditVideoTextListItem): RemotionInfographicSpec | null {
  return parseRemotionInfographic(item);
}

/** Identity for exclusive text-vs-graphics placement: same overlay id, or same visible card. */
function overlayFingerprint(spec: RemotionInfographicSpec): string {
  return `${spec.animationType.trim().toLowerCase()}|${spec.durationFrames}|${remotionInfographicLabel(spec).trim().toLowerCase()}`;
}

function asOverlayId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

/** Builds a library-card-shaped Suggestion from a Remotion spec, for the shared SuggestionCard component. */
function specToSuggestionItem(
  spec: RemotionInfographicSpec,
  sceneTitle: string,
  clips: TimelineClip[] = [],
): Suggestion {
  const clip =
    clips.find((c) => spec.overlayId && c.overlayId === spec.overlayId) ??
    clips.find(
      (c) =>
        c.remotion?.animationType === spec.animationType &&
        Math.abs(c.start - (spec.startSeconds ?? 0)) < 0.08,
    );
  const label = (clip?.name || clip?.text || remotionInfographicLabel(spec)).trim();
  const icons = Array.isArray(spec.props.icons)
    ? spec.props.icons.filter((v): v is string => typeof v === 'string' && Boolean(v.trim()))
    : [];
  return {
    label,
    meta: `${spec.animationType} · ${spec.durationFrames}f · Remotion`,
    start: spec.startSeconds ?? 0,
    dur: remotionDurationSeconds(spec.durationFrames, EDITOR_FPS),
    matchedScene: sceneTitle,
    matchPct: 100,
    mode: spec.placement === 'full_frame' ? 'fullscreen' : 'overlay',
    icons,
  };
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function tc(sec: number): string {
  return formatTimecode(sec);
}

function tcShort(sec: number): string {
  return formatTimecodeShort(sec);
}

/** Read media duration from a blob/object URL (falls back if metadata fails). */
function probeMediaDuration(url: string, fallback = 5): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const done = (d: number) => {
      video.removeAttribute('src');
      video.load();
      resolve(Number.isFinite(d) && d > 0 ? d : fallback);
    };
    video.onloadedmetadata = () => done(video.duration);
    video.onerror = () => done(fallback);
    video.src = url;
  });
}

function StatusPill({ status }: { status: SceneStatus }) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold">
        <Check className="w-3 h-3" /> Ready
      </span>
    );
  }
  if (status === 'working') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 text-[10px] font-semibold">
        <Sparkles className="w-3 h-3" /> Agent working
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold">
      <AlertTriangle className="w-3 h-3" /> Needs media
    </span>
  );
}

/** Mobile bottom-bar icon (Scenes / library tabs) — opens a slide-up sheet. */
function MobileBarIcon({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-semibold text-[#6e6e73]"
    >
      <Icon className="h-5 w-5" />
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Mobile contextual tool button (Delete / Split / Trim / Duplicate) shown when a clip is selected. */
function MobileToolButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
    >
      <Icon className="h-4.5 w-4.5" />
      <span>{label}</span>
    </button>
  );
}

function CaptionStyleFields({
  style,
  onPatch,
  onPickColor,
}: {
  style: CaptionStyle;
  onPatch: (patch: Partial<CaptionStyle>) => void;
  onPickColor: (target: 'caption-text' | 'caption-outline' | 'caption-bg') => void;
}) {
  const hasBackground = Boolean(style.backgroundColor);
  return (
    <>
      <p className="mb-3 text-[10px] leading-relaxed text-[#a1a1a6]">
        Drag the captions on the preview to position them. Changes apply to this scene&apos;s burned-in captions.
      </p>

      <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Text colour</p>
      <button
        type="button"
        onClick={() => onPickColor('caption-text')}
        className="mb-3 flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-medium text-[#1d1d1f] hover:border-gray-300"
      >
        <span
          className="h-5 w-5 flex-shrink-0 rounded-full border border-gray-200"
          style={{ background: style.textColor }}
        />
        {style.textColor}
      </button>

      <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Outline colour</p>
      <button
        type="button"
        onClick={() => onPickColor('caption-outline')}
        className="mb-3 flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-medium text-[#1d1d1f] hover:border-gray-300"
      >
        <span
          className="h-5 w-5 flex-shrink-0 rounded-full border border-gray-200"
          style={{ background: style.outlineColor }}
        />
        {style.outlineColor}
      </button>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#6e6e73]">Background</span>
        <button
          type="button"
          role="switch"
          aria-checked={hasBackground}
          onClick={() => onPatch({ backgroundColor: hasBackground ? null : '#000000' })}
          className={`relative h-[19px] w-[34px] rounded-full transition-colors ${
            hasBackground ? 'bg-[#1d1d1f]' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 h-[15px] w-[15px] rounded-full bg-white transition-all ${
              hasBackground ? 'left-[17px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>
      {hasBackground && (
        <button
          type="button"
          onClick={() => onPickColor('caption-bg')}
          className="mb-3 flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-medium text-[#1d1d1f] hover:border-gray-300"
        >
          <span
            className="h-5 w-5 flex-shrink-0 rounded-full border border-gray-200"
            style={{ background: style.backgroundColor || '#000000' }}
          />
          {style.backgroundColor}
        </button>
      )}

      <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Font size (px)</p>
      <input
        type="number"
        min={8}
        max={300}
        step={1}
        value={style.fontSize}
        onChange={(e) => {
          const next = Math.max(8, Math.min(300, Number(e.target.value) || style.fontSize));
          onPatch({ fontSize: next });
        }}
        className="mb-3 w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-2 text-xs text-[#1d1d1f]"
      />

      <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Animation</p>
      <select
        value={style.animationType}
        onChange={(e) => onPatch({ animationType: e.target.value as EditVideoCaptionAnimationType })}
        className="mb-3 w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-2 text-xs text-[#1d1d1f]"
      >
        {CAPTION_ANIMATIONS.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>

      <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Vertical position</p>
      <select
        value={style.verticalPosition}
        onChange={(e) => {
          const verticalPosition = e.target.value as EditVideoTextVerticalPosition;
          onPatch({ verticalPosition, offsetY: offsetYForVertical(verticalPosition) });
        }}
        className="mb-3 w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-2 text-xs text-[#1d1d1f]"
      >
        <option value="top">Top</option>
        <option value="middle">Middle</option>
        <option value="bottom">Bottom</option>
      </select>

      <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Horizontal position</p>
      <select
        value={style.horizontalPosition}
        onChange={(e) => {
          const horizontalPosition = e.target.value as EditVideoTextHorizontalPosition;
          onPatch({ horizontalPosition, offsetX: offsetXForHorizontal(horizontalPosition) });
        }}
        className="mb-3 w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-2 text-xs text-[#1d1d1f]"
      >
        <option value="left">Left</option>
        <option value="center">Center</option>
        <option value="right">Right</option>
      </select>
    </>
  );
}

function InfographicOverlayFields({
  clip,
  onDisplayText,
  onPlacement,
  onPickColor,
}: {
  clip: TimelineClip;
  onDisplayText: (value: string) => void;
  onPlacement: (placement: string) => void;
  onPickColor: () => void;
}) {
  const displayValue = overlayDisplayTextForEditor(clip.remotion?.props, clip.text || '');
  const placement = clip.placement || clip.remotion?.placement || 'center';
  const color =
    (typeof clip.remotion?.props.colorHint === 'string' && clip.remotion.props.colorHint) ||
    (typeof clip.remotion?.props.color === 'string' && clip.remotion.props.color) ||
    clip.textColor ||
    '#ffffff';
  return (
    <div className="mt-4 border-t border-gray-100 pt-3.5">
      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
        Edit overlay
      </p>
      <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Display text</p>
      <textarea
        value={displayValue}
        rows={3}
        onChange={(e) => onDisplayText(e.target.value)}
        className="mb-3 w-full resize-none rounded-xl border border-gray-200 bg-[#f5f5f7] px-3 py-2 text-xs leading-relaxed text-[#1d1d1f] outline-none focus:border-[#1d1d1f] focus:ring-2 focus:ring-[#1d1d1f]/10"
      />
      <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Position</p>
      <select
        value={INFOGRAPHIC_PLACEMENTS.some((p) => p.id === placement) ? placement : 'center'}
        onChange={(e) => onPlacement(e.target.value)}
        className="mb-3 w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-2 text-xs text-[#1d1d1f]"
      >
        {INFOGRAPHIC_PLACEMENTS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Colour hint</p>
      <button
        type="button"
        onClick={onPickColor}
        className="mb-1 flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-medium text-[#1d1d1f] hover:border-gray-300"
      >
        <span
          className="h-5 w-5 flex-shrink-0 rounded-full border border-gray-200"
          style={{ background: color }}
        />
        {color}
      </button>
      <p className="text-[10px] leading-relaxed text-[#a1a1a6]">
        Colour hint is styling only — it is not shown as on-screen copy.
      </p>
    </div>
  );
}

/** Canva-style colour picker: search, custom/eyedropper/current swatches, default colour grid. */
function ColorPickerPanel({
  title,
  value,
  onChange,
  onClose,
}: {
  title: string;
  value: string;
  onChange: (hex: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const eyedropperSupported = typeof window !== 'undefined' && 'EyeDropper' in window;

  const applySearch = () => {
    const q = search.trim();
    if (!q) return;
    if (/^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(q)) {
      onChange(q.startsWith('#') ? q : `#${q}`);
      return;
    }
    const named = NAMED_COLORS[q.toLowerCase()];
    if (named) onChange(named);
  };

  const pickWithEyedropper = async () => {
    if (!eyedropperSupported) return;
    try {
      type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
      const EyeDropperClass = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper;
      const result = await new EyeDropperClass().open();
      if (result?.sRGBHex) onChange(result.sRGBHex);
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div
      role="button"
      tabIndex={-1}
      className="fixed inset-0 z-[92] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
          <p className="text-sm font-semibold text-[#1d1d1f]">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#f5f5f7]"
          >
            <X className="h-4 w-4 text-[#1d1d1f]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin' }}>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a1a1a6]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySearch();
              }}
              placeholder='Try "blue" or "#00c4cc"'
              className="w-full rounded-xl border border-gray-200 bg-[#f5f5f7] py-2.5 pl-9 pr-3 text-sm text-[#1d1d1f] outline-none focus:border-[#1d1d1f]"
            />
          </div>

          <div className="mb-4 flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => nativeInputRef.current?.click()}
              className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border border-gray-200"
              style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
              title="Custom colour"
            >
              <input
                ref={nativeInputRef}
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </button>
            {eyedropperSupported && (
              <button
                type="button"
                onClick={() => void pickWithEyedropper()}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 text-[#6e6e73] hover:border-gray-300"
                title="Eyedropper"
              >
                <Pipette className="h-4 w-4" />
              </button>
            )}
            <span
              className="h-9 w-9 flex-shrink-0 rounded-full border-2 border-[#1d1d1f]"
              style={{ background: value }}
              title={value}
            />
          </div>

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">
            Default colours
          </p>
          <div className="grid grid-cols-7 gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                className={`h-7 w-7 rounded-full border-2 ${
                  value.toLowerCase() === c ? 'border-[#1d1d1f]' : 'border-transparent'
                }`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export function StudioVideoEditingPanel({
  scriptText = '',
  isUnlocked = false,
  ideaTitle,
  scriptRowId = null,
  onFindMoreBroll,
}: {
  scriptText?: string;
  isUnlocked?: boolean;
  ideaTitle?: string | null;
  /** scripts_assigned row id — rendered video URLs are saved onto its `video` column. */
  scriptRowId?: string | number | null;
  /** Navigate to the B-roll library tab to pick more media. */
  onFindMoreBroll?: (kind: 'video' | 'image') => void;
}) {
  const [stage, setStage] = useState<Stage>('editor');
  const [setupOpen, setSetupOpen] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [playingVO, setPlayingVO] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sceneTimelines, setSceneTimelines] = useState<Record<string, TimelineState>>({});
  const sceneTimelinesRef = useRef(sceneTimelines);
  sceneTimelinesRef.current = sceneTimelines;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const brollVideoUploadRef = useRef<HTMLInputElement>(null);
  const brollImageUploadRef = useRef<HTMLInputElement>(null);
  const pendingUploadSceneIdRef = useRef<string | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  /** Set once flushSceneEdits is defined below (needs videoId, declared later) — selectScene calls it via this ref. */
  const flushSceneEditsRef = useRef<((sceneId: string) => void) | null>(null);
  /** Accumulates in-progress style/infographic edits per scene until the user moves on. */
  const pendingSceneEditsRef = useRef<Record<string, PendingSceneEdits>>({});
  /** Backend deletes — sent only when the user confirms Render, so clips can be re-inserted first. */
  const pendingDeletesRef = useRef<PendingDelete[]>([]);
  const syncedBeatIdsRef = useRef<Set<string>>(new Set());
  const syncedOverlayIdsRef = useRef<Set<string>>(new Set());
  const flushPendingDeletesRef = useRef<(() => void) | null>(null);
  const [detachedBrollCards, setDetachedBrollCards] = useState<Record<string, Suggestion[]>>({});

  const [timelinePanelHeight, setTimelinePanelHeight] = useState(() => {
    if (typeof window === 'undefined') return 240;
    const raw = window.localStorage.getItem('storio_timeline_height');
    const n = raw ? Number(raw) : 240;
    return Number.isFinite(n) ? Math.min(500, Math.max(150, n)) : 240;
  });
  const [textStyle, setTextStyle] = useState<TextStyle>({
    offsetX: 50,
    offsetY: 15,
    background: true,
    bgColor: '#000000',
    textColor: '#ffffff',
    fontSize: 72,
    fontStyle: 'Inter',
    animationStyle: 'fade_in',
  });
  const textStyleRef = useRef(textStyle);
  textStyleRef.current = textStyle;
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>({ ...DEFAULT_CAPTION_STYLE });
  const captionStyleRef = useRef(captionStyle);
  captionStyleRef.current = captionStyle;
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedSceneText, setExpandedSceneText] = useState<Set<string>>(new Set());
  const [previewItem, setPreviewItem] = useState<{ item: Suggestion; type: 'broll' | 'infographic' } | null>(null);
  const [previewRemotion, setPreviewRemotion] = useState<RemotionInfographicSpec | null>(null);
  const [colorPickerTarget, setColorPickerTarget] = useState<ColorPickerTarget | null>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('broll-videos');
  /** Mobile: which bottom-bar slide-up sheet is open, if any. */
  const [mobileSheet, setMobileSheet] = useState<'scenes' | 'library' | null>(null);

  const timelineApi = useVideoTimeline(createEmptyTimeline());
  const { setTimeline: replaceTimelineState } = timelineApi;
  const timelineRef = useRef(timelineApi.timeline);
  timelineRef.current = timelineApi.timeline;

  const selected = useMemo(
    () => scenes.find((s) => s.id === selectedId) ?? scenes[0] ?? null,
    [scenes, selectedId],
  );
  const hasScenes = scenes.length > 0;
  const showDummyLibrary = !hasScenes;
  const totalDuration = timelineApi.timeline.duration;
  const timeOrigin = selected?.start ?? 0;
  const selectedVoiceoverClip = useMemo(() => {
    if (!selected) return null;
    return (
      timelineApi.timeline.tracks
        .find((t) => t.id === DEFAULT_TRACK_IDS.voiceover)
        ?.clips.find((c) => c.sceneId === selected.id) ?? null
    );
  }, [timelineApi.timeline, selected]);

  const selectScene = useCallback(
    (nextId: string) => {
      if (nextId === selectedIdRef.current) return;
      setIsPlaying(false);
      const currentId = selectedIdRef.current;
      // Scene being left — flush any queued style/infographic edits.
      if (currentId) {
        flushSceneEditsRef.current?.(currentId);
      }
      const maps = { ...sceneTimelinesRef.current };
      if (currentId) {
        maps[currentId] = JSON.parse(JSON.stringify(timelineRef.current)) as TimelineState;
      }
      const scene = scenes.find((s) => s.id === nextId) ?? scenes[0];
      if (!scene) return;
      const target = ensureOverlayClips(
        ensureCaptionClip(maps[nextId] ?? createSceneTimeline(scene), scene),
        scene,
      );
      maps[nextId] = target;
      setSceneTimelines(maps);
      replaceTimelineState(target, false);
      setSelectedId(nextId);
      setCaptionStyle(scene.captionStyle ?? { ...DEFAULT_CAPTION_STYLE });
    },
    [scenes, replaceTimelineState],
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  /** Loads the curated Google Fonts once so the font-style picker actually renders each face. */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.querySelector(`link[href="${GOOGLE_FONTS_HREF}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_HREF;
    document.head.appendChild(link);
  }, []);

  /* ── Setup flow (voice + face/faceless, before the editor is shown) ── */
  const [userId, setUserId] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string | null>(null);
  const [videoKind, setVideoKind] = useState<VideoKind | null>(null);
  const [setupScript, setSetupScript] = useState(scriptText || '');
  const [voicePresets, setVoicePresets] = useState<VoicePreset[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [genVolume, setGenVolume] = useState(5);
  const [genLoudnessNorm, setGenLoudnessNorm] = useState(true);
  const [genTextNorm, setGenTextNorm] = useState(true);
  const [clonedAudioUrl, setClonedAudioUrl] = useState<string | null>(null);
  const [clonedVoiceName, setClonedVoiceName] = useState<string | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);
  const [isSubmittingSetup, setIsSubmittingSetup] = useState(false);
  const [faceScenes, setFaceScenes] = useState<FaceSceneDraft[]>([]);
  const [sceneBrollVideoSuggestions, setSceneBrollVideoSuggestions] = useState<Record<string, Suggestion[]>>({});
  const [sceneBrollImageSuggestions, setSceneBrollImageSuggestions] = useState<Record<string, Suggestion[]>>({});
  /** Scene-scoped overlays parsed from the /edit-video response's `text_list` / `infographics_list`. */
  const [sceneTextOverlays, setSceneTextOverlays] = useState<Record<string, EditVideoTextListItem[]>>({});
  const [sceneGraphicsOverlays, setSceneGraphicsOverlays] = useState<Record<string, RemotionInfographicSpec[]>>({});
  /** Media added via B-roll tab "Find more → Add" (always shown in sidebar sections). */
  const [manualBrollVideos, setManualBrollVideos] = useState<Suggestion[]>([]);
  const [manualBrollImages, setManualBrollImages] = useState<Suggestion[]>([]);
  /** video_id returned by /edit-video — required for every .../timeline/{video_id} PATCH call. */
  const [videoId, setVideoId] = useState<string | null>(null);
  const restoredCacheRef = useRef(false);
  const restoreIdentityRef = useRef('');

  /* ── Render video ── */
  const [queuedRequestCount, setQueuedRequestCount] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [renderConfirmOpen, setRenderConfirmOpen] = useState(false);
  const [isDownloadingRendered, setIsDownloadingRendered] = useState(false);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  /* ── Serialized backend save queue ──────────────────────────────────────────
   * Style/infographic/trim edits accumulate locally per-scene while the
   * user is working on that scene, and only get sent once they move on to the
   * next scene (see flushSceneEdits + selectScene). Every request that leaves
   * this component funnels through enqueueRequest so at most one is ever in
   * flight — the next one only starts once the previous has settled.
   */
  const requestQueueRef = useRef<Promise<void>>(Promise.resolve());
  const enqueueRequest = useCallback((task: () => Promise<void>) => {
    setQueuedRequestCount((n) => n + 1);
    requestQueueRef.current = requestQueueRef.current
      .catch(() => {})
      .then(() =>
        task()
          .catch((err) => {
            console.error('[video-edit queue]', err);
          })
          .finally(() => setQueuedRequestCount((n) => Math.max(0, n - 1))),
      );
  }, []);

  /** Marks burned-in caption style as changed for this scene. */
  const recordPendingCaption = useCallback((sceneId: string) => {
    const current = pendingSceneEditsRef.current[sceneId] ?? {};
    pendingSceneEditsRef.current[sceneId] = { ...current, captionStyle: true };
  }, []);

  const recordPendingOverlay = useCallback(
    (sceneId: string, clipId?: string, types?: Array<'text' | 'infographic'>) => {
      const current = pendingSceneEditsRef.current[sceneId] ?? {};
      const ids = new Set(current.overlayClipIds ?? []);
      if (clipId) {
        ids.add(clipId);
      } else {
        const wanted = new Set(types ?? ['text', 'infographic']);
        for (const track of timelineRef.current.tracks) {
          for (const clip of track.clips) {
            if (clip.sceneId === sceneId && wanted.has(clip.type as 'text' | 'infographic')) {
              ids.add(clip.id);
            }
          }
        }
      }
      pendingSceneEditsRef.current[sceneId] = { ...current, overlayClipIds: [...ids] };
    },
    [],
  );

  const recordPendingInfographic = useCallback((sceneId: string, patch: SceneInfographicUpdate) => {
    const current = pendingSceneEditsRef.current[sceneId] ?? {};
    pendingSceneEditsRef.current[sceneId] = {
      ...current,
      infographic: { ...(current.infographic ?? {}), ...patch },
    };
  }, []);

  const recordPendingBroll = useCallback((sceneId: string, clipId: string) => {
    const current = pendingSceneEditsRef.current[sceneId] ?? {};
    const ids = new Set(current.brollClipIds ?? []);
    ids.add(clipId);
    pendingSceneEditsRef.current[sceneId] = { ...current, brollClipIds: [...ids] };
  }, []);

  const recordPendingTrim = useCallback((sceneId: string, trim: { start: number; end: number }) => {
    const current = pendingSceneEditsRef.current[sceneId] ?? {};
    pendingSceneEditsRef.current[sceneId] = { ...current, trim };
  }, []);

  const recordPendingSplit = useCallback((sceneId: string, split: PendingSplit) => {
    const current = pendingSceneEditsRef.current[sceneId] ?? {};
    pendingSceneEditsRef.current[sceneId] = {
      ...current,
      splits: [...(current.splits ?? []), split],
    };
  }, []);

  const cancelPendingDelete = useCallback((opts: { beatId?: string | null; overlayId?: string | null }) => {
    pendingDeletesRef.current = pendingDeletesRef.current.filter((op) => {
      if (opts.beatId && op.beatId === opts.beatId) return false;
      if (opts.overlayId && op.overlayId === opts.overlayId) return false;
      return true;
    });
  }, []);

  const clipExistsOnTimelines = useCallback((match: (clip: TimelineClip) => boolean) => {
    const maps: Record<string, TimelineState> = { ...sceneTimelinesRef.current };
    if (selectedIdRef.current) maps[selectedIdRef.current] = timelineRef.current;
    return Object.values(maps).some((tl) => tl.tracks.some((t) => t.clips.some(match)));
  }, []);

  /** Looks up a scene's clip on a given track in the (about-to-be-left) timeline, for its scene-local start/end. */
  const sceneClipBounds = useCallback((trackId: string, sceneId: string) => {
    const clip = timelineRef.current.tracks
      .find((t) => t.id === trackId)
      ?.clips.find((c) => c.sceneId === sceneId);
    if (!clip) return null;
    return { start: clip.start, end: clip.start + clip.duration };
  }, []);

  /** Writes a clip patch onto a scene's stored timeline, and onto the live timeline if that scene is active. */
  const patchSceneClip = useCallback(
    (sceneId: string, clipId: string, patch: Partial<TimelineClip>) => {
      setSceneTimelines((prev) => {
        const tl = prev[sceneId];
        if (!tl) return prev;
        return {
          ...prev,
          [sceneId]: {
            ...tl,
            tracks: tl.tracks.map((t) => ({
              ...t,
              clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
            })),
          },
        };
      });
      if (selectedIdRef.current === sceneId) {
        timelineApi.updateClip(clipId, patch);
      }
    },
    [timelineApi],
  );

  const updateCaptionStyle = useCallback(
    (patch: Partial<CaptionStyle>) => {
      setCaptionStyle((prev) => ({ ...prev, ...patch }));
      const sceneId = selectedIdRef.current;
      if (!sceneId) return;
      setScenes((prev) =>
        prev.map((s) =>
          s.id === sceneId
            ? { ...s, captionStyle: { ...(s.captionStyle ?? DEFAULT_CAPTION_STYLE), ...patch } }
            : s,
        ),
      );
      const voClip = timelineRef.current.tracks
        .find((t) => t.id === DEFAULT_TRACK_IDS.voiceover)
        ?.clips.find((c) => c.sceneId === sceneId || c.type === 'voiceover');
      if (voClip) {
        const merged = { ...(voClip.captionStyle ?? DEFAULT_CAPTION_STYLE), ...patch };
        patchSceneClip(sceneId, voClip.id, { captionStyle: merged });
      }
      recordPendingCaption(sceneId);
    },
    [patchSceneClip, recordPendingCaption],
  );

  /** Called when the user leaves a scene — enqueues one request per edited field, in order. */
  const flushSceneEdits = useCallback(
    (sceneId: string) => {
      const pending = pendingSceneEditsRef.current[sceneId];
      delete pendingSceneEditsRef.current[sceneId];
      if (!pending || !videoId) return;

      if (pending.trim) {
        const trim = pending.trim;
        enqueueRequest(() =>
          ApiService.trimScene(videoId, sceneId, { start: trim.start, end: trim.end }).then(
            () => {},
            (err) => {
              showToast(err instanceof Error ? err.message : 'Failed to save trim');
            },
          ),
        );
      }

      if (pending.splits?.length) {
        for (const split of pending.splits) {
          const left = findTimelineClip(timelineRef.current, split.leftClipId);
          const right = findTimelineClip(timelineRef.current, split.rightClipId);
          if (!left || !right) continue;
          if (!syncedBeatIdsRef.current.has(split.beatId)) continue;
          enqueueRequest(async () => {
            try {
              await ApiService.splitSceneBeat(videoId, sceneId, split.beatId, {
                split_at: split.splitAtLocal,
              });
              await ApiService.insertSceneBeat(videoId, sceneId, split.beatId, {
                start: right.start,
                end: right.start + right.duration,
              });
              if (split.newBeatId) syncedBeatIdsRef.current.add(split.newBeatId);
              if (right.beatId) syncedBeatIdsRef.current.add(right.beatId);
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Failed to save clip split');
            }
          });
        }
      }

      if (pending.brollClipIds?.length) {
        const brollClips = timelineRef.current.tracks.find((t) => t.id === DEFAULT_TRACK_IDS.broll)?.clips ?? [];
        for (const clipId of pending.brollClipIds) {
          const clip = findTimelineClip(timelineRef.current, clipId);
          if (!clip || clip.type !== 'broll') continue;
          const source = clip.mediaKind === 'image' ? 'image' : 'video';
          const start = clip.start;
          const end = clip.start + clip.duration;
          const beatId = clip.beatId;
          const assetId = clip.assetId;
          const alreadySynced = Boolean(beatId && syncedBeatIdsRef.current.has(beatId));
          const hasNextBeat = brollClips.some(
            (c) => c.id !== clip.id && c.sceneId === sceneId && c.start >= end - 0.05,
          );

          if (clip.fromPexels && assetId != null && !alreadySynced) {
            enqueueRequest(() =>
              ApiService.insertTimelineBroll(videoId, {
                asset_id: assetId,
                source,
                scene_id: sceneId,
                start,
                end,
              }).then(
                (res) => {
                  const returnedBeat = asOverlayId(res.beat_id);
                  if (returnedBeat) {
                    syncedBeatIdsRef.current.add(returnedBeat);
                    patchSceneClip(sceneId, clip.id, { beatId: returnedBeat });
                  } else if (beatId) {
                    syncedBeatIdsRef.current.add(beatId);
                  }
                },
                (err) => {
                  showToast(err instanceof Error ? err.message : 'Failed to insert b-roll');
                },
              ),
            );
            continue;
          }

          if (assetId != null && beatId) {
            enqueueRequest(() =>
              ApiService.selectSceneBroll(videoId, sceneId, {
                asset_id: assetId,
                source,
                beat_id: beatId,
                start,
                end,
                adjust_next_beat: hasNextBeat,
              }).then(
                () => {
                  syncedBeatIdsRef.current.add(beatId);
                },
                (err) => {
                  showToast(err instanceof Error ? err.message : 'Failed to save b-roll selection');
                },
              ),
            );
          }
        }
      }

      if (pending.captionStyle) {
        const cs = captionStyleRef.current;
        const style: SceneStyleUpdate = {
          font_size: cs.fontSize,
          text_color: cs.textColor,
          outline_color: cs.outlineColor,
          animation_type: cs.animationType,
          background_color: cs.backgroundColor ?? null,
          vertical_position: cs.verticalPosition,
          margin_bottom_percent: Math.round(cs.offsetY),
          horizontal_position: cs.horizontalPosition,
          margin_horizontal_percent: marginHorizontalPercent(cs.offsetX, cs.horizontalPosition),
        };
        enqueueRequest(() =>
          ApiService.updateSceneStyle(videoId, sceneId, style).then(
            () => {},
            (err) => {
              showToast(err instanceof Error ? err.message : 'Failed to save caption style');
            },
          ),
        );
      }

      if (pending.overlayClipIds?.length) {
        const sceneNum =
          scenes.find((s) => s.id === sceneId)?.num ?? sceneId.replace(/^s/i, '') ?? '1';
        const ts = textStyleRef.current;
        for (const clipId of pending.overlayClipIds) {
          const clip = findTimelineClip(timelineRef.current, clipId);
          if (!clip || (clip.type !== 'text' && clip.type !== 'infographic')) continue;
          const beatId =
            clip.beatId || makeOverlayBeatId(sceneNum, clip.type === 'text' ? 'txt' : 'gfx');
          if (!clip.beatId) {
            patchSceneClip(sceneId, clip.id, { beatId });
          }
          const payload = buildBeatAnimationUpdate(clip, {
            textColor: ts.textColor,
            animationStyle: ts.animationStyle,
            fontSize: ts.fontSize,
            bgColor: ts.bgColor,
            background: ts.background,
          });
          if (!payload) continue;
          enqueueRequest(() =>
            ApiService.updateBeatAnimation(videoId, sceneId, beatId, payload).then(
              (res) => {
                const overlayId = overlayIdFromBeatResponse(res);
                if (overlayId) {
                  syncedOverlayIdsRef.current.add(overlayId);
                  patchSceneClip(sceneId, clip.id, { overlayId, beatId });
                }
                if (beatId) syncedBeatIdsRef.current.add(beatId);
              },
              (err) => {
                showToast(err instanceof Error ? err.message : 'Failed to save overlay');
              },
            ),
          );
        }
      }

      if (pending.infographic) {
        const infoBounds = sceneClipBounds(DEFAULT_TRACK_IDS.infographic, sceneId);
        const infographic: SceneInfographicUpdate = {
          ...pending.infographic,
          ...(infoBounds ? { start_seconds: infoBounds.start, end_seconds: infoBounds.end } : {}),
        };
        enqueueRequest(() =>
          ApiService.updateSceneInfographic(videoId, sceneId, infographic).then(
            () => {},
            (err) => {
              showToast(err instanceof Error ? err.message : 'Failed to save infographic');
            },
          ),
        );
      }
    },
    [videoId, enqueueRequest, showToast, sceneClipBounds, patchSceneClip, scenes],
  );
  flushSceneEditsRef.current = flushSceneEdits;

  const flushPendingDeletes = useCallback(() => {
    if (!videoId) return;
    const ops = pendingDeletesRef.current;
    pendingDeletesRef.current = [];
    for (const op of ops) {
      if (op.kind === 'broll' && op.beatId && op.sceneId) {
        if (clipExistsOnTimelines((c) => c.beatId === op.beatId)) continue;
        enqueueRequest(() =>
          ApiService.deleteSceneContent(videoId, op.sceneId, {
            content_type: op.contentType ?? 'video',
            beat_id: op.beatId!,
          }).then(
            () => {
              syncedBeatIdsRef.current.delete(op.beatId!);
            },
            (err) => {
              showToast(err instanceof Error ? err.message : 'Failed to delete media');
            },
          ),
        );
        continue;
      }
      if (op.kind === 'overlay' && op.overlayId) {
        if (clipExistsOnTimelines((c) => c.overlayId === op.overlayId)) continue;
        enqueueRequest(() =>
          ApiService.deleteTimelineOverlay(videoId, op.overlayId!).then(
            () => {
              syncedOverlayIdsRef.current.delete(op.overlayId!);
            },
            (err) => {
              showToast(err instanceof Error ? err.message : 'Failed to delete overlay');
            },
          ),
        );
      }
    }
  }, [videoId, enqueueRequest, showToast, clipExistsOnTimelines]);
  flushPendingDeletesRef.current = flushPendingDeletes;

  /** Flush whatever's still pending for the active scene if the editor unmounts. */
  useEffect(() => {
    return () => {
      if (selectedIdRef.current) flushSceneEditsRef.current?.(selectedIdRef.current);
    };
  }, []);

  /** Load a previously rendered video (from an earlier session) so "Generated video" works right away. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = await getScriptVideoUrl(scriptRowId);
      if (!cancelled && url) setRenderedVideoUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [scriptRowId]);

  const renderDisabled = !videoId || isRendering;
  const renderBusy = queuedRequestCount > 0 || isRendering;

  const openRenderConfirm = useCallback(() => {
    if (!videoId) return;
    setRenderConfirmOpen(true);
  }, [videoId]);

  const handleRenderVideo = useCallback(async () => {
    if (!videoId || isRendering) return;
    setIsRendering(true);
    try {
      const pendingIds = new Set(Object.keys(pendingSceneEditsRef.current));
      if (selectedIdRef.current) pendingIds.add(selectedIdRef.current);
      for (const sceneId of pendingIds) {
        flushSceneEditsRef.current?.(sceneId);
      }
      flushPendingDeletesRef.current?.();
      await requestQueueRef.current.catch(() => {});

      const { videoUrl } = await ApiService.renderVideo(videoId);
      if (!videoUrl) {
        showToast('Render finished, but no video URL was returned');
        return;
      }
      setRenderedVideoUrl(videoUrl);
      setRenderConfirmOpen(false);
      setVideoPreviewOpen(true);
      setPreviewPlaying(false);
      setPreviewTime(0);
      showToast('Video rendered');

      if (scriptRowId) {
        const save = await saveScriptVideoUrl({ scriptRowId, userId, videoUrl });
        if (!save.ok) {
          showToast(save.error || 'Video rendered, but failed to save');
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to render video');
    } finally {
      setIsRendering(false);
    }
  }, [videoId, isRendering, scriptRowId, userId, showToast]);

  const closeVideoPreview = useCallback(() => {
    previewVideoRef.current?.pause();
    setVideoPreviewOpen(false);
    setPreviewPlaying(false);
  }, []);

  const handleDownloadRenderedVideo = useCallback(async () => {
    if (!renderedVideoUrl || isDownloadingRendered) return;
    const safeName = (ideaTitle || 'storio-video')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const filename = `${safeName || 'storio-video'}.mp4`;
    setIsDownloadingRendered(true);
    try {
      let href = renderedVideoUrl;
      let revokeAfter: string | null = null;
      if (!renderedVideoUrl.startsWith('blob:')) {
        const res = await fetch(renderedVideoUrl);
        if (!res.ok) throw new Error('Failed to fetch video file');
        const blob = await res.blob();
        href = URL.createObjectURL(blob);
        revokeAfter = href;
      }
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (revokeAfter) URL.revokeObjectURL(revokeAfter);
    } catch {
      const a = document.createElement('a');
      a.href = renderedVideoUrl;
      a.download = filename;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setIsDownloadingRendered(false);
    }
  }, [renderedVideoUrl, isDownloadingRendered, ideaTitle]);

  const togglePreviewPlayback = useCallback(() => {
    const v = previewVideoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPreviewPlaying(true);
    } else {
      v.pause();
      setPreviewPlaying(false);
    }
  }, []);

  /** Draft values for the voiceover trim inputs — only sent to the backend on an explicit "Trim" click. */
  const [trimDraft, setTrimDraft] = useState<{ start: number; end: number } | null>(null);
  /** Last-committed trim per scene — reused as the trim UI's baseline on reopen. */
  const sceneTrimCommittedRef = useRef<Record<string, { start: number; end: number }>>({});
  useEffect(() => {
    setTrimDraft(null);
  }, [selected?.id]);

  useEffect(() => {
    setCaptionStyle(selected?.captionStyle ?? { ...DEFAULT_CAPTION_STYLE });
  }, [selected?.id]);

  /** Sends the trim window for the active scene's voiceover clip — only fires on the "Trim" button click. */
  const commitTrim = useCallback(() => {
    if (!selected || !videoId || !selectedVoiceoverClip) return;
    const naturalStart = Math.min(
      Math.max(0, selected.voiceStart ?? 0),
      Math.max(0, selectedVoiceoverClip.sourceDuration - 0.1),
    );
    const draft = trimDraft ??
      sceneTrimCommittedRef.current[selected.id] ?? {
        start: naturalStart,
        end: selected.sceneEndSec ?? selectedVoiceoverClip.sourceStart + selectedVoiceoverClip.sourceDuration,
      };
    const sceneId = selected.id;
    sceneTrimCommittedRef.current[sceneId] = draft;
    recordPendingTrim(sceneId, draft);
    showToast('Trim saved');
  }, [selected, videoId, selectedVoiceoverClip, trimDraft, recordPendingTrim, showToast]);

  const dedupeSuggestions = (items: Suggestion[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.label}|${item.assetUrl || item.previewUrl || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const brollTrackClips = useMemo(
    () => timelineApi.timeline.tracks.find((t) => t.id === DEFAULT_TRACK_IDS.broll)?.clips ?? [],
    [timelineApi.timeline.tracks],
  );

  /** B-roll clips of the selected scene — the media library mirrors these one-for-one. */
  const sceneBrollClips = useMemo(() => {
    const sceneId = selected?.id;
    return brollTrackClips.filter(
      (c) =>
        Boolean(c.sourceUrl || c.thumbnailUrl) &&
        (!sceneId || !c.sceneId || c.sceneId === sceneId),
    );
  }, [brollTrackClips, selected?.id]);

  /**
   * One card per clip on the track. Built from the clip itself — not by filtering the
   * backend's candidate lists, whose asset URLs often differ from the picked asset, which
   * left most clips without a card. Scene suggestions only enrich the card (size, match %).
   */
  const cardFromBrollClip = useCallback(
    (clip: TimelineClip, index: number): Suggestion => {
      const kind = clipMediaKind(clip);
      const pool = selected
        ? kind === 'image'
          ? sceneBrollImageSuggestions[selected.id] ?? []
          : sceneBrollVideoSuggestions[selected.id] ?? []
        : [];
      const match = pool.find((item) => clipMatchesSuggestion(clip, item));
      return {
        label: clip.name || brollDisplayName({ mediaKind: kind, index }),
        meta: match?.meta ?? (kind === 'image' ? 'Image on timeline' : 'Video on timeline'),
        start: clip.start,
        dur: Math.max(0.1, Math.round(clip.duration * 10) / 10),
        matchedScene: selected?.title ?? 'Timeline',
        matchPct: match?.matchPct ?? 100,
        mediaKind: kind,
        previewUrl: clip.thumbnailUrl || clip.sourceUrl || match?.previewUrl || null,
        assetUrl: clip.sourceUrl || match?.assetUrl || null,
        assetId: clip.assetId ?? match?.assetId ?? null,
        source: kind,
        fromPexels: clip.fromPexels ?? match?.fromPexels,
        beatId: clip.beatId,
      };
    },
    [selected, sceneBrollImageSuggestions, sceneBrollVideoSuggestions],
  );

  /** Uploads still staged in the library — hidden once their clip is on the track. */
  const stagedUploads = useCallback(
    (uploads: Suggestion[]) =>
      dedupeSuggestions(uploads).filter(
        (item) => !sceneBrollClips.some((c) => clipMatchesSuggestion(c, item)),
      ),
    [sceneBrollClips],
  );

  const sidebarBrollVideos = useMemo(() => {
    if (showDummyLibrary) {
      return dedupeSuggestions([...manualBrollVideos, ...BROLL_SUGGESTIONS]);
    }
    const sceneId = selected?.id ?? '';
    const onTimeline = sceneBrollClips
      .filter((c) => clipMediaKind(c) === 'video')
      .map(cardFromBrollClip);
    const detached = (detachedBrollCards[sceneId] ?? []).filter((item) => {
      if (item.mediaKind === 'image') return false;
      return !sceneBrollClips.some(
        (c) => clipMatchesSuggestion(c, item) || (item.beatId && c.beatId === item.beatId),
      );
    });
    return dedupeSuggestions([...stagedUploads(manualBrollVideos), ...detached, ...onTimeline]);
  }, [
    showDummyLibrary,
    manualBrollVideos,
    sceneBrollClips,
    cardFromBrollClip,
    stagedUploads,
    detachedBrollCards,
    selected?.id,
  ]);

  const sidebarBrollImages = useMemo(() => {
    if (showDummyLibrary) {
      return dedupeSuggestions([...manualBrollImages, ...BROLL_IMAGE_SUGGESTIONS]);
    }
    const sceneId = selected?.id ?? '';
    const onTimeline = sceneBrollClips
      .filter((c) => clipMediaKind(c) === 'image')
      .map(cardFromBrollClip);
    const detached = (detachedBrollCards[sceneId] ?? []).filter((item) => {
      if (item.mediaKind === 'video') return false;
      return !sceneBrollClips.some(
        (c) => clipMatchesSuggestion(c, item) || (item.beatId && c.beatId === item.beatId),
      );
    });
    return dedupeSuggestions([...stagedUploads(manualBrollImages), ...detached, ...onTimeline]);
  }, [
    showDummyLibrary,
    manualBrollImages,
    sceneBrollClips,
    cardFromBrollClip,
    stagedUploads,
    detachedBrollCards,
    selected?.id,
  ]);

  /** Graphic infographics (infographics_list) for the selected scene — never mixed with text_list. */
  const graphicsForSelectedScene = useMemo(() => {
    if (!selected) return [];
    const list = sceneGraphicsOverlays[selected.id];
    if (list && list.length > 0) return list;
    const fallback = selected.remotionInfographic;
    if (!fallback) return [];
    const textFps = new Set(
      (sceneTextOverlays[selected.id] ?? [])
        .map(textListItemToSpec)
        .filter((s): s is RemotionInfographicSpec => s != null)
        .map(overlayFingerprint),
    );
    if (textFps.has(overlayFingerprint(fallback))) return [];
    return [fallback];
  }, [selected, sceneGraphicsOverlays, sceneTextOverlays]);

  /** Full-screen/callout text overlays (text_list) — excluded when the same item is already in infographics_list. */
  const textOverlaysForSelectedScene = useMemo(() => {
    if (!selected) return [];
    const graphics = sceneGraphicsOverlays[selected.id] ?? [];
    const graphicIds = new Set(graphics.map((s) => s.overlayId).filter((id): id is string => Boolean(id)));
    const graphicFps = new Set(graphics.map(overlayFingerprint));
    return (sceneTextOverlays[selected.id] ?? [])
      .map((item) => textListItemToSpec(item))
      .filter((s): s is RemotionInfographicSpec => s != null)
      .filter((s) => {
        if (s.overlayId && graphicIds.has(s.overlayId)) return false;
        if (graphicFps.has(overlayFingerprint(s))) return false;
        return true;
      });
  }, [selected, sceneTextOverlays, sceneGraphicsOverlays]);

  const overlaySpecsForPreview = useMemo(
    () => [
      ...Object.values(sceneGraphicsOverlays).flat(),
      ...Object.values(sceneTextOverlays).flatMap((items) =>
        items.map(textListItemToSpec).filter((s): s is RemotionInfographicSpec => s != null),
      ),
    ],
    [sceneGraphicsOverlays, sceneTextOverlays],
  );

  const overlayClipsForCards = useMemo(
    () =>
      timelineApi.timeline.tracks
        .filter((t) => t.id === DEFAULT_TRACK_IDS.infographic || t.id === DEFAULT_TRACK_IDS.text)
        .flatMap((t) => t.clips),
    [timelineApi.timeline.tracks],
  );

  const suggestionFromPick = useCallback(
    (picked: PickedBrollItem): Suggestion => ({
      label: picked.label,
      meta: picked.meta,
      start: 0,
      dur: Math.max(1, Math.round(picked.durationSeconds)),
      matchedScene: selected?.title || 'Library',
      matchPct: 100,
      mediaKind: picked.kind === 'image' ? 'image' : 'video',
      previewUrl: picked.previewUrl,
      assetUrl: picked.assetUrl,
      assetId: picked.assetId ?? null,
      source: picked.kind === 'image' ? 'image' : 'video',
      fromPexels: true,
    }),
    [selected?.title],
  );

  const ingestPickedBroll = useCallback(
    (picked: PickedBrollItem, opts?: { silent?: boolean }) => {
      const suggestion = suggestionFromPick(picked);
      const sceneKey = picked.sceneId || selectedIdRef.current || '';
      const same = (s: Suggestion) =>
        s.label === suggestion.label &&
        (s.assetUrl || '') === (suggestion.assetUrl || '') &&
        (s.previewUrl || '') === (suggestion.previewUrl || '');

      // Always keep a copy in the manual lists so the sidebar still shows the item
      // even if scene suggestion maps are later overwritten by project restore.
      if (picked.kind === 'image') {
        setManualBrollImages((prev) => (prev.some(same) ? prev : [suggestion, ...prev]));
        if (sceneKey) {
          setSceneBrollImageSuggestions((prev) => {
            const list = prev[sceneKey] ?? [];
            if (list.some(same)) return prev;
            return { ...prev, [sceneKey]: [suggestion, ...list] };
          });
        }
      } else {
        setManualBrollVideos((prev) => (prev.some(same) ? prev : [suggestion, ...prev]));
        if (sceneKey) {
          setSceneBrollVideoSuggestions((prev) => {
            const list = prev[sceneKey] ?? [];
            if (list.some(same)) return prev;
            return { ...prev, [sceneKey]: [suggestion, ...list] };
          });
        }
      }

      if (!opts?.silent) {
        showToast(`Added to B-roll ${picked.kind === 'image' ? 'images' : 'videos'}`);
      }
    },
    [suggestionFromPick, showToast],
  );

  const syncPickedBrollIntoSidebar = useCallback(() => {
    listPickedBroll().forEach((item) => ingestPickedBroll(item, { silent: true }));
  }, [ingestPickedBroll]);

  useEffect(() => {
    syncPickedBrollIntoSidebar();
    setBrollPickListener((item) => ingestPickedBroll(item));
    return () => setBrollPickListener(null);
  }, [ingestPickedBroll, syncPickedBrollIntoSidebar]);

  const handleFindMoreBroll = useCallback(
    (kind: 'video' | 'image') => {
      startBrollPickSession({
        kind,
        sceneId: selected?.id ?? null,
        sceneTitle: selected?.title ?? null,
      });
      if (onFindMoreBroll) {
        onFindMoreBroll(kind);
      } else {
        showToast('Open the B-roll Videos tab to find more media');
      }
    },
    [selected?.id, selected?.title, onFindMoreBroll, showToast],
  );

  useEffect(() => {
    setSetupScript(scriptText || '');
  }, [scriptText]);

  /** Restore from the `videos` table only when that row's script matches this scripts_assigned script. */
  useEffect(() => {
    if (!userId) return;
    const identity = `${userId}|${scriptRowId ?? ''}|${(scriptText || '').trim()}`;
    const scriptChanged = restoreIdentityRef.current !== identity;
    if (scriptChanged) {
      restoreIdentityRef.current = identity;
      restoredCacheRef.current = false;
      setVideoId(null);
      setScenes([]);
      setSceneTimelines({});
      setSceneBrollVideoSuggestions({});
      setSceneBrollImageSuggestions({});
      setSceneTextOverlays({});
      setSceneGraphicsOverlays({});
      setRenderedVideoUrl(null);
      replaceTimelineState(createEmptyTimeline(), false);
    }
    if (restoredCacheRef.current) return;

    let cancelled = false;

    const applyMapped = (
      res: EditVideoResponse,
      extras?: {
        script?: string | null;
        voice?: string | null;
        finalVideoUrl?: string | null;
        selectedId?: string;
        textStyle?: TextStyle | null;
        videoKind?: VideoKind | null;
        selectedVoice?: string;
        sceneTimelines?: Record<string, TimelineState>;
        brollVideoSuggestions?: Record<string, Suggestion[]>;
        brollImageSuggestions?: Record<string, Suggestion[]>;
        keepCachedScenes?: Scene[];
        /** When true, don't backfill deleted b-roll beats from raw_scenes. */
        skipEnsureBroll?: boolean;
      },
    ) => {
      const mapped = mapEditVideoResponse(res);
      const mappedScenes = extras?.keepCachedScenes?.length
        ? extras.keepCachedScenes.map((s) => {
            const fresh = mapped.scenes.find((m) => m.id === s.id);
            if (!fresh) return s;
            return {
              ...s,
              voiceoverUrl: fresh.voiceoverUrl,
              wordSegments: fresh.wordSegments,
              captionStyle: fresh.captionStyle,
              voiceStart: fresh.voiceStart,
              sceneEndSec: fresh.sceneEndSec,
              beats: fresh.beats,
            };
          })
        : mapped.scenes;
      if (!mappedScenes.length) return false;

      restoredCacheRef.current = true;
      setVideoId(res.video_id);
      if (extras?.finalVideoUrl) setRenderedVideoUrl(extras.finalVideoUrl);

      for (const scene of res.scenes ?? []) {
        if (scene.trim && scene.scene_id) {
          sceneTrimCommittedRef.current[scene.scene_id] = scene.trim;
        }
      }

      const videos = extras?.brollVideoSuggestions ?? mapped.brollVideoSuggestions;
      const images = extras?.brollImageSuggestions ?? mapped.brollImageSuggestions;
      setScenes(mappedScenes);
      setSceneBrollVideoSuggestions(videos);
      setSceneBrollImageSuggestions(images);
      setSceneTextOverlays(extractSceneTextOverlays(res));
      setSceneGraphicsOverlays(extractSceneGraphicsOverlays(res));
      const firstId = extras?.selectedId || mappedScenes[0]?.id;
      setSelectedId(firstId);
      if (extras?.textStyle) setTextStyle(extras.textStyle);
      if (extras?.videoKind) setVideoKind(extras.videoKind);
      else setVideoKind('faceless');
      if (extras?.selectedVoice) setSelectedVoice(extras.selectedVoice);
      if (extras?.script) setSetupScript(extras.script);

      const maps = extras?.sceneTimelines
        ? Object.fromEntries(
            Object.entries(extras.sceneTimelines).map(([sceneId, tl]) => {
              const scene = mappedScenes.find((s) => s.id === sceneId);
              if (!scene) return [sceneId, tl];
              const withVo = ensureVoiceoverClip(tl, scene);
              const withCaptions = ensureCaptionClip(withVo, scene);
              const withOverlays = ensureOverlayClips(withCaptions, scene);
              return [sceneId, extras.skipEnsureBroll ? withOverlays : ensureBrollBeats(withOverlays, scene)];
            }),
          )
        : createSceneTimelinesMap(mappedScenes);
      setSceneTimelines(maps);
      replaceTimelineState((firstId && maps[firstId]) || maps[mappedScenes[0].id], false);
      const synced = collectSyncedIds(Object.values(maps));
      syncedBeatIdsRef.current = synced.beats;
      syncedOverlayIdsRef.current = synced.overlays;
      pendingDeletesRef.current = [];
      setDetachedBrollCards({});
      setStage('editor');
      queueMicrotask(() => {
        listPickedBroll().forEach((item) => ingestPickedBroll(item, { silent: true }));
      });
      return true;
    };

    (async () => {
      const row = await fetchVideosProject(userId, {
        script: scriptText || setupScript || '',
        scriptRowId,
      });
      if (cancelled) return;

      if (row) {
        const res = videosRowToEditVideoResponse(row);
        const mapped = mapEditVideoResponse(res);
        const maps = hydrateSceneTimelinesFromVideosRow(mapped.scenes, row);
        applyMapped(res, {
          script: row.script,
          voice: row.voice,
          finalVideoUrl: row.final_video_url,
          sceneTimelines: maps,
          brollVideoSuggestions: mapped.brollVideoSuggestions,
          brollImageSuggestions: mapped.brollImageSuggestions,
          skipEnsureBroll: true,
        });
        return;
      }
    })().catch((err) => {
      console.error('[videos restore]', err);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, scriptText, scriptRowId, replaceTimelineState, ingestPickedBroll]);

  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      }
      objectUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setVoicesLoading(true);
      try {
        const voices = await fetchPreMadeVoices();
        if (!cancelled) setVoicePresets(voices);
      } finally {
        if (!cancelled) setVoicesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      const id = session?.user?.id ?? null;
      setUserId(id);
      if (!id) return;
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('user_tier')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      setUserTier((profile?.user_tier || 'Free').trim() || 'Free');
      const { audioUrl, name } = await fetchClonedVoiceFromProfile(id);
      if (cancelled) return;
      setClonedAudioUrl(audioUrl);
      setClonedVoiceName(name);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cloningAllowed = canUseVoiceCloning(userTier);
  const clonedVoicePreset: VoicePreset = useMemo(
    () => ({
      id: 'cloned',
      name: clonedVoiceName || 'Your voice',
      tags: 'Cloned · Personal · Ready',
      wash: CLONED_VOICE_WASH,
    }),
    [clonedVoiceName],
  );
  const selectedVoicePreset = useMemo(
    () => voicePresets.find((v) => v.id === selectedVoice) ?? null,
    [voicePresets, selectedVoice],
  );

  const handlePreviewVoice = useCallback((e: MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedVoice(id);
    setPreviewVoiceId((cur) => (cur === id ? null : id));
  }, []);

  const handleCloned = useCallback(async () => {
    if (!userId) return;
    saveClonedVoiceProfile(userId);
    const { audioUrl, name } = await fetchClonedVoiceFromProfile(userId);
    setClonedAudioUrl(audioUrl);
    setClonedVoiceName(name);
    if (audioUrl) setSelectedVoice('cloned');
  }, [userId]);

  const setupScriptReady = Boolean(setupScript.trim());
  const setupVoiceReady = videoKind === 'with-face' ? true : Boolean(selectedVoice);
  const canSubmitSetup = Boolean(videoKind) && setupScriptReady && setupVoiceReady && !isSubmittingSetup;

  const runFacelessGenerate = useCallback(async () => {
    if (!canSubmitSetup || videoKind !== 'faceless') return;
    if (!userId) {
      showToast('Please sign in to generate video');
      return;
    }
    const voice =
      selectedVoice === 'cloned' ? 'user' : selectedVoicePreset?.referenceId?.trim() || '';
    if (!voice) {
      showToast('Pick a voice to continue');
      return;
    }
    const durationSeconds = estimateSpeechDurationSeconds(setupScript);
    const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

    setIsSubmittingSetup(true);
    try {
      const res: EditVideoResponse = await ApiService.editVideo({
        userId,
        script: setupScript.trim(),
        voice,
        langCode: 'en',
        durationMinutes,
        volume: genVolume,
        loudnessNormalization: genLoudnessNorm,
        textNormalization: genTextNorm,
      });
      const { scenes: mappedScenes, brollVideoSuggestions, brollImageSuggestions } = mapEditVideoResponse(res);
      if (!mappedScenes.length) {
        showToast('No scenes came back for this script');
        return;
      }
      restoredCacheRef.current = true;
      setVideoId(res.video_id);
      setScenes(mappedScenes);
      setSceneBrollVideoSuggestions(brollVideoSuggestions);
      setSceneBrollImageSuggestions(brollImageSuggestions);
      setSceneTextOverlays(extractSceneTextOverlays(res));
      setSceneGraphicsOverlays(extractSceneGraphicsOverlays(res));
      const maps = createSceneTimelinesMap(mappedScenes);
      const firstId = mappedScenes[0].id;
      setSceneTimelines(maps);
      setSelectedId(firstId);
      const timeline = maps[firstId];
      replaceTimelineState(timeline, false);
      const synced = collectSyncedIds(Object.values(maps));
      syncedBeatIdsRef.current = synced.beats;
      syncedOverlayIdsRef.current = synced.overlays;
      pendingDeletesRef.current = [];
      setDetachedBrollCards({});
      setStage('editor');
      setSetupOpen(false);
      showToast('Video generated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate video');
    } finally {
      setIsSubmittingSetup(false);
    }
  }, [
    canSubmitSetup,
    videoKind,
    userId,
    selectedVoice,
    selectedVoicePreset,
    setupScript,
    showToast,
    replaceTimelineState,
    genVolume,
    genLoudnessNorm,
    genTextNorm,
  ]);

  const runWithFaceGenerate = useCallback(() => {
    if (!canSubmitSetup || videoKind !== 'with-face') return;
    setIsSubmittingSetup(true);
    // Stub for the scene-wise script breakdown endpoint.
    setTimeout(() => {
      setFaceScenes(stubSplitScriptIntoScenes(setupScript));
      setIsSubmittingSetup(false);
      setStage('scenes');
    }, 500);
  }, [canSubmitSetup, videoKind, setupScript]);

  const uploadFaceSceneRecording = useCallback((id: string) => {
    setFaceScenes((list) =>
      list.map((s) =>
        s.id === id
          ? { ...s, filename: `${s.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_recording.mp4` }
          : s,
      ),
    );
  }, []);

  const allFaceScenesUploaded = faceScenes.length > 0 && faceScenes.every((s) => s.filename);

  const finishWithFaceSetup = useCallback(() => {
    if (!allFaceScenesUploaded) return;
    const nextScenes: Scene[] = faceScenes.map((s, i) => ({
      id: s.id,
      num: s.num,
      title: s.title,
      desc: s.script,
      start: i * 6,
      duration: 6,
      status: 'ready',
      mainParts: s.filename ? [{ filename: s.filename }] : [],
      joinStatus: 'single',
      broll: null,
      infographic: null,
    }));
    setVideoId(null);
    restoredCacheRef.current = true;
    setScenes(nextScenes);
    const maps = createSceneTimelinesMap(nextScenes);
    const firstId = faceScenes[0]?.id ?? 's1';
    setSceneTimelines(maps);
    setSelectedId(firstId);
    const timeline = maps[firstId] ?? createSceneTimeline(nextScenes[0]);
    replaceTimelineState(timeline, false);
    setStage('editor');
    setSetupOpen(false);
    showToast('Video generation started');
  }, [allFaceScenesUploaded, faceScenes, showToast, replaceTimelineState]);

  const voiceoverAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!playingVO) return;
    const scene = scenes.find((s) => s.id === playingVO);
    if (scene?.voiceoverUrl) return; // real audio ends itself via onended
    const ms = Math.min(scene?.duration ?? 3, 6) * 1000;
    const t = setTimeout(() => setPlayingVO(null), ms);
    return () => clearTimeout(t);
  }, [playingVO, scenes]);

  useEffect(() => {
    return () => {
      voiceoverAudioRef.current?.pause();
    };
  }, []);

  const toggleVoiceoverPlayback = useCallback((sc: Scene) => {
    if (playingVO === sc.id) {
      voiceoverAudioRef.current?.pause();
      setPlayingVO(null);
      return;
    }
    voiceoverAudioRef.current?.pause();
    if (sc.voiceoverUrl) {
      const audio = voiceoverAudioRef.current ?? new Audio();
      audio.src = sc.voiceoverUrl;
      audio.onended = () => setPlayingVO(null);
      voiceoverAudioRef.current = audio;
      void audio.play().catch(() => {
        showToast('Could not play voiceover');
        setPlayingVO(null);
      });
    }
    setPlayingVO(sc.id);
  }, [playingVO, showToast]);

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-24), JSON.stringify(scenes)]);
    setFuture([]);
  }, [scenes]);

  const undo = () => {
    if (timelineApi.historyLength) {
      timelineApi.undo();
      return;
    }
    if (!history.length) {
      showToast('Nothing to undo');
      return;
    }
    const prev = history[history.length - 1];
    setFuture((f) => [...f, JSON.stringify(scenes)]);
    setHistory((h) => h.slice(0, -1));
    const nextScenes = JSON.parse(prev) as Scene[];
    setScenes(nextScenes);
  };

  const redo = () => {
    if (timelineApi.futureLength) {
      timelineApi.redo();
      return;
    }
    if (!future.length) {
      showToast('Nothing to redo');
      return;
    }
    const next = future[future.length - 1];
    setHistory((h) => [...h, JSON.stringify(scenes)]);
    setFuture((f) => f.slice(0, -1));
    const nextScenes = JSON.parse(next) as Scene[];
    setScenes(nextScenes);
  };

  const updateScene = (id: string, patch: Partial<Scene>) => {
    setScenes((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addScene = () => {
    pushHistory();
    const n = scenes.length + 1;
    const last = scenes[scenes.length - 1];
    const start = last ? last.start + last.duration : 0;
    const id = `s${Date.now()}`;
    const scene: Scene = {
      id,
      num: String(n).padStart(2, '0'),
      title: 'New scene',
      desc: 'Describe what happens in this scene.',
      start,
      duration: 5,
      status: 'needs',
      mainParts: [],
      joinStatus: 'single',
      broll: null,
      infographic: null,
    };
    setScenes((list) => [...list, scene]);
    const tl = createSceneTimeline(scene);
    setSceneTimelines((prev) => {
      const snapshot = JSON.parse(JSON.stringify(timelineRef.current)) as TimelineState;
      return { ...prev, [selectedIdRef.current]: snapshot, [id]: tl };
    });
    if (selectedIdRef.current) {
      flushSceneEditsRef.current?.(selectedIdRef.current);
    }
    replaceTimelineState(tl, false);
    setSelectedId(id);
  };

  const openUploadFootage = (sceneId: string) => {
    if (sceneId !== selectedIdRef.current) selectScene(sceneId);
    pendingUploadSceneIdRef.current = sceneId;
    // Defer so scene switch paints before the native file dialog blocks the UI.
    requestAnimationFrame(() => fileInputRef.current?.click());
  };

  /** Uploads a local file into the B-roll videos/images library as a new pickable suggestion. */
  const onBrollUploadChosen = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'video' | 'image',
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name);
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif)$/i.test(file.name);
    if (kind === 'video' && !isVideo) {
      showToast('Please choose a video file (MP4, MOV, or WebM)');
      return;
    }
    if (kind === 'image' && !isImage) {
      showToast('Please choose an image file');
      return;
    }

    const url = URL.createObjectURL(file);
    objectUrlsRef.current.push(url);
    const dur = kind === 'video' ? await probeMediaDuration(url, 5) : 4;
    const suggestion: Suggestion = {
      label: file.name.replace(/\.[^.]+$/, ''),
      meta: kind === 'video' ? `Uploaded video · ${Math.round(dur)}s` : 'Uploaded image',
      start: 0,
      dur,
      matchedScene: selected?.title ?? 'Uploaded',
      matchPct: 100,
      mediaKind: kind,
      previewUrl: url,
      assetUrl: url,
      assetId: Math.floor(Math.random() * 1_000_000_000),
      source: kind,
    };
    if (kind === 'video') setManualBrollVideos((list) => [suggestion, ...list]);
    else setManualBrollImages((list) => [suggestion, ...list]);
    showToast(kind === 'video' ? 'Video added to B-roll videos' : 'Image added to B-roll images');
  };

  const onFootageFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const sceneId = pendingUploadSceneIdRef.current ?? selectedIdRef.current;
    pendingUploadSceneIdRef.current = null;
    if (!file || !sceneId) return;
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|webm|m4v)$/i.test(file.name)) {
      showToast('Please choose a video file (MP4, MOV, or WebM)');
      return;
    }

    const url = URL.createObjectURL(file);
    objectUrlsRef.current.push(url);
    const mediaDur = await probeMediaDuration(url, selected?.duration ?? 5);
    const sceneDur = timelineRef.current.duration || selected?.duration || mediaDur;
    const clipDur = Math.max(0.5, Math.min(mediaDur, sceneDur));

    const videoTrack = timelineRef.current.tracks.find((t) => t.id === DEFAULT_TRACK_IDS.video);
    const lastEnd =
      videoTrack?.clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0) ?? 0;
    const start = Math.min(lastEnd, Math.max(0, sceneDur - 0.1));

    pushHistory();
    setScenes((list) =>
      list.map((sc) => {
        if (sc.id !== sceneId) return sc;
        const mainParts = [...sc.mainParts, { filename: file.name, url }];
        return {
          ...sc,
          mainParts,
          status: 'ready' as const,
          joinStatus: mainParts.length > 1 ? 'join' : 'single',
        };
      }),
    );

    timelineApi.addClip(DEFAULT_TRACK_IDS.video, {
      id: `vid-${sceneId}-${Date.now()}`,
      type: 'video',
      name: file.name,
      sourceUrl: url,
      start,
      duration: clipDur,
      sourceStart: 0,
      sourceDuration: clipDur,
      originalSourceDuration: mediaDur,
      sceneId,
    });
    showToast('Footage added to Video track');
  };

  const movePart = (id: string, idx: number, dir: -1 | 1) => {
    pushHistory();
    setScenes((list) =>
      list.map((sc) => {
        if (sc.id !== id) return sc;
        const next = [...sc.mainParts];
        const j = idx + dir;
        if (j < 0 || j >= next.length) return sc;
        [next[idx], next[j]] = [next[j], next[idx]];
        return { ...sc, mainParts: next };
      }),
    );
    showToast('Reordered — timing will re-sync');
  };

  const removePart = (id: string, idx: number) => {
    pushHistory();
    const scene = scenes.find((s) => s.id === id);
    const removed = scene?.mainParts[idx];
    setScenes((list) =>
      list.map((sc) => {
        if (sc.id !== id) return sc;
        const mainParts = sc.mainParts.filter((_, i) => i !== idx);
        return {
          ...sc,
          mainParts,
          joinStatus: mainParts.length <= 1 ? 'single' : sc.joinStatus,
          status: mainParts.length === 0 ? 'needs' : sc.status,
        };
      }),
    );
    if (removed && id === selectedIdRef.current) {
      const videoTrack = timelineApi.timeline.tracks.find((t) => t.id === DEFAULT_TRACK_IDS.video);
      const clip = videoTrack?.clips.find(
        (c) => c.name === removed.filename || c.sourceUrl === removed.url,
      );
      if (clip) {
        timelineApi.selectClips([clip.id]);
        timelineApi.deleteSelected();
      }
    }
  };

  const insertSuggestion = (type: 'broll' | 'infographic', item: Suggestion) => {
    const target = selected;
    if (!target) {
      showToast('Generate voice and scenes first');
      return;
    }
    if (type === 'infographic') return; // Remotion infographics use insertRemotionInfographic

    const trackId = DEFAULT_TRACK_IDS.broll;
    const alreadyOnTimeline = timelineApi.timeline.tracks
      .find((t) => t.id === trackId)
      ?.clips.some((c) => clipMatchesSuggestion(c, item));
    if (alreadyOnTimeline) {
      showToast('Already on the timeline');
      return;
    }

    pushHistory();
    setScenes((prev) =>
      prev.map((sc) => {
        if (sc.id !== target.id) return sc;
        return {
          ...sc,
          broll: {
            label: item.label,
            url: item.assetUrl,
            thumbnailUrl: item.previewUrl,
          },
          status: sc.status === 'needs' ? 'ready' : sc.status,
        };
      }),
    );

    const start = Math.max(0, Math.min(timelineApi.timeline.currentTime, Math.max(0, totalDuration - 0.1)));
    const dur = Math.min(item.dur, Math.max(0.5, totalDuration - start));

    const brollTrack = timelineApi.timeline.tracks.find((t) => t.id === DEFAULT_TRACK_IDS.broll);
    const existingForScene = brollTrack?.clips.filter((c) => c.sceneId === target.id).length ?? 0;
    const beatId = item.beatId || makeBrollBeatId(target.num, existingForScene + 1);
    const clipId = `br-${Date.now()}`;
    const assetId = item.assetId ?? Math.floor(Math.random() * 1_000_000_000);

    timelineApi.addClip(DEFAULT_TRACK_IDS.broll, {
      id: clipId,
      type: 'broll',
      name: item.label,
      sourceUrl: item.assetUrl || item.previewUrl || undefined,
      thumbnailUrl: item.previewUrl || undefined,
      mediaKind: item.mediaKind === 'image' ? 'image' : 'video',
      start,
      duration: dur,
      sourceStart: 0,
      sourceDuration: dur,
      originalSourceDuration: dur,
      sceneId: target.id,
      beatId,
      assetId,
      fromPexels: Boolean(item.fromPexels),
    });

    cancelPendingDelete({ beatId: item.beatId });
    setDetachedBrollCards((prev) => {
      const list = prev[target.id] ?? [];
      const next = list.filter((s) => {
        if (item.beatId && s.beatId === item.beatId) return false;
        if (urlsMatch(s.assetUrl, item.assetUrl) || urlsMatch(s.previewUrl, item.previewUrl)) return false;
        return true;
      });
      if (next.length === list.length) return prev;
      return { ...prev, [target.id]: next };
    });

    showToast(`Inserted into ${target.title}`);
    recordPendingBroll(target.id, clipId);
  };

  /**
   * Fires after a b-roll clip ("beat") gets split on the timeline — tells the backend where the
   * split happened, then registers the boundaries of the newly split-off second clip. The right
   * half becomes its own beat, so it's assigned the next beat id in that scene.
   */
  const handleClipSplit = useCallback(
    (clip: TimelineClip, splitAt: number) => {
      if (clip.trackId !== DEFAULT_TRACK_IDS.broll || !clip.sceneId || !clip.beatId) return;
      const sceneId = clip.sceneId;
      const beatId = clip.beatId;
      const splitAtLocal = splitAt - clip.start;
      const rightClipId = `${clip.id}-b`;
      let newBeatId = beatId;
      const sceneNum = scenes.find((s) => s.id === sceneId)?.num;
      if (sceneNum) {
        const brollTrack = timelineApi.timeline.tracks.find((t) => t.id === DEFAULT_TRACK_IDS.broll);
        const existingForScene = brollTrack?.clips.filter((c) => c.sceneId === sceneId).length ?? 0;
        newBeatId = makeBrollBeatId(sceneNum, existingForScene + 1);
        timelineApi.updateClip(rightClipId, {
          beatId: newBeatId,
          assetId: clip.assetId,
          fromPexels: clip.fromPexels,
        });
      }
      recordPendingSplit(sceneId, {
        beatId,
        leftClipId: clip.id,
        rightClipId,
        splitAtLocal,
        newBeatId,
      });
      recordPendingBroll(sceneId, clip.id);
      recordPendingBroll(sceneId, rightClipId);
    },
    [scenes, timelineApi, recordPendingSplit, recordPendingBroll],
  );

  /** Mobile bottom-bar Split button — captures the selected clip before splitting so handleClipSplit can sync it. */
  const splitSelectedClip = useCallback(() => {
    const id = timelineApi.timeline.selectedClipIds[0];
    const clip = id
      ? timelineApi.timeline.tracks.flatMap((t) => t.clips).find((c) => c.id === id)
      : undefined;
    const splitAt = timelineApi.timeline.currentTime;
    timelineApi.splitSelectedAtPlayhead();
    if (clip) handleClipSplit(clip, splitAt);
  }, [timelineApi, handleClipSplit]);

  const insertRemotionInfographic = useCallback((specArg?: RemotionInfographicSpec) => {
    const target = selected;
    const spec = specArg ?? target?.remotionInfographic;
    if (!target || !spec) return;

    const already = timelineApi.timeline.tracks.some((t) =>
      t.clips.some((c) => {
        if (c.sceneId && c.sceneId !== target.id) return false;
        if (spec.overlayId && c.overlayId === spec.overlayId) return true;
        return c.remotion?.compositionId === spec.compositionId && c.sceneId === target.id;
      }),
    );
    if (already) {
      showToast('Already on the timeline');
      return;
    }

    const label = remotionInfographicLabel(spec);
    const start = resolveInfographicStartSeconds(spec.trigger, 0, spec.startSeconds);
    const durSec = remotionDurationSeconds(spec.durationFrames, EDITOR_FPS);
    if (durSec <= 0) {
      showToast('Invalid infographic duration');
      return;
    }

    const isFull =
      spec.placement === 'full_frame' ||
      spec.placement === 'fullscreen' ||
      spec.placement === 'full_screen' ||
      (!spec.placement && spec.animationType.startsWith('full_screen_'));

    pushHistory();
    setScenes((prev) =>
      prev.map((sc) =>
        sc.id !== target.id
          ? sc
          : {
              ...sc,
              infographic: {
                label,
                mode: isFull ? 'fullscreen' : 'overlay',
                placement: spec.placement || null,
              },
              status: sc.status === 'needs' ? 'ready' : sc.status,
            },
      ),
    );

    cancelPendingDelete({ overlayId: spec.overlayId });
    timelineApi.addClip(DEFAULT_TRACK_IDS.infographic, {
      id: `info-remotion-${target.id}-${Date.now()}`,
      type: 'infographic',
      name: label,
      text: label,
      start,
      duration: durSec,
      sourceStart: 0,
      sourceDuration: durSec,
      originalSourceDuration: durSec,
      sceneId: target.id,
      overlayId: spec.overlayId,
      beatId: spec.beatId || makeOverlayBeatId(target.num, 'gfx'),
      placement: spec.placement,
      mode: isFull ? 'fullscreen' : 'overlay',
      remotion: {
        compositionId: spec.compositionId,
        animationType: spec.animationType,
        props: spec.props,
        durationFrames: spec.durationFrames,
        trigger: spec.trigger,
        placement: spec.placement,
        renderEngineHint: spec.renderEngineHint,
      },
    });

    showToast(`Inserted into ${target.title}`);

    recordPendingInfographic(target.id, {
      animation_type: spec.animationType as EditVideoInfographicAnimationType,
      duration_frames: spec.durationFrames,
    });
  }, [selected, timelineApi, pushHistory, showToast, recordPendingInfographic, cancelPendingDelete]);

  const isRemotionAlreadyOnTimeline = useCallback(
    (spec: RemotionInfographicSpec | null | undefined) => {
      if (!spec || !selected) return false;
      return timelineApi.timeline.tracks.some((t) =>
        t.clips.some((c) => {
          if (c.sceneId && c.sceneId !== selected.id) return false;
          if (spec.overlayId && c.overlayId === spec.overlayId) return true;
          if (c.remotion?.compositionId === spec.compositionId && c.remotion?.animationType === spec.animationType) {
            return true;
          }
          if (c.type === 'text' && spec.props.title && c.text === spec.props.title) return true;
          return false;
        }),
      );
    },
    [selected, timelineApi.timeline.tracks],
  );
  const remotionAlreadyOnTimeline = isRemotionAlreadyOnTimeline(selected?.remotionInfographic);

  const addTextClip = useCallback(() => {
    const start = timelineApi.timeline.currentTime;
    const id = `txt-${Date.now()}`;
    const sceneId = selectedId;
    const sceneNum = selected?.num ?? '1';
    const ts = textStyleRef.current;
    const beatId = makeTextBeatId(sceneNum);
    timelineApi.addClip(DEFAULT_TRACK_IDS.text, {
      id,
      type: 'text',
      name: 'New text',
      text: 'New text',
      start,
      duration: 3,
      sourceStart: 0,
      sourceDuration: 3,
      sceneId,
      beatId,
      offsetX: ts.offsetX,
      offsetY: ts.offsetY,
      textColor: ts.textColor,
      bgColor: ts.bgColor,
      animationStyle: ts.animationStyle,
    });
    timelineApi.selectClips([id]);
    if (sceneId) recordPendingOverlay(sceneId, id);
    showToast('Text clip added');
  }, [timelineApi, selectedId, selected?.num, showToast, recordPendingOverlay]);

  const applyInfographicDisplayText = useCallback(
    (clip: TimelineClip, value: string) => {
      const previous = clip.remotion?.props.displayText ?? clip.remotion?.props.display_text;
      const payload = displayTextPayloadFromEditor(value, previous);
      const first = Array.isArray(payload) ? payload[0] : payload;
      const label = (first || 'Infographic').slice(0, 48);
      timelineApi.updateClip(clip.id, {
        text: Array.isArray(payload) ? payload.join('\n') : payload,
        name: label,
        remotion: clip.remotion
          ? {
              ...clip.remotion,
              props: {
                ...clip.remotion.props,
                displayText: payload,
                ...(typeof payload === 'string' ? { title: payload } : {}),
              },
            }
          : clip.remotion,
      });
      const sceneId = clip.sceneId || selectedIdRef.current;
      if (sceneId) recordPendingOverlay(sceneId, clip.id);
    },
    [timelineApi, recordPendingOverlay],
  );

  const applyInfographicPlacement = useCallback(
    (clip: TimelineClip, placement: string) => {
      const remotion = clip.remotion;
      const geo =
        remotion?.props.geometryPx && typeof remotion.props.geometryPx === 'object'
          ? (remotion.props.geometryPx as { width?: number; height?: number })
          : undefined;
      const w = typeof geo?.width === 'number' ? geo.width : 520;
      const h = typeof geo?.height === 'number' ? geo.height : 160;
      const pos = placementToDesignPx(placement, w, h);
      const offsets = placementToPreviewOffsets(placement);
      timelineApi.updateClip(clip.id, {
        placement,
        offsetX: offsets.offsetX,
        offsetY: offsets.offsetY,
        remotion: remotion
          ? {
              ...remotion,
              placement,
              props: { ...remotion.props, geometryPx: { ...pos, width: w, height: h } },
            }
          : remotion,
      });
      const sceneId = clip.sceneId || selectedIdRef.current;
      if (sceneId) recordPendingOverlay(sceneId, clip.id);
    },
    [timelineApi, recordPendingOverlay],
  );

  const applyInfographicColor = useCallback(
    (clip: TimelineClip, hex: string) => {
      timelineApi.updateClip(clip.id, {
        textColor: hex,
        remotion: clip.remotion
          ? {
              ...clip.remotion,
              props: { ...clip.remotion.props, colorHint: hex, color: hex },
            }
          : clip.remotion,
      });
      const sceneId = clip.sceneId || selectedIdRef.current;
      if (sceneId) recordPendingOverlay(sceneId, clip.id);
    },
    [timelineApi, recordPendingOverlay],
  );

  const queueClipDeletion = useCallback(
    (clip: TimelineClip) => {
      const sceneId = clip.sceneId || selectedIdRef.current;
      if (!sceneId) return;

      const pending = pendingSceneEditsRef.current[sceneId];
      if (pending) {
        pendingSceneEditsRef.current[sceneId] = {
          ...pending,
          overlayClipIds: pending.overlayClipIds?.filter((id) => id !== clip.id),
          brollClipIds: pending.brollClipIds?.filter((id) => id !== clip.id),
        };
      }

      if (clip.type === 'broll') {
        const kind = clipMediaKind(clip);
        const pool =
          kind === 'image'
            ? sceneBrollImageSuggestions[sceneId] ?? []
            : sceneBrollVideoSuggestions[sceneId] ?? [];
        const match = pool.find((item) => clipMatchesSuggestion(clip, item));
        const card: Suggestion = {
          label: clip.name || (kind === 'image' ? 'Image' : 'Video'),
          meta: 'Removed from timeline',
          start: clip.start,
          dur: Math.max(0.1, Math.round(clip.duration * 10) / 10),
          matchedScene: scenes.find((s) => s.id === sceneId)?.title ?? 'Timeline',
          matchPct: match?.matchPct ?? 100,
          mediaKind: kind,
          previewUrl: clip.thumbnailUrl || clip.sourceUrl || match?.previewUrl || null,
          assetUrl: clip.sourceUrl || match?.assetUrl || null,
          assetId: clip.assetId ?? match?.assetId ?? null,
          source: kind,
          fromPexels: clip.fromPexels ?? match?.fromPexels,
          beatId: clip.beatId,
        };
        setDetachedBrollCards((prev) => {
          const list = prev[sceneId] ?? [];
          if (
            list.some(
              (s) =>
                (clip.beatId && s.beatId === clip.beatId) ||
                urlsMatch(s.assetUrl, clip.sourceUrl) ||
                urlsMatch(s.previewUrl, clip.thumbnailUrl),
            )
          ) {
            return prev;
          }
          return { ...prev, [sceneId]: [card, ...list] };
        });
        if (clip.beatId && syncedBeatIdsRef.current.has(clip.beatId)) {
          const already = pendingDeletesRef.current.some(
            (op) => op.kind === 'broll' && op.beatId === clip.beatId,
          );
          if (!already) {
            pendingDeletesRef.current.push({
              sceneId,
              kind: 'broll',
              beatId: clip.beatId,
              contentType: kind === 'image' ? 'image' : 'video',
            });
          }
        }
        return;
      }

      if ((clip.type === 'infographic' || clip.type === 'text') && clip.overlayId) {
        if (!syncedOverlayIdsRef.current.has(clip.overlayId)) return;
        const already = pendingDeletesRef.current.some(
          (op) => op.kind === 'overlay' && op.overlayId === clip.overlayId,
        );
        if (!already) {
          pendingDeletesRef.current.push({
            sceneId,
            kind: 'overlay',
            overlayId: clip.overlayId,
          });
        }
      }
    },
    [scenes, sceneBrollImageSuggestions, sceneBrollVideoSuggestions],
  );

  const handleDeleteSelected = useCallback(() => {
    const ids = new Set(timelineApi.timeline.selectedClipIds);
    if (!ids.size) return;
    const clips = timelineApi.timeline.tracks.flatMap((t) => t.clips).filter((c) => ids.has(c.id));
    timelineApi.deleteSelected();
    clips.forEach(queueClipDeletion);
  }, [timelineApi, queueClipDeletion]);

  const timelineHasSuggestion = useCallback(
    (trackId: string, item: Suggestion) =>
      Boolean(
        timelineApi.timeline.tracks
          .find((t) => t.id === trackId)
          ?.clips.some((c) => clipMatchesSuggestion(c, item)),
      ),
    [timelineApi.timeline.tracks],
  );

  const toggleSceneText = useCallback((id: string) => {
    setExpandedSceneText((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const beginResizeTimeline = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = timelinePanelHeight;
    const move = (ev: PointerEvent) => {
      const delta = startY - ev.clientY;
      const next = Math.min(Math.round(window.innerHeight * 0.65), Math.max(150, startH + delta));
      setTimelinePanelHeight(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setTimelinePanelHeight((h) => {
        try {
          window.localStorage.setItem('storio_timeline_height', String(h));
        } catch {
          /* ignore */
        }
        return h;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [timelinePanelHeight]);

  const openSetupModal = useCallback(() => {
    setStage('setup');
    setSetupOpen(true);
  }, []);

  const closeSetupModal = useCallback(() => {
    if (isSubmittingSetup) return;
    setSetupOpen(false);
    setStage('editor');
  }, [isSubmittingSetup]);

  const setupDialog = setupOpen ? (
      <div
        className="absolute inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
        aria-label="AI video editing setup"
        onClick={closeSetupModal}
      >
        <div
          className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={closeSetupModal}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f7] text-[#6e6e73] hover:bg-gray-200 hover:text-[#1d1d1f]"
            aria-label="Close setup"
          >
            <X className="h-4 w-4" />
          </button>
          {stage === 'setup' ? (
            <>
              <div className="flex-shrink-0 border-b border-gray-100 px-6 py-5">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-600">
                  AI Video Editing
                </p>
                <h2 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">
                  {ideaTitle ? `Set up "${ideaTitle}"` : 'Set up your video'}
                </h2>
                <p className="mt-1 text-xs text-[#6e6e73]">
                  Choose a video type, add your script, and pick a voice.
                </p>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                {/* Face / faceless */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-[#6e6e73]">
                    Is this a with-face or faceless video?
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setVideoKind('faceless')}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3.5 text-center transition-all ${
                        videoKind === 'faceless'
                          ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white shadow-sm'
                          : 'border-gray-200 bg-[#fafafa] text-[#1d1d1f] hover:border-gray-300'
                      }`}
                    >
                      <UserRoundX className="h-4.5 w-4.5" />
                      <span className="text-xs font-semibold">Faceless video</span>
                      <span className={`text-[10px] ${videoKind === 'faceless' ? 'text-white/65' : 'text-[#86868b]'}`}>
                        AI voice over footage
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoKind('with-face')}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3.5 text-center transition-all ${
                        videoKind === 'with-face'
                          ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white shadow-sm'
                          : 'border-gray-200 bg-[#fafafa] text-[#1d1d1f] hover:border-gray-300'
                      }`}
                    >
                      <UserRound className="h-4.5 w-4.5" />
                      <span className="text-xs font-semibold">With face video</span>
                      <span className={`text-[10px] ${videoKind === 'with-face' ? 'text-white/65' : 'text-[#86868b]'}`}>
                        You record each scene
                      </span>
                    </button>
                  </div>
                </div>

                {/* Voice selection */}
                <div className={videoKind === 'with-face' ? 'pointer-events-none opacity-40' : ''}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-[#6e6e73]">
                      Voice {videoKind === 'with-face' && '(not needed for on-camera videos)'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (!cloningAllowed) {
                          showToast('Voice cloning is available on Plus and Pro plans');
                          return;
                        }
                        setCloneOpen(true);
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6e6e73] hover:text-[#1d1d1f]"
                    >
                      <Mic className="h-3 w-3" />
                      {clonedAudioUrl ? 'Re-clone voice' : 'Clone your voice'}
                    </button>
                  </div>
                  {voicesLoading ? (
                    <div className="flex items-center justify-center py-6 text-[#6e6e73]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {clonedAudioUrl && (
                        <VoiceCard
                          voice={clonedVoicePreset}
                          active={selectedVoice === 'cloned'}
                          onSelect={() => setSelectedVoice('cloned')}
                          onPreview={(e) => handlePreviewVoice(e, 'cloned')}
                          isPreviewing={previewVoiceId === 'cloned'}
                        />
                      )}
                      {voicePresets.map((v) => (
                        <VoiceCard
                          key={v.id}
                          voice={v}
                          active={selectedVoice === v.id}
                          onSelect={() => setSelectedVoice(v.id)}
                          onPreview={(e) => handlePreviewVoice(e, v.id)}
                          isPreviewing={previewVoiceId === v.id}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Audio settings */}
                <div className={videoKind === 'with-face' ? 'pointer-events-none opacity-40' : ''}>
                  <p className="mb-2 text-[11px] font-semibold text-[#6e6e73]">Audio settings</p>
                  <div className="space-y-3 rounded-2xl border border-gray-200 bg-[#fafafa] p-3">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#1d1d1f]">Volume</span>
                        <span className="text-[11px] font-semibold text-[#6e6e73]">{genVolume}</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={genVolume}
                        onChange={(e) => setGenVolume(Number(e.target.value))}
                        className="w-full accent-[#1d1d1f]"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-[#1d1d1f]">Loudness normalization</p>
                        <p className="text-[10px] leading-relaxed text-[#86868b]">
                          Evens out the volume levels across different audio blocks or sections to provide a
                          consistent listening experience.
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 overflow-hidden rounded-lg border border-gray-200">
                        <button
                          type="button"
                          onClick={() => setGenLoudnessNorm(true)}
                          className={`px-2.5 py-1 text-[11px] font-semibold ${
                            genLoudnessNorm ? 'bg-[#1d1d1f] text-white' : 'bg-white text-[#6e6e73]'
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setGenLoudnessNorm(false)}
                          className={`px-2.5 py-1 text-[11px] font-semibold ${
                            !genLoudnessNorm ? 'bg-[#1d1d1f] text-white' : 'bg-white text-[#6e6e73]'
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-[#1d1d1f]">Text normalization</p>
                        <p className="text-[10px] leading-relaxed text-[#86868b]">
                          Improves reading accuracy for numbers, currency amounts, and similar text.
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 overflow-hidden rounded-lg border border-gray-200">
                        <button
                          type="button"
                          onClick={() => setGenTextNorm(true)}
                          className={`px-2.5 py-1 text-[11px] font-semibold ${
                            genTextNorm ? 'bg-[#1d1d1f] text-white' : 'bg-white text-[#6e6e73]'
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setGenTextNorm(false)}
                          className={`px-2.5 py-1 text-[11px] font-semibold ${
                            !genTextNorm ? 'bg-[#1d1d1f] text-white' : 'bg-white text-[#6e6e73]'
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Script */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-[#6e6e73]">Script</p>
                  <textarea
                    value={setupScript}
                    onChange={(e) => setSetupScript(e.target.value)}
                    placeholder={
                      isUnlocked ? undefined : 'Paste or write the script for this video…'
                    }
                    rows={4}
                    className="w-full min-h-[90px] max-h-[130px] resize-none rounded-xl border border-gray-200 bg-[#f5f5f7] px-3 py-2.5 text-xs leading-relaxed text-[#1d1d1f] outline-none focus:border-[#1d1d1f] focus:ring-2 focus:ring-[#1d1d1f]/10"
                  />
                </div>
              </div>

              <div className="flex-shrink-0 border-t border-gray-100 p-4">
                <button
                  type="button"
                  disabled={!canSubmitSetup}
                  onClick={() => {
                    if (videoKind === 'faceless') void runFacelessGenerate();
                    else if (videoKind === 'with-face') runWithFaceGenerate();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSubmittingSetup ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-amber-300" />
                  )}
                  {!videoKind
                    ? 'Choose a video type'
                    : videoKind === 'faceless'
                      ? 'Generate video'
                      : 'Get scene-wise script'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex-shrink-0 border-b border-gray-100 px-6 py-5">
                <button
                  type="button"
                  onClick={() => setStage('setup')}
                  className="mb-2 text-[11px] font-semibold text-[#6e6e73] hover:text-[#1d1d1f]"
                >
                  ← Back
                </button>
                <h2 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">
                  Upload your scenes
                </h2>
                <p className="mt-1 text-xs text-[#6e6e73]">
                  Record and upload footage for each scene of the script, then generate.
                </p>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 py-4">
                {faceScenes.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-[#fafafa] p-3"
                  >
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-white border border-gray-200 text-[10px] font-semibold text-[#6e6e73]">
                      {s.num}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#1d1d1f]">{s.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-[#6e6e73]">{s.script}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => uploadFaceSceneRecording(s.id)}
                      className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                        s.filename
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-white text-[#1d1d1f] hover:border-gray-300'
                      }`}
                    >
                      {s.filename ? (
                        <>
                          <Check className="h-3 w-3" /> Uploaded
                        </>
                      ) : (
                        <>
                          <Video className="h-3 w-3" /> Upload
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex-shrink-0 border-t border-gray-100 p-4">
                <p className="mb-2 text-center text-[11px] text-[#86868b]">
                  {faceScenes.filter((s) => s.filename).length} of {faceScenes.length} scenes uploaded
                </p>
                <button
                  type="button"
                  disabled={!allFaceScenesUploaded}
                  onClick={finishWithFaceSetup}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  Generate
                </button>
              </div>
            </>
          )}
        </div>

        </div>
  ) : null;

  return (
    <div
      className="relative flex h-full min-h-0 w-full overflow-hidden rounded-2xl border border-gray-200 bg-[#f5f5f7] shadow-sm"
      aria-label="AI video editing"
    >
      {setupDialog}

      <VoiceCloneModal
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        onCloned={handleCloned}
        userId={userId}
      />

      {/* ── Desktop: 3-column layout ── */}
      <div className="hidden h-full min-h-0 w-full lg:flex">

      {/* ── Left: Storyboard ── */}
      <aside className="flex h-full min-h-0 w-[min(280px,26%)] min-w-[220px] max-w-[300px] flex-shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white">
        <div className="flex-shrink-0 border-b border-gray-100 px-4 py-3.5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6e6e73]">
            Storyboard
          </p>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-[#1d1d1f]">Scenes</h2>
            {hasScenes ? (
              <button
                type="button"
                onClick={addScene}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-[#f5f5f7] text-[#1d1d1f] hover:bg-gray-200"
                aria-label="Add scene"
              >
                <Plus className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {!hasScenes ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-5 text-center">
            <p className="text-xs leading-relaxed text-[#86868b]">
              No scenes yet. Generate a voiceover and scene breakdown to start editing.
            </p>
            <button
              type="button"
              onClick={openSetupModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              Generate voice and scenes
            </button>
          </div>
        ) : (
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3" style={{ scrollbarWidth: 'thin' }}>
          {scenes.map((sc) => {
            const active = sc.id === selectedId;
            return (
              <div
                key={sc.id}
                role="button"
                tabIndex={0}
                onClick={() => selectScene(sc.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') selectScene(sc.id);
                }}
                className={`cursor-pointer rounded-2xl border p-3 transition-colors ${
                  active
                    ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white shadow-sm'
                    : 'border-gray-200 bg-[#fafafa] hover:border-gray-300'
                }`}
              >
                <div className="mb-2 flex items-start gap-2.5">
                  <span
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold tabular-nums ${
                      active ? 'bg-white/10 text-white/80' : 'bg-white border border-gray-200 text-[#6e6e73]'
                    }`}
                  >
                    {sc.num}
                  </span>
                  <p className={`pt-1 text-sm font-semibold leading-snug ${active ? 'text-white' : 'text-[#1d1d1f]'}`}>
                    {sc.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSceneText(sc.id);
                  }}
                  className={`mb-2.5 flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold ${
                    active
                      ? 'bg-white/8 text-white/80 hover:bg-white/12'
                      : 'border border-gray-100 bg-white text-[#6e6e73] hover:border-gray-200'
                  }`}
                >
                  <span>Scene text</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${expandedSceneText.has(sc.id) ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedSceneText.has(sc.id) && (
                  <p className={`mb-2.5 text-xs leading-relaxed ${active ? 'text-white/65' : 'text-[#6e6e73]'}`}>
                    {sc.desc}
                  </p>
                )}
                {sc.generationError && (
                  <div
                    className={`mb-2.5 flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[10px] leading-snug ${
                      active
                        ? 'bg-red-400/15 text-red-100'
                        : 'border border-red-100 bg-red-50 text-red-700'
                    }`}
                  >
                    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{sc.generationError}</span>
                  </div>
                )}
                <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className={`tabular-nums ${active ? 'text-white/55' : 'text-[#86868b]'}`}>
                    {tc(sc.start)} · {sc.duration}s
                  </span>
                  {!active && <StatusPill status={sc.status} />}
                  {active && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                      {sc.status === 'ready' ? 'Ready' : sc.status === 'working' ? 'Working' : 'Needs media'}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!sc.voiceoverUrl && !!sc.generationError}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVoiceoverPlayback(sc);
                  }}
                  className={`mb-2.5 flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[11px] disabled:cursor-not-allowed disabled:opacity-40 ${
                    playingVO === sc.id
                      ? active
                        ? 'border-amber-300/40 bg-amber-400/15 text-amber-100'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                      : active
                        ? 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'
                        : 'border-gray-200 bg-white text-[#6e6e73] hover:border-gray-300'
                  }`}
                >
                  {playingVO === sc.id ? <Pause className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  <span className="flex-1">
                    {sc.generationError && !sc.voiceoverUrl
                      ? 'Voiceover unavailable'
                      : playingVO === sc.id
                        ? 'Playing voiceover…'
                        : 'Play voiceover'}
                  </span>
                  <span className="tabular-nums opacity-60">{sc.duration}s</span>
                </button>

                {sc.mainParts.length > 1 && (
                  <div
                    className={`mb-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold ${
                      active ? 'bg-sky-400/15 text-sky-100' : 'bg-sky-50 text-sky-800'
                    }`}
                  >
                    <Link2 className="h-3 w-3" />
                    {sc.joinStatus === 'join'
                      ? 'Joined — continuous script coverage'
                      : 'Two takes — pick or reorder'}
                  </div>
                )}

                {sc.mainParts.length > 0 && (
                  <>
                    <div className="mb-2 space-y-1">
                      {sc.mainParts.map((p, pi) => (
                        <div
                          key={`${p.filename}-${pi}`}
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] ${
                            active ? 'bg-white/8 text-white/80' : 'bg-white border border-gray-100 text-[#6e6e73]'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span
                            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-[9px] font-bold ${
                              active ? 'bg-white/15' : 'bg-gray-100'
                            }`}
                          >
                            {pi + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{p.filename}</span>
                          <div className="flex gap-0.5">
                            <button
                              type="button"
                              disabled={pi === 0}
                              onClick={() => movePart(sc.id, pi, -1)}
                              className="rounded p-0.5 hover:bg-black/10 disabled:opacity-30"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={pi === sc.mainParts.length - 1}
                              onClick={() => movePart(sc.id, pi, 1)}
                              className="rounded p-0.5 hover:bg-black/10 disabled:opacity-30"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removePart(sc.id, pi)}
                              className="rounded p-0.5 hover:bg-black/10"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        )}
        {hasScenes ? (
        <p className="flex-shrink-0 border-t border-gray-100 px-4 py-2.5 text-[11px] leading-relaxed text-[#86868b]">
          Drop MP4, MOV or WebM from your device. Uploaded clips appear on the Video track for the selected scene.
        </p>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
          className="hidden"
          onChange={onFootageFileChosen}
        />
        <input
          ref={brollVideoUploadRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
          className="hidden"
          onChange={(e) => void onBrollUploadChosen(e, 'video')}
        />
        <input
          ref={brollImageUploadRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif,.png,.jpg,.jpeg,.webp,.gif,.avif"
          className="hidden"
          onChange={(e) => void onBrollUploadChosen(e, 'image')}
        />
      </aside>

      {/* ── Center: Preview + timeline ── */}
      <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f5f5f7]">
        {/* Undo/redo/split live in the timeline toolbar below — no separate header needed. */}
        <div className="flex min-h-0 flex-1 items-stretch justify-center overflow-hidden p-2 sm:p-3 [container-type:size]">
          <TimelinePreview
            timeline={timelineApi.timeline}
            isPlaying={isPlaying}
            overlaySpecs={overlaySpecsForPreview}
            onTimeUpdate={(t) => timelineApi.setCurrentTime(t)}
            onEnded={() => {
              setIsPlaying(false);
              timelineApi.setCurrentTime(timelineApi.timeline.duration);
            }}
            textStyle={textStyle}
            onTextPositionChange={(x, y) => {
              setTextStyle((t) => ({ ...t, offsetX: x, offsetY: y }));
              const textTrack = timelineApi.timeline.tracks.find((t) => t.id === DEFAULT_TRACK_IDS.text);
              const activeText =
                textTrack?.clips.find((c) => timelineApi.timeline.selectedClipIds.includes(c.id)) ??
                textTrack?.clips.find(
                  (c) =>
                    timelineApi.timeline.currentTime >= c.start &&
                    timelineApi.timeline.currentTime < c.start + c.duration,
                );
              if (activeText) timelineApi.updateClip(activeText.id, { offsetX: x, offsetY: y });
              if (selected && activeText) recordPendingOverlay(selected.id, activeText.id);
            }}
            onCaptionPositionChange={(x, y) => {
              updateCaptionStyle({
                offsetX: x,
                offsetY: y,
                verticalPosition: verticalPositionFromOffsetY(y),
                horizontalPosition: horizontalPositionFromOffsetX(x),
              });
            }}
            onTextResize={(fontSize) => {
              setTextStyle((t) => ({ ...t, fontSize }));
              if (selected) recordPendingOverlay(selected.id, undefined, ['text']);
            }}
            onTextEdit={(clipId, text) => {
              timelineApi.updateClip(clipId, { text, name: text.slice(0, 48) || 'Text' });
              if (selected) recordPendingOverlay(selected.id, clipId);
            }}
          />
        </div>

        {/* Transport */}
        <div className="flex h-10 flex-shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-white px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                timelineApi.setCurrentTime(0);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6e6e73] hover:bg-[#f5f5f7]"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1d1d1f] text-white"
            >
              {isPlaying ? (
                <Pause className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" />
              )}
            </button>
            <span className="rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-1 text-xs tabular-nums text-[#6e6e73]">
              {tc(timelineApi.timeline.currentTime + timeOrigin)}
            </span>
            <span className="text-[11px] tabular-nums text-[#86868b]">
              / {tcShort(timeOrigin + totalDuration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openRenderConfirm}
              disabled={renderDisabled}
              title={
                !videoId
                  ? 'Generate the video first'
                  : 'Render all scenes into one video'
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1d1d1f] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-30"
            >
              {isRendering ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Film className="h-3.5 w-3.5" />
              )}
              Render
            </button>
            <button
              type="button"
              onClick={() => setVideoPreviewOpen(true)}
              disabled={!renderedVideoUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-40"
              title={renderedVideoUrl ? 'View and download the generated video' : 'Render a video first'}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          </div>
        </div>

        {/* Resizable divider */}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize timeline"
          onPointerDown={beginResizeTimeline}
          className="flex h-2 flex-shrink-0 cursor-row-resize items-center justify-center bg-gray-100 hover:bg-amber-100"
        >
          <span className="h-0.5 w-10 rounded-full bg-gray-300" />
        </div>

        <TimelinePanel
          api={timelineApi}
          height={timelinePanelHeight}
          sceneLabel={selected ? `${selected.num} · ${selected.title}` : 'No scenes yet'}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          hiddenTrackIds={[DEFAULT_TRACK_IDS.video, DEFAULT_TRACK_IDS.caption]}
          onClipSplit={handleClipSplit}
          onDelete={handleDeleteSelected}
          timeOrigin={selected?.start ?? 0}
        />
      </section>


      {/* ── Right: Agent suggestions ── */}
      <aside className="flex h-full min-h-0 w-[min(320px,28%)] min-w-[250px] max-w-[360px] flex-shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white">
        <div className="flex-shrink-0 border-b border-gray-100 px-4 py-3.5">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6e6e73]">
            Agent suggestions
          </p>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#1d1d1f]">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Media library
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {selectedVoiceoverClip &&
            timelineApi.selectedClip?.id === selectedVoiceoverClip.id &&
            (() => {
              const clip = selectedVoiceoverClip;
              const committed = sceneTrimCommittedRef.current[selected!.id];
              // Natural leading-silence start (e.g. ~0.3–0.6s), when known — suggested here as the
              // default, but never baked into the clip itself (see createSceneTimeline).
              const naturalStart = Math.min(
                Math.max(0, selected?.voiceStart ?? 0),
                Math.max(0, clip.sourceDuration - 0.1),
              );
              const draftStart = trimDraft?.start ?? committed?.start ?? naturalStart;
              const draftEnd =
                trimDraft?.end ??
                committed?.end ??
                selected?.sceneEndSec ??
                clip.sourceStart + clip.sourceDuration;
              const isTrimmed = trimDraft != null || committed != null;
              return (
                <div className="border-b border-gray-100 px-4 py-3.5">
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
                      Voiceover trim
                    </p>
                    {isTrimmed && (
                      <button
                        type="button"
                        onClick={() => {
                          delete sceneTrimCommittedRef.current[selected!.id];
                          setTrimDraft({
                            start: clip.sourceStart,
                            end: clip.sourceStart + clip.sourceDuration,
                          });
                        }}
                        className="text-[10px] font-semibold text-[#6e6e73] hover:text-[#1d1d1f]"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold text-[#6e6e73]">Start (s)</span>
                      <input
                        type="number"
                        min={0}
                        max={Math.max(0, draftEnd - 0.1)}
                        step={0.1}
                        value={draftStart.toFixed(1)}
                        onChange={(e) => {
                          const next = Math.max(0, Math.min(draftEnd - 0.1, Number(e.target.value) || 0));
                          setTrimDraft({ start: next, end: draftEnd });
                        }}
                        className="w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-1.5 text-xs text-[#1d1d1f]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold text-[#6e6e73]">End (s)</span>
                      <input
                        type="number"
                        min={draftStart + 0.1}
                        step={0.1}
                        value={draftEnd.toFixed(1)}
                        onChange={(e) => {
                          const next = Math.max(draftStart + 0.1, Number(e.target.value) || draftStart + 0.1);
                          setTrimDraft({ start: draftStart, end: next });
                        }}
                        className="w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-1.5 text-xs text-[#1d1d1f]"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={commitTrim}
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1d1d1f] py-1.5 text-[11px] font-semibold text-white hover:bg-black"
                  >
                    <Crop className="h-3.5 w-3.5" />
                    Trim
                  </button>
                  <p className="mt-2 text-[10px] leading-relaxed text-[#a1a1a6]">
                    Type exact seconds, then hit Trim to save.
                  </p>
                </div>
              );
            })()}

          <div className="sticky top-0 z-10 flex border-b border-gray-200 bg-white">
            {LIBRARY_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setLibraryTab(t.id)}
                className={`flex flex-1 flex-col items-center gap-1 border-b-2 px-0.5 py-2 text-[10px] font-semibold transition-colors ${
                  libraryTab === t.id
                    ? 'border-[#1d1d1f] text-[#1d1d1f]'
                    : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                <t.icon className="h-4 w-4" />
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>

          {libraryTab === 'broll-videos' && (
          <div className="border-b border-gray-100 px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
               videos
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => brollVideoUploadRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-[#1d1d1f] hover:border-gray-300 hover:bg-[#f5f5f7]"
                >
                  <Upload className="h-3 w-3" />
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => handleFindMoreBroll('video')}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-[#1d1d1f] hover:border-gray-300 hover:bg-[#f5f5f7]"
                >
                  <Search className="h-3 w-3" />
                  Find more
                </button>
              </div>
            </div>
            <div className="space-y-2.5">
              {sidebarBrollVideos.length === 0 ? (
                <p className="text-[11px] leading-relaxed text-[#a1a1a6]">
                  No videos on this scene&apos;s timeline yet.
                </p>
              ) : (
                sidebarBrollVideos.map((item, i) => (
                  <SuggestionCard
                    key={`vid-${item.label}-${i}`}
                    item={item}
                    type="broll"
                    already={timelineHasSuggestion(DEFAULT_TRACK_IDS.broll, item)}
                    onInsert={() => insertSuggestion('broll', item)}
                    onPreview={() => setPreviewItem({ item, type: 'broll' })}
                  />
                ))
              )}
            </div>
          </div>
          )}

          {libraryTab === 'broll-images' && (
          <div className="border-b border-gray-100 px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
                 images
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => brollImageUploadRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-[#1d1d1f] hover:border-gray-300 hover:bg-[#f5f5f7]"
                >
                  <Upload className="h-3 w-3" />
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => handleFindMoreBroll('image')}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-[#1d1d1f] hover:border-gray-300 hover:bg-[#f5f5f7]"
                >
                  <Search className="h-3 w-3" />
                  Find more
                </button>
              </div>
            </div>
            <div className="space-y-2.5">
              {sidebarBrollImages.length === 0 ? (
                <p className="text-[11px] leading-relaxed text-[#a1a1a6]">
                  No images on this scene&apos;s timeline yet.
                </p>
              ) : (
                sidebarBrollImages.map((item, i) => (
                  <SuggestionCard
                    key={`img-${item.label}-${i}`}
                    item={item}
                    type="broll"
                    already={timelineHasSuggestion(DEFAULT_TRACK_IDS.broll, item)}
                    onInsert={() => insertSuggestion('broll', item)}
                    onPreview={() => setPreviewItem({ item, type: 'broll' })}
                  />
                ))
              )}
            </div>
          </div>
          )}

          {libraryTab === 'infographics' && (
            <div className="border-b border-gray-100 px-4 py-3.5">
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
                Text
              </p>
              {textOverlaysForSelectedScene.length > 0 ? (
                <div className="mb-4 space-y-2.5">
                  {textOverlaysForSelectedScene.map((spec, i) => (
                    <SuggestionCard
                      key={`txtlist-${selected?.id}-${i}`}
                      item={specToSuggestionItem(spec, selected?.title ?? '', overlayClipsForCards)}
                      type="infographic"
                      already={isRemotionAlreadyOnTimeline(spec)}
                      onInsert={() => insertRemotionInfographic(spec)}
                      onPreview={() => setPreviewRemotion(spec)}
                    />
                  ))}
                </div>
              ) : (
                <p className="mb-4 text-[11px] leading-relaxed text-[#a1a1a6]">
                  No text overlay suggested for this scene yet.
                </p>
              )}

              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
                Graphics
              </p>
              {graphicsForSelectedScene.length > 0 ? (
                <div className="space-y-2.5">
                  {graphicsForSelectedScene.map((spec, i) => (
                    <SuggestionCard
                      key={`gfxlist-${selected?.id}-${i}`}
                      item={specToSuggestionItem(spec, selected?.title ?? '', overlayClipsForCards)}
                      type="infographic"
                      already={isRemotionAlreadyOnTimeline(spec)}
                      onInsert={() => insertRemotionInfographic(spec)}
                      onPreview={() => setPreviewRemotion(spec)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[11px] leading-relaxed text-[#a1a1a6]">
                  No infographic suggested for this scene yet.
                </p>
              )}
              {timelineApi.selectedClip?.type === 'infographic' && (
                <InfographicOverlayFields
                  clip={timelineApi.selectedClip}
                  onDisplayText={(value) => applyInfographicDisplayText(timelineApi.selectedClip!, value)}
                  onPlacement={(placement) => applyInfographicPlacement(timelineApi.selectedClip!, placement)}
                  onPickColor={() => setColorPickerTarget('info-color')}
                />
              )}
            </div>
          )}

          {libraryTab === 'text' && (
          <div className="px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
                Text
              </p>
              <button
                type="button"
                onClick={addTextClip}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-[#f5f5f7] px-2 py-1 text-[11px] font-semibold text-[#1d1d1f] hover:bg-gray-200"
              >
                <Plus className="h-3.5 w-3.5" />
                Add text
              </button>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-[#86868b]">
              Suggested text overlays are placed on the timeline automatically. Add more clips as you need — each can be moved and trimmed.
            </p>

            <p className="mb-3 text-[10px] leading-relaxed text-[#a1a1a6]">
              Drag the text directly on the preview to position it.
            </p>

            <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Text colour</p>
            <button
              type="button"
              onClick={() => setColorPickerTarget('text')}
              className="mb-3 flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-medium text-[#1d1d1f] hover:border-gray-300"
            >
              <span
                className="h-5 w-5 flex-shrink-0 rounded-full border border-gray-200"
                style={{ background: textStyle.textColor }}
              />
              {textStyle.textColor}
            </button>

            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#6e6e73]">Background</span>
              <button
                type="button"
                role="switch"
                aria-checked={textStyle.background}
                onClick={() => {
                  setTextStyle((t) => ({ ...t, background: !t.background }));
                  if (selected) recordPendingOverlay(selected.id, undefined, ['text']);
                }}
                className={`relative h-[19px] w-[34px] rounded-full transition-colors ${
                  textStyle.background ? 'bg-[#1d1d1f]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-[15px] w-[15px] rounded-full bg-white transition-all ${
                    textStyle.background ? 'left-[17px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
            {textStyle.background && (
              <button
                type="button"
                onClick={() => setColorPickerTarget('background')}
                className="mb-3 flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-medium text-[#1d1d1f] hover:border-gray-300"
              >
                <span
                  className="h-5 w-5 flex-shrink-0 rounded-full border border-gray-200"
                  style={{ background: textStyle.bgColor }}
                />
                {textStyle.bgColor}
              </button>
            )}

            <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Font size (px)</p>
            <input
              type="number"
              min={8}
              max={300}
              step={1}
              value={textStyle.fontSize}
              onChange={(e) => {
                const next = Math.max(8, Math.min(300, Number(e.target.value) || textStyle.fontSize));
                setTextStyle((t) => ({ ...t, fontSize: next }));
                if (selected) recordPendingOverlay(selected.id, undefined, ['text']);
              }}
              className="mb-3 w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-2 text-xs text-[#1d1d1f]"
            />

            <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Font style</p>
            <select
              value={textStyle.fontStyle}
              onChange={(e) => {
                const next = e.target.value;
                setTextStyle((t) => ({ ...t, fontStyle: next }));
              }}
              style={{ fontFamily: textStyle.fontStyle }}
              className="mb-3 w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-2 text-xs text-[#1d1d1f]"
            >
              {GOOGLE_FONTS.map((f) => (
                <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
                  {f.label}
                </option>
              ))}
            </select>

            <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Animation</p>
            <select
              value={textStyle.animationStyle}
              onChange={(e) => {
                const next = e.target.value as EditVideoTextAnimationStyle;
                setTextStyle((t) => ({ ...t, animationStyle: next }));
                if (timelineApi.selectedClip?.type === 'text') {
                  timelineApi.updateClip(timelineApi.selectedClip.id, { animationStyle: next });
                  if (selected) recordPendingOverlay(selected.id, timelineApi.selectedClip.id);
                } else if (selected) {
                  recordPendingOverlay(selected.id, undefined, ['text']);
                }
              }}
              className="mb-3 w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-2 text-xs text-[#1d1d1f]"
            >
              {TEXT_ANIMATIONS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>

            {timelineApi.selectedClip?.type === 'text' ? (
              <>
                <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Selected text</p>
                <textarea
                  value={timelineApi.selectedClip.text || ''}
                  rows={3}
                  onChange={(e) => {
                    const value = e.target.value;
                    timelineApi.updateClip(timelineApi.selectedClip!.id, {
                      text: value,
                      name: value.slice(0, 48) || 'Text',
                    });
                    if (selected) recordPendingOverlay(selected.id, timelineApi.selectedClip!.id);
                  }}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-[#f5f5f7] px-3 py-2 text-xs leading-relaxed text-[#1d1d1f] outline-none focus:border-[#1d1d1f] focus:ring-2 focus:ring-[#1d1d1f]/10"
                />
                <p className="mt-1.5 text-[10px] leading-relaxed text-[#a1a1a6]">
                  Move and trim this clip on the Text track. Add more with “Add text”.
                </p>
              </>
            ) : (
              <p className="text-[11px] leading-relaxed text-[#a1a1a6]">
                Select a text clip on the timeline to edit its wording, or click Add text.
              </p>
            )}
          </div>
          )}

          {libraryTab === 'captions' && (
            <div className="px-4 py-3.5">
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
                Captions
              </p>
              <CaptionStyleFields
                style={captionStyle}
                onPatch={updateCaptionStyle}
                onPickColor={(target) => setColorPickerTarget(target)}
              />
            </div>
          )}
        </div>
      </aside>

      </div>

      {/* ── Mobile: single-column layout ── */}
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#f5f5f7] lg:hidden">
        {/* Top toolbar — undo/redo/split/delete/duplicate live only in the clip-selected tools below */}
        <div className="flex h-11 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3">
          <div className="w-[68px] flex-shrink-0" />
          <p className="min-w-0 flex-1 truncate px-2 text-center text-xs font-semibold text-[#1d1d1f]">
            {selected ? selected.title : 'Preview'}
          </p>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setVideoPreviewOpen(true)}
              disabled={!renderedVideoUrl}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6e6e73] disabled:opacity-30"
              title={renderedVideoUrl ? 'View and download the generated video' : 'Render a video first'}
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={openRenderConfirm}
              disabled={renderDisabled}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6e6e73] disabled:opacity-30"
              title={
                !videoId
                  ? 'Generate the video first'
                  : 'Render all scenes into one video'
              }
            >
              {isRendering ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Film className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6e6e73]"
              title="More"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Preview — large, fills all remaining space above the controls */}
        <div className="flex min-h-0 flex-1 items-stretch justify-center overflow-hidden p-2 [container-type:size]">
          <TimelinePreview
            timeline={timelineApi.timeline}
            isPlaying={isPlaying}
            overlaySpecs={overlaySpecsForPreview}
            onTimeUpdate={(t) => timelineApi.setCurrentTime(t)}
            onEnded={() => {
              setIsPlaying(false);
              timelineApi.setCurrentTime(timelineApi.timeline.duration);
            }}
            textStyle={textStyle}
            onTextPositionChange={(x, y) => {
              setTextStyle((t) => ({ ...t, offsetX: x, offsetY: y }));
              const textTrack = timelineApi.timeline.tracks.find((t) => t.id === DEFAULT_TRACK_IDS.text);
              const activeText =
                textTrack?.clips.find((c) => timelineApi.timeline.selectedClipIds.includes(c.id)) ??
                textTrack?.clips.find(
                  (c) =>
                    timelineApi.timeline.currentTime >= c.start &&
                    timelineApi.timeline.currentTime < c.start + c.duration,
                );
              if (activeText) timelineApi.updateClip(activeText.id, { offsetX: x, offsetY: y });
              if (selected && activeText) recordPendingOverlay(selected.id, activeText.id);
            }}
            onCaptionPositionChange={(x, y) => {
              updateCaptionStyle({
                offsetX: x,
                offsetY: y,
                verticalPosition: verticalPositionFromOffsetY(y),
                horizontalPosition: horizontalPositionFromOffsetX(x),
              });
            }}
            onTextResize={(fontSize) => {
              setTextStyle((t) => ({ ...t, fontSize }));
              if (selected) recordPendingOverlay(selected.id, undefined, ['text']);
            }}
            onTextEdit={(clipId, text) => {
              timelineApi.updateClip(clipId, { text, name: text.slice(0, 48) || 'Text' });
              if (selected) recordPendingOverlay(selected.id, clipId);
            }}
          />
        </div>

        {/* Playback controls */}
        <div className="flex flex-shrink-0 items-center justify-center gap-3 border-t border-gray-200 bg-white py-2">
          <span className="text-xs font-semibold tabular-nums text-[#1d1d1f]">
            {tc(timelineApi.timeline.currentTime + timeOrigin)}
          </span>
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-white"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            )}
          </button>
          <span className="text-xs tabular-nums text-[#86868b]">{tcShort(timeOrigin + totalDuration)}</span>
        </div>

        {/* Tracks — compact rows only (no ruler/toolbar); tap a clip to select it and
            bring up its tools in the bottom bar below. Trim still works via the same
            drag handles as desktop once a clip is selected. */}
        <div
          className="flex-shrink-0 overflow-auto border-t border-gray-200 bg-white"
          style={{ scrollbarWidth: 'thin', maxHeight: 160 }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('[data-clip-id]')) return;
            timelineApi.clearSelection();
          }}
        >
          <div
            className="relative"
            style={{
              width: Math.max(320, timelineApi.timeline.duration * timelineApi.timeline.pixelsPerSecond + 40),
            }}
          >
            {timelineApi.timeline.tracks
              .filter((track) => track.id !== DEFAULT_TRACK_IDS.video && track.id !== DEFAULT_TRACK_IDS.caption)
              .map((track) => (
              <div
                key={track.id}
                className="relative border-b border-gray-100 last:border-b-0"
                style={{ height: TRACK_ROW_HEIGHT }}
              >
                {track.clips.length === 0 ? (
                  <div className="flex h-full items-center px-3 text-[10px] text-[#a1a1a6]">
                    {track.name}
                  </div>
                ) : (
                  track.clips.map((clip) => (
                    <TimelineClipView
                      key={clip.id}
                      clip={clip}
                      pixelsPerSecond={timelineApi.timeline.pixelsPerSecond}
                      selected={timelineApi.timeline.selectedClipIds.includes(clip.id)}
                      trackLocked={track.locked}
                      trackHeight={TRACK_ROW_HEIGHT}
                      onSelect={(e) => timelineApi.selectClips([clip.id], e.metaKey || e.ctrlKey)}
                      onBeginMove={timelineApi.beginMove}
                      onBeginTrim={timelineApi.beginTrim}
                      onPointerDelta={(dx, disableSnap) => timelineApi.applyPointerDelta(dx, { disableSnap })}
                      onPointerEnd={timelineApi.endPointerInteraction}
                    />
                  ))
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar — icon nav, or the selected clip's tools */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white">
          {timelineApi.selectedClip ? (
            <div className="flex items-center justify-around px-2 py-2">
              <MobileToolButton icon={Trash2} label="Delete" onClick={handleDeleteSelected} />
              <MobileToolButton icon={Scissors} label="Split" onClick={splitSelectedClip} />
              <MobileToolButton
                icon={Crop}
                label="Trim"
                onClick={() => showToast('Drag the amber handles on the clip to trim')}
              />
              <MobileToolButton icon={Copy} label="Duplicate" onClick={() => timelineApi.duplicateSelected()} />
              <button
                type="button"
                onClick={() => timelineApi.clearSelection()}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-white"
                aria-label="Done"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-stretch">
              <MobileBarIcon icon={Layers} label="Scenes" onClick={() => setMobileSheet('scenes')} />
              <MobileBarIcon
                icon={Film}
                label="Videos"
                onClick={() => {
                  setLibraryTab('broll-videos');
                  setMobileSheet('library');
                }}
              />
              <MobileBarIcon
                icon={ImageIcon}
                label="Images"
                onClick={() => {
                  setLibraryTab('broll-images');
                  setMobileSheet('library');
                }}
              />
              <MobileBarIcon
                icon={BarChart3}
                label="Info"
                onClick={() => {
                  setLibraryTab('infographics');
                  setMobileSheet('library');
                }}
              />
              <MobileBarIcon
                icon={Type}
                label="Text"
                onClick={() => {
                  setLibraryTab('text');
                  setMobileSheet('library');
                }}
              />
              <MobileBarIcon
                icon={Subtitles}
                label="Captions"
                onClick={() => {
                  setLibraryTab('captions');
                  setMobileSheet('library');
                }}
              />
            </div>
          )}
        </div>

        {/* Slide-up sheet */}
        {mobileSheet && (
          <div
            role="button"
            tabIndex={-1}
            className="fixed inset-0 z-[85] flex items-end bg-black/40"
            onClick={() => setMobileSheet(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="flex max-h-[75vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-semibold text-[#1d1d1f]">
                  {mobileSheet === 'scenes' ? 'Scenes' : LIBRARY_TABS.find((t) => t.id === libraryTab)?.label}
                </p>
                <button
                  type="button"
                  onClick={() => setMobileSheet(null)}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#f5f5f7]"
                >
                  <X className="h-4 w-4 text-[#1d1d1f]" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {mobileSheet === 'scenes' && (
                  <div className="p-3">
                    {!hasScenes ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                        <p className="text-xs leading-relaxed text-[#86868b]">
                          No scenes yet. Generate a voiceover and scene breakdown to start editing.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileSheet(null);
                            openSetupModal();
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-sm font-semibold text-white"
                        >
                          <Sparkles className="h-4 w-4 text-amber-300" />
                          Generate voice and scenes
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {scenes.map((sc) => {
                          const active = sc.id === selectedId;
                          return (
                            <div
                              key={sc.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                selectScene(sc.id);
                                setMobileSheet(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  selectScene(sc.id);
                                  setMobileSheet(null);
                                }
                              }}
                              className={`cursor-pointer rounded-2xl border p-3 transition-colors ${
                                active
                                  ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white shadow-sm'
                                  : 'border-gray-200 bg-[#fafafa]'
                              }`}
                            >
                              <div className="mb-2 flex items-start gap-2.5">
                                <span
                                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold tabular-nums ${
                                    active ? 'bg-white/10 text-white/80' : 'bg-white border border-gray-200 text-[#6e6e73]'
                                  }`}
                                >
                                  {sc.num}
                                </span>
                                <p className={`pt-1 text-sm font-semibold leading-snug ${active ? 'text-white' : 'text-[#1d1d1f]'}`}>
                                  {sc.title}
                                </p>
                              </div>
                              {sc.generationError && (
                                <div
                                  className={`mb-2.5 flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[10px] leading-snug ${
                                    active ? 'bg-red-400/15 text-red-100' : 'border border-red-100 bg-red-50 text-red-700'
                                  }`}
                                >
                                  <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                  <span className="line-clamp-2">{sc.generationError}</span>
                                </div>
                              )}
                              <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                                <span className={`tabular-nums ${active ? 'text-white/55' : 'text-[#86868b]'}`}>
                                  {tc(sc.start)} · {sc.duration}s
                                </span>
                                {!active && <StatusPill status={sc.status} />}
                              </div>
                              <button
                                type="button"
                                disabled={!sc.voiceoverUrl && !!sc.generationError}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleVoiceoverPlayback(sc);
                                }}
                                className={`mb-2.5 flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[11px] disabled:cursor-not-allowed disabled:opacity-40 ${
                                  playingVO === sc.id
                                    ? active
                                      ? 'border-amber-300/40 bg-amber-400/15 text-amber-100'
                                      : 'border-amber-200 bg-amber-50 text-amber-900'
                                    : active
                                      ? 'border-white/15 bg-white/5 text-white/80'
                                      : 'border-gray-200 bg-white text-[#6e6e73]'
                                }`}
                              >
                                {playingVO === sc.id ? <Pause className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                                <span className="flex-1">
                                  {sc.generationError && !sc.voiceoverUrl
                                    ? 'Voiceover unavailable'
                                    : playingVO === sc.id
                                      ? 'Playing voiceover…'
                                      : 'Play voiceover'}
                                </span>
                                <span className="tabular-nums opacity-60">{sc.duration}s</span>
                              </button>
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={addScene}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-2.5 text-xs font-semibold text-[#6e6e73]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add scene
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {mobileSheet === 'library' && (
                  <div className="p-3">
                    {libraryTab === 'broll-videos' && (
                      <>
                        <div className="mb-2.5 flex items-center justify-between gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
                             videos
                          </p>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => brollVideoUploadRef.current?.click()}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-[#1d1d1f]"
                            >
                              <Upload className="h-3 w-3" />
                              Upload
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFindMoreBroll('video')}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-[#1d1d1f]"
                            >
                              <Search className="h-3 w-3" />
                              Find more
                            </button>
                          </div>
                        </div>
                        {sidebarBrollVideos.length === 0 ? (
                          <p className="text-[11px] leading-relaxed text-[#a1a1a6]">
                            No videos on this scene&apos;s timeline yet.
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2.5">
                            {sidebarBrollVideos.map((item, i) => (
                              <SuggestionCard
                                key={`m-vid-${item.label}-${i}`}
                                item={item}
                                type="broll"
                                already={timelineHasSuggestion(DEFAULT_TRACK_IDS.broll, item)}
                                onInsert={() => insertSuggestion('broll', item)}
                                onPreview={() => setPreviewItem({ item, type: 'broll' })}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {libraryTab === 'broll-images' && (
                      <>
                        <div className="mb-2.5 flex items-center justify-between gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
                             images
                          </p>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => brollImageUploadRef.current?.click()}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-[#1d1d1f]"
                            >
                              <Upload className="h-3 w-3" />
                              Upload
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFindMoreBroll('image')}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-[#1d1d1f]"
                            >
                              <Search className="h-3 w-3" />
                              Find more
                            </button>
                          </div>
                        </div>
                        {sidebarBrollImages.length === 0 ? (
                          <p className="text-[11px] leading-relaxed text-[#a1a1a6]">
                            No images on this scene&apos;s timeline yet.
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2.5">
                            {sidebarBrollImages.map((item, i) => (
                              <SuggestionCard
                                key={`m-img-${item.label}-${i}`}
                                item={item}
                                type="broll"
                                already={timelineHasSuggestion(DEFAULT_TRACK_IDS.broll, item)}
                                onInsert={() => insertSuggestion('broll', item)}
                                onPreview={() => setPreviewItem({ item, type: 'broll' })}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {libraryTab === 'infographics' && (
                      <>
                        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
                          Text
                        </p>
                        {textOverlaysForSelectedScene.length > 0 ? (
                          <div className="mb-4 space-y-2.5">
                            {textOverlaysForSelectedScene.map((spec, i) => (
                              <SuggestionCard
                                key={`m-txtlist-${selected?.id}-${i}`}
                                item={specToSuggestionItem(spec, selected?.title ?? '', overlayClipsForCards)}
                                type="infographic"
                                already={isRemotionAlreadyOnTimeline(spec)}
                                onInsert={() => insertRemotionInfographic(spec)}
                                onPreview={() => setPreviewRemotion(spec)}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="mb-4 text-[11px] leading-relaxed text-[#a1a1a6]">
                            No text overlay suggested for this scene yet.
                          </p>
                        )}

                        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
                          Graphics
                        </p>
                        {graphicsForSelectedScene.length > 0 ? (
                          <div className="space-y-2.5">
                            {graphicsForSelectedScene.map((spec, i) => (
                              <SuggestionCard
                                key={`m-gfxlist-${selected?.id}-${i}`}
                                item={specToSuggestionItem(spec, selected?.title ?? '', overlayClipsForCards)}
                                type="infographic"
                                already={isRemotionAlreadyOnTimeline(spec)}
                                onInsert={() => insertRemotionInfographic(spec)}
                                onPreview={() => setPreviewRemotion(spec)}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] leading-relaxed text-[#a1a1a6]">
                            No infographic suggested for this scene yet.
                          </p>
                        )}
                        {timelineApi.selectedClip?.type === 'infographic' && (
                          <InfographicOverlayFields
                            clip={timelineApi.selectedClip}
                            onDisplayText={(value) => applyInfographicDisplayText(timelineApi.selectedClip!, value)}
                            onPlacement={(placement) => applyInfographicPlacement(timelineApi.selectedClip!, placement)}
                            onPickColor={() => setColorPickerTarget('info-color')}
                          />
                        )}
                      </>
                    )}

                    {libraryTab === 'text' && (
                      <>
                        <div className="mb-2.5 flex items-center justify-between gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
                            Text
                          </p>
                          <button
                            type="button"
                            onClick={addTextClip}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-[#f5f5f7] px-2 py-1 text-[11px] font-semibold text-[#1d1d1f]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add text
                          </button>
                        </div>

                        <p className="mb-3 text-[10px] leading-relaxed text-[#a1a1a6]">
                          Drag the text directly on the preview to position it.
                        </p>

                        <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Text colour</p>
                        <button
                          type="button"
                          onClick={() => setColorPickerTarget('text')}
                          className="mb-3 flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-medium text-[#1d1d1f]"
                        >
                          <span
                            className="h-5 w-5 flex-shrink-0 rounded-full border border-gray-200"
                            style={{ background: textStyle.textColor }}
                          />
                          {textStyle.textColor}
                        </button>

                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[#6e6e73]">Background</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={textStyle.background}
                            onClick={() => {
                              setTextStyle((t) => ({ ...t, background: !t.background }));
                              if (selected) recordPendingOverlay(selected.id, undefined, ['text']);
                            }}
                            className={`relative h-[19px] w-[34px] rounded-full transition-colors ${
                              textStyle.background ? 'bg-[#1d1d1f]' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-[15px] w-[15px] rounded-full bg-white transition-all ${
                                textStyle.background ? 'left-[17px]' : 'left-0.5'
                              }`}
                            />
                          </button>
                        </div>
                        {textStyle.background && (
                          <button
                            type="button"
                            onClick={() => setColorPickerTarget('background')}
                            className="mb-3 flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-medium text-[#1d1d1f]"
                          >
                            <span
                              className="h-5 w-5 flex-shrink-0 rounded-full border border-gray-200"
                              style={{ background: textStyle.bgColor }}
                            />
                            {textStyle.bgColor}
                          </button>
                        )}

                        <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Font size (px)</p>
                        <input
                          type="number"
                          min={8}
                          max={300}
                          step={1}
                          value={textStyle.fontSize}
                          onChange={(e) => {
                            const next = Math.max(8, Math.min(300, Number(e.target.value) || textStyle.fontSize));
                            setTextStyle((t) => ({ ...t, fontSize: next }));
                            if (selected) recordPendingOverlay(selected.id, undefined, ['text']);
                          }}
                          className="mb-3 w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-2 text-xs text-[#1d1d1f]"
                        />

                        {timelineApi.selectedClip?.type === 'text' ? (
                          <textarea
                            value={timelineApi.selectedClip.text || ''}
                            rows={3}
                            onChange={(e) => {
                              const value = e.target.value;
                              timelineApi.updateClip(timelineApi.selectedClip!.id, {
                                text: value,
                                name: value.slice(0, 48) || 'Text',
                              });
                              if (selected) recordPendingOverlay(selected.id, timelineApi.selectedClip!.id);
                            }}
                            className="w-full resize-none rounded-xl border border-gray-200 bg-[#f5f5f7] px-3 py-2 text-xs leading-relaxed text-[#1d1d1f] outline-none focus:border-[#1d1d1f]"
                          />
                        ) : (
                          <p className="text-[11px] leading-relaxed text-[#a1a1a6]">
                            Select a text clip on the timeline to edit its wording, or tap Add text.
                          </p>
                        )}
                      </>
                    )}

                    {libraryTab === 'captions' && (
                      <>
                        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
                          Captions
                        </p>
                        <CaptionStyleFields
                          style={captionStyle}
                          onPatch={updateCaptionStyle}
                          onPickColor={(target) => setColorPickerTarget(target)}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {colorPickerTarget && (
        <ColorPickerPanel
          title={
            colorPickerTarget === 'text' || colorPickerTarget === 'caption-text'
              ? 'Text colour'
              : colorPickerTarget === 'caption-outline'
                ? 'Outline colour'
                : colorPickerTarget === 'info-color'
                  ? 'Colour hint'
                  : 'Background colour'
          }
          value={
            colorPickerTarget === 'text'
              ? textStyle.textColor
              : colorPickerTarget === 'caption-text'
                ? captionStyle.textColor
                : colorPickerTarget === 'caption-outline'
                  ? captionStyle.outlineColor
                  : colorPickerTarget === 'caption-bg'
                    ? captionStyle.backgroundColor || '#000000'
                    : colorPickerTarget === 'info-color'
                      ? (typeof timelineApi.selectedClip?.remotion?.props.colorHint === 'string'
                          ? timelineApi.selectedClip.remotion.props.colorHint
                          : timelineApi.selectedClip?.textColor || '#ffffff')
                      : textStyle.bgColor
          }
          onChange={(hex) => {
            if (colorPickerTarget === 'text') {
              setTextStyle((t) => ({ ...t, textColor: hex }));
              if (timelineApi.selectedClip?.type === 'text') {
                timelineApi.updateClip(timelineApi.selectedClip.id, { textColor: hex });
                if (selected) recordPendingOverlay(selected.id, timelineApi.selectedClip.id);
              } else if (selected) {
                recordPendingOverlay(selected.id, undefined, ['text']);
              }
              return;
            }
            if (colorPickerTarget === 'background') {
              setTextStyle((t) => ({ ...t, bgColor: hex }));
              if (selected) recordPendingOverlay(selected.id, undefined, ['text']);
              return;
            }
            if (colorPickerTarget === 'caption-text') {
              updateCaptionStyle({ textColor: hex });
              return;
            }
            if (colorPickerTarget === 'caption-outline') {
              updateCaptionStyle({ outlineColor: hex });
              return;
            }
            if (colorPickerTarget === 'caption-bg') {
              updateCaptionStyle({ backgroundColor: hex });
              return;
            }
            if (colorPickerTarget === 'info-color' && timelineApi.selectedClip?.type === 'infographic') {
              applyInfographicColor(timelineApi.selectedClip, hex);
            }
          }}
          onClose={() => setColorPickerTarget(null)}
        />
      )}

      {previewRemotion && (
        <div
          role="button"
          tabIndex={-1}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreviewRemotion(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
              <p className="truncate text-sm font-semibold text-[#1d1d1f]">
                {remotionInfographicLabel(previewRemotion)}
              </p>
              <button
                type="button"
                onClick={() => setPreviewRemotion(null)}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] hover:bg-gray-200"
              >
                <X className="h-4 w-4 text-[#1d1d1f]" />
              </button>
            </div>
            <div className="bg-black" style={{ aspectRatio: '16 / 9' }}>
              <RemotionInfographicPreview spec={previewRemotion} />
            </div>
            <div className="flex flex-shrink-0 items-center justify-between gap-3 px-5 py-3">
              <p className="text-xs text-[#6e6e73]">
                {previewRemotion.animationType} · {previewRemotion.durationFrames} frames ·{' '}
                {remotionDurationSeconds(previewRemotion.durationFrames, EDITOR_FPS).toFixed(1)}s
                {previewRemotion.compositionId
                  ? ` · id ${previewRemotion.compositionId}`
                  : ''}
              </p>
              <button
                type="button"
                disabled={isRemotionAlreadyOnTimeline(previewRemotion)}
                onClick={() => {
                  insertRemotionInfographic(previewRemotion);
                  setPreviewRemotion(null);
                }}
                className="rounded-lg bg-[#1d1d1f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-40"
              >
                {isRemotionAlreadyOnTimeline(previewRemotion) ? 'Added' : 'Insert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewItem && (
        <div
          role="button"
          tabIndex={-1}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
              <p className="truncate text-sm font-semibold text-[#1d1d1f]">{previewItem.item.label}</p>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] hover:bg-gray-200"
              >
                <X className="h-4 w-4 text-[#1d1d1f]" />
              </button>
            </div>
            <div className="flex items-center justify-center bg-black" style={{ aspectRatio: '16 / 9' }}>
              {previewItem.item.mediaKind === 'video' && previewItem.item.assetUrl ? (
                <video
                  key={previewItem.item.assetUrl}
                  src={previewItem.item.assetUrl}
                  controls
                  autoPlay
                  className="h-full w-full"
                />
              ) : previewItem.item.mediaKind === 'image' && previewItem.item.assetUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewItem.item.assetUrl}
                  alt={previewItem.item.label}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 px-8 py-16 text-center text-white/70">
                  <BarChart3 className="h-8 w-8" />
                  <p className="text-sm">No preview asset yet — this is an AI-suggested clip.</p>
                </div>
              )}
            </div>
            <div className="flex-shrink-0 px-5 py-3 text-xs text-[#6e6e73]">
              {previewItem.item.meta} · matched to {previewItem.item.matchedScene} ·{' '}
              {previewItem.item.matchPct}% match
            </div>
          </div>
        </div>
      )}

      {videoPreviewOpen && renderedVideoUrl && (
        <div
          role="button"
          tabIndex={-1}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4"
          onClick={closeVideoPreview}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
              <p className="text-sm font-semibold text-white">Generated video</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownloadRenderedVideo()}
                  disabled={isDownloadingRendered}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1d1d1f] hover:bg-white/90 disabled:opacity-50"
                >
                  {isDownloadingRendered ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Download
                </button>
                <button
                  type="button"
                  onClick={closeVideoPreview}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

            <div className="relative bg-black" style={{ aspectRatio: '16 / 9' }}>
              <video
                key={renderedVideoUrl}
                ref={previewVideoRef}
                src={renderedVideoUrl}
                className="h-full w-full"
                onTimeUpdate={(e) => setPreviewTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setPreviewDuration(e.currentTarget.duration)}
                onPlay={() => setPreviewPlaying(true)}
                onPause={() => setPreviewPlaying(false)}
                onEnded={() => setPreviewPlaying(false)}
                onClick={togglePreviewPlayback}
              />
              {!previewPlaying && (
                <button
                  type="button"
                  onClick={togglePreviewPlayback}
                  className="absolute inset-0 flex items-center justify-center"
                  aria-label="Play"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90">
                    <Play className="ml-0.5 h-6 w-6 fill-current text-[#1d1d1f]" />
                  </span>
                </button>
              )}
            </div>

            <div className="flex flex-shrink-0 items-center gap-3 px-5 py-3">
              <button
                type="button"
                onClick={togglePreviewPlayback}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#1d1d1f]"
                aria-label={previewPlaying ? 'Pause' : 'Play'}
              >
                {previewPlaying ? (
                  <Pause className="h-4 w-4 fill-current" />
                ) : (
                  <Play className="ml-0.5 h-4 w-4 fill-current" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={previewDuration || 0}
                step={0.1}
                value={previewTime}
                onChange={(e) => {
                  const t = Number(e.target.value);
                  if (previewVideoRef.current) previewVideoRef.current.currentTime = t;
                  setPreviewTime(t);
                }}
                className="flex-1 accent-white"
              />
              <span className="flex-shrink-0 text-[11px] tabular-nums text-white/70">
                {tc(previewTime)} / {tc(previewDuration)}
              </span>
            </div>
          </div>
        </div>
      )}

      {renderConfirmOpen && (
        <div
          role="button"
          tabIndex={-1}
          className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            if (!isRendering) setRenderConfirmOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="render-confirm-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </span>
              <div>
                <h2 id="render-confirm-title" className="text-sm font-semibold text-[#1d1d1f]">
                  Render the full video?
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-[#6e6e73]">
                  This renders every scene together. Make sure edits on all scenes are done before
                  continuing — later scene changes won&apos;t be in this file until you render again.
                </p>
              </div>
            </div>
            {isRendering || queuedRequestCount > 0 ? (
              <p className="mb-4 flex items-center gap-2 text-[11px] text-[#6e6e73]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {queuedRequestCount > 0
                  ? 'Saving pending edits before render can start…'
                  : 'Rendering all scenes…'}
              </p>
            ) : (
              <p className="mb-4 text-[11px] text-[#86868b]">Ready to render all scenes.</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenderConfirmOpen(false)}
                disabled={isRendering}
                className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-[#6e6e73] hover:bg-[#f5f5f7] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRenderVideo()}
                disabled={!videoId || renderBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1d1d1f] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {renderBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Film className="h-3.5 w-3.5" />
                )}
                Render
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-medium text-[#1d1d1f] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  item,
  type,
  already,
  onInsert,
  onPreview,
}: {
  item: Suggestion;
  type: 'broll' | 'infographic';
  already: boolean;
  onInsert: () => void;
  onPreview: () => void;
}) {
  const isInfo = type === 'infographic';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPreview}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPreview();
        }
      }}
      className="cursor-pointer rounded-2xl border border-amber-200/80 bg-amber-50/40 p-3 transition-colors hover:border-amber-300"
    >
      <div className="mb-2 flex gap-2.5">
        <div
          className={`relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl ${
            isInfo ? 'bg-violet-100 text-violet-700' : 'bg-teal-100 text-teal-700'
          }`}
        >
          {item.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.previewUrl} alt={item.label} className="h-full w-full object-cover" />
          ) : isInfo && item.icons?.length ? (
            <LucideIconView name={item.icons[0]} size={22} color="#6d28d9" />
          ) : isInfo ? (
            <BarChart3 className="h-5 w-5" />
          ) : (
            <Film className="h-5 w-5" />
          )}
          {item.mediaKind === 'video' && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <Play className="h-3.5 w-3.5 fill-white text-white" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 truncate text-xs font-bold text-[#1d1d1f]">{item.label}</p>
          <p className="mb-0.5 text-[11px] text-[#6e6e73]">{item.meta}</p>
          <p className="text-[10px] tabular-nums text-[#a1a1a6]">
            @ {tcShort(item.start)}.00 · {item.dur}s
          </p>
        </div>
      </div>
      {isInfo && item.mode && (
        <div
          className={`mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            item.mode === 'fullscreen'
              ? 'bg-violet-100 text-violet-800'
              : 'bg-sky-100 text-sky-800'
          }`}
        >
          <Sparkles className="h-3 w-3" />
          AI decided: {item.mode === 'fullscreen' ? 'Full screen' : 'Overlay'}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-amber-200/60 pt-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[11px] text-[#6e6e73]">{item.matchedScene}</span>
          <span className="flex-shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
            {item.matchPct}%
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInsert();
          }}
          className={`inline-flex flex-shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold ${
            already
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-gray-200 bg-white text-[#1d1d1f] hover:border-gray-300'
          }`}
        >
          {already ? (
            <>
              <Check className="h-3 w-3" /> Added
            </>
          ) : (
            <>
              <Plus className="h-3 w-3" /> Insert
            </>
          )}
        </button>
      </div>
    </div>
  );
}
