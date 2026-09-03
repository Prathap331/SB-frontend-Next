'use client';

import type { TimelineClip } from '@/lib/video-editor/types';
import { EDITOR_FPS } from '@/lib/video-editor/fps';
import { clipRemotionToInfographicData } from '@/remotion/data';
import { InfographicVisual } from '@/remotion/compositions/DataDrivenInfographic';

const DESIGN_W = 1920;
const DESIGN_H = 1080;

type Props = {
  clip: TimelineClip;
  currentTime: number;
  width: number;
  height: number;
};

/**
 * Timeline overlay preview: same InfographicVisual as the library Remotion
 * Player (layout + text_animation_style + icon_name), CSS-scaled to the frame.
 */
export function TimelineOverlayPreview({ clip, currentTime, width, height }: Props) {
  const remotion = clip.remotion;
  if (!remotion || width <= 0 || height <= 0) return null;
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

  return (
    <div className="pointer-events-none absolute inset-0 z-[4] overflow-hidden">
      <div
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
          icon_name={
            (data.props.icon_name as string | string[] | undefined) ??
            (data.props.iconName as string | string[] | undefined)
          }
          clock={{ frame, fps: EDITOR_FPS, durationInFrames }}
        />
      </div>
    </div>
  );
}
