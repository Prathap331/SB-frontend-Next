import { EDITOR_FPS, framesToSeconds, secondsToFrame } from './fps';
import { frameWindowSeconds, toSceneLocalSeconds } from './timings';

/** Backend `infographics` / Remotion payload (read-only shape from /edit-video). */
export type BackendInfographicPayload = {
  composition_id?: string;
  animation_type?: string;
  props?: Record<string, unknown>;
  duration_frames?: number;
  trigger?: string;
  placement?: string;
  render_engine_hint?: string;
};

/** Normalized Remotion infographic attached to a timeline clip / scene. */
export type RemotionInfographicSpec = {
  compositionId: string;
  animationType: string;
  props: Record<string, unknown>;
  durationFrames: number;
  trigger: string;
  placement: string;
  renderEngineHint?: string;
  /** Backend overlay id from infographics_list / text_list — used when deleting. */
  overlayId?: string;
  /** Scene-local start time when the list item includes `start` / `start_sec`. */
  startSeconds?: number;
  colorHint?: string;
  beatId?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asPositiveInt(value: unknown): number | null {
  const n = asFiniteNumber(value);
  if (n == null || n <= 0) return null;
  return Math.round(n);
}

/**
 * Scene-local window for an overlay list item / animation track.
 * B-roll/animation: `startFrame`/`endFrame` at 30fps.
 * Otherwise `start`/`end` (or `start_sec`/`end_sec`); then duration_frames from 0.
 */
export function overlayWindowSeconds(
  raw: {
    start?: unknown;
    end?: unknown;
    start_sec?: unknown;
    end_sec?: unknown;
    startFrame?: unknown;
    endFrame?: unknown;
    start_frame?: unknown;
    end_frame?: unknown;
    duration_frames?: unknown;
  },
  fps: number = EDITOR_FPS,
): { start: number; duration: number } | null {
  const frameWin = frameWindowSeconds(raw, fps);
  if (frameWin) return { start: frameWin.start, duration: frameWin.duration };
  const start = asFiniteNumber(raw.start) ?? asFiniteNumber(raw.start_sec);
  const end = asFiniteNumber(raw.end) ?? asFiniteNumber(raw.end_sec);
  if (start != null && end != null && end > start) {
    return { start: Math.max(0, start), duration: Math.max(0.1, end - start) };
  }
  const frames = asPositiveInt(raw.duration_frames);
  if (frames) {
    return { start: Math.max(0, start ?? 0), duration: framesToSeconds(frames, fps) };
  }
  return null;
}

/** Maps backend placement strings onto the preview's left/bottom percentages. */
export function placementToPreviewOffsets(placement?: string | null): { offsetX: number; offsetY: number } {
  const p = (placement || '').trim().toLowerCase();
  switch (p) {
    case 'top_left':
      return { offsetX: 16, offsetY: 82 };
    case 'top':
      return { offsetX: 50, offsetY: 82 };
    case 'top_right':
      return { offsetX: 84, offsetY: 82 };
    case 'center_left':
    case 'left':
      return { offsetX: 16, offsetY: 50 };
    case 'center':
      return { offsetX: 50, offsetY: 50 };
    case 'center_right':
    case 'right':
      return { offsetX: 84, offsetY: 50 };
    case 'bottom_left':
      return { offsetX: 16, offsetY: 12 };
    case 'bottom':
    case 'overlay':
      return { offsetX: 50, offsetY: 12 };
    case 'bottom_right':
      return { offsetX: 84, offsetY: 12 };
    case 'full_frame':
    case 'fullscreen':
    case 'full_screen':
      return { offsetX: 50, offsetY: 50 };
    default:
      return { offsetX: 50, offsetY: 14 };
  }
}

export type OverlayMotionSpec = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  style?: string;
};

export type SeededTextOverlay = {
  overlayId?: string;
  beatId?: string;
  text: string;
  start: number;
  duration: number;
  placement?: string;
  textColor?: string;
  offsetX: number;
  offsetY: number;
  animationStyle?: string;
  remotion?: RemotionInfographicSpec;
};

