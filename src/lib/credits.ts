/** Product credit rates & plan allotments — single source of truth */

export const CREDITS_PER_SCRIPT_MINUTE = 1;
export const CREDITS_PER_THUMBNAIL = 10;
/** Voice / TTS: 5 credits per minute of generated speech */
export const CREDITS_PER_VOICE_MINUTE = 11;
/**
 * Faceless AI video generation via POST /edit-video — charged per minute of the
 * `durationMinutes` sent in the payload (5 min → 55 credits).
 */
export const CREDITS_PER_EDIT_VIDEO_MINUTE = 11;

/** Monthly credit pool by plan (fallback when subscriptions_plan.mins missing) */
export const PLAN_CREDITS: Record<'free' | 'plus' | 'pro', number> = {
  free: 150,
  plus: 1300,
  pro: 2500,
};

/** Min script generation length (minutes) by plan — free 3, paid 5 */
export const MIN_SCRIPT_MINUTES: Record<'free' | 'plus' | 'pro', number> = {
  free: 3,
  plus: 5,
  pro: 5,
};

/** Max script generation length (minutes) by plan — free 5, paid 15 */
export const MAX_SCRIPT_MINUTES: Record<'free' | 'plus' | 'pro', number> = {
  free: 5,
  plus: 15,
  pro: 15,
};

export type PlanKey = 'free' | 'plus' | 'pro';

export function normalizePlanKey(tier: string | null | undefined): PlanKey {
  const t = (tier || 'free').trim().toLowerCase();
  if (t.includes('pro')) return 'pro';
  if (t.includes('plus')) return 'plus';
  return 'free';
}

export function minScriptMinutesForPlan(tier: string | null | undefined): number {
  return MIN_SCRIPT_MINUTES[normalizePlanKey(tier)];
}

export function maxScriptMinutesForPlan(tier: string | null | undefined): number {
  return MAX_SCRIPT_MINUTES[normalizePlanKey(tier)];
}

/** Clamp a requested script length (minutes) into the plan's [min, max] range. */
export function clampScriptMinutes(minutes: number, tier: string | null | undefined): number {
  const min = minScriptMinutesForPlan(tier);
  const max = maxScriptMinutesForPlan(tier);
  if (!Number.isFinite(minutes)) return min;
  return Math.min(max, Math.max(min, Math.round(minutes)));
}

export function planCreditsFallback(tier: string | null | undefined): number {
  return PLAN_CREDITS[normalizePlanKey(tier)];
}

/** Billable voice minutes (ceil to whole minutes, min 1 when duration > 0) */
export function voiceBillableMinutes(durationSeconds: number): number {
  const sec = Math.max(0, Math.floor(Number(durationSeconds) || 0));
  if (sec <= 0) return 0;
  return Math.max(1, Math.ceil(sec / 60));
}

export function voiceCreditsForSeconds(durationSeconds: number): number {
  return voiceBillableMinutes(durationSeconds) * CREDITS_PER_VOICE_MINUTE;
}

/**
 * Credits an /edit-video run costs, from the same `durationMinutes` the payload sends.
 * Whole minutes, at least one, so the quoted price matches what is charged.
 */
export function editVideoCredits(durationMinutes: number): number {
  const mins = Math.max(1, Math.round(Number(durationMinutes) || 0));
  return mins * CREDITS_PER_EDIT_VIDEO_MINUTE;
}

/**
 * Prefer script metrics duration; otherwise estimate from word count (~150 wpm).
 */
export function estimateSpeechDurationSeconds(
  text: string,
  scriptDurationMinutes?: number | null,
): number {
  const mins = Number(scriptDurationMinutes);
  if (Number.isFinite(mins) && mins > 0) {
    return Math.round(mins * 60);
  }
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 0;
  return Math.max(60, Math.round((words / 150) * 60));
}
