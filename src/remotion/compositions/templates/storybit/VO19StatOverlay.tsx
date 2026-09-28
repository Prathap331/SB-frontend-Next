'use client';

/**
 * VO-19 · Statistic Overlay  (animation_type: "vo_stat_overlay")   — overlay on footage
 * One number with a short label in a compact card while the footage keeps playing.
 *
 * Inputs (full list, limits and JSON Schema: VO19StatOverlay.inputs.json):
 *   value (required) · label (required) · prefix · unit · icon · position · format · decimals
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [value, label]
 * Timing: 1.5–8s from clock.durationInFrames.
 */
import type { CSSProperties } from 'react';
import type { TemplateProps } from '../../../types';
import { readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, iconStyle, lineStyle, progress, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { FORMAT_HELP, NUMBER_FORMATS, decimalsFor, formatDigits, pickScale, readNumber, type NumberFormat, type Scale } from './core/numbers';
import { NUMBER_LH, NumberRow, fitNumberRows, measureNumberRow, numberAnimFrames, numberAnimState, type NumberParts } from './core/numberRow';
import { OVERLAY_DURATION, OVERLAY_POSITIONS, anchorBox, type OverlayPosition } from './core/overlay';
import { SafeArea } from './core/safeArea';
import { readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, leaf, readFirst } from './core/shared';

export const VO19_SPEC: TemplateSpec = {
  id: 'VO-19',
  animationType: 'vo_stat_overlay',
  name: 'Statistic Overlay',
  pickWhen: 'A figure is mentioned while the footage should keep playing.',
  placement: 'overlay',
  duration: OVERLAY_DURATION,
  numbers: { value: { label: 'Value', required: true, fills: 'The number (formatted by the template)', example: 18400000000 } },
  text: {
    label: { label: 'Label', required: true, minChars: 2, maxChars: 34, minWords: 1, maxWords: 6, maxWordChars: 16, maxLines: 2, fontMax: 30, fontMin: 20, weight: 600, lineHeight: 1.22, hint: 'What the number is: "UPI payments a month".', fills: 'Label under the number', example: 'UPI payments a month' },
    prefix: { label: 'Prefix', required: false, minChars: 1, maxChars: 3, minWords: 1, maxWords: 1, maxWordChars: 3, maxLines: 1, fontMax: 60, fontMin: 20, weight: 800, lineHeight: 1, fills: 'Symbol before the number', noSize: true },
    unit: { label: 'Unit', required: false, minChars: 1, maxChars: 8, minWords: 1, maxWords: 1, maxWordChars: 8, maxLines: 1, fontMax: 60, fontMin: 20, weight: 800, lineHeight: 1, fills: 'Unit after the number', noSize: true },
  },
  icons: { icon: { label: 'Icon', required: false, fills: 'Icon on the left of the card', fallback: 'none', example: 'smartphone' } },
  lists: {},
  options: {
    position: { label: 'Position', values: [...OVERLAY_POSITIONS], default: 'top_right', fills: 'Where the card sits inside the safe box' },
    format: { label: 'Number format', values: [...NUMBER_FORMATS], default: 'indian_compact', fills: FORMAT_HELP },
    decimals: { label: 'Decimals', values: ['auto', '0', '1', '2'], default: 'auto', fills: 'Decimal places shown' },
  },
  animations: {
    card: { label: 'Card', kind: 'card', target: 'the card', default: 'pop' },
    icon: { label: 'Icon', kind: 'icon', target: 'icon', default: 'pop' },
    value: { label: 'Number', kind: 'number', target: 'the number', default: 'count_up' },
    label: { label: 'Label', kind: 'text', target: 'label', default: 'fade_up' },
    exit: { label: 'Exit', kind: 'exit', target: 'the card', default: 'fade' },
  },
  cues: { description: 'value → label.', units: ['value', 'label'] },
  colors: ['icon', 'icon_bg', 'card'],
  sizes: { value: { label: 'Number', min: 40, max: 96, fills: 'The number' } },
  example: { value: 18400000000, label: 'UPI payments a month', format: 'intl_compact', icon: 'smartphone', position: 'top_right' },
};

export const PAD = 26;
export type StatLayout = { parts: NumberParts; scale: Scale; decimals: number; font: number; digitsW: number; label: Line[]; icon: number; w: number; h: number; contentW: number };

export function layoutStat(input: { value: number; prefix: string; unit: string; label: string; format: NumberFormat; decimals: string; hasIcon: boolean }, measure: Measure, spec: TemplateSpec = VO19_SPEC, valueMax = 96): StatLayout {
  const T = spec.text;
  const scale = pickScale(input.value, input.format);
  const d = decimalsFor(input.value, scale, input.decimals);
  const parts = { prefix: input.prefix, digits: formatDigits(input.value, scale, input.format, d), suffix: scale.suffix, unit: input.unit };
  const maxW = 640;
  const font = fitNumberRows([parts], maxW, 36, valueMax, measure);
  const row = measureNumberRow(parts, font, measure);
  const label = fitText(input.label, T.label, Math.max(row.total, 360), measure).lines;
  const contentW = Math.ceil(Math.max(row.total, ...label.map((l) => measure(l.text, l.size, T.label.weight))));
  const contentH = font * NUMBER_LH + 6 + blockHeight(label, T.label.lineHeight);
  const icon = input.hasIcon ? Math.round(Math.min(96, contentH * 0.7)) : 0;
  const h = Math.round(contentH + PAD * 2);
  const w = Math.ceil(PAD * 2 + 8 + (icon ? icon + 22 : 0) + contentW);
  return { parts, scale, decimals: d, font, digitsW: Math.ceil(row.dg), label, icon, w, h, contentW };
}

export function planStat(L: StatLayout, anims: { value: string; label: string }, duration: number, cueTimes?: number[]): Plan {
  const vDur = Math.min(numberAnimFrames(anims.value), 30);
  const lt = L.label.map((l) => l.text).join(' ');
  const units: Unit[] = [
    { key: 'value', label: 'Number', start: 8, dur: vDur, cue: 0 },
    { key: 'label', label: 'Label', start: 14, dur: textAnimFrames(anims.label, words(lt).length, lt.length, 14), cue: 1 },
    { key: 'card', label: 'Card', start: 2, dur: 12, follows: { key: 'value', offset: -6 } },
  ];
  if (L.icon) units.push({ key: 'icon', label: 'Icon', start: 6, dur: 14, follows: { key: 'value', offset: -2 } });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareVO19(props: Record<string, unknown>, durationInFrames: number) {
  const S = VO19_SPEC.text;
  const A = (k: string) => readAnim(props, VO19_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(VO19_SPEC, props);
  const measure = measureFor(style);
  const icon = readFirst(props, ['icon', 'icon_name']);
  const input = {
    value: readNumber(props.value) ?? 0,
    prefix: normaliseText(readFirst(props, ['prefix']), S.prefix),
    unit: normaliseText(readFirst(props, ['unit']), S.unit),
    label: normaliseText(readFirst(props, ['label', 'text']), S.label),
    format: opt(props, 'format', NUMBER_FORMATS, 'indian_compact'),
    decimals: opt(props, 'decimals', ['auto', '0', '1', '2'] as const, 'auto'),
    hasIcon: Boolean(icon),
  };
  const L = layoutStat(input, measure, sized.spec, sized.extra.value);
  const plan = planStat(L, { value: A('value'), label: A('label') }, durationInFrames, readCues(props));
  return { style, sized, A, input, icon, L, plan, position: opt(props, 'position', OVERLAY_POSITIONS, 'top_right') as OverlayPosition, debug: props.show_safe_area === true };
}

export function VO19StatOverlay({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, input, icon, L, plan, position, debug } = prepareVO19(props, durationInFrames);
  const w = plan.windows;
  const S = VO19_SPEC.text;
  const accent = style.colors.accent;
  const { left, top } = anchorBox(position, L.w, L.h);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const fill = style.custom.has('card') ? style.colors.card : withAlpha(style.colors.scrim, 0.78);
  const vp = progress(frame, w.value.start, w.value.dur);
  const st = numberAnimState(A('value'), vp);
  const shown = st.counting && st.countP < 1 ? formatDigits(input.value * st.countP, L.scale, input.format, L.decimals) : L.parts.digits;
  const rowStyle: CSSProperties = st.counting ? { opacity: Math.min(1, vp * 4), transform: `scale(${1 + 0.07 * st.pop})` } : lineStyle(A('value') === 'rise' ? 'fade_up' : A('value'), vp);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          <div
            style={{
              position: 'absolute',
              left,
              top,
              width: L.w,
              height: L.h,
              boxSizing: 'border-box',
              padding: PAD,
              borderRadius: 24,
              background: fill,
              borderLeft: `8px solid ${accent}`,
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              ...cardStyle(A('card'), progress(frame, w.card.start, w.card.dur)),
            }}
          >
            {L.icon > 0 && icon && w.icon && (
              <div {...leaf('icon', 'icon')} style={{ width: L.icon, height: L.icon, flexShrink: 0, borderRadius: '50%', background: style.colors.icon_bg, display: 'flex', alignItems: 'center', justifyContent: 'center', ...iconStyle(A('icon'), progress(frame, w.icon.start, w.icon.dur)) }}>
                <LucideIconView name={icon} size={Math.round(L.icon * 0.52)} color={style.colors.icon} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <NumberRow parts={L.parts} shownDigits={shown} font={L.font} digitsW={L.digitsW} color={style.colors.text} accent={accent} shadow={FOOTAGE_SHADOW} group="value" inputs={{ value: 'value' }} align="left" style={rowStyle} />
              <AnimatedText lines={L.label} anim={A('label')} start={w.label.start} dur={w.label.dur} frame={frame} weight={S.label.weight} lineHeight={S.label.lineHeight} color={style.custom.has('muted') ? style.colors.muted : '#E8EAF6'} shadow={FOOTAGE_SHADOW} group="label" input="label" />
            </div>
          </div>
        </div>
      </SafeArea>
    </div>
  );
}
