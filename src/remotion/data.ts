import type { InfographicData } from './types';
import type { RemotionInfographicSpec } from '@/lib/video-editor/infographics';

/** Convert editor camelCase spec → backend-shaped InfographicData for Remotion. */
export function specToInfographicData(spec: RemotionInfographicSpec): InfographicData {
  return {
    composition_id: spec.compositionId,
    animation_type: spec.animationType,
    props: spec.props ?? {},
    duration_frames: spec.durationFrames,
    trigger: spec.trigger || 'scene_start',
    placement: spec.placement || 'full_frame',
    render_engine_hint: spec.renderEngineHint || 'remotion',
  };
}

/** Build InfographicData from a timeline clip's remotion payload. */
export function clipRemotionToInfographicData(remotion: {
  compositionId: string;
  animationType: string;
  props: Record<string, unknown>;
  durationFrames: number;
  trigger?: string;
  placement?: string;
  renderEngineHint?: string;
}): InfographicData {
  return {
    composition_id: remotion.compositionId,
    animation_type: remotion.animationType,
    props: remotion.props ?? {},
    duration_frames: remotion.durationFrames,
    trigger: remotion.trigger || 'scene_start',
    placement: remotion.placement || 'full_frame',
    render_engine_hint: remotion.renderEngineHint || 'remotion',
  };
}
