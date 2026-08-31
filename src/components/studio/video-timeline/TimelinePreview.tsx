'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TimelineClip, TimelineState } from '@/lib/video-editor/types';
import { getActiveClipsAtTime } from '@/lib/video-editor/math';
import { isInfographicActiveAtTime } from '@/lib/video-editor/infographics';
import { InfographicRenderer } from '@/remotion/InfographicRenderer';
import { clipRemotionToInfographicData } from '@/remotion/data';
import { Sparkles, Film, Volume2 } from 'lucide-react';

type TextStyle = {
  /** Distance from the left edge of the frame, as a % of frame width. */
  offsetX: number;
  /** Distance from the bottom edge of the frame, as a % of frame height. */
  offsetY: number;
  background: boolean;
  bgColor: string;
  textColor: string;
  fontSize: number;
  /** CSS font-family value, e.g. "Inter". */
  fontStyle: string;
  animationStyle: string;
};

type Props = {
  timeline: TimelineState;
  isPlaying: boolean;
  onTimeUpdate: (t: number) => void;
  onEnded: () => void;
  textStyle: TextStyle;
  /** Fired while the on-screen text is dragged — x/y are percentages of the preview box. */
  onTextPositionChange?: (x: number, y: number) => void;
  /** Fired while a corner handle is dragged to resize the text. */
  onTextResize?: (fontSize: number) => void;
  /** Fired when the inline-edited text is changed — receives the clip id being edited. */
  onTextEdit?: (clipId: string, text: string) => void;
};

type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br';

/** animation-name → { duration, timing } for each backend text_animation_style value. */
const TEXT_ANIMATION_CSS: Record<string, { duration: string; timing: string }> = {
  fade_in: { duration: '0.5s', timing: 'ease' },
  slide_in_left: { duration: '0.5s', timing: 'ease' },
  slide_in_right: { duration: '0.5s', timing: 'ease' },
  slide_up: { duration: '0.5s', timing: 'ease' },
  slide_down: { duration: '0.5s', timing: 'ease' },
  zoom_in: { duration: '0.45s', timing: 'ease' },
  bounce: { duration: '0.6s', timing: 'ease' },
  pop: { duration: '0.3s', timing: 'ease' },
  typewriter: { duration: '0.9s', timing: 'steps(14, end)' },
  wipe: { duration: '0.7s', timing: 'linear' },
};

const TEXT_ANIMATION_KEYFRAMES = `
@keyframes txtAnim-fade_in { from { opacity: 0; } to { opacity: 1; } }
@keyframes txtAnim-slide_in_left { from { opacity: 0; transform: translate(calc(-50% - 40px), 0); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes txtAnim-slide_in_right { from { opacity: 0; transform: translate(calc(-50% + 40px), 0); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes txtAnim-slide_up { from { opacity: 0; transform: translate(-50%, 40px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes txtAnim-slide_down { from { opacity: 0; transform: translate(-50%, -40px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes txtAnim-zoom_in { from { opacity: 0; transform: translate(-50%, 0) scale(0.55); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
@keyframes txtAnim-bounce { 0% { opacity: 0; transform: translate(-50%, 0) scale(0.3); } 50% { opacity: 1; transform: translate(-50%, 0) scale(1.12); } 70% { transform: translate(-50%, 0) scale(0.94); } 100% { transform: translate(-50%, 0) scale(1); } }
@keyframes txtAnim-pop { 0% { opacity: 0; transform: translate(-50%, 0) scale(0.5); } 70% { opacity: 1; transform: translate(-50%, 0) scale(1.1); } 100% { transform: translate(-50%, 0) scale(1); } }
@keyframes txtAnim-typewriter { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes txtAnim-wipe { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
`;

type CaptionLine = { text: string; start: number; end: number };