export function seededTextFromOverlayItem(raw: unknown): SeededTextOverlay | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  if (isOverlayGraphicTrack(obj)) return null;
  const window = overlayWindowSeconds(obj);
  if (!window) return null;
  const text = displayTextPlain(obj.display_text) || displayTextPlain(obj.text);
  if (!text) return null;
  const remotion = parseRemotionInfographic(obj);
  const placement = asString(obj.placement);
  const offsets = placementToPreviewOffsets(placement);
  const color = asString(obj.color_hint)?.trim();
  const overlayId =
    asOverlayId(obj.id) ?? asOverlayId(obj.overlay_id) ?? asOverlayId(obj.text_id) ?? asOverlayId(obj.track_id);
  return {
    ...(overlayId ? { overlayId } : {}),
    beatId: asString(obj.beat_id),
    text,
    start: window.start,
    duration: window.duration,
    placement,
    textColor: color || undefined,
    offsetX: offsets.offsetX,
    offsetY: offsets.offsetY,
    animationStyle: asString(obj.text_animation_style) ?? asString(obj.animation_type),
    ...(remotion ? { remotion } : {}),
  };
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value;
}

/** `display_text` / `icon_name` is a string or a list of strings. */
export function parseNameList(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (typeof value === 'number' && Number.isFinite(value)) return [String(value)];
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === 'string' && entry.trim()) return [entry.trim()];
    if (typeof entry === 'number' && Number.isFinite(entry)) return [String(entry)];
    return [];
  });
}

/** Icons may arrive as a string, JSON array, comma list, or `{name|icon}` objects. */
export function parseIconList(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return [];
    if (t.startsWith('[')) {
      try {
        return parseIconList(JSON.parse(t));
      } catch {
        /* use as a single name */
      }
    }
    if (t.includes(',')) return t.split(',').map((part) => part.trim()).filter(Boolean);
    return [t];
  }
  if (typeof value === 'number' && Number.isFinite(value)) return [String(value)];
  if (!Array.isArray(value)) {
    const rec = asRecord(value);
    if (!rec) return [];
    return parseIconList(rec.name ?? rec.icon ?? rec.icon_name ?? rec.value);
  }
  return value.flatMap((entry) => parseIconList(entry));
}

function collectIcons(obj: Record<string, unknown>, props: Record<string, unknown>): string[] {
  for (const src of [
    obj.icon_name,
    obj.iconName,
    obj.icons,
    obj.icon,
    obj.icon_names,
    props.icon_name,
    props.iconName,
    props.icons,
    props.icon,
    props.icon_names,
  ]) {
    const list = parseIconList(src);
    if (list.length) return list;
  }
  return [];
}

/** `display_text` is a string or a list of strings. */
function parseDisplayText(value: unknown): { title?: string; items?: string[] } {
  const items = parseNameList(value);
  if (items.length === 1) return { title: items[0] };
  if (items.length > 1) return { items };
  return {};
}

function xyPair(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = asFiniteNumber(value[0]);
  const y = asFiniteNumber(value[1]);
  if (x == null || y == null) return null;
  return [x, y];
}

export function parseOverlayMotion(raw: unknown): OverlayMotionSpec | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const start = xyPair(obj.start_xy_px);
  const end = xyPair(obj.end_xy_px);
  const style = asString(obj.motion_style)?.trim();
  if (!start && !end && !style) return null;
  return {
    startX: start?.[0] ?? end?.[0] ?? 0,
    startY: start?.[1] ?? end?.[1] ?? 0,
    endX: end?.[0] ?? start?.[0] ?? 0,
    endY: end?.[1] ?? start?.[1] ?? 0,
    ...(style ? { style } : {}),
  };
}

/**
 * Rebase overlay start times that arrived in project-absolute seconds onto a
 * 0-based per-scene timeline (same rule as beat start/end).
 */
export function sceneLocalOverlayStart(
  start: number,
  sceneStart: number,
  sceneDuration: number,
): number {
  if (!Number.isFinite(start)) return 0;
  const shifted = toSceneLocalSeconds(start, sceneStart);
  if (sceneStart <= 0.05 && Number.isFinite(sceneDuration) && start > sceneDuration + 0.5) {
    return Math.max(0, start);
  }
  return shifted;
}

export function rebaseOverlaySpec(
  spec: RemotionInfographicSpec,
  sceneStart: number,
  sceneDuration: number,
): RemotionInfographicSpec {
  if (spec.startSeconds == null) return spec;
  return {
    ...spec,
    startSeconds: sceneLocalOverlayStart(spec.startSeconds, sceneStart, sceneDuration),
  };
}

