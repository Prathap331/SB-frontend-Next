'use client';

import { resolveInfographicRenderer } from '@/remotion/registry';
import { clipRemotionToInfographicData, specToInfographicData } from '@/remotion/data';
import {
  EDITOR_FPS,
  remotionLocalFrame,
  type RemotionInfographicSpec,
} from '@/lib/video-editor/infographics';
import type { TimelineClip } from '@/lib/video-editor/types';
import type { InfographicData } from '@/remotion/types';
import { useEffect, useMemo, useRef } from 'react';
import { Player, type PlayerRef } from '@remotion/player';

type Props = {
  /** Preferred: complete backend-shaped infographic object. */
  data?: InfographicData;
  /** Convenience: editor camelCase spec (converted to InfographicData). */
  spec?: RemotionInfographicSpec;
  /** Timeline clip — builds InfographicData from clip.remotion when `data` is omitted. */
  clip?: TimelineClip;
  /** Editor playhead (seconds). Required for timeline sync. */
  currentTime?: number;
  /** Infographic start on the timeline (seconds). Defaults to clip.start. */
  startSeconds?: number;
  width?: number;
  height?: number;
  /** When true, Player autoplays (modal preview). Timeline mode seeks manually. */
  previewMode?: boolean;
};

/**
 * Central entry:
 * Backend JSON → InfographicRenderer data={…} → Remotion (data-driven) → preview
 *
 * Pass the COMPLETE infographic object. Do not extract title/quote/items here.
 */
export function InfographicRenderer({
  data: dataProp,
  spec,
  clip,
  currentTime = 0,
  startSeconds,
  width = 1920,
  height = 1080,
  previewMode = false,
}: Props) {
  const playerRef = useRef<PlayerRef>(null);

  const data = useMemo((): InfographicData | null => {
    if (dataProp) return dataProp;
    if (spec) return specToInfographicData(spec);
    if (clip?.remotion) return clipRemotionToInfographicData(clip.remotion);
    return null;
  }, [dataProp, spec, clip]);

  const resolved = useMemo(() => {
    if (!data) return null;
    const hint = (data.render_engine_hint || 'remotion').trim().toLowerCase();
    if (hint && hint !== 'remotion') {
      return {
        ok: false as const,
        animationType: data.animation_type,
        reason: 'unsupported_engine' as const,
        engine: data.render_engine_hint,
      };
    }
    return resolveInfographicRenderer(data);
  }, [data]);

  const infographicStart = startSeconds ?? clip?.start ?? 0;
  const durationFrames = data?.duration_frames ?? 0;

  const localFrame = useMemo(() => {
    if (!data || durationFrames <= 0) return 0;
    return remotionLocalFrame(currentTime, infographicStart, durationFrames, EDITOR_FPS);
  }, [currentTime, infographicStart, data, durationFrames]);

  useEffect(() => {
    if (previewMode) return;
    const player = playerRef.current;
    if (!player || !resolved || !('ok' in resolved) || !resolved.ok) return;
    try {
      player.pause();
      player.seekTo(localFrame);
    } catch {
      /* Player may not be ready on first paint */
    }
  }, [localFrame, resolved, durationFrames, previewMode]);

  if (!data || durationFrames <= 0) return null;

  if (!resolved || !resolved.ok) {
    const message =
      resolved && 'reason' in resolved && resolved.reason === 'unsupported_engine'
        ? `Unsupported infographic render engine: ${'engine' in resolved ? resolved.engine : ''}`
        : `Unsupported infographic animation: ${resolved?.animationType || data.animation_type || 'unknown'}`;
    return (
      <div
        className={
          previewMode
            ? 'flex h-full w-full items-center justify-center bg-black/80 px-6 text-center'
            : 'absolute inset-0 z-[4] flex items-center justify-center bg-black/50 px-6 text-center'
        }
      >
        <p className="text-sm font-semibold text-white/90">{message}</p>
      </div>
    );
  }

  const shellClass = previewMode
    ? 'relative h-full w-full overflow-hidden'
    : 'absolute inset-0 z-[4] overflow-hidden';

  return (
    <div className={shellClass} style={{ pointerEvents: previewMode ? 'auto' : 'none' }}>
      <Player
        ref={playerRef}
        component={resolved.renderer.component}
        inputProps={resolved.renderer.inputProps}
        durationInFrames={durationFrames}
        compositionWidth={width}
        compositionHeight={height}
        fps={EDITOR_FPS}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
        controls={previewMode}
        loop={previewMode}
        autoPlay={previewMode}
        clickToPlay={false}
        doubleClickToFullscreen={false}
        acknowledgeRemotionLicense
      />
    </div>
  );
}

/** @deprecated Use InfographicRenderer — kept as alias for timeline overlay call sites. */
export function InfographicRemotionOverlay(props: {
  clip: TimelineClip;
  currentTime: number;
  width?: number;
  height?: number;
}) {
  return (
    <InfographicRenderer
      clip={props.clip}
      currentTime={props.currentTime}
      width={props.width}
      height={props.height}
    />
  );
}
