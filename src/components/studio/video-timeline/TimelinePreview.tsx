'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TimelineClip, TimelineState } from '@/lib/video-editor/types';
import { getActiveClipsAtTime } from '@/lib/video-editor/math';
import { isInfographicActiveAtTime } from '@/lib/video-editor/infographics';
import { InfographicRenderer } from '@/remotion/InfographicRenderer';
import { clipRemotionToInfographicData } from '@/remotion/data';
import { Sparkles, Film, Volume2 } from 'lucide-react';

type TextStyle = {
  position: 'upper' | 'middle' | 'lower';
  background: boolean;
  bgColor: string;
  fontSize: 'sm' | 'md' | 'lg';
  fontStyle: string;
};

type Props = {
  timeline: TimelineState;
  isPlaying: boolean;
  onTimeUpdate: (t: number) => void;
  onEnded: () => void;
  textStyle: TextStyle;
  fontSizeClass: Record<string, string>;
  fontFamilyClass: Record<string, string>;
};

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
  fontSizeClass,
  fontFamilyClass,
}: Props) {
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
  const infoClip = active.find((c) => c.type === 'infographic');
  const voClip = active.find((c) => c.type === 'voiceover');

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
      className={`relative flex max-h-full items-end justify-center overflow-hidden rounded-xl border border-gray-200 ${
        hasVisual
          ? 'bg-gradient-to-br from-slate-700 to-slate-950'
          : hasVoiceOnly
            ? 'bg-gradient-to-br from-indigo-50 to-slate-100'
            : 'bg-[length:24px_24px] bg-[linear-gradient(45deg,#e8e8ed_25%,transparent_25%),linear-gradient(-45deg,#e8e8ed_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e8e8ed_75%),linear-gradient(-45deg,transparent_75%,#e8e8ed_75%)] bg-[position:0_0,0_12px,12px_-12px,-12px_0] bg-white'
      }`}
      style={{
        aspectRatio: '16 / 9',
        width: 'min(100%, calc(100cqh * 16 / 9))',
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

      {textClip?.text && (
        <div
          className={`absolute left-0 right-0 z-[2] px-5 py-4 ${
            textStyle.position === 'upper'
              ? 'top-0'
              : textStyle.position === 'middle'
                ? 'top-1/2 -translate-y-1/2 text-center'
                : 'bottom-0'
          }`}
          style={
            textStyle.background
              ? {
                  background:
                    textStyle.position === 'upper'
                      ? `linear-gradient(to bottom, ${textStyle.bgColor}cc, transparent)`
                      : textStyle.position === 'lower'
                        ? `linear-gradient(to top, ${textStyle.bgColor}cc, transparent)`
                        : 'transparent',
                }
              : undefined
          }
        >
          <p
            className={`leading-snug text-white ${fontSizeClass[textStyle.fontSize] || ''} ${
              fontFamilyClass[textStyle.fontStyle] || ''
            } font-semibold`}
          >
            {textClip.text}
          </p>
        </div>
      )}
    </div>
  );
}