export function rebaseSeededText(
  seeded: SeededTextOverlay,
  sceneStart: number,
  sceneDuration: number,
): SeededTextOverlay {
  const start = sceneLocalOverlayStart(seeded.start, sceneStart, sceneDuration);
  return {
    ...seeded,
    start,
    remotion: seeded.remotion ? { ...seeded.remotion, startSeconds: start } : seeded.remotion,
  };
}

/** Copy missing icon / motion / timing fields from the matching timeline track. */
export function mergeOverlayTrackOntoItem(
  item: unknown,
  tracks: unknown[],
  sceneId?: string,
): Record<string, unknown> {
  const itemRec = asRecord(item) ?? {};
  const beatId = asString(itemRec.beat_id);
  const sid = sceneId ?? asString(itemRec.scene_id);
  if (!beatId) return itemRec;
  const track = tracks
    .map((t) => asRecord(t))
    .find(
      (t) =>
        t &&
        asString(t.beat_id) === beatId &&
        (!sid || !asString(t.scene_id) || asString(t.scene_id) === sid),
    );
  if (!track) return itemRec;
  return {
    ...track,
    ...itemRec,
    icon_name: parseIconList(itemRec.icon_name).length ? itemRec.icon_name : (track.icon_name ?? itemRec.icon_name),
    icon_layout: itemRec.icon_layout ?? track.icon_layout,
    motion: itemRec.motion ?? track.motion,
    display_text: itemRec.display_text ?? track.display_text,
    color_hint: itemRec.color_hint ?? track.color_hint,
    animation_type: itemRec.animation_type ?? track.animation_type,
    placement: itemRec.placement ?? track.placement,
    start: itemRec.start ?? itemRec.start_sec ?? track.start ?? track.start_sec,
    end: itemRec.end ?? itemRec.end_sec ?? track.end ?? track.end_sec,
    startFrame: itemRec.startFrame ?? itemRec.start_frame ?? track.startFrame ?? track.start_frame,
    endFrame: itemRec.endFrame ?? itemRec.end_frame ?? track.endFrame ?? track.end_frame,
    duration_frames: itemRec.duration_frames ?? track.duration_frames,
  };
}

export function remotionPayloadFromSpec(spec: RemotionInfographicSpec): {
  compositionId: string;
  animationType: string;
  props: Record<string, unknown>;
  durationFrames: number;
  trigger?: string;
  placement?: string;
  renderEngineHint?: string;
} {
  return {
    compositionId: spec.compositionId,
    animationType: spec.animationType,
    props: spec.props,
    durationFrames: spec.durationFrames,
    trigger: spec.trigger,
    placement: spec.placement,
    renderEngineHint: spec.renderEngineHint,
  };
}

function displayTextPlain(value: unknown): string {
  const parsed = parseDisplayText(value);
  if (parsed.title) return parsed.title;
  if (parsed.items?.length) return parsed.items.join(' · ');
  return '';
}

function parseGeometryPx(raw: unknown): {
  x: number;
  y: number;
  width: number;
  height: number;
  scale?: number;
} | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const x = asFiniteNumber(obj.x);
  const y = asFiniteNumber(obj.y);
  const width = asFiniteNumber(obj.width);
  const height = asFiniteNumber(obj.height);
  const scale = asFiniteNumber(obj.scale);
  if (x == null && y == null && width == null && height == null) return null;
  return {
    x: x ?? 64,
    y: y ?? 854,
    width: Math.max(1, width ?? 520),
    height: Math.max(1, height ?? 160),
    ...(scale != null ? { scale } : {}),
  };
}

const VISUAL_ONLY_ANIMATION_TYPES = new Set([
  'full_screen_broll',
  'full_screen_transition_fx',
  'full_screen_color_wash',
  'ken_burns',
  'ken_burns_pan_zoom',
  'shake_impact_flash',
  'parallax_accent',
  'split_screen_divider',
  'multi_panel_grid',
  'pip_video_frame',
  'speed_ramp_indicator',
  'arrow_highlight',
  'emoji_reaction',
  'badge_sticker',
  'logo_watermark',
  'avatar_overlay',
  'avatar_overlay_placeholder',
  'mascot_animation',
  'mascot_animation_placeholder',
]);

function asOverlayId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

/**
 * Parse backend infographics payload into a safe spec.
 * `animation_type` is required for rendering; `composition_id` is identity metadata only.
 * Returns null when data is missing or unusable (never throws).
 */
