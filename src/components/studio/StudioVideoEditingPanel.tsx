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
  type SceneTrimUpdate,
  type EditVideoTextVerticalPosition,
} from '@/services/api';
import { useVideoTimeline } from '@/hooks/useVideoTimeline';
import {
  DEFAULT_TRACK_IDS,
  createEmptyTimeline,
  createSceneTimeline,
  createSceneTimelinesMap,
  saveVideoEditProject,
  loadVideoEditProject,
} from '@/lib/video-editor';
import {
  listPickedBroll,
  setBrollPickListener,
  startBrollPickSession,
  type PickedBrollItem,
} from '@/lib/video-editor/broll-pick';
import type { TimelineState, TimelineClip } from '@/lib/video-editor/types';
import { readInfographicFromEditScene, remotionInfographicLabel, remotionDurationSeconds, resolveInfographicStartSeconds, type RemotionInfographicSpec } from '@/lib/video-editor/infographics';
import { TimelinePanel, TimelinePreview, TimelineClipView } from '@/components/studio/video-timeline';
import { TRACK_ROW_HEIGHT } from '@/components/studio/video-timeline/trackLayout';
import { RemotionInfographicPreview } from '@/remotion/RemotionInfographicPreview';
import { formatTimecode, formatTimecodeShort } from '@/lib/video-editor/timecode';
import { EDITOR_FPS } from '@/lib/video-editor/fps';

/* ── Types ─────────────────────────────────────────────────────────────────── */

type SceneStatus = 'ready' | 'working' | 'needs';
type JoinStatus = 'single' | 'join';
type InfographicMode = 'overlay' | 'fullscreen';
type FontStyle = 'sans' | 'serif' | 'mono' | 'display';

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
  /** Natural start of speech within the generated voiceover audio (from the first word segment). */
  voiceStart?: number;
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
};

/** Backend edits accumulated per scene while the user is working on it, flushed when they move on. */
type PendingSceneEdits = {
  /** Marks that the text style changed — the full current style snapshot is sent on flush. */
  style?: boolean;
  infographic?: SceneInfographicUpdate;
  voice?: string;
  trim?: SceneTrimUpdate;
};

type LibraryTab = 'broll-videos' | 'broll-images' | 'infographics' | 'text';

const LIBRARY_TABS: { id: LibraryTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'broll-videos', label: 'B-roll', icon: Film },
  { id: 'broll-images', label: 'Images', icon: ImageIcon },
  { id: 'infographics', label: 'Infographics', icon: BarChart3 },
  { id: 'text', label: 'Text', icon: Type },
];

type TextStyle = {
  /** Always centred — the backend has no horizontal position field. */
  offsetX: number;
  /** Distance from the bottom edge of the frame, as a % of frame height — matches `margin_bottom_percent` 1:1. */
  offsetY: number;
  background: boolean;
  bgColor: string;
  textColor: string;
  fontSize: number;
  fontStyle: FontStyle;
};

/** Builds a b-roll "beat" id: `s{sceneNum}_b{nth}` — the nth b-roll clip in that scene. */
function makeBrollBeatId(sceneNum: string, nth: number): string {
  const n = parseInt(sceneNum, 10) || 1;
  return `s${n}_b${nth}`;
}

/** Maps the draggable vertical offset (% from bottom) to the backend's coarse position zone. */
function verticalPositionFromOffsetY(offsetY: number): EditVideoTextVerticalPosition {
  if (offsetY >= 65) return 'top';
  if (offsetY <= 30) return 'bottom';
  return 'middle';
}

/* ── Dummy data ────────────────────────────────────────────────────────────── */

const FONT_FAMILY_CLASS: Record<FontStyle, string> = {
  sans: 'font-sans',
  serif: 'font-serif',
  mono: 'font-mono',
  display: 'font-sans uppercase tracking-wide font-extrabold',
};

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

/** Maps the /edit-video response into editor scenes + per-scene B-roll video/image suggestions. */
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

  const scenes: Scene[] = (res.scenes ?? []).map((s, i) => {
    const hasTiming = s.start != null && s.end != null;
    const start = hasTiming ? Number(s.start) || 0 : cursor;
    const end = hasTiming ? Number(s.end) || start : start + FALLBACK_DURATION;
    const duration = Math.max(1, Math.round((end - start) * 10) / 10);
    cursor = start + duration;

    const title = deriveSceneTitle(s, i);
    const keywords = s.broll_keywords?.length ? s.broll_keywords : s.media?.keywords ?? [];
    const videoResults = s.media?.videos?.results ?? [];
    const imageResults = s.media?.images?.results ?? [];

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

    const topLabel =
      brollVideoSuggestions[s.scene_id]?.[0]?.label ??
      brollImageSuggestions[s.scene_id]?.[0]?.label ??
      null;

    const remotionInfographic = readInfographicFromEditScene(s);

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
      voiceoverUrl: s.voiceover?.url ?? null,
      generationError: s.error ?? null,
      onScreenText: s.on_screen_text ?? null,
      wordSegments: s.word_segments?.map((w) => ({
        word: w.word,
        start: Number(w.start) || 0,
        end: Number(w.end) || 0,
      })),
      voiceStart: s.word_segments?.[0]?.start != null ? Number(s.word_segments[0].start) || 0 : 0,
    };
  });

  return { scenes, brollVideoSuggestions, brollImageSuggestions };
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

