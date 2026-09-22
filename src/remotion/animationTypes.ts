/**
 * Canonical animation_type values for the data-driven Remotion composition.
 * `composition_id` is identity only — animation_type is the source of truth.
 */

export const NEW_TEMPLATE_ANIMATION_TYPES = [
  'bar_chart',
  'line_chart',
  'pie_chart',
  'donut_chart',
  'area_chart',
  'progress_bars',
  'stat_counter',
  'comparison_chart',
  'circular_progress',
  'animated_text',
  'bounce_text',
  'bubble_pop_text',
  'floating_text_chip',
  'glitch_text',
  'popping_scale_text',
  'pulsing_text',
  'slide_text',
  'typewriter_subtitle',
  'animated_list',
  'card_flip',
  'countdown_timer',
  'notification_pop',
  'particle_explosion',
  'progress_steps',
  'rotating_carousel',
  'sound_wave',
  'text_highlight',
  'bokeh_circles',
  'geometric_patterns',
  'gradient_shift',
  'grid_pulse',
  'liquid_wave',
  'matrix_rain',
  'noise_grain',
  'pixel_transition',
  'starfield',
  'camera_shake',
  'film_burn',
  'ken_burns',
  'letterbox_reveal',
  'parallax_pan',
  'spotlight_reveal',
  'vignette_pulse',
  'whip_pan',
  'zoom_pulse',
  'blinds_transition',
  'clock_wipe',
  'cross_dissolve',
  'fade_through_black',
  'iris_transition',
  'morph_transition',
  'push_transition',
  'slide_wipe',
  'zoom_through',
  'logo_blur_reveal',
  'logo_bounce_drop',
  'logo_fade_reveal',
  'logo_glitch_reveal',
  'logo_scale_rotate',
  'logo_spin_reveal',
  'logo_split_reveal',
  'logo_stroke_draw',
  'logo_typewriter',
  'chapter_title',
  'cinematic_title_intro',
  'countdown_intro',
  'credits_roll',
  'end_card',
  'quote_card',
  'subscribe_reminder',
  'title_split',
  'gallery_grid',
  'image_carousel',
  'image_comparison_slider',
  'image_zoom_reveal',
  'masonry_gallery',
  'photo_stack',
  'picture_in_picture',
  'polaroid_frame',
  'split_screen',
] as const;

export type NewTemplateAnimationType = (typeof NEW_TEMPLATE_ANIMATION_TYPES)[number];

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
  | 'overlay_text'
  | NewTemplateAnimationType;

export const KNOWN_ANIMATION_TYPES: ReadonlySet<string> = new Set([
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
  ...NEW_TEMPLATE_ANIMATION_TYPES,
]);

export function isSupportedAnimationType(type: string): type is SupportedAnimationType {
  return KNOWN_ANIMATION_TYPES.has(type.trim().toLowerCase());
}

export function toPascalCase(snake: string): string {
  return snake
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
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

  for (const type of KNOWN_ANIMATION_TYPES) {
    if (toPascalCase(type) === id) return type;
  }
  return undefined;
}
