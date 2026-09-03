/**
 * Backend-shaped infographic payload (source of truth for Remotion).
 * `composition_id` is identity only — never used as a component registry key.
 */
export type InfographicData = {
  composition_id: string;
  animation_type: string;
  props: Record<string, unknown>;
  duration_frames: number;
  trigger: string;
  placement: string;
  render_engine_hint: string;
};

export type InfographicRemotionInputProps = {
  data: InfographicData;
  /** Backend `icon_name` — one Lucide id or a list — passed straight into the composition. */
  icon_name?: string | string[];
};

export function isInfographicData(value: unknown): value is InfographicData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.animation_type === 'string' &&
    typeof v.duration_frames === 'number' &&
    Number.isFinite(v.duration_frames) &&
    v.duration_frames > 0 &&
    typeof v.props === 'object' &&
    v.props !== null &&
    !Array.isArray(v.props)
  );
}