/** Mobile bottom-bar icon (Scenes / B-roll / Images / Infographics / Text) — opens a slide-up sheet. */
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
  const pendingUploadSceneIdRef = useRef<string | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  /** Set once flushSceneEdits is defined below (needs videoId, declared later) — selectScene calls it via this ref. */
  const flushSceneEditsRef = useRef<((sceneId: string) => void) | null>(null);
  /** Accumulates in-progress style/infographic/voice/trim edits per scene until the user moves on. */
  const pendingSceneEditsRef = useRef<Record<string, PendingSceneEdits>>({});
  /** The voice id originally sent to /edit-video — resent (once) to confirm each scene as the user visits it. */
  const initialVoiceRef = useRef<string | null>(null);
  const voiceConfirmedScenesRef = useRef<Set<string>>(new Set());

  /** Confirms the scene's voice with the backend (once per scene) using the voice picked at setup. */
  const confirmVoiceForScene = (sceneId: string) => {
    if (!initialVoiceRef.current || voiceConfirmedScenesRef.current.has(sceneId)) return;
    voiceConfirmedScenesRef.current.add(sceneId);
    const current = pendingSceneEditsRef.current[sceneId] ?? {};
    pendingSceneEditsRef.current[sceneId] = { ...current, voice: initialVoiceRef.current };
  };

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
    fontStyle: 'sans',
  });
  const textStyleRef = useRef(textStyle);
  textStyleRef.current = textStyle;
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedSceneText, setExpandedSceneText] = useState<Set<string>>(new Set());
  const [previewItem, setPreviewItem] = useState<{ item: Suggestion; type: 'broll' | 'infographic' } | null>(null);
  const [previewRemotion, setPreviewRemotion] = useState<RemotionInfographicSpec | null>(null);
  const [colorPickerTarget, setColorPickerTarget] = useState<'text' | 'background' | null>(null);
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
      // Scene being left — confirm its voice, then flush any queued style/infographic/voice/trim edits.
      if (currentId) {
        confirmVoiceForScene(currentId);
        flushSceneEditsRef.current?.(currentId);
      }
      const maps = { ...sceneTimelinesRef.current };
      if (currentId) {
        maps[currentId] = JSON.parse(JSON.stringify(timelineRef.current)) as TimelineState;
      }
      const scene = scenes.find((s) => s.id === nextId) ?? scenes[0];
      if (!scene) return;
      const target = maps[nextId] ?? createSceneTimeline(scene);
      maps[nextId] = target;
      setSceneTimelines(maps);
      replaceTimelineState(target, false);
      setSelectedId(nextId);
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

  /* ── Setup flow (voice + face/faceless, before the editor is shown) ── */
  const [userId, setUserId] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string | null>(null);
  const [videoKind, setVideoKind] = useState<VideoKind | null>(null);
  const [setupScript, setSetupScript] = useState(scriptText || '');
  const [voicePresets, setVoicePresets] = useState<VoicePreset[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [clonedAudioUrl, setClonedAudioUrl] = useState<string | null>(null);
  const [clonedVoiceName, setClonedVoiceName] = useState<string | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);
  const [isSubmittingSetup, setIsSubmittingSetup] = useState(false);
  const [faceScenes, setFaceScenes] = useState<FaceSceneDraft[]>([]);
  const [sceneBrollVideoSuggestions, setSceneBrollVideoSuggestions] = useState<Record<string, Suggestion[]>>({});
  const [sceneBrollImageSuggestions, setSceneBrollImageSuggestions] = useState<Record<string, Suggestion[]>>({});
  /** Media added via B-roll tab "Find more → Add" (always shown in sidebar sections). */
  const [manualBrollVideos, setManualBrollVideos] = useState<Suggestion[]>([]);
  const [manualBrollImages, setManualBrollImages] = useState<Suggestion[]>([]);
  /** video_id returned by /edit-video — required for every .../timeline/{video_id} PATCH call. */
  const [videoId, setVideoId] = useState<string | null>(null);
  const lastEditVideoResponseRef = useRef<EditVideoResponse | null>(null);
  const restoredCacheRef = useRef(false);
  const hasEditorProjectRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Render video ── */
  const [queuedRequestCount, setQueuedRequestCount] = useState(0);
  const [hasEdited, setHasEdited] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  /* ── Serialized backend save queue ──────────────────────────────────────────
   * Style/infographic/voice/trim edits accumulate locally per-scene while the
   * user is working on that scene, and only get sent once they move on to the
   * next scene (see flushSceneEdits + selectScene). Every request that leaves
   * this component funnels through enqueueRequest so at most one is ever in
   * flight — the next one only starts once the previous has settled.
   */
  const requestQueueRef = useRef<Promise<void>>(Promise.resolve());
  const enqueueRequest = useCallback((task: () => Promise<void>) => {
    setHasEdited(true);
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

  /** Marks the text style as changed for this scene — the full snapshot is built and sent on flush. */
  const recordPendingStyle = useCallback((sceneId: string) => {
    const current = pendingSceneEditsRef.current[sceneId] ?? {};
    pendingSceneEditsRef.current[sceneId] = { ...current, style: true };
  }, []);

  const recordPendingInfographic = useCallback((sceneId: string, patch: SceneInfographicUpdate) => {
    const current = pendingSceneEditsRef.current[sceneId] ?? {};
    pendingSceneEditsRef.current[sceneId] = {
      ...current,
      infographic: { ...(current.infographic ?? {}), ...patch },
    };
  }, []);

  const recordPendingTrim = useCallback((sceneId: string, trim: SceneTrimUpdate) => {
    const current = pendingSceneEditsRef.current[sceneId] ?? {};
    pendingSceneEditsRef.current[sceneId] = { ...current, trim };
  }, []);

  /** Looks up a scene's clip on a given track in the (about-to-be-left) timeline, for its scene-local start/end. */
  const sceneClipBounds = useCallback((trackId: string, sceneId: string) => {
    const clip = timelineRef.current.tracks
      .find((t) => t.id === trackId)
      ?.clips.find((c) => c.sceneId === sceneId);
    if (!clip) return null;
    return { start: clip.start, end: clip.start + clip.duration };
  }, []);

  /** Called when the user leaves a scene — enqueues one request per edited field, in order. */
  const flushSceneEdits = useCallback(
    (sceneId: string) => {
      const pending = pendingSceneEditsRef.current[sceneId];
      delete pendingSceneEditsRef.current[sceneId];
      if (!pending || !videoId) return;

      if (pending.style) {
        const textBounds = sceneClipBounds(DEFAULT_TRACK_IDS.text, sceneId);
        const ts = textStyleRef.current;
        const style: SceneStyleUpdate = {
          font_size: ts.fontSize,
          text_color: ts.textColor,
          background_color: ts.bgColor,
          vertical_position: verticalPositionFromOffsetY(ts.offsetY),
          margin_bottom_percent: Math.round(ts.offsetY),
          ...(textBounds ? { text_start: textBounds.start, text_end: textBounds.end } : {}),
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
      if (pending.voice) {
        const voice = pending.voice;
        const voiceBounds = sceneClipBounds(DEFAULT_TRACK_IDS.voiceover, sceneId);
        enqueueRequest(() =>
          ApiService.updateSceneVoice(videoId, sceneId, {
            voice,
            start: voiceBounds?.start ?? 0,
            end: voiceBounds?.end ?? 0,
          }).then(
            () => {},
            (err) => {
              showToast(err instanceof Error ? err.message : 'Failed to update voice');
            },
          ),
        );
      }
      if (pending.trim) {
        const trim = pending.trim;
        enqueueRequest(() =>
          ApiService.trimScene(videoId, sceneId, trim).then(
            () => {},
            (err) => {
              showToast(err instanceof Error ? err.message : 'Failed to save trim');
            },
          ),
        );
      }
    },
    [videoId, enqueueRequest, showToast, sceneClipBounds],
  );
  flushSceneEditsRef.current = flushSceneEdits;

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

  const renderDisabled = !videoId || !hasEdited || queuedRequestCount > 0 || isRendering;

  const handleRenderVideo = useCallback(async () => {
    if (!videoId || renderDisabled) return;
    setIsRendering(true);
    try {
      const { videoUrl } = await ApiService.renderVideo(videoId);
      if (!videoUrl) {
        showToast('Render finished, but no video URL was returned');
        return;
      }
      setRenderedVideoUrl(videoUrl);
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
  }, [videoId, renderDisabled, scriptRowId, userId, showToast]);

  const closeVideoPreview = useCallback(() => {
    previewVideoRef.current?.pause();
    setVideoPreviewOpen(false);
    setPreviewPlaying(false);
  }, []);

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

  /**
   * Trimming the voiceover clip's edges on the timeline (drag handles already exist on
   * every clip — see TimelineClipView) changes its sourceStart/sourceDuration. Whenever
   * that differs from the clip's original bounds, record it as the scene's pending trim —
   * it's only actually sent once the user moves on (see flushSceneEdits).
   */
  useEffect(() => {
    if (!selected || !selectedVoiceoverClip) return;
    const original = selectedVoiceoverClip.originalSourceDuration ?? selected.duration;
    const start = selectedVoiceoverClip.sourceStart;
    const end = selectedVoiceoverClip.sourceStart + selectedVoiceoverClip.sourceDuration;
    const isTrimmed = start > 0.01 || end < original - 0.01;
    if (isTrimmed) recordPendingTrim(selected.id, { start, end });
  }, [selected, selectedVoiceoverClip, recordPendingTrim]);

  const dedupeSuggestions = (items: Suggestion[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.label}|${item.assetUrl || item.previewUrl || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const sidebarBrollVideos = useMemo(() => {
    if (showDummyLibrary) {
      return dedupeSuggestions([...manualBrollVideos, ...BROLL_SUGGESTIONS]);
    }
    const sceneItems = selected ? sceneBrollVideoSuggestions[selected.id] ?? [] : [];
    const merged = dedupeSuggestions([...manualBrollVideos, ...sceneItems]);
    return merged.length > 0 ? merged : BROLL_SUGGESTIONS;
  }, [showDummyLibrary, manualBrollVideos, selected, sceneBrollVideoSuggestions]);

  const sidebarBrollImages = useMemo(() => {
    if (showDummyLibrary) {
      return dedupeSuggestions([...manualBrollImages, ...BROLL_IMAGE_SUGGESTIONS]);
    }
    const sceneItems = selected ? sceneBrollImageSuggestions[selected.id] ?? [] : [];
    return dedupeSuggestions([...manualBrollImages, ...sceneItems]);
  }, [showDummyLibrary, manualBrollImages, selected, sceneBrollImageSuggestions]);

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

  /** Restore a previously generated project from localStorage (skip re-calling /edit-video). */
  useEffect(() => {
    if (!userId || restoredCacheRef.current) return;
    const cached = loadVideoEditProject(userId, scriptText || setupScript || '');
    if (!cached || cached.stage !== 'editor' || !cached.scenes.length) return;

    restoredCacheRef.current = true;
    hasEditorProjectRef.current = true;
    lastEditVideoResponseRef.current = cached.response ?? null;
    setVideoId(cached.response?.video_id ?? null);
    setScenes(cached.scenes as Scene[]);
    setSceneBrollVideoSuggestions(
      (cached.brollVideoSuggestions || {}) as Record<string, Suggestion[]>,
    );
    setSceneBrollImageSuggestions(
      (cached.brollImageSuggestions || {}) as Record<string, Suggestion[]>,
    );
    setSelectedId(cached.selectedId || (cached.scenes[0] as Scene)?.id);
    if (cached.textStyle) setTextStyle(cached.textStyle as TextStyle);
    if (cached.videoKind) setVideoKind(cached.videoKind);
    if (cached.selectedVoice) setSelectedVoice(cached.selectedVoice);
    if (cached.script) setSetupScript(cached.script);
    const maps =
      (cached.sceneTimelines as Record<string, TimelineState> | undefined) ??
      createSceneTimelinesMap(cached.scenes as Scene[]);
    setSceneTimelines(maps);
    const sid = cached.selectedId || (cached.scenes[0] as Scene)?.id;
    replaceTimelineState(
      (sid && maps[sid]) || (cached.timeline as TimelineState),
      false,
    );
    setStage('editor');
    // Re-apply library picks after restore overwrites suggestion maps.
    queueMicrotask(() => {
      listPickedBroll().forEach((item) => ingestPickedBroll(item, { silent: true }));
    });
  }, [userId, scriptText, setupScript, replaceTimelineState, ingestPickedBroll]);

  const persistProject = useCallback(
    (overrides?: {
      scenes?: Scene[];
      timeline?: TimelineState;
      sceneTimelines?: Record<string, TimelineState>;
      selectedId?: string;
      stage?: Stage;
      response?: EditVideoResponse | null;
      brollVideoSuggestions?: Record<string, Suggestion[]>;
      brollImageSuggestions?: Record<string, Suggestion[]>;
      videoKind?: VideoKind | null;
      script?: string;
    }) => {
      if (!userId) return;
      const script = (overrides?.script ?? (setupScript || scriptText)).trim();
      if (!script) return;
      const nextStage = overrides?.stage ?? stage;
      if (nextStage !== 'editor') return;
      const nextScenes = overrides?.scenes ?? scenes;
      if (!nextScenes.length) return;

      const sid = overrides?.selectedId ?? selectedId;
      if (!sid) return;
      const currentTl = overrides?.timeline ?? timelineApi.timeline;
      const maps = {
        ...(overrides?.sceneTimelines ?? sceneTimelines),
        [sid]: currentTl,
      };

      saveVideoEditProject({
        userId,
        script,
        ideaTitle: ideaTitle ?? null,
        videoKind: overrides?.videoKind ?? videoKind ?? 'faceless',
        selectedVoice,
        response: overrides?.response !== undefined ? overrides.response : lastEditVideoResponseRef.current,
        scenes: nextScenes,
        brollVideoSuggestions:
          overrides?.brollVideoSuggestions ?? sceneBrollVideoSuggestions,
        brollImageSuggestions:
          overrides?.brollImageSuggestions ?? sceneBrollImageSuggestions,
        timeline: currentTl,
        sceneTimelines: maps,
        selectedId: sid,
        textStyle,
        stage: 'editor',
      });
    },
    [
      userId,
      setupScript,
      scriptText,
      ideaTitle,
      videoKind,
      selectedVoice,
      stage,
      scenes,
      sceneBrollVideoSuggestions,
      sceneBrollImageSuggestions,
      timelineApi.timeline,
      sceneTimelines,
      selectedId,
      textStyle,
    ],
  );

  const timelinePersistKey = useMemo(
    () =>
      JSON.stringify({
        tracks: timelineApi.timeline.tracks,
        duration: timelineApi.timeline.duration,
        pixelsPerSecond: timelineApi.timeline.pixelsPerSecond,
        selectedClipIds: timelineApi.timeline.selectedClipIds,
      }),
    [timelineApi.timeline],
  );

  /** Debounced persist while editing so refresh keeps timeline changes. */
  useEffect(() => {
    if (stage !== 'editor' || !userId || !hasEditorProjectRef.current) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistProject();
    }, 700);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [stage, userId, scenes, selectedId, textStyle, timelinePersistKey, persistProject]);

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

  /** Restored sessions don't go through runFacelessGenerate, so resolve the confirmed voice once we can. */
  useEffect(() => {
    if (!videoId || initialVoiceRef.current || !restoredCacheRef.current) return;
    const resolved =
      selectedVoice === 'cloned' ? 'user' : selectedVoicePreset?.referenceId?.trim() || null;
    if (resolved) initialVoiceRef.current = resolved;
  }, [videoId, selectedVoice, selectedVoicePreset]);

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
    initialVoiceRef.current = voice;
    voiceConfirmedScenesRef.current = new Set();
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
      });
      const { scenes: mappedScenes, brollVideoSuggestions, brollImageSuggestions } = mapEditVideoResponse(res);
      if (!mappedScenes.length) {
        showToast('No scenes came back for this script');
        return;
      }
      lastEditVideoResponseRef.current = res;
      hasEditorProjectRef.current = true;
      restoredCacheRef.current = true;
      setVideoId(res.video_id);
      setScenes(mappedScenes);
      setSceneBrollVideoSuggestions(brollVideoSuggestions);
      setSceneBrollImageSuggestions(brollImageSuggestions);
      const maps = createSceneTimelinesMap(mappedScenes);
      const firstId = mappedScenes[0].id;
      setSceneTimelines(maps);
      setSelectedId(firstId);
      const timeline = maps[firstId];
      replaceTimelineState(timeline, false);
      setStage('editor');
      setSetupOpen(false);
      persistProject({
        scenes: mappedScenes,
        timeline,
        sceneTimelines: maps,
        selectedId: firstId,
        stage: 'editor',
        response: res,
        brollVideoSuggestions,
        brollImageSuggestions,
        videoKind: 'faceless',
        script: setupScript.trim(),
      });
      showToast('Video generated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate video');
    } finally {
      setIsSubmittingSetup(false);
    }
  }, [canSubmitSetup, videoKind, userId, selectedVoice, selectedVoicePreset, setupScript, showToast, replaceTimelineState, persistProject]);

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
    lastEditVideoResponseRef.current = null;
    setVideoId(null);
    hasEditorProjectRef.current = true;
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
    persistProject({
      scenes: nextScenes,
      timeline,
      sceneTimelines: maps,
      selectedId: firstId,
      stage: 'editor',
      response: null,
      brollVideoSuggestions: {},
      brollImageSuggestions: {},
      videoKind: 'with-face',
      script: setupScript.trim(),
    });
    showToast('Video generation started');
  }, [allFaceScenesUploaded, faceScenes, showToast, replaceTimelineState, persistProject, setupScript]);

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
      confirmVoiceForScene(selectedIdRef.current);
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
      ?.clips.some((c) => c.name === item.label);
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
    const beatId = makeBrollBeatId(target.num, existingForScene + 1);

    timelineApi.addClip(DEFAULT_TRACK_IDS.broll, {
      id: `br-${Date.now()}`,
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
    });

    showToast(`Inserted into ${target.title}`);

    // Persist the pick server-side whenever we have a video + a real asset URL.
    // asset_id doesn't need to be the real Pexels id (manually-picked library
    // items don't have one) — the url is what actually matters, so fall back
    // to a synthetic id rather than skipping the save.
    const assetUrl = item.assetUrl || item.previewUrl;
    if (videoId && assetUrl) {
      const sceneId = target.id;
      const assetId = item.assetId ?? Math.floor(Math.random() * 1_000_000_000);
      const source = item.source ?? (item.mediaKind === 'image' ? 'image' : 'video');
      const clipEnd = start + dur;
      const hasNextBeat = Boolean(
        brollTrack?.clips.some((c) => c.sceneId === sceneId && c.start >= clipEnd - 0.05),
      );
      enqueueRequest(() =>
        ApiService.selectSceneBroll(videoId, sceneId, {
          asset_id: assetId,
          source,
          beat_id: beatId,
          start,
          end: clipEnd,
          adjust_next_beat: hasNextBeat,
        }).then(
          () => {},
          (err) => {
            showToast(err instanceof Error ? err.message : 'Failed to save b-roll selection');
          },
        ),
      );
    }
  };

  /**
   * Fires after a b-roll clip ("beat") gets split on the timeline — tells the backend where the
   * split happened, then registers the boundaries of the newly split-off second clip. The right
   * half becomes its own beat, so it's assigned the next beat id in that scene.
   */
  const handleClipSplit = useCallback(
    (clip: TimelineClip, splitAt: number) => {
      if (!videoId || clip.trackId !== DEFAULT_TRACK_IDS.broll || !clip.sceneId || !clip.beatId) return;
      const sceneId = clip.sceneId;
      const beatId = clip.beatId;
      const rightStart = splitAt;
      const rightEnd = clip.start + clip.duration;

      // The right half becomes its own beat — assign it the next beat id for this scene
      // (splitClip() ids the new clip `${clip.id}-b`).
      const sceneNum = scenes.find((s) => s.id === sceneId)?.num;
      if (sceneNum) {
        const brollTrack = timelineApi.timeline.tracks.find((t) => t.id === DEFAULT_TRACK_IDS.broll);
        const existingForScene = brollTrack?.clips.filter((c) => c.sceneId === sceneId).length ?? 0;
        const newBeatId = makeBrollBeatId(sceneNum, existingForScene + 1);
        timelineApi.updateClip(`${clip.id}-b`, { beatId: newBeatId });
      }

      enqueueRequest(async () => {
        try {
          await ApiService.splitSceneBeat(videoId, sceneId, beatId, { split_at: splitAt });
          await ApiService.insertSceneBeat(videoId, sceneId, beatId, { start: rightStart, end: rightEnd });
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Failed to save clip split');
        }
      });
    },
    [videoId, enqueueRequest, showToast, scenes, timelineApi],
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

  const insertRemotionInfographic = useCallback(() => {
    const target = selected;
    const spec = target?.remotionInfographic;
    if (!target || !spec) return;

    const already = timelineApi.timeline.tracks
      .find((t) => t.id === DEFAULT_TRACK_IDS.infographic)
      ?.clips.some(
        (c) =>
          c.remotion?.compositionId === spec.compositionId &&
          c.sceneId === target.id,
      );
    if (already) {
      showToast('Already on the timeline');
      return;
    }

    const label = remotionInfographicLabel(spec);
    const start = resolveInfographicStartSeconds(spec.trigger, 0);
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
  }, [selected, timelineApi, pushHistory, showToast, recordPendingInfographic]);

  const remotionAlreadyOnTimeline = useMemo(() => {
    const spec = selected?.remotionInfographic;
    if (!spec) return false;
    return Boolean(
      timelineApi.timeline.tracks
        .find((t) => t.id === DEFAULT_TRACK_IDS.infographic)
        ?.clips.some(
          (c) => c.remotion?.compositionId === spec.compositionId && c.sceneId === selected?.id,
        ),
    );
  }, [selected, timelineApi.timeline.tracks]);

  const addTextClip = useCallback(() => {
    const start = timelineApi.timeline.currentTime;
    const id = `txt-${Date.now()}`;
    timelineApi.addClip(DEFAULT_TRACK_IDS.text, {
      id,
      type: 'text',
      name: 'New text',
      text: 'New text',
      start,
      duration: 3,
      sourceStart: 0,
      sourceDuration: 3,
      sceneId: selectedId,
    });
    timelineApi.selectClips([id]);
    showToast('Text clip added');
  }, [timelineApi, selectedId, showToast]);

  const timelineHasClipNamed = useCallback(
    (trackId: string, name: string) =>
      Boolean(
        timelineApi.timeline.tracks
          .find((t) => t.id === trackId)
          ?.clips.some((c) => c.name === name),
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

                {sc.mainParts.length > 0 ? (
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openUploadFootage(sc.id);
                      }}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-2 text-[11px] font-semibold ${
                        active
                          ? 'border-white/25 text-white/80 hover:bg-white/10'
                          : 'border-gray-300 text-[#6e6e73] hover:border-[#1d1d1f] hover:text-[#1d1d1f]'
                      }`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Add another take
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openUploadFootage(sc.id);
                    }}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold ${
                      active
                        ? 'bg-white text-[#1d1d1f] hover:bg-gray-100'
                        : 'bg-[#1d1d1f] text-white hover:bg-black'
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload footage
                  </button>
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
      </aside>

      {/* ── Center: Preview + timeline ── */}
      <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f5f5f7]">
        {/* Undo/redo/split live in the timeline toolbar below — no separate header needed. */}
        <div className="flex min-h-0 flex-1 items-stretch justify-center overflow-hidden p-2 sm:p-3 [container-type:size]">
          <TimelinePreview
            timeline={timelineApi.timeline}
            isPlaying={isPlaying}
            onTimeUpdate={(t) => timelineApi.setCurrentTime(t)}
            onEnded={() => {
              setIsPlaying(false);
              timelineApi.setCurrentTime(timelineApi.timeline.duration);
            }}
            textStyle={textStyle}
            fontFamilyClass={FONT_FAMILY_CLASS}
            onTextPositionChange={(_x, y) => {
              setTextStyle((t) => ({ ...t, offsetY: y }));
              if (selected) recordPendingStyle(selected.id);
            }}
            onTextResize={(fontSize) => {
              setTextStyle((t) => ({ ...t, fontSize }));
              if (selected) recordPendingStyle(selected.id);
            }}
            onTextEdit={(clipId, text) =>
              timelineApi.updateClip(clipId, { text, name: text.slice(0, 48) || 'Text' })
            }
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
              {tc(timelineApi.timeline.currentTime)}
            </span>
            <span className="text-[11px] tabular-nums text-[#86868b]">
              / {tcShort(totalDuration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRenderVideo()}
              disabled={renderDisabled}
              title={
                !videoId
                  ? 'Generate the video first'
                  : !hasEdited
                    ? 'Edit something before rendering'
                    : queuedRequestCount > 0
                      ? 'Waiting for pending edits to save…'
                      : 'Render the whole video'
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1d1d1f] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-30"
            >
              {isRendering ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Film className="h-3.5 w-3.5" />
              )}
              Render video
            </button>
            <button
              type="button"
              onClick={() => setVideoPreviewOpen(true)}
              disabled={!renderedVideoUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-40"
              title={renderedVideoUrl ? 'View the generated video' : 'Render a video first'}
            >
              <Upload className="h-3.5 w-3.5" />
              Generated video
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
          hiddenTrackIds={[DEFAULT_TRACK_IDS.video]}
          onClipSplit={handleClipSplit}
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
          {selectedVoiceoverClip && (() => {
            const clip = selectedVoiceoverClip;
            const original = clip.originalSourceDuration ?? selected!.duration;
            const trimStart = clip.sourceStart;
            const trimEnd = clip.sourceStart + clip.sourceDuration;
            const isTrimmed = trimStart > 0.01 || trimEnd < original - 0.01;
            return (
              <div className="border-b border-gray-100 px-4 py-3.5">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
                    Voiceover trim
                  </p>
                  {isTrimmed && (
                    <button
                      type="button"
                      onClick={() =>
                        timelineApi.updateClip(clip.id, {
                          start: 0,
                          duration: original,
                          sourceStart: 0,
                          sourceDuration: original,
                        })
                      }
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
                      max={Math.max(0, trimEnd - 0.1)}
                      step={0.1}
                      value={trimStart.toFixed(1)}
                      onChange={(e) => {
                        const next = Math.max(0, Math.min(trimEnd - 0.1, Number(e.target.value) || 0));
                        timelineApi.updateClip(clip.id, {
                          start: next,
                          sourceStart: next,
                          duration: trimEnd - next,
                          sourceDuration: trimEnd - next,
                        });
                      }}
                      className="w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-1.5 text-xs text-[#1d1d1f]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold text-[#6e6e73]">End (s)</span>
                    <input
                      type="number"
                      min={trimStart + 0.1}
                      max={original}
                      step={0.1}
                      value={trimEnd.toFixed(1)}
                      onChange={(e) => {
                        const next = Math.max(
                          trimStart + 0.1,
                          Math.min(original, Number(e.target.value) || original),
                        );
                        timelineApi.updateClip(clip.id, {
                          duration: next - trimStart,
                          sourceDuration: next - trimStart,
                        });
                      }}
                      className="w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-1.5 text-xs text-[#1d1d1f]"
                    />
                  </label>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-[#a1a1a6]">
                  Drag the amber handles on the voiceover clip in the timeline, or type exact seconds here.
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
                className={`flex flex-1 flex-col items-center gap-1 border-b-2 px-1.5 py-2.5 text-[10px] font-semibold transition-colors ${
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
                B-roll videos
              </p>
              <button
                type="button"
                onClick={() => handleFindMoreBroll('video')}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-[#1d1d1f] hover:border-gray-300 hover:bg-[#f5f5f7]"
              >
                <Search className="h-3 w-3" />
                Find more
              </button>
            </div>
            <div className="space-y-2.5">
              {sidebarBrollVideos.map((item, i) => (
                <SuggestionCard
                  key={`vid-${item.label}-${i}`}
                  item={item}
                  type="broll"
                  already={timelineHasClipNamed(DEFAULT_TRACK_IDS.broll, item.label)}
                  onInsert={() => insertSuggestion('broll', item)}
                  onPreview={() => setPreviewItem({ item, type: 'broll' })}
                />
              ))}
            </div>
          </div>
          )}

          {libraryTab === 'broll-images' && (
          <div className="border-b border-gray-100 px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
                B-roll images
              </p>
              <button
                type="button"
                onClick={() => handleFindMoreBroll('image')}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-[#1d1d1f] hover:border-gray-300 hover:bg-[#f5f5f7]"
              >
                <Search className="h-3 w-3" />
                Find more
              </button>
            </div>
            <div className="space-y-2.5">
              {sidebarBrollImages.length === 0 ? (
                <p className="text-[11px] leading-relaxed text-[#a1a1a6]">
                  No matched images for this scene yet.
                </p>
              ) : (
                sidebarBrollImages.map((item, i) => (
                  <SuggestionCard
                    key={`img-${item.label}-${i}`}
                    item={item}
                    type="broll"
                    already={timelineHasClipNamed(DEFAULT_TRACK_IDS.broll, item.label)}
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
                Infographics
              </p>
              {selected?.remotionInfographic ? (
                <div className="space-y-2.5">
                  <SuggestionCard
                    item={{
                      label: remotionInfographicLabel(selected.remotionInfographic),
                      meta: `${selected.remotionInfographic.animationType} · ${selected.remotionInfographic.durationFrames}f · Remotion`,
                      start: 0,
                      dur: remotionDurationSeconds(
                        selected.remotionInfographic.durationFrames,
                        EDITOR_FPS,
                      ),
                      matchedScene: selected.title,
                      matchPct: 100,
                      mode:
                        selected.remotionInfographic.placement === 'full_frame'
                          ? 'fullscreen'
                          : 'overlay',
                    }}
                    type="infographic"
                    already={remotionAlreadyOnTimeline}
                    onInsert={insertRemotionInfographic}
                    onPreview={() => setPreviewRemotion(selected.remotionInfographic!)}
                  />
                </div>
              ) : (
                <p className="text-[11px] leading-relaxed text-[#a1a1a6]">
                  No infographic suggested for this scene yet.
                </p>
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
              Text track starts empty. Add as many text clips as you need — each can be moved and trimmed on the timeline.
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
                onClick={() => setTextStyle((t) => ({ ...t, background: !t.background }))}
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
                if (selected) recordPendingStyle(selected.id);
              }}
              className="mb-3 w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-2 text-xs text-[#1d1d1f]"
            />

            <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Font style</p>
            <select
              value={textStyle.fontStyle}
              onChange={(e) =>
                setTextStyle((t) => ({ ...t, fontStyle: e.target.value as FontStyle }))
              }
              className="mb-3 w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-2 text-xs text-[#1d1d1f]"
            >
              <option value="sans">Sans — clean</option>
              <option value="serif">Serif — editorial</option>
              <option value="mono">Mono — technical</option>
              <option value="display">Display — bold</option>
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
              title={renderedVideoUrl ? 'View the generated video' : 'Render a video first'}
            >
              <Upload className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleRenderVideo()}
              disabled={renderDisabled}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6e6e73] disabled:opacity-30"
              title="Render the whole video"
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
            onTimeUpdate={(t) => timelineApi.setCurrentTime(t)}
            onEnded={() => {
              setIsPlaying(false);
              timelineApi.setCurrentTime(timelineApi.timeline.duration);
            }}
            textStyle={textStyle}
            fontFamilyClass={FONT_FAMILY_CLASS}
            onTextPositionChange={(_x, y) => {
              setTextStyle((t) => ({ ...t, offsetY: y }));
              if (selected) recordPendingStyle(selected.id);
            }}
            onTextResize={(fontSize) => {
              setTextStyle((t) => ({ ...t, fontSize }));
              if (selected) recordPendingStyle(selected.id);
            }}
            onTextEdit={(clipId, text) =>
              timelineApi.updateClip(clipId, { text, name: text.slice(0, 48) || 'Text' })
            }
          />
        </div>

        {/* Playback controls */}
        <div className="flex flex-shrink-0 items-center justify-center gap-3 border-t border-gray-200 bg-white py-2">
          <span className="text-xs font-semibold tabular-nums text-[#1d1d1f]">
            {tc(timelineApi.timeline.currentTime)}
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
          <span className="text-xs tabular-nums text-[#86868b]">{tcShort(totalDuration)}</span>
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
              .filter((track) => track.id !== DEFAULT_TRACK_IDS.video)
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
              <MobileToolButton icon={Trash2} label="Delete" onClick={() => timelineApi.deleteSelected()} />
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
                label="B-roll"
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
                              {sc.mainParts.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openUploadFootage(sc.id);
                                  }}
                                  className={`flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-2 text-[11px] font-semibold ${
                                    active ? 'border-white/25 text-white/80' : 'border-gray-300 text-[#6e6e73]'
                                  }`}
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  Add another take
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openUploadFootage(sc.id);
                                  }}
                                  className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold ${
                                    active ? 'bg-white text-[#1d1d1f]' : 'bg-[#1d1d1f] text-white'
                                  }`}
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  Upload footage
                                </button>
                              )}
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
                            B-roll videos
                          </p>
                          <button
                            type="button"
                            onClick={() => handleFindMoreBroll('video')}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-[#1d1d1f]"
                          >
                            <Search className="h-3 w-3" />
                            Find more
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          {sidebarBrollVideos.map((item, i) => (
                            <SuggestionCard
                              key={`m-vid-${item.label}-${i}`}
                              item={item}
                              type="broll"
                              already={timelineHasClipNamed(DEFAULT_TRACK_IDS.broll, item.label)}
                              onInsert={() => insertSuggestion('broll', item)}
                              onPreview={() => setPreviewItem({ item, type: 'broll' })}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {libraryTab === 'broll-images' && (
                      <>
                        <div className="mb-2.5 flex items-center justify-between gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
                            B-roll images
                          </p>
                          <button
                            type="button"
                            onClick={() => handleFindMoreBroll('image')}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-[#1d1d1f]"
                          >
                            <Search className="h-3 w-3" />
                            Find more
                          </button>
                        </div>
                        {sidebarBrollImages.length === 0 ? (
                          <p className="text-[11px] leading-relaxed text-[#a1a1a6]">
                            No matched images for this scene yet.
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2.5">
                            {sidebarBrollImages.map((item, i) => (
                              <SuggestionCard
                                key={`m-img-${item.label}-${i}`}
                                item={item}
                                type="broll"
                                already={timelineHasClipNamed(DEFAULT_TRACK_IDS.broll, item.label)}
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
                          Infographics
                        </p>
                        {selected?.remotionInfographic ? (
                          <SuggestionCard
                            item={{
                              label: remotionInfographicLabel(selected.remotionInfographic),
                              meta: `${selected.remotionInfographic.animationType} · ${selected.remotionInfographic.durationFrames}f · Remotion`,
                              start: 0,
                              dur: remotionDurationSeconds(selected.remotionInfographic.durationFrames, EDITOR_FPS),
                              matchedScene: selected.title,
                              matchPct: 100,
                              mode: selected.remotionInfographic.placement === 'full_frame' ? 'fullscreen' : 'overlay',
                            }}
                            type="infographic"
                            already={remotionAlreadyOnTimeline}
                            onInsert={insertRemotionInfographic}
                            onPreview={() => setPreviewRemotion(selected.remotionInfographic!)}
                          />
                        ) : (
                          <p className="text-[11px] leading-relaxed text-[#a1a1a6]">
                            No infographic suggested for this scene yet.
                          </p>
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
                            onClick={() => setTextStyle((t) => ({ ...t, background: !t.background }))}
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
                            if (selected) recordPendingStyle(selected.id);
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
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {colorPickerTarget && (
        <ColorPickerPanel
          title={colorPickerTarget === 'text' ? 'Text colour' : 'Background colour'}
          value={colorPickerTarget === 'text' ? textStyle.textColor : textStyle.bgColor}
          onChange={(hex) => {
            if (colorPickerTarget === 'text') {
              setTextStyle((t) => ({ ...t, textColor: hex }));
            } else {
              setTextStyle((t) => ({ ...t, bgColor: hex }));
            }
            if (selected) recordPendingStyle(selected.id);
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
                disabled={remotionAlreadyOnTimeline}
                onClick={() => {
                  insertRemotionInfographic();
                  setPreviewRemotion(null);
                }}
                className="rounded-lg bg-[#1d1d1f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-40"
              >
                {remotionAlreadyOnTimeline ? 'Added' : 'Insert'}
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
              <button
                type="button"
                onClick={closeVideoPreview}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              >
                <X className="h-4 w-4 text-white" />
              </button>
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
