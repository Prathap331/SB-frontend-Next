/** Product credit rates & plan allotments — single source of truth */

export const CREDITS_PER_SCRIPT_MINUTE = 1;
export const CREDITS_PER_THUMBNAIL = 10;
/** Voice / TTS: 5 credits per minute of generated speech */
export const CREDITS_PER_VOICE_MINUTE = 5;

/** Monthly credit pool by plan (fallback when subscriptions_plan.mins missing) */
export const PLAN_CREDITS: Record<'free' | 'plus' | 'pro', number> = {
  free: 100,
  plus: 600,
  pro: 1200,
};

/** Max script generation length (minutes) by plan */
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

export function maxScriptMinutesForPlan(tier: string | null | undefined): number {
  return MAX_SCRIPT_MINUTES[normalizePlanKey(tier)];
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
