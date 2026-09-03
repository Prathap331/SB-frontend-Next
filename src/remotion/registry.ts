import type { ComponentType } from 'react';
import { DataDrivenInfographic } from './compositions/DataDrivenInfographic';
import type { InfographicData, InfographicRemotionInputProps } from './types';
import { propsHaveRenderableContent, readIconNames } from './props';

/**
 * Known animation layouts implemented in the data-driven composition.
 * New composition_ids do NOT need entries here — only genuinely new animation behaviors do.
 */
export type SupportedAnimationType =
  | 'full_screen_title_card'
  | 'full_screen_quote_card'
  | 'full_screen_data_viz'
  | 'bullet_list_reveal'
  | 'icon_sequence'
  | 'icon_pop_in'
  | 'stat_counter_overlay'
  | 'lower_third'
  | 'kinetic_caption'
  | 'callout_textbox'
  | 'callout'
  | 'logo_watermark'
  | 'emoji_reaction'
  | 'arrow_highlight'
  | 'badge_sticker'
  | 'full_screen_broll'
  | 'full_screen_transition_fx'
  | 'full_screen_color_wash'
  | 'full_screen_document_highlight'
  | 'pip_video_frame'
  | 'split_screen_divider'
  | 'multi_panel_grid'
  | 'avatar_overlay'
  | 'mascot_animation'
  | 'parallax_accent'
  | 'shake_impact_flash'
  | 'speed_ramp_indicator'
  | 'fade_in'
  | 'slide_in_left'
  | 'slide_in_right'
  | 'slide_up'
  | 'slide_down'
  | 'zoom_in'
  | 'bounce'
  | 'pop'
  | 'typewriter'
  | 'wipe'
  | 'overlay_text';

const KNOWN_ANIMATION_TYPES: ReadonlySet<string> = new Set([
  'full_screen_title_card',
  'full_screen_quote_card',
  'full_screen_data_viz',
  'bullet_list_reveal',
  'icon_sequence',
  'icon_pop_in',
  'stat_counter_overlay',
  'lower_third',
  'kinetic_caption',
  'callout_textbox',
  'callout',
  'logo_watermark',
  'emoji_reaction',
  'arrow_highlight',
  'badge_sticker',
  'full_screen_broll',
  'full_screen_transition_fx',
  'full_screen_color_wash',
  'full_screen_document_highlight',
  'pip_video_frame',
  'split_screen_divider',
  'multi_panel_grid',
  'avatar_overlay',
  'avatar_overlay_placeholder',
  'mascot_animation',
  'mascot_animation_placeholder',
  'parallax_accent',
  'shake_impact_flash',
  'speed_ramp_indicator',
  'ken_burns',
  'ken_burns_pan_zoom',
  'fade_in',
  'slide_in_left',
  'slide_in_right',
  'slide_up',
  'slide_down',
  'zoom_in',
  'bounce',
  'pop',
  'typewriter',
  'wipe',
  'overlay_text',
]);

export function isSupportedAnimationType(type: string): type is SupportedAnimationType {
  return KNOWN_ANIMATION_TYPES.has(type.trim().toLowerCase());
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
  if (id === 'IconSequence' || id.startsWith('IconSequence')) return 'icon_sequence';
  if (id === 'IconPopIn' || id.startsWith('IconPopIn')) return 'icon_pop_in';
  if (id === 'StatCounterOverlay' || id.startsWith('StatCounter')) return 'stat_counter_overlay';
  if (id === 'LowerThird' || id.startsWith('LowerThird')) return 'lower_third';
  if (id === 'KineticCaption') return 'kinetic_caption';
  if (id === 'CalloutTextbox') return 'callout_textbox';
  if (id === 'LogoWatermark') return 'logo_watermark';
  if (id === 'EmojiReaction') return 'emoji_reaction';
  if (id === 'ArrowHighlight') return 'arrow_highlight';
  if (id === 'BadgeSticker') return 'badge_sticker';
  if (id === 'FullScreenBroll') return 'full_screen_broll';
  if (id === 'FullScreenTransitionFx') return 'full_screen_transition_fx';
  if (id === 'FullScreenColorWash') return 'full_screen_color_wash';
  if (id === 'FullScreenDocumentHighlight') return 'full_screen_document_highlight';
  if (id === 'PipVideoFrame') return 'pip_video_frame';
  if (id === 'SplitScreenDivider') return 'split_screen_divider';
  if (id === 'MultiPanelGrid') return 'multi_panel_grid';
  if (id === 'AvatarOverlayPlaceholder' || id === 'AvatarOverlay') return 'avatar_overlay';
  if (id === 'MascotAnimationPlaceholder' || id === 'MascotAnimation') return 'mascot_animation';
  if (id === 'KenBurnsNoOp' || id === 'KenBurns') return 'ken_burns_pan_zoom';
  if (id === 'ParallaxAccent') return 'parallax_accent';
  if (id === 'ShakeImpactFlash') return 'shake_impact_flash';
  if (id === 'SpeedRampIndicator') return 'speed_ramp_indicator';
  return undefined;
}
