/**
 * Canonical animation_type values for the data-driven Remotion composition.
 * `composition_id` is identity only — animation_type is the source of truth.
 */

/** Storybit library ids from each template SPEC. Not aliases of overlay taxonomy names. */
export const STORYBIT_ANIMATION_TYPES = [
  'fs_title_card',
  'fs_title_metadata',
  'fs_big_number',
  'fs_number_comparison',
  'fs_quote_card',
  'fs_key_statement',
  'fs_structured_list',
  'fs_comparison_columns',
  'dv_bar_chart',
  'dv_line_chart',
  'dv_pie_donut',
  'dv_gauge',
  'dv_leaderboard',
  'dv_icon_array',
  'tl_timeline',
  'tl_roadmap',
  'dg_linear_process',
  'dg_relationship',
  'dg_decision_tree',
  'dg_funnel',
  'dg_hierarchy',
  'dg_architecture',
  'dg_pros_cons',
  'dg_vs_faceoff',
  'dg_myth_fact',
  'pe_person_intro',
  'pe_profile_card',
  'vo_image_caption',
  'vo_image_grid',
  'vo_image_montage',
  'vo_before_after',
  'vo_location_tag',
  'vo_lower_third',
  'vo_stat_overlay',
  'vo_callout',
  'vo_source_citation',
  'kt_punch_word',
  'kt_stacked_text',
  'kt_question_hook',
  'kt_captions',
  'nv_chapter_card',
  'nv_progress_tracker',
  'nv_rank_reveal',
  'nv_subscribe',
  'nv_end_screen',
  'ui_social_post',
  'ui_chat',
  'ui_news_headline',
  'ui_newspaper_clipping',
  'ui_search_bar',
  'ui_notification',
  'dc_document_highlight',
  'dc_investigation_board',
  'dc_case_file',
  'dc_archive_photo',
  'dc_sticky_notes',
  'mp_globe_zoom',
  'mp_radius_range',
  'mp_travel_route',
  'em_scribble',
  'hc_floating_card',
] as const;

export type StorybitAnimationType = (typeof STORYBIT_ANIMATION_TYPES)[number];

const STORYBIT_ANIMATION_TYPE_SET: ReadonlySet<string> = new Set(STORYBIT_ANIMATION_TYPES);

export type SupportedAnimationType =
  | StorybitAnimationType
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
  | 'full_screen_transition'
  | 'full_screen_transition_fx'
  | 'full_screen_color_wash'
  | 'full_screen_document_highlight'
  | 'pip_video'
  | 'pip_video_frame'
  | 'split_screen'
  | 'split_screen_divider'
  | 'multi_panel_grid'
  | 'avatar_overlay'
  | 'mascot_animation'
  | 'parallax_accent'
  | 'parallax_layering'
  | 'shake_impact'
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
  'full_screen_transition',
  'full_screen_transition_fx',
  'full_screen_color_wash',
  'full_screen_document_highlight',
  'pip_video',
  'pip_video_frame',
  'split_screen',
  'split_screen_divider',
  'multi_panel_grid',
  'avatar_overlay',
  'avatar_overlay_placeholder',
  'mascot_animation',
  'mascot_animation_placeholder',
  'parallax_accent',
  'parallax_layering',
  'shake_impact',
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
  ...STORYBIT_ANIMATION_TYPES,
]);

export function isSupportedAnimationType(type: string): type is SupportedAnimationType {
  return KNOWN_ANIMATION_TYPES.has(resolveAnimationType(type));
}

/**
 * Only true synonyms (legacy placeholder ids). Similar names are NOT treated as the same animation.
 * Hyphen vs underscore of the same token is a format difference, not a different animation.
 */
const ANIMATION_TYPE_ALIASES: Record<string, string> = {
  avatar_overlay_placeholder: 'avatar_overlay',
  mascot_animation_placeholder: 'mascot_animation',
};

export function resolveAnimationType(type: string | undefined | null): string {
  const t = (type || '').trim().toLowerCase().replace(/-/g, '_');
  return ANIMATION_TYPE_ALIASES[t] ?? t;
}

export function isStorybitAnimationType(type: string | undefined | null): boolean {
  return STORYBIT_ANIMATION_TYPE_SET.has(resolveAnimationType(type));
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
  if (id === 'FullScreenTransition') return 'full_screen_transition';
  if (id === 'FullScreenColorWash') return 'full_screen_color_wash';
  if (id === 'FullScreenDocumentHighlight') return 'full_screen_document_highlight';
  if (id === 'PipVideoFrame') return 'pip_video_frame';
  if (id === 'PipVideo') return 'pip_video';
  if (id === 'SplitScreenDivider') return 'split_screen_divider';
  if (id === 'SplitScreen') return 'split_screen';
  if (id === 'ParallaxAccent') return 'parallax_accent';
  if (id === 'ParallaxLayering') return 'parallax_layering';
  if (id === 'ShakeImpactFlash') return 'shake_impact_flash';
  if (id === 'ShakeImpact') return 'shake_impact';
  if (id === 'KenBurnsNoOp' || id === 'KenBurnsPanZoom') return 'ken_burns_pan_zoom';
  if (id === 'MultiPanelGrid') return 'multi_panel_grid';
  if (id === 'AvatarOverlayPlaceholder' || id === 'AvatarOverlay') return 'avatar_overlay';
  if (id === 'MascotAnimationPlaceholder' || id === 'MascotAnimation') return 'mascot_animation';
  if (id === 'SpeedRampIndicator') return 'speed_ramp_indicator';

  const snake = id.replace(/-/g, '_').toLowerCase();
  if (KNOWN_ANIMATION_TYPES.has(snake)) return snake;

  for (const type of KNOWN_ANIMATION_TYPES) {
    if (toPascalCase(type) === id) return type;
    if (type.replace(/_/g, '-') === id.toLowerCase()) return type;
  }
  return undefined;
}
