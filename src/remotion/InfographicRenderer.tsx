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
import { isFullFramePlacement } from '@/remotion/placement';
import { useEffect, useMemo, useRef } from 'react';
import { Player, type PlayerRef } from '@remotion/player';

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

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
  width = DESIGN_WIDTH,
  height = DESIGN_HEIGHT,
  previewMode = false,
}: Props) {
  const playerRef = useRef<PlayerRef>(null);
  const lastFrameRef = useRef<number | null>(null);

  const remotionSig = clip?.remotion
    ? `${clip.id}:${clip.remotion.animationType}:${clip.remotion.durationFrames}:${clip.remotion.placement}`
    : spec
      ? `${spec.overlayId ?? spec.compositionId}:${spec.animationType}:${spec.durationFrames}`
      : '';

  // Keyed on the payload objects themselves, not a field signature: `setCurrentTime`
  // shallow-copies timeline state, so clip.remotion keeps its identity across playback
  // frames (no Player churn), while an actual props edit — new text, new icon_name —
  // rebuilds here. A signature that omitted `props` left the timeline showing stale
  // content while the library preview showed the edited version.
  const data = useMemo((): InfographicData | null => {
    if (dataProp) return dataProp;
    if (spec) return specToInfographicData(spec);
    if (clip?.remotion) return clipRemotionToInfographicData(clip.remotion);
    return null;
  }, [dataProp, spec, clip?.remotion]);

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
    if (!player || !resolved || !resolved.ok) return;
    if (lastFrameRef.current === localFrame) return;
    lastFrameRef.current = localFrame;
    try {
      player.seekTo(localFrame);
    } catch {
      /* Player may not be ready on first paint */
    }
  }, [localFrame, resolved, previewMode]);

  useEffect(() => {
    lastFrameRef.current = null;
  }, [remotionSig]);

  const inputProps = useMemo(
    () => (resolved && resolved.ok ? resolved.renderer.inputProps : null),
    [resolved],
  );

  if (!data || durationFrames <= 0) return null;

  if (!resolved || !resolved.ok || !inputProps) {
    const fail = resolved && !resolved.ok ? resolved : null;
    const message =
      fail && fail.reason === 'unsupported_engine'
        ? `Unsupported infographic render engine: ${'engine' in fail ? fail.engine : ''}`
        : `Unsupported infographic animation: ${fail && 'animationType' in fail ? fail.animationType : data.animation_type || 'unknown'}`;
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

  if (!previewMode && (width <= 0 || height <= 0)) return null;

  const isFull = isFullFramePlacement(data.placement);
  const scaleX = width / DESIGN_WIDTH;
  const scaleY = height / DESIGN_HEIGHT;
  const uniform = Math.min(scaleX, scaleY);

  return (
    <div className={shellClass} style={{ pointerEvents: previewMode ? 'auto' : 'none' }}>
      {previewMode ? (
        <Player
          ref={playerRef}
          component={resolved.renderer.component}
          inputProps={inputProps}
          durationInFrames={durationFrames}
          compositionWidth={width}
          compositionHeight={height}
          fps={EDITOR_FPS}
          style={{ width: '100%', height: '100%', background: 'transparent' }}
          controls
          loop
          autoPlay
          clickToPlay={false}
          doubleClickToFullscreen={false}
          acknowledgeRemotionLicense
        />
      ) : (
        <div
          style={
            isFull
              ? {
                  position: 'absolute',
                  inset: 0,
                  width: DESIGN_WIDTH,
                  height: DESIGN_HEIGHT,
                  transform: `scale(${scaleX}, ${scaleY})`,
                  transformOrigin: 'top left',
                }
              : {
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: DESIGN_WIDTH,
                  height: DESIGN_HEIGHT,
                  marginLeft: -DESIGN_WIDTH / 2,
                  marginTop: -DESIGN_HEIGHT / 2,
                  transform: `scale(${uniform})`,
                  transformOrigin: 'center center',
                }
          }
        >
          <Player
            ref={playerRef}
            component={resolved.renderer.component}
            inputProps={inputProps}
            durationInFrames={durationFrames}
            compositionWidth={DESIGN_WIDTH}
            compositionHeight={DESIGN_HEIGHT}
            fps={EDITOR_FPS}
            style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT, background: 'transparent' }}
            controls={false}
            loop={false}
            autoPlay={false}
            clickToPlay={false}
            doubleClickToFullscreen={false}
            acknowledgeRemotionLicense
          />
        </div>
      )}
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