/** Groups word-level segments into readable caption lines (standard burned-in-caption chunking). */
function buildCaptionLines(
  words: { word: string; start: number; end: number }[] | undefined,
): CaptionLine[] {
  if (!words?.length) return [];
  const lines: CaptionLine[] = [];
  let current: { word: string; start: number; end: number }[] = [];

  const flush = () => {
    if (!current.length) return;
    lines.push({
      text: current.map((w) => w.word).join(' '),
      start: current[0].start,
      end: current[current.length - 1].end,
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

function isImageClip(clip: TimelineClip | undefined | null): boolean {
  if (!clip) return false;
  if (clip.mediaKind === 'image') return true;
  if (clip.mediaKind === 'video') return false;
  const url = clip.sourceUrl || clip.thumbnailUrl || '';
  if (!url) return false;
  if (/^data:image/i.test(url)) return true;
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(url)) return true;
  // Common still-image CDNs without file extensions in the path
  if (/images\.pexels\.com|images\.unsplash\.com|img\.freepik\.com|cdn\.pixabay\.com/i.test(url)) {
    return true;
  }
  return false;
}

function localMediaTime(clip: TimelineClip, globalTime: number): number {
  return Math.max(0, globalTime - clip.start + (clip.sourceStart || 0));
}

function findNextAdjacentClip(clip: TimelineClip, timeline: TimelineState): TimelineClip | null {
  const track = timeline.tracks.find((t) => t.id === clip.trackId);
  if (!track) return null;
  const end = clip.start + clip.duration;
  const next = [...track.clips]
    .filter((c) => c.id !== clip.id && c.sourceUrl && c.start >= end - 0.05)
    .sort((a, b) => a.start - b.start)[0];
  if (!next) return null;
  // Only prefetch near-adjacent clips (touching or tiny gap)
  if (next.start - end > 0.2) return null;
  return next;
}

/**
 * Preview driven by TimelineState.currentTime.
 * Voiceover plays independently of whether video/B-roll is present.
 * Uses dual video buffers so adjacent clips hand off without a blank gap.
 */
export function TimelinePreview({
  timeline,
  isPlaying,
  onTimeUpdate,
  onEnded,
  textStyle,
  onTextPositionChange,
  onTextResize,
  onTextEdit,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [editingText, setEditingText] = useState(false);

  const beginDragText = (e: React.PointerEvent) => {
    if (editingText) return;
    e.stopPropagation();
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && (Math.abs(ev.clientX - startX) > 3 || Math.abs(ev.clientY - startY) > 3)) {
        moved = true;
      }
      if (!moved || !onTextPositionChange) return;
      const fromLeft = Math.max(4, Math.min(96, ((ev.clientX - rect.left) / rect.width) * 100));
      const fromTop = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
      const fromBottom = Math.max(4, Math.min(96, 100 - fromTop));
      onTextPositionChange(fromLeft, fromBottom);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      // A tap with no drag — edit the text in place instead of moving it.
      if (!moved && onTextEdit) setEditingText(true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const beginResizeText = (e: React.PointerEvent, corner: ResizeCorner) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onTextResize) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startFontSize = textStyle.fontSize;
    // Dragging a corner away from the box centre grows the text; toward it shrinks.
    const signX = corner === 'tl' || corner === 'bl' ? -1 : 1;
    const signY = corner === 'tl' || corner === 'tr' ? -1 : 1;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) * signX;
      const dy = (ev.clientY - startY) * signY;
      const next = Math.max(8, Math.min(300, Math.round(startFontSize + (dx + dy) / 2)));
      onTextResize(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [activeBuf, setActiveBuf] = useState<'A' | 'B'>('A');
  const activeBufRef = useRef<'A' | 'B'>('A');
  activeBufRef.current = activeBuf;
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number | null>(null);
  const seekingRef = useRef(false);
  const timeRef = useRef(timeline.currentTime);
  const isPlayingRef = useRef(isPlaying);
  const mediaClipIdRef = useRef<string | null>(null);
  timeRef.current = timeline.currentTime;
  isPlayingRef.current = isPlaying;

  const active = useMemo(
    () => getActiveClipsAtTime(timeline, timeline.currentTime),
    [timeline],
  );

  const videoClip = active.find(
    (c) => c.type === 'video' && timeline.tracks.find((t) => t.id === c.trackId)?.visible,
  );
  const brollClip = active.find((c) => c.type === 'broll');
  const textClip = active.find((c) => c.type === 'text' || c.type === 'caption');
  useEffect(() => {
    setEditingText(false);
  }, [textClip?.id]);
  const infoClip = active.find((c) => c.type === 'infographic');
  const voClip = active.find((c) => c.type === 'voiceover');

  const captionLines = useMemo(() => buildCaptionLines(voClip?.wordSegments), [voClip]);
  const activeCaption = useMemo(() => {
    if (!voClip || !captionLines.length) return null;
    const local = localMediaTime(voClip, timeline.currentTime);
    return captionLines.find((l) => local >= l.start && local < l.end) ?? null;
  }, [voClip, captionLines, timeline.currentTime]);

  const remotionInfoClip = useMemo(() => {
    if (!infoClip?.remotion) return null;
    const frames = infoClip.remotion.durationFrames;
    if (!Number.isFinite(frames) || frames <= 0) return null;
    // Prefer clip.duration (seconds on timeline); fall back to frames/fps via sourceDuration
    const dur = infoClip.duration > 0 ? infoClip.duration : infoClip.sourceDuration;
    if (!isInfographicActiveAtTime(timeline.currentTime, infoClip.start, dur)) return null;
    return infoClip;
  }, [infoClip, timeline.currentTime]);

  const mediaClip = brollClip || videoClip;
  const mediaIsImage = isImageClip(mediaClip);
  const displayUrl = mediaClip?.sourceUrl || mediaClip?.thumbnailUrl || null;
  const displayThumb = mediaClip?.thumbnailUrl || null;
  const voTrack = timeline.tracks.find((t) => t.type === 'voiceover');
  const voMuted = Boolean(voTrack?.muted);

  const getBuf = (which: 'A' | 'B') => (which === 'A' ? videoARef.current : videoBRef.current);
  const getActiveVideo = () => getBuf(activeBufRef.current);
  const getInactiveVideo = () => getBuf(activeBufRef.current === 'A' ? 'B' : 'A');

  const swapToBuffer = (which: 'A' | 'B') => {
    activeBufRef.current = which;
    setActiveBuf(which);
  };

  const prepareBuffer = (
    el: HTMLVideoElement,
    clip: TimelineClip,
    opts?: { seekTo?: number; play?: boolean },
  ) => {
    const url = clip.sourceUrl;
    if (!url) return;
    const needsSrc = el.dataset.clipId !== clip.id || el.getAttribute('data-src') !== url;
    if (needsSrc) {
      el.dataset.clipId = clip.id;
      el.setAttribute('data-src', url);
      el.src = url;
      el.load();
    }
    const seekTo = opts?.seekTo ?? (clip.sourceStart || 0);
    const apply = () => {
      seekingRef.current = true;
      try {
        if (Number.isFinite(seekTo) && Math.abs(el.currentTime - seekTo) > 0.04) {
          el.currentTime = Math.max(0, seekTo);
        }
      } catch {
        /* ignore */
      }
      seekingRef.current = false;
      if (opts?.play) void el.play().catch(() => undefined);
      else el.pause();
    };
    if (!needsSrc && el.readyState >= 2) {
      apply();
      return;
    }
    const onReady = () => {
      el.removeEventListener('loadeddata', onReady);
      el.removeEventListener('canplay', onReady);
      apply();
    };
    el.addEventListener('loadeddata', onReady);
    el.addEventListener('canplay', onReady);
  };

  // Assign active media clip to a buffer; swap instantly when the next clip was prefetched.
  useEffect(() => {
    if (!mediaClip?.sourceUrl || mediaIsImage) {
      getActiveVideo()?.pause();
      getInactiveVideo()?.pause();
      mediaClipIdRef.current = mediaClip?.id ?? null;
      return;
    }

    const local = localMediaTime(mediaClip, timeline.currentTime);
    const inactive = getInactiveVideo();
    const activeEl = getActiveVideo();

    // Already showing this clip on the active buffer — only sync play/pause / light seek
    if (mediaClipIdRef.current === mediaClip.id && activeEl?.dataset.clipId === mediaClip.id) {
      if (isPlaying) {
        if (activeEl.paused) void activeEl.play().catch(() => undefined);
      } else {
        activeEl.pause();
      }
      return;
    }

    // Hot-swap: next clip already loaded in the inactive buffer
    if (
      inactive &&
      inactive.dataset.clipId === mediaClip.id &&
      inactive.readyState >= 2
    ) {
      const nextBuf = activeBufRef.current === 'A' ? 'B' : 'A';
      swapToBuffer(nextBuf);
      mediaClipIdRef.current = mediaClip.id;
      seekingRef.current = true;
      try {
        inactive.currentTime = local;
      } catch {
        /* ignore */
      }
      seekingRef.current = false;
      if (isPlaying) void inactive.play().catch(() => undefined);
      else inactive.pause();
      activeEl?.pause();
      return;
    }

    // Cold load into the inactive buffer; keep previous frame visible until ready
    const target = inactive || activeEl;
    if (!target) return;
    const targetBuf: 'A' | 'B' =
      target === videoARef.current ? 'A' : target === videoBRef.current ? 'B' : activeBufRef.current;

    let cancelled = false;
    const url = mediaClip.sourceUrl;
    target.dataset.clipId = mediaClip.id;
    target.setAttribute('data-src', url);
    target.src = url;
    target.load();

    const reveal = () => {
      if (cancelled) return;
      seekingRef.current = true;
      try {
        target.currentTime = local;
      } catch {
        /* ignore */
      }
      seekingRef.current = false;
      mediaClipIdRef.current = mediaClip.id;
      if (targetBuf !== activeBufRef.current) {
        swapToBuffer(targetBuf);
        activeEl?.pause();
      }
      if (isPlaying) void target.play().catch(() => undefined);
      else target.pause();
    };

    if (target.readyState >= 2) {
      reveal();
    } else {
      const onReady = () => {
        target.removeEventListener('loadeddata', onReady);
        target.removeEventListener('canplay', onReady);
        reveal();
      };
      target.addEventListener('loadeddata', onReady);
      target.addEventListener('canplay', onReady);
      return () => {
        cancelled = true;
        target.removeEventListener('loadeddata', onReady);
        target.removeEventListener('canplay', onReady);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaClip?.id, mediaClip?.sourceUrl, mediaIsImage, isPlaying]);

  // Scrub / pause seek on the active buffer
  useEffect(() => {
    if (mediaIsImage || !mediaClip?.sourceUrl) return;
    const el = getActiveVideo();
    if (!el) return;
    if (isPlaying) return;
    const local = localMediaTime(mediaClip, timeline.currentTime);
    if (Math.abs(el.currentTime - local) > 0.12) {
      seekingRef.current = true;
      try {
        el.currentTime = local;
      } catch {
        /* ignore */
      }
      seekingRef.current = false;
    }
    el.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline.currentTime, mediaClip?.id, mediaIsImage, isPlaying]);

  // Prefetch the next adjacent video clip into the inactive buffer
  useEffect(() => {
    if (!isPlaying || !mediaClip?.sourceUrl || mediaIsImage) return;
    const next = findNextAdjacentClip(mediaClip, timeline);
    if (!next || isImageClip(next) || !next.sourceUrl) return;
    const remaining = mediaClip.start + mediaClip.duration - timeline.currentTime;
    // Start warming the next buffer ~1.25s before the cut
    if (remaining > 1.25) return;
    const inactive = getInactiveVideo();
    if (!inactive) return;
    if (inactive.dataset.clipId === next.id && inactive.readyState >= 2) return;
    prepareBuffer(inactive, next, { seekTo: next.sourceStart || 0, play: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, mediaClip?.id, timeline.currentTime, timeline.tracks, mediaIsImage]);

  // Load / swap voiceover source (independent of video).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!voClip?.sourceUrl || voMuted) {
      audio.pause();
      return;
    }
    const nextSrc = voClip.sourceUrl;
    if (audio.getAttribute('data-src') !== nextSrc) {
      audio.setAttribute('data-src', nextSrc);
      audio.src = nextSrc;
      audio.load();
    }
  }, [voClip?.sourceUrl, voMuted, voClip]);

  // Seek voiceover when paused/scrubbing
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !voClip?.sourceUrl || voMuted) return;
    if (isPlaying) return;
    const local = Math.max(0, timeline.currentTime - voClip.start + voClip.sourceStart);
    if (Math.abs(audio.currentTime - local) > 0.15) {
      try {
        audio.currentTime = local;
      } catch {
        /* ignore */
      }
    }
    audio.pause();
  }, [timeline.currentTime, voClip, voMuted, isPlaying]);

  // Play / pause voiceover with transport
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !voClip?.sourceUrl || voMuted) {
      audioRef.current?.pause();
      return;
    }
    if (isPlaying) {
      const local = Math.max(0, timeline.currentTime - voClip.start + voClip.sourceStart);
      const startPlay = () => {
        if (Math.abs(audio.currentTime - local) > 0.25) {
          try {
            audio.currentTime = local;
          } catch {
            /* ignore */
          }
        }
        void audio.play().catch(() => undefined);
      };
      if (audio.readyState >= 2) startPlay();
      else {
        const onReady = () => {
          audio.removeEventListener('canplay', onReady);
          startPlay();
        };
        audio.addEventListener('canplay', onReady);
        return () => audio.removeEventListener('canplay', onReady);
      }
    } else {
      audio.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, voClip?.id, voClip?.sourceUrl, voMuted]);

  // Drive currentTime: video clock (when playable), else VO, else soft clock (images / gaps).
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      if (!isPlayingRef.current) return;

      const video = getActiveVideo();
      const audio = audioRef.current;
      const activeMedia = mediaClip;
      const activeVo = voClip;
      const useVideoClock =
        Boolean(activeMedia?.sourceUrl) &&
        !isImageClip(activeMedia) &&
        video &&
        video.dataset.clipId === activeMedia?.id &&
        !seekingRef.current &&
        !video.paused &&
        !video.ended &&
        video.readyState >= 2;

      if (useVideoClock && video && activeMedia) {
        const global = activeMedia.start + (video.currentTime - (activeMedia.sourceStart || 0));
        // Clamp within the clip so we don't overshoot into a blank before React swaps clips
        const clipEnd = activeMedia.start + activeMedia.duration;
        const clamped = Math.min(global, clipEnd - 0.001);
        timeRef.current = clamped;
        onTimeUpdate(clamped);
        if (global >= timeline.duration - 0.001) {
          onEnded();
          return;
        }
        // When this clip is exhausted, advance soft-clock onto the next frame so the
        // next clip becomes active immediately (prefetch swap can then take over).
        if (global >= clipEnd - 0.001) {
          const next = Math.min(timeline.duration, clipEnd);
          timeRef.current = next;
          onTimeUpdate(next);
        }
      } else if (
        audio &&
        activeVo?.sourceUrl &&
        !voMuted &&
        !audio.paused &&
        !audio.ended &&
        audio.readyState >= 2 &&
        // Prefer soft/video clock when a visual clip owns the playhead
        !(activeMedia?.sourceUrl && !isImageClip(activeMedia))
      ) {
        const global = activeVo.start + (audio.currentTime - activeVo.sourceStart);
        timeRef.current = global;
        onTimeUpdate(global);
        if (global >= timeline.duration) {
          onEnded();
          return;
        }
      } else {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const next = timeRef.current + dt;
        timeRef.current = next;
        onTimeUpdate(next);
        if (next >= timeline.duration) {
          onEnded();
          return;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, mediaClip, voClip, voMuted, onEnded, onTimeUpdate, timeline.duration, mediaIsImage]);

  const hasVisual = Boolean(displayUrl || displayThumb || videoClip || brollClip);
  const hasVoiceOnly = Boolean(voClip?.sourceUrl) && !hasVisual;
  const showImage = Boolean(mediaIsImage && (displayUrl || displayThumb));
  const showVideo = Boolean(mediaClip?.sourceUrl && !mediaIsImage);

  return (
    <div
      ref={rootRef}
      className={`relative flex max-h-full items-end justify-center overflow-hidden rounded-xl border border-gray-200 ${
        hasVisual
          ? 'bg-gradient-to-br from-slate-700 to-slate-950'
          : hasVoiceOnly
            ? 'bg-gradient-to-br from-indigo-50 to-slate-100'
            : 'bg-[length:24px_24px] bg-[linear-gradient(45deg,#e8e8ed_25%,transparent_25%),linear-gradient(-45deg,#e8e8ed_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e8e8ed_75%),linear-gradient(-45deg,transparent_75%,#e8e8ed_75%)] bg-[position:0_0,0_12px,12px_-12px,-12px_0] bg-white'
      }`}
      style={{
        aspectRatio: '16 / 9',
        width: 'min(100%, 900px)',
        maxWidth: '900px',
      }}
    >
      <audio ref={audioRef} preload="auto" className="hidden" />

      {/* Dual video buffers — cross-swap at clip boundaries to avoid blank frames */}
      <video
        ref={videoARef}
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: showVideo && activeBuf === 'A' ? 1 : 0,
          pointerEvents: 'none',
          zIndex: showVideo && activeBuf === 'A' ? 1 : 0,
        }}
        playsInline
        preload="auto"
        muted={Boolean(brollClip) || mediaIsImage}
      />
      <video
        ref={videoBRef}
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: showVideo && activeBuf === 'B' ? 1 : 0,
          pointerEvents: 'none',
          zIndex: showVideo && activeBuf === 'B' ? 1 : 0,
        }}
        playsInline
        preload="auto"
        muted={Boolean(brollClip) || mediaIsImage}
      />

      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote stock stills; Next Image not required here
        <img
          src={displayUrl || displayThumb || ''}
          alt={mediaClip?.name || 'B-roll'}
          className="absolute inset-0 z-[1] h-full w-full object-cover"
        />
      ) : null}

      {!showVideo && !showImage && hasVoiceOnly ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
          <Volume2 className="h-8 w-8 text-indigo-500" />
          <p className="text-sm font-semibold text-[#1d1d1f]">
            {isPlaying ? 'Playing voiceover…' : 'Voiceover ready'}
          </p>
          <p className="max-w-sm text-xs leading-relaxed text-[#6e6e73]">
            {voClip?.name || 'Audio will play with the timeline — no video required.'}
          </p>
        </div>
      ) : null}

      {!showVideo && !showImage && !hasVoiceOnly && hasVisual ? (
        <div className="absolute inset-0 flex items-center justify-center text-white/70">
          <Film className="h-8 w-8" />
        </div>
      ) : null}

      {!showVideo && !showImage && !hasVoiceOnly && !hasVisual ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <p className="mb-2 text-base font-semibold text-[#1d1d1f]">Preview</p>
          <p className="max-w-sm text-xs leading-relaxed text-[#6e6e73]">
            Generate a video or insert media onto the timeline to preview at the playhead.
          </p>
        </div>
      ) : null}

      {remotionInfoClip?.remotion ? (
        <InfographicRenderer
          data={clipRemotionToInfographicData(remotionInfoClip.remotion)}
          clip={remotionInfoClip}
          currentTime={timeline.currentTime}
        />
      ) : null}

      {!remotionInfoClip && infoClip && infoClip.mode === 'fullscreen' && (
        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 bg-violet-950/70 px-6 text-center">
          <Sparkles className="h-5 w-5 text-violet-200" />
          <p className="text-sm font-bold text-white">{infoClip.text || infoClip.name}</p>
        </div>
      )}

      {!remotionInfoClip && infoClip && infoClip.mode !== 'fullscreen' && (
        <div className="absolute bottom-14 left-3 z-[3] rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-violet-100">
          <Sparkles className="mr-1 inline h-3 w-3" />
          {infoClip.text || infoClip.name}
        </div>
      )}

      {activeCaption && (
        <div className="pointer-events-none absolute bottom-[7%] left-1/2 z-[1] max-w-[88%] -translate-x-1/2 rounded-md bg-black/70 px-3 py-1.5 text-center">
          <p className="text-[15px] font-bold leading-snug text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.8)] sm:text-lg">
            {activeCaption.text}
          </p>
        </div>
      )}

      {textClip && (textClip.text || editingText) && (
        <div
          key={textClip.id}
          onPointerDown={beginDragText}
          className="absolute z-[2] max-w-[85%] touch-none select-none rounded-lg px-3.5 py-2 text-center"
          style={{
            left: `${textStyle.offsetX}%`,
            bottom: `${textStyle.offsetY}%`,
            transform: 'translateX(-50%)',
            background: textStyle.background ? `${textStyle.bgColor}cc` : 'transparent',
            cursor: editingText ? 'text' : onTextPositionChange ? 'grab' : undefined,
            ...(editingText
              ? {}
              : {
                  animationName: `txtAnim-${textStyle.animationStyle}`,
                  animationDuration: TEXT_ANIMATION_CSS[textStyle.animationStyle]?.duration ?? '0.5s',
                  animationTimingFunction: TEXT_ANIMATION_CSS[textStyle.animationStyle]?.timing ?? 'ease',
                  animationFillMode: 'both' as const,
                }),
          }}
        >
          <style>{TEXT_ANIMATION_KEYFRAMES}</style>
          {editingText ? (
            <textarea
              autoFocus
              value={textClip.text ?? ''}
              onChange={(e) => onTextEdit?.(textClip.id, e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={() => setEditingText(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingText(false);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              rows={Math.max(1, (textClip.text ?? '').split('\n').length)}
              className="min-w-[80px] resize-none whitespace-pre-wrap border-none bg-transparent text-center leading-snug font-semibold outline-none"
              style={{ fontSize: `${textStyle.fontSize}px`, color: textStyle.textColor, fontFamily: textStyle.fontStyle }}
            />
          ) : (
            <p
              className="whitespace-pre-wrap leading-snug font-semibold"
              style={{ fontSize: `${textStyle.fontSize}px`, color: textStyle.textColor, fontFamily: textStyle.fontStyle }}
            >
              {textClip.text}
            </p>
          )}

          {!editingText && onTextResize && (
            <>
              <span
                onPointerDown={(e) => beginResizeText(e, 'tl')}
                className="absolute -left-1.5 -top-1.5 h-3 w-3 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-[#1d1d1f] shadow"
              />
              <span
                onPointerDown={(e) => beginResizeText(e, 'tr')}
                className="absolute -right-1.5 -top-1.5 h-3 w-3 cursor-nesw-resize touch-none rounded-full border-2 border-white bg-[#1d1d1f] shadow"
              />
              <span
                onPointerDown={(e) => beginResizeText(e, 'bl')}
                className="absolute -left-1.5 -bottom-1.5 h-3 w-3 cursor-nesw-resize touch-none rounded-full border-2 border-white bg-[#1d1d1f] shadow"
              />
              <span
                onPointerDown={(e) => beginResizeText(e, 'br')}
                className="absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-[#1d1d1f] shadow"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
