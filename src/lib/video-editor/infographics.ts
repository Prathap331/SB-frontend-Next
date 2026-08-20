import { EDITOR_FPS, framesToSeconds, secondsToFrame } from './fps';

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
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asPositiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value;
}

/**
 * Parse backend infographics payload into a safe spec.
 * `animation_type` is required for rendering; `composition_id` is identity metadata only.
 * Returns null when data is missing or unusable (never throws).
 */
export function parseRemotionInfographic(raw: unknown): RemotionInfographicSpec | null {
  const obj = asRecord(raw);
  if (!obj) return null;

  const durationFrames = asPositiveInt(obj.duration_frames);
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
  const trigger = asString(obj.trigger) ?? 'scene_start';
  const placement = asString(obj.placement) ?? 'full_frame';

  return {
    compositionId: compositionIdRaw || animationType,
    animationType,
    props,
    durationFrames,
    trigger,
    placement,
    renderEngineHint: asString(obj.render_engine_hint),
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

/** Human-readable label for library cards. */
export function remotionInfographicLabel(spec: RemotionInfographicSpec): string {
  const title = spec.props.title;
  if (typeof title === 'string' && title.trim()) return title.trim();
  const quote = spec.props.quote;
  if (typeof quote === 'string' && quote.trim()) {
    return quote.trim().length > 48 ? `${quote.trim().slice(0, 48)}…` : quote.trim();
  }
  const label = spec.props.label;
  if (typeof label === 'string' && label.trim()) return label.trim();
  const items = spec.props.items;
  if (Array.isArray(items) && items.length > 0) {
    const first = items.find((v): v is string => typeof v === 'string' && v.trim().length > 0);
    if (first) {
      const more = items.length > 1 ? ` (+${items.length - 1})` : '';
      return first.length > 40 ? `${first.slice(0, 40)}…${more}` : `${first}${more}`;
    }
  }
  return spec.compositionId || spec.animationType;
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
): number {
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
