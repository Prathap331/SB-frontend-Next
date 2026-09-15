/* eslint-disable no-undef -- Jest globals */
import {
  CREDITS_PER_EDIT_VIDEO_MINUTE,
  clampScriptMinutes,
  editVideoCredits,
  maxScriptMinutesForPlan,
  minScriptMinutesForPlan,
} from './credits';

describe('script length limits by plan', () => {
  it('free users get 3–5 minutes', () => {
    expect(minScriptMinutesForPlan('Free')).toBe(3);
    expect(maxScriptMinutesForPlan('Free')).toBe(5);
    expect(minScriptMinutesForPlan(null)).toBe(3);
  });

  it('paid users get 5–15 minutes', () => {
    for (const tier of ['Plus', 'Pro', 'pro_monthly']) {
      expect(minScriptMinutesForPlan(tier)).toBe(5);
      expect(maxScriptMinutesForPlan(tier)).toBe(15);
    }
  });

  it('clamps a requested length into the plan range', () => {
    expect(clampScriptMinutes(1, 'Free')).toBe(3);
    expect(clampScriptMinutes(10, 'Free')).toBe(5);
    expect(clampScriptMinutes(4, 'Free')).toBe(4);
    expect(clampScriptMinutes(2, 'Pro')).toBe(5);
    expect(clampScriptMinutes(60, 'Plus')).toBe(15);
    expect(clampScriptMinutes(10, 'Plus')).toBe(10);
    expect(clampScriptMinutes(Number.NaN, 'Plus')).toBe(5);
  });
});

describe('AI video generation credits', () => {
  it('charges 11 credits per minute of durationMinutes', () => {
    expect(CREDITS_PER_EDIT_VIDEO_MINUTE).toBe(11);
    expect(editVideoCredits(1)).toBe(11);
    expect(editVideoCredits(5)).toBe(55);
    expect(editVideoCredits(15)).toBe(165);
  });

  it('bills whole minutes, never less than one', () => {
    expect(editVideoCredits(0)).toBe(11);
    expect(editVideoCredits(2.4)).toBe(22);
    expect(editVideoCredits(2.6)).toBe(33);
    expect(editVideoCredits(Number.NaN)).toBe(11);
  });
});