export function parseRemotionInfographic(raw: unknown): RemotionInfographicSpec | null {
  const obj = asRecord(raw);
  if (!obj) return null;

  const window = overlayWindowSeconds(obj);
  const durationFrames = window
    ? Math.max(1, Math.round(window.duration * EDITOR_FPS))
    : asPositiveInt(obj.duration_frames);
  if (durationFrames == null) return null;

  const compositionIdRaw = asString(obj.composition_id)?.trim() ?? '';
  let animationType = asString(obj.animation_type)?.trim() ?? '';

  // Legacy payloads may omit animation_type but send a well-known composition_id.
  if (!animationType) {
    animationType = inferAnimationTypeFromCompositionId(compositionIdRaw) ?? '';
  }

  // Need a resolvable animation type (or at least store the payload for fallback UI).
  // Spec is kept even for unknown animation types so the UI can show the unsupported message.
  if (!animationType && !compositionIdRaw) return null;
  if (!animationType) {
    // No animation_type and unknown composition_id — cannot render, skip library card.
    return null;
  }

  const props = asRecord(obj.props) ?? {};
  const fromDisplay = parseDisplayText(obj.display_text ?? obj.text ?? props.displayText ?? props.display_text);
  if (fromDisplay.title && !asString(props.title) && !asString(props.label) && !asString(props.quote)) {
    props.title = fromDisplay.title;
  }
  if (fromDisplay.items?.length && !Array.isArray(props.items)) {
    props.items = fromDisplay.items;
  }
  const icons = collectIcons(obj, props);
  if (icons.length) {
    props.icons = icons;
    // Hand the backend's own key through untouched (single name stays a string, a list
    // stays a list) so the Remotion component receives `icon_name` exactly as sent.
    props.icon_name = icons.length === 1 ? icons[0] : icons;
  }
  const iconLayout = asString(obj.icon_layout) ?? asString(props.icon_layout) ?? asString(props.iconLayout);
  if (iconLayout) props.iconLayout = iconLayout;
  // The entrance style the backend picked for on-screen text. Without this the Remotion
  // composition fell back to its own generic fade, so the library preview and the
  // timeline's CSS text overlay animated differently for the same overlay.
  const textAnimationStyle =
    asString(obj.text_animation_style) ??
    asString(props.textAnimationStyle) ??
    asString(props.text_animation_style);
  if (textAnimationStyle?.trim()) props.textAnimationStyle = textAnimationStyle.trim();
  const motion = parseOverlayMotion(obj.motion) ?? parseOverlayMotion(props.motion);
  if (motion) props.motion = motion;
  const colorHint = asString(obj.color_hint)?.trim();
  if (colorHint && !asString(props.color) && !asString(props.accent)) {
    props.color = colorHint;
  }
  if (colorHint) props.colorHint = colorHint;
  const geometry = parseGeometryPx(obj.geometry_px ?? obj.geometryPx ?? props.geometryPx);
  if (geometry) props.geometryPx = geometry;
  const highlight =
    asString(obj.highlight_target_text) ?? asString(props.highlightTargetText) ?? asString(props.highlight_target_text);
  if (highlight) props.highlightTargetText = highlight;
  if (obj.display_text != null && props.displayText == null) props.displayText = obj.display_text;
  if (icons.length && props.iconName == null) props.iconName = icons.length === 1 ? icons[0] : icons;
  const hasCopy =
    Boolean(asString(props.title) || asString(props.label) || asString(props.quote)) ||
    (Array.isArray(props.items) && props.items.length > 0) ||
    icons.length > 0;
  const typeKey = animationType.toLowerCase();
  const isIconAnim = typeKey.startsWith('icon_');
  const visualOnly = VISUAL_ONLY_ANIMATION_TYPES.has(typeKey);
  if (!hasCopy && !isIconAnim && !visualOnly) {
    const fallbackLabel = asString(obj.animation_type)?.replace(/_/g, ' ').trim();
    if (fallbackLabel) props.title = fallbackLabel;
  }
  const trigger = asString(obj.trigger) ?? 'scene_start';
  const category = (asString(obj.category) ?? '').toLowerCase();
  let placement = asString(obj.placement) ?? 'full_frame';
  if (category === 'full_frame' || category === 'fullscreen' || category === 'full_screen') {
    placement = 'full_frame';
  } else if (placement === 'fullscreen' || placement === 'full_screen') {
    placement = 'full_frame';
  }

  const overlayId =
    asOverlayId(obj.id) ??
    asOverlayId(obj.overlay_id) ??
    asOverlayId(obj.text_id) ??
    asOverlayId(obj.track_id);

  return {
    compositionId: compositionIdRaw || animationType,
    animationType,
    props,
    durationFrames,
    trigger,
    placement,
    renderEngineHint: asString(obj.render_engine_hint),
    ...(overlayId ? { overlayId } : {}),
    ...(window ? { startSeconds: window.start } : {}),
    ...(colorHint ? { colorHint } : {}),
    ...(asString(obj.beat_id) ? { beatId: asString(obj.beat_id) } : {}),
  };
}

