'use client';

/**
 * A formatted number row: prefix · digits · scale suffix · unit, baseline-aligned.
 * Digits use tabular figures and a fixed width (measured at the final value), so a count-up
 * never changes the row's width. Shared by FS-04, FS-06 and the chart templates.
 */
import type { CSSProperties } from 'react';
import type { Measure } from './fit';
import { leaf } from './shared';
import { fontFor } from './style';

export const PREFIX_SCALE = 0.62;
export const SUFFIX_SCALE = 0.46;
export const UNIT_SCALE = 0.42;
export const NUMBER_WEIGHT = 800;
export const NUMBER_LH = 1.08;

export type NumberParts = { prefix: string; digits: string; suffix: string; unit: string };

export function measureNumberRow(p: NumberParts, f: number, measure: Measure) {
  const pre = p.prefix ? measure(p.prefix, f * PREFIX_SCALE, NUMBER_WEIGHT) + f * 0.04 : 0;
  const dg = measure(p.digits, f, NUMBER_WEIGHT, { tabular: true });
  const sx = p.suffix ? measure(p.suffix, f * SUFFIX_SCALE, NUMBER_WEIGHT) + f * 0.08 : 0;
  const u = p.unit ? measure(p.unit, f * UNIT_SCALE, NUMBER_WEIGHT) + f * 0.1 : 0;
  return { pre, dg, sx, u, total: pre + dg + sx + u };
}

/** Largest font (step 4) in [min, max] at which every row fits `width`. */
export function fitNumberRows(rows: NumberParts[], width: number, min: number, max: number, measure: Measure): number {
  for (let f = max; f > min; f -= 4) if (rows.every((r) => measureNumberRow(r, f, measure).total <= width * 0.98)) return f;
  // last resort: scale down proportionally so the widest row fits
  const widest = Math.max(...rows.map((r) => measureNumberRow(r, min, measure).total));
  return widest > width * 0.98 ? Math.floor((min * width * 0.98) / widest) : min;
}

export function NumberRow({
  parts,
  shownDigits,
  font,
  digitsW,
  color,
  accent,
  shadow,
  group,
  inputs,
  style,
  align = 'center',
}: {
  parts: NumberParts;
  /** Current digits (count-up); defaults to the final digits. */
  shownDigits?: string;
  font: number;
  /** Reserved digits width (final value, tabular). */
  digitsW: number;
  color: string;
  accent: string;
  shadow: string;
  group: string;
  /** Prop names for the preview labels. */
  inputs: { value: string; prefix?: string; unit?: string };
  style?: CSSProperties;
  align?: 'left' | 'center';
}) {
  const f = font;
  const t: CSSProperties = { fontFamily: fontFor(NUMBER_WEIGHT), fontWeight: NUMBER_WEIGHT, lineHeight: 1, color, whiteSpace: 'nowrap', textShadow: shadow, letterSpacing: '-0.02em' };
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', height: f * NUMBER_LH, transformOrigin: align === 'center' ? 'center' : 'left center', ...style }}>
      {parts.prefix && (
        <span {...leaf(`${group}-prefix`, inputs.prefix ?? 'prefix')} style={{ ...t, fontSize: f * PREFIX_SCALE, marginRight: f * 0.04 }}>
          {parts.prefix}
        </span>
      )}
      <span
        {...leaf(`${group}-digits`, inputs.value)}
        style={{ ...t, fontSize: f, width: digitsW, display: 'inline-block', textAlign: 'right', fontVariantNumeric: 'tabular-nums', letterSpacing: 0 }}
      >
        {shownDigits ?? parts.digits}
      </span>
      {parts.suffix && (
        <span {...leaf(`${group}-suffix`, `${inputs.value} (scale)`)} style={{ ...t, fontSize: f * SUFFIX_SCALE, marginLeft: f * 0.08, color: accent }}>
          {parts.suffix}
        </span>
      )}
      {parts.unit && (
        <span {...leaf(`${group}-unit`, inputs.unit ?? 'unit')} style={{ ...t, fontSize: f * UNIT_SCALE, marginLeft: f * 0.1, color: accent }}>
          {parts.unit}
        </span>
      )}
    </div>
  );
}

/** Count-up progress and row style for a number animation preset. */
export function numberAnimState(anim: string, p: number) {
  const counting = anim === 'count_up' || anim === 'count_up_pop';
  const countP = counting ? 1 - (1 - Math.min(1, p / (anim === 'count_up_pop' ? 0.8 : 1))) ** 3 : 1;
  const pop = anim === 'count_up_pop' ? Math.sin(Math.PI * Math.min(1, Math.max(0, (p - 0.8) / 0.2))) : 0;
  return { counting, countP, pop };
}

export function numberAnimFrames(anim: string): number {
  if (anim === 'count_up') return 36;
  if (anim === 'count_up_pop') return 42;
  if (anim === 'none') return 1;
  return 18;
}
