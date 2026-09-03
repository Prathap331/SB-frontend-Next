import { EDITOR_FPS } from './fps';
import type { EditVideoCaptionAnimationType, EditVideoTextHorizontalPosition, EditVideoTextVerticalPosition } from '@/services/api';

export type CaptionWord = { word: string; start: number; end: number };

export type CaptionStyle = {
  /** Distance from the left edge of the frame, as a % of frame width. */
  offsetX: number;
  /** Distance from the bottom edge of the frame, as a % of frame height. */
  offsetY: number;
  fontSize: number;
  textColor: string;
  outlineColor: string;
  verticalPosition: EditVideoTextVerticalPosition;
  horizontalPosition: EditVideoTextHorizontalPosition;
  animationType: EditVideoCaptionAnimationType;
};

export type CaptionLine = { text: string; start: number; end: number; words: CaptionWord[] };

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  offsetX: 50,
  offsetY: 12,
  fontSize: 32,
  textColor: '#ffffff',
  outlineColor: '#000000',
  verticalPosition: 'bottom',
  horizontalPosition: 'center',
  animationType: 'static_line',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function trackSceneId(track: Record<string, unknown>): string {
  return str(track.scene_id);
}

function isCaptionTrack(track: Record<string, unknown>): boolean {
  const type = str(track.type).toLowerCase();
  return type === 'caption_word' || type === 'caption' || type === 'captions';
}

function isAudioTrack(track: Record<string, unknown>): boolean {
  const type = str(track.type).toLowerCase();
  return type === 'audio' || type === 'voiceover' || type === 'voice';
}

export function findCaptionTrack(tracks: unknown[] | undefined, sceneId: string): Record<string, unknown> | null {
  if (!tracks?.length || !sceneId) return null;
  for (const raw of tracks) {
    const track = asRecord(raw);
    if (!track) continue;
    if (trackSceneId(track) === sceneId && isCaptionTrack(track)) return track;
  }
  return null;
}

export function findAudioTrack(tracks: unknown[] | undefined, sceneId: string): Record<string, unknown> | null {
  if (!tracks?.length || !sceneId) return null;
  for (const raw of tracks) {
    const track = asRecord(raw);
    if (!track) continue;
    if (trackSceneId(track) === sceneId && isAudioTrack(track)) return track;
  }
  return null;
}

function asVerticalPosition(value: unknown): EditVideoTextVerticalPosition | null {
  const v = str(value).toLowerCase();
  if (v === 'top' || v === 'middle' || v === 'bottom') return v;
  return null;
}

function asHorizontalPosition(value: unknown): EditVideoTextHorizontalPosition | null {
  const v = str(value).toLowerCase();
  if (v === 'left' || v === 'center' || v === 'right') return v;
  return null;
}

function asAnimationType(value: unknown): EditVideoCaptionAnimationType | null {
  const v = str(value).toLowerCase();
  if (v === 'kinetic_caption' || v === 'static_line' || v === 'typewriter' || v === 'word_pop') return v;
  return null;
}

/** Maps backend caption_style / caption_word.style onto preview coordinates. */
export function parseCaptionStyle(raw: unknown): CaptionStyle {
  const obj = asRecord(raw);
  if (!obj) return { ...DEFAULT_CAPTION_STYLE };

  const verticalPosition = asVerticalPosition(obj.vertical_position) ?? DEFAULT_CAPTION_STYLE.verticalPosition;
  const horizontalPosition = asHorizontalPosition(obj.horizontal_position) ?? DEFAULT_CAPTION_STYLE.horizontalPosition;
  const animationType = asAnimationType(obj.animation_type) ?? DEFAULT_CAPTION_STYLE.animationType;
  const marginBottom = num(obj.margin_bottom_percent);
  const marginH = num(obj.margin_horizontal_percent);
  const fontSize = num(obj.font_size);
  const textColor = str(obj.text_color);
  const outlineColor = str(obj.outline_color);

  let offsetY: number;
  if (marginBottom != null) offsetY = marginBottom;
  else if (verticalPosition === 'top') offsetY = 82;
  else if (verticalPosition === 'middle') offsetY = 48;
  else offsetY = DEFAULT_CAPTION_STYLE.offsetY;

  let offsetX: number;
  if (horizontalPosition === 'center') {
    offsetX = marginH != null ? marginH : 50;
  } else if (horizontalPosition === 'left') {
    offsetX = marginH ?? 8;
  } else {
    offsetX = marginH != null ? 100 - marginH : 92;
  }

  return {
    offsetX,
    offsetY,
    fontSize: fontSize != null && fontSize > 0 ? fontSize : DEFAULT_CAPTION_STYLE.fontSize,
    textColor: textColor || DEFAULT_CAPTION_STYLE.textColor,
    outlineColor: outlineColor || DEFAULT_CAPTION_STYLE.outlineColor,
    verticalPosition,
    horizontalPosition,
    animationType,
  };
}

