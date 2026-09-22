import type { ComponentType } from 'react';
import { DataDrivenInfographic } from './compositions/DataDrivenInfographic';
import type { InfographicData, InfographicRemotionInputProps } from './types';
import { propsHaveRenderableContent, readIconNames } from './props';
import {
  isSupportedAnimationType,
} from './animationTypes';

export type { SupportedAnimationType } from './animationTypes';
export {
  KNOWN_ANIMATION_TYPES,
  isSupportedAnimationType,
  inferAnimationTypeFromCompositionId,
  resolveAnimationType,
} from './animationTypes';

export type RemotionRendererComponent = ComponentType<InfographicRemotionInputProps>;

export type ResolvedInfographicRenderer = {
  animationType: string;
  layout: 'known' | 'generic';
  component: RemotionRendererComponent;
  /** Complete backend object passed into Remotion — do not peel fields at the Player. */
  inputProps: InfographicRemotionInputProps;
};

export type InfographicResolveResult =
  | { ok: true; renderer: ResolvedInfographicRenderer }
  | { ok: false; animationType: string; reason: 'empty_props' | 'invalid_data' };

/**
 * Resolve playback for a complete InfographicData object.
 * Always uses the single DataDrivenInfographic composition.
 * `composition_id` is ignored for component selection.
 */
export function resolveInfographicRenderer(data: InfographicData): InfographicResolveResult {
  const animationType = (data.animation_type || '').trim() || 'unknown';
  if (!data.duration_frames || data.duration_frames <= 0) {
    return { ok: false, animationType, reason: 'invalid_data' };
  }

  const known = isSupportedAnimationType(animationType);
  if (!known && !propsHaveRenderableContent(data.props ?? {})) {
    return { ok: false, animationType, reason: 'empty_props' };
  }

  const iconNames = readIconNames(data.props ?? {});
  const icon_name =
    iconNames.length === 0
      ? undefined
      : typeof data.props.icon_name === 'string' && !data.props.icon_name.includes(',')
        ? data.props.icon_name
        : iconNames.length === 1
          ? iconNames[0]
          : iconNames;

  return {
    ok: true,
    renderer: {
      animationType,
      layout: known ? 'known' : 'generic',
      component: DataDrivenInfographic,
      inputProps: icon_name != null ? { data, icon_name } : { data },
    },
  };
}