/**
 * Read Remotion `infographics` from a raw /edit-video scene.
 * If the backend sets `infographics: null`, returns null (section should be hidden).
 * Does not invent cards from legacy `animation` when `infographics` is explicitly null.
 */
export function readInfographicFromEditScene(scene: unknown): RemotionInfographicSpec | null {
  const s = asRecord(scene);
  if (!s) return null;

  // Explicit null / missing usable payload → no Remotion infographic for this scene
  if ('infographics' in s) {
    if (s.infographics == null) return null;
    return parseRemotionInfographic(s.infographics);
  }

  // Legacy responses without an `infographics` key: try animation + on_screen_text
  const anim = asRecord(s.animation);
  if (!anim) return null;

  const onScreen = asString(s.on_screen_text);
  const titleFromText = onScreen?.split('|')[0]?.trim() || '';
  const merged: BackendInfographicPayload = {
    composition_id: asString(anim.composition_id),
    animation_type: asString(anim.animation_type),
    duration_frames: asPositiveInt(anim.duration_frames) ?? undefined,
    trigger: asString(anim.trigger),
    placement: asString(anim.placement),
    render_engine_hint: asString(anim.render_engine_hint),
    props: asRecord(anim.props) ?? (titleFromText ? { title: titleFromText, subtitle: '' } : undefined),
  };

  if (merged.placement === 'fullscreen' || merged.placement === 'full_screen') {
    merged.placement = 'full_frame';
  }

  return parseRemotionInfographic(merged);
}

/**
 * Legacy helper: if animation_type is missing, infer from well-known composition_id names.
 * New/random composition_ids are NOT mapped — they require animation_type.
 */
function inferAnimationTypeFromCompositionId(compositionId: string): string | undefined {
  if (compositionId === 'TitleCard' || compositionId.startsWith('TitleCard_')) {
    return 'full_screen_title_card';
  }
  if (compositionId === 'QuoteCard' || compositionId.startsWith('QuoteCard_')) {
    return 'full_screen_quote_card';
  }
  if (compositionId === 'DataVizFullScreen' || compositionId.startsWith('DataViz')) {
    return 'full_screen_data_viz';
  }
  if (compositionId === 'BulletListReveal' || compositionId.startsWith('BulletList')) {
    return 'bullet_list_reveal';
  }
  return undefined;
}

/** Human-readable label for library cards and timeline clips. */
export function remotionInfographicLabel(spec: RemotionInfographicSpec): string {
  const fromDisplay = parseDisplayText(spec.props.displayText ?? spec.props.display_text);
  const title =
    (typeof spec.props.title === 'string' && spec.props.title.trim()) || fromDisplay.title || '';
  if (title) return title;
  const quote = spec.props.quote;
  if (typeof quote === 'string' && quote.trim()) {
    return quote.trim().length > 48 ? `${quote.trim().slice(0, 48)}…` : quote.trim();
  }
  const label = spec.props.label;
  if (typeof label === 'string' && label.trim()) return label.trim();
  const items = [
    ...(Array.isArray(spec.props.items) ? spec.props.items : []),
    ...(fromDisplay.items ?? []),
  ];
  if (items.length > 0) {
    const first = items.find((v): v is string => typeof v === 'string' && v.trim().length > 0);
    if (first) {
      const more = items.length > 1 ? ` (+${items.length - 1})` : '';
      return first.length > 40 ? `${first.slice(0, 40)}…${more}` : `${first}${more}`;
    }
  }
  const icons = parseIconList(spec.props.icons ?? spec.props.iconName ?? spec.props.icon_name);
  if (icons.length) {
    const more = icons.length > 1 ? ` (+${icons.length - 1})` : '';
    return `${icons[0]}${more}`;
  }
  return spec.compositionId || spec.animationType;
}

