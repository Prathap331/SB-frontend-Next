'use client';

import { useEffect, useMemo, useState, type MutableRefObject } from 'react';
import type { TimelineClip, TimelineState } from '@/lib/video-editor/types';
import { EDITOR_FPS } from '@/lib/video-editor/fps';
import { getActiveClipsAtTime } from '@/lib/video-editor/math';
import {
  enrichRemotionFromSpecs,
  isInfographicActiveAtTime,
  type RemotionInfographicSpec,
} from '@/lib/video-editor/infographics';
import { clipRemotionToInfographicData } from '@/remotion/data';
import { InfographicVisual } from '@/remotion/compositions/DataDrivenInfographic';
import { readIconNames } from '@/remotion/props';
import { InfographicInPlaceTextEditor } from '@/components/studio/video-timeline/InfographicInPlaceTextEditor';

const DESIGN_W = 1920;
const DESIGN_H = 1080;

type Props = {
  clip: TimelineClip;
  currentTime: number;
  width: number;
  height: number;
  overlaySpecs?: RemotionInfographicSpec[];
  isPlaying?: boolean;
  onTextCommit?: (path: string, value: string) => void;
  onRequestPause?: () => void;
};

/**
 * Timeline overlay preview: same InfographicVisual as the library Remotion
 * Player (layout + text_animation_style + icon_name), CSS-scaled to the frame.
 */
export function TimelineOverlayPreview({
  clip,
  currentTime,
  width,
  height,
  overlaySpecs = [],
  isPlaying = false,
  onTextCommit,
  onRequestPause,
}: Props) {
  const remotion = clip.remotion
    ? enrichRemotionFromSpecs(clip.remotion, overlaySpecs, clip)
    : clip.remotion;
  if (!remotion || width <= 1 || height <= 1) return null;
  const data = clipRemotionToInfographicData(remotion);

  const dur = clip.duration > 0 ? clip.duration : clip.sourceDuration;
  if (!Number.isFinite(dur) || dur <= 0) return null;
  const local = currentTime - clip.start;
  if (local < -0.02 || local >= dur) return null;

  const durationInFrames = Math.max(1, remotion.durationFrames || Math.round(dur * EDITOR_FPS));
  const frame = Math.min(
    durationInFrames - 1,
    Math.max(0, Math.floor(local * EDITOR_FPS)),
  );

  const scaleX = width / DESIGN_W;
  const scaleY = height / DESIGN_H;
  const iconNames = readIconNames(data.props);

  return (
    <div className="pointer-events-none absolute inset-0 z-[4] overflow-hidden">
      <div
        data-sb-preview-edit=""
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${scaleX}, ${scaleY})`,
          transformOrigin: 'top left',
        }}
      >
        <InfographicVisual
          data={data}
          icon_name={iconNames.length === 1 ? iconNames[0] : iconNames.length ? iconNames : undefined}
          clock={{ frame, fps: EDITOR_FPS, durationInFrames }}
        />
        {onTextCommit ? (
          <InfographicInPlaceTextEditor
            enabled
            isPlaying={isPlaying}
            props={data.props ?? {}}
            onCommit={onTextCommit}
            onRequestPause={onRequestPause}
          />
        ) : null}
      </div>
    </div>
  );
}

function remotionClipAtTime(clip: TimelineClip, time: number): TimelineClip | null {
  if (!clip.remotion) return null;
  const dur = clip.duration > 0 ? clip.duration : clip.sourceDuration;
  if (!Number.isFinite(dur) || dur <= 0) return null;
  if (!isInfographicActiveAtTime(time, clip.start, dur)) return null;
  return clip;
}

/**
 * Live overlay stack driven by the preview clock ref so infographics stay on
 * screen at the playhead even while React `currentTime` is throttled.
 */
export function LiveTimelineOverlays({
  timeline,
  isPlaying,
  visualTimeRef,
  width,
  height,
  overlaySpecs = [],
  onInfographicTextCommit,
  onRequestPause,
}: {
  timeline: TimelineState;
  isPlaying: boolean;
  visualTimeRef?: MutableRefObject<number>;
  width: number;
  height: number;
  overlaySpecs?: RemotionInfographicSpec[];
  onInfographicTextCommit?: (clipId: string, path: string, value: string) => void;
  onRequestPause?: () => void;
}) {
  const [liveTime, setLiveTime] = useState(timeline.currentTime);

  useEffect(() => {
    if (!isPlaying) {
      // Next play starts from here, so the first playing render is not stale.
      setLiveTime(timeline.currentTime);
      return;
    }
    let raf = 0;
    const tick = () => {
      const next = visualTimeRef?.current;
      if (typeof next === 'number') {
        setLiveTime((prev) => (Math.abs(prev - next) >= 1 / 120 ? next : prev));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, timeline.currentTime, visualTimeRef]);

  // Paused / scrubbing / scene switch: the committed timeline time is the truth.
  // Only playback follows the 60fps clock (React time is throttled while playing).
  const clockTime = isPlaying ? liveTime : timeline.currentTime;

  const overlayClips = useMemo(() => {
    const active = getActiveClipsAtTime(timeline, clockTime);
    const seen = new Set<string>();
    const list: TimelineClip[] = [];
    for (const clip of active) {
      if (clip.type !== 'infographic' && clip.type !== 'text') continue;
      const ready = remotionClipAtTime(clip, clockTime);
      if (!ready || seen.has(ready.id)) continue;
      seen.add(ready.id);
      list.push(ready);
    }
    return list;
  }, [timeline, clockTime]);

  if (width <= 1 || height <= 1) return null;
  if (!overlayClips.length) return null;

  return (
    <>
      {overlayClips.map((clip) => (
        <TimelineOverlayPreview
          key={clip.id}
          clip={clip}
          currentTime={clockTime}
          width={width}
          height={height}
          overlaySpecs={overlaySpecs}
          isPlaying={isPlaying}
          onTextCommit={
            onInfographicTextCommit
              ? (path, value) => onInfographicTextCommit(clip.id, path, value)
              : undefined
          }
          onRequestPause={onRequestPause}
        />
      ))}
    </>
  );
}
