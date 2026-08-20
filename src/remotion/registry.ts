import type { ComponentType } from 'react';
import { DataDrivenInfographic } from './compositions/DataDrivenInfographic';
import type { InfographicData, InfographicRemotionInputProps } from './types';
import { propsHaveRenderableContent } from './props';

/**
 * Known animation layouts implemented in the data-driven composition.
 * New composition_ids do NOT need entries here — only genuinely new animation behaviors do.
 */
export type SupportedAnimationType =
  | 'full_screen_title_card'
  | 'full_screen_quote_card'
  | 'full_screen_data_viz'
  | 'bullet_list_reveal';

const KNOWN_ANIMATION_TYPES: ReadonlySet<string> = new Set([
  'full_screen_title_card',
  'full_screen_quote_card',
  'full_screen_data_viz',
  'bullet_list_reveal',
]);

export function isSupportedAnimationType(type: string): type is SupportedAnimationType {
  return KNOWN_ANIMATION_TYPES.has(type.trim());
}

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

  return {
    ok: true,
    renderer: {
      animationType,
      layout: known ? 'known' : 'generic',
      component: DataDrivenInfographic,
      inputProps: { data },
    },
  };
}

/**
 * Legacy helper: if animation_type is missing, infer from well-known composition_id names.
 * New/random composition_ids are NOT mapped — they require animation_type.
 */
export function inferAnimationTypeFromCompositionId(compositionId: string | undefined): string | undefined {
  const id = compositionId?.trim();
  if (!id) return undefined;
  if (id === 'TitleCard' || id.startsWith('TitleCard_')) return 'full_screen_title_card';
  if (id === 'QuoteCard' || id.startsWith('QuoteCard_')) return 'full_screen_quote_card';
  if (id === 'DataVizFullScreen' || id.startsWith('DataViz')) return 'full_screen_data_viz';
  if (id === 'BulletListReveal' || id.startsWith('BulletList')) return 'bullet_list_reveal';
  return undefined;
}