export type KenBurnsMotion = {
  beatId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  colorHint?: string;
};

/** Camera pan/zoom from a timeline `type: animation` Ken Burns / background track. */
export function kenBurnsFromTrack(raw: unknown): KenBurnsMotion | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const animationType = (asString(obj.animation_type) ?? '').toLowerCase();
  const category = (asString(obj.category) ?? '').toLowerCase();
  const layer = (asString(obj.layer) ?? '').toLowerCase();
  const isKen =
    animationType.includes('ken_burns') || category === 'transition' || layer === 'background';
  if (!isKen) return null;
  const beatId = asString(obj.beat_id);
  if (!beatId) return null;
  const motion = asRecord(obj.motion);
  const start = Array.isArray(motion?.start_xy_px) ? motion.start_xy_px : [0, 0];
  const end = Array.isArray(motion?.end_xy_px) ? motion.end_xy_px : [0, 0];
  const sx = typeof start[0] === 'number' ? start[0] : Number(start[0]) || 0;
  const sy = typeof start[1] === 'number' ? start[1] : Number(start[1]) || 0;
  const ex = typeof end[0] === 'number' ? end[0] : Number(end[0]) || 0;
  const ey = typeof end[1] === 'number' ? end[1] : Number(end[1]) || 0;
  const colorHint = asString(obj.color_hint)?.trim();
  return {
    beatId,
    startX: sx,
    startY: sy,
    endX: ex,
    endY: ey,
    ...(colorHint ? { colorHint } : {}),
  };
}

/** Foreground icon / graphic animation — not Ken Burns, not on-screen text. */
export function isOverlayGraphicTrack(raw: unknown): boolean {
  const obj = asRecord(raw);
  if (!obj) return false;
  if (kenBurnsFromTrack(obj)) return false;
  const category = (asString(obj.category) ?? '').toLowerCase();
  const animationType = (asString(obj.animation_type) ?? '').toLowerCase();
  const layer = (asString(obj.layer) ?? '').toLowerCase();
  const hasIcons = parseIconList(obj.icon_name ?? obj.icons ?? obj.icon).length > 0;
  if (category === 'overlay_graphic') return true;
  if (hasIcons && (animationType.startsWith('icon_') || layer === 'foreground')) return true;
  return false;
}

/**
 * Timeline start (seconds) for an infographic.
 *
 * `trigger: "scene_start"` → starts at the scene's start on the active timeline.
 * Per-scene timelines are 0-based (scene start == 0). Full-project timelines
 * pass the scene's absolute start via `sceneStartSeconds`.
 */
export function resolveInfographicStartSeconds(
  trigger: string,
  sceneStartSeconds: number,
  explicitStart?: number | null,
): number {
  if (explicitStart != null && Number.isFinite(explicitStart)) {
    return Math.max(0, explicitStart);
  }
  if (trigger === 'scene_start') {
    return Number.isFinite(sceneStartSeconds) ? Math.max(0, sceneStartSeconds) : 0;
  }
  return Number.isFinite(sceneStartSeconds) ? Math.max(0, sceneStartSeconds) : 0;
}

export function remotionDurationSeconds(
  durationFrames: number,
  fps: number = EDITOR_FPS,
): number {
  return framesToSeconds(durationFrames, fps);
}

/**
 * Local Remotion frame from editor currentTime (seconds).
 * MUST use infographic-local time, never globalTime * fps alone.
 */
export function remotionLocalFrame(
  currentTime: number,
  infographicStart: number,
  durationFrames: number,
  fps: number = EDITOR_FPS,
): number {
  const localSeconds = currentTime - infographicStart;
  const raw = Math.floor(localSeconds * fps);
  const max = Math.max(0, durationFrames - 1);
  if (!Number.isFinite(raw)) return 0;
  return Math.min(max, Math.max(0, raw));
}

export function isInfographicActiveAtTime(
  currentTime: number,
  start: number,
  durationSeconds: number,
): boolean {
  return currentTime >= start && currentTime < start + durationSeconds;
}

export { EDITOR_FPS, framesToSeconds, secondsToFrame };