function originFrameFromAudio(audio: Record<string, unknown> | null, fps: number): number {
  if (!audio) return 0;
  const startFrame = num(audio.startFrame ?? audio.start_frame);
  if (startFrame != null) return Math.max(0, startFrame);
  const startSec = num(audio.start_sec);
  const sceneStart = num(audio.scene_start_sec);
  if (startSec != null && sceneStart != null) {
    return Math.max(0, Math.round((startSec - sceneStart) * fps));
  }
  if (startSec != null) return Math.max(0, Math.round(startSec * fps));
  return 0;
}

function parseRawCaptionWord(raw: unknown): { word: string; startFrame: number | null; endFrame: number | null; start: number | null; end: number | null } | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const word = str(obj.word);
  if (!word) return null;
  return {
    word,
    startFrame: num(obj.startFrame ?? obj.start_frame),
    endFrame: num(obj.endFrame ?? obj.end_frame),
    start: num(obj.start),
    end: num(obj.end),
  };
}

function wordsLookSceneLocal(words: CaptionWord[], sceneDuration: number): boolean {
  if (!words.length) return false;
  const first = words[0].start;
  const last = words[words.length - 1].end;
  const span = last - first;
  if (!(span > 0)) return false;
  if (first < -0.05) return false;
  const cap = sceneDuration > 0 ? sceneDuration + 1.5 : last + 1;
  return last <= cap;
}

function convertFrameWords(rawWords: ReturnType<typeof parseRawCaptionWord>[], fps: number, originFrame: number): CaptionWord[] {
  const out: CaptionWord[] = [];
  for (const raw of rawWords) {
    if (!raw || raw.startFrame == null || raw.endFrame == null) continue;
    const start = Math.max(0, (raw.startFrame - originFrame) / fps);
    const end = Math.max(start, (raw.endFrame - originFrame) / fps);
    out.push({ word: raw.word, start, end });
  }
  return out;
}

/**
 * Converts caption_word `{ startFrame, endFrame }` (or second-based `{ start, end }`)
 * into scene-local seconds.
 */
export function captionWordsFromTrack(
  track: unknown,
  fps: number = EDITOR_FPS,
  audioTrack?: unknown,
  sceneDuration = 0,
): CaptionWord[] {
  const rec = asRecord(track);
  if (!rec) return [];
  const list = Array.isArray(rec.words) ? rec.words : [];
  const parsed = list.map(parseRawCaptionWord).filter((w): w is NonNullable<typeof w> => Boolean(w));
  if (!parsed.length) return [];

  const hasFrames = parsed.some((w) => w.startFrame != null && w.endFrame != null);
  if (hasFrames) {
    const safeFps = Number.isFinite(fps) && fps > 0 ? fps : EDITOR_FPS;
    const audioOrigin = originFrameFromAudio(asRecord(audioTrack), safeFps);
    const minFrame = parsed.reduce((min, w) => {
      if (w.startFrame == null) return min;
      return min == null ? w.startFrame : Math.min(min, w.startFrame);
    }, null as number | null);
    const origin =
      audioOrigin > 0 && minFrame != null && minFrame >= audioOrigin - 5 ? audioOrigin : 0;
    let words = convertFrameWords(parsed, safeFps, origin);
    if (!wordsLookSceneLocal(words, sceneDuration) && minFrame != null && minFrame > 0) {
      const shifted = convertFrameWords(parsed, safeFps, minFrame);
      if (wordsLookSceneLocal(shifted, sceneDuration) || !wordsLookSceneLocal(words, sceneDuration)) {
        words = shifted;
      }
    }
    return words;
  }

  return parsed
    .filter((w) => w.start != null && w.end != null)
    .map((w) => ({
      word: w.word,
      start: Math.max(0, w.start!),
      end: Math.max(w.start!, w.end!),
    }));
}

export function captionWordsFromSegments(raw: unknown[] | undefined, fps: number = EDITOR_FPS): CaptionWord[] {
  if (!raw?.length) return [];
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : EDITOR_FPS;
  const out: CaptionWord[] = [];
  for (const item of raw) {
    const parsed = parseRawCaptionWord(item);
    if (!parsed) continue;
    if (parsed.start != null && parsed.end != null) {
      out.push({ word: parsed.word, start: Math.max(0, parsed.start), end: Math.max(parsed.start, parsed.end) });
      continue;
    }
    if (parsed.startFrame != null && parsed.endFrame != null) {
      out.push({
        word: parsed.word,
        start: Math.max(0, parsed.startFrame / safeFps),
        end: Math.max(parsed.startFrame, parsed.endFrame) / safeFps,
      });
    }
  }
  return out;
}

/** Prefers caption_word track frames; falls back to scene word_segments. */
export function captionWordsForScene(opts: {
  tracks?: unknown[];
  sceneId: string;
  fps?: number;
  sceneDuration?: number;
  fallbackWords?: unknown[];
}): CaptionWord[] {
  const fps = opts.fps ?? EDITOR_FPS;
  const captionTrack = findCaptionTrack(opts.tracks, opts.sceneId);
  const audioTrack = findAudioTrack(opts.tracks, opts.sceneId);
  const fromTrack = captionWordsFromTrack(captionTrack, fps, audioTrack, opts.sceneDuration ?? 0);
  if (fromTrack.length) return fromTrack;
  return captionWordsFromSegments(opts.fallbackWords, fps);
}

export function captionStyleForScene(opts: { tracks?: unknown[]; sceneId: string; fallbackStyle?: unknown }): CaptionStyle {
  const track = findCaptionTrack(opts.tracks, opts.sceneId);
  const trackStyle = asRecord(track)?.style;
  return parseCaptionStyle(trackStyle ?? opts.fallbackStyle);
}

/** Groups word-level segments into readable caption lines. */
export function buildCaptionLines(words: CaptionWord[] | undefined): CaptionLine[] {
  if (!words?.length) return [];
  const lines: CaptionLine[] = [];
  let current: CaptionWord[] = [];

  const flush = () => {
    if (!current.length) return;
    lines.push({
      text: current.map((w) => w.word).join(' '),
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current,
    });
    current = [];
  };

  for (const w of words) {
    const prev = current[current.length - 1];
    const gap = prev ? w.start - prev.end : 0;
    if (current.length >= 8 || gap > 0.6) flush();
    current.push(w);
  }
  flush();
  return lines;
}

/** Caption text that should be visible at a scene-local time. */
export function captionTextAtTime(
  words: CaptionWord[] | undefined,
  animationType: EditVideoCaptionAnimationType | string | undefined,
  time: number,
): string | null {
  if (!words?.length) return null;
  const type = asAnimationType(animationType) ?? 'static_line';

  if (type === 'kinetic_caption' || type === 'word_pop') {
    const word = words.find((w) => time >= w.start && time < w.end);
    return word?.word ?? null;
  }

  const lines = buildCaptionLines(words);
  const line = lines.find((l) => time >= l.start && time < l.end);
  if (!line) return null;
  if (type === 'typewriter') {
    const dur = Math.max(0.05, line.end - line.start);
    const p = Math.min(1, Math.max(0, (time - line.start) / dur));
    const n = Math.max(1, Math.floor(line.text.length * p));
    return line.text.slice(0, n);
  }
  return line.text;
}
