'use client';

/**
 * FS-04 · Big Number  (animation_type: "fs_big_number")
 * One hero figure with a label, optional context line and an optional change indicator.
 * The number counts up; Indian (lakh / crore) or international (K / M / B) formatting.
 *
 * Inputs (full list, limits and JSON Schema: FS04BigNumber.inputs.json):
 *   value (number, required) · prefix · unit · label (required) · context · icon
 *   change (number) · change_label · count_from (number)
 *   format · decimals · change_type · direction · good_direction · align · background · image_url
 *   accent_color · animations{…} · cue_times [value, label, context, change]
 * Timing: 3–8s from clock.durationInFrames. Everything stays inside the 100px safe margin.
 */
import type { CSSProperties } from 'react';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, normaliseText, readAnim, type TemplateSpec, applySizes } from './core/contentSpec';
import { measureFor } from './core/measure';
import { cardColors, fontFor, mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { HEADROOM, blockHeight, fitText, sharedFont, words, type Line, type Measure } from './core/fit';
import {
  cardStyle,
  easeOutCubic,
  exitStyle,
  iconStyle,
  lineStyle,
  progress,
  shapeState,
  textAnimFrames,
} from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { FORMAT_HELP, NUMBER_FORMATS, decimalsFor, formatDigits, pickScale, readNumber, type NumberFormat, type Scale } from './core/numbers';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { withAutoFit } from './core/autofit';
import {
  AnimatedText,
  FOOTAGE_SHADOW,
  StoryBackground,
  leaf,
  readBgMode,
  readFirst,
} from './core/shared';

/* ================================================================== */
/* Content spec                                                         */
/* ================================================================== */

export const FS04_SPEC: TemplateSpec = {
  id: 'FS-04',
  animationType: 'fs_big_number',
  name: 'Big Number',
  pickWhen: 'Narration states one striking figure: "₹4,200 crore", "73% of Indians", "3 million users".',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 120, max: 240 },
  numbers: {
    value: {
      label: 'Value',
      required: true,
      fills: 'The big number (formatted by the template)',
      hint: 'Raw value, e.g. 42000000000 for ₹4,200 crore, 73 for 73%.',
      example: 42000000000,
    },
    change: {
      label: 'Change',
      required: false,
      fills: 'Change indicator under the label (arrow + value)',
      hint: 'Percent points when change_type = percent (12.4 = +12.4%), otherwise same unit as value. Negative = down.',
      example: 12.4,
    },
    count_from: {
      label: 'Count from',
      required: false,
      fills: 'Where the count-up starts (default 0)',
      example: 0,
    },
  },
  text: {
    prefix: {
      label: 'Prefix',
      required: false,
      minChars: 1,
      maxChars: 3,
      minWords: 1,
      maxWords: 1,
      maxWordChars: 3,
      maxLines: 1,
      fontMax: 150,
      fontMin: 60,
      weight: 800,
      lineHeight: 1,
      hint: 'Currency or symbol before the number: ₹, $, ~.',
      noSize: true,
      fills: 'Symbol before the number',
      example: '₹',
    },
    unit: {
      label: 'Unit',
      required: false,
      minChars: 1,
      maxChars: 10,
      minWords: 1,
      maxWords: 2,
      maxWordChars: 8,
      maxLines: 1,
      fontMax: 110,
      fontMin: 40,
      weight: 800,
      lineHeight: 1,
      hint: 'After the number: %, km, users, per day.',
      noSize: true,
      fills: 'Unit after the number',
      example: '%',
    },
    label: {
      label: 'Label',
      required: true,
      minChars: 3,
      maxChars: 40,
      minWords: 1,
      maxWords: 8,
      maxWordChars: 18,
      maxLines: 2,
      fontMax: 56,
      fontMin: 36,
      weight: 600,
      lineHeight: 1.2,
      hint: 'What the number is: "spent on ads in 2025".',
      fills: 'Label under the number',
      example: 'spent on digital ads in 2025',
    },
    context: {
      label: 'Context',
      required: false,
      minChars: 10,
      maxChars: 90,
      minWords: 2,
      maxWords: 16,
      maxWordChars: 18,
      maxLines: 2,
      fontMax: 36,
      fontMin: 26,
      weight: 500,
      lineHeight: 1.35,
      hint: 'One line that makes the number meaningful.',
      fills: 'Supporting line under the label',
      example: 'More than TV and print combined for the first time',
    },
    change_label: {
      label: 'Change label',
      required: false,
      minChars: 2,
      maxChars: 20,
      minWords: 1,
      maxWords: 4,
      maxWordChars: 14,
      maxLines: 1,
      fontMax: 30,
      fontMin: 24,
      weight: 500,
      lineHeight: 1.2,
      hint: 'What the change is measured against: "vs 2024".',
      fills: 'Text after the change value',
      example: 'vs 2024',
    },
  },
  icons: {
    icon: { label: 'Icon', required: false, fills: 'Icon above the number', fallback: 'none (no icon shown)', example: 'trending-up' },
  },
  lists: {},
  options: {
    format: {
      label: 'Number format',
      values: [...NUMBER_FORMATS],
      default: 'indian_compact',
      fills: FORMAT_HELP,
    },
    decimals: { label: 'Decimals', values: ['auto', '0', '1', '2'], default: 'auto', fills: 'Decimal places shown' },
    change_type: { label: 'Change type', values: ['percent', 'absolute'], default: 'percent', fills: 'How change is shown: +12.4% or +₹1.2 Cr' },
    direction: { label: 'Change direction', values: ['auto', 'up', 'down', 'flat'], default: 'auto', fills: 'Arrow direction (auto = from the sign of change)' },
    good_direction: { label: 'Good direction', values: ['up', 'down'], default: 'up', fills: 'Which direction is shown green (e.g. down for prices or deaths)' },
    align: { label: 'Align', values: ['center', 'left'], default: 'center', fills: 'Horizontal alignment' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    icon: { label: 'Icon', kind: 'icon', target: 'icon above the number', default: 'pop' },
    value: { label: 'Number', kind: 'number', target: 'the big number with prefix and unit', default: 'count_up' },
    rule: { label: 'Accent line', kind: 'shape', target: 'line under the number', default: 'grow' },
    label: { label: 'Label', kind: 'text', target: 'label under the number', default: 'fade_up' },
    context: { label: 'Context', kind: 'text', target: 'supporting line', default: 'fade_up' },
    change: { label: 'Change chip', kind: 'card', target: 'change indicator chip', default: 'slide_up' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: {
    description: 'One cue per element that is present, in order: value, label, context, change. Missing elements are skipped.',
    units: ['value', 'label', 'context', 'change'],
  },
  colors: ['icon', 'icon_bg', 'card', 'card_border', 'positive', 'negative'],
  sizes: { value: { label: 'Number', min: 120, max: 260, fills: 'Big number (prefix, scale and unit follow it)' } },
  example: {
    prefix: '₹',
    value: 42000000000,
    label: 'spent on digital ads in 2025',
    context: 'More than TV and print combined for the first time',
    change: 18.5,
    change_label: 'vs 2024',
    icon: 'megaphone',
    format: 'indian_compact',
    align: 'center',
    background: 'theme',
    animations: { value: 'count_up_pop' },
    cue_times: [0.1, 1.0, 1.9, 2.8],
  },
};

/* ================================================================== */
/* Layout                                                               */
/* ================================================================== */

export const PREFIX_SCALE = 0.62;
export const SUFFIX_SCALE = 0.46;
export const UNIT_SCALE = 0.42;
export const VALUE_WEIGHT = 800;
export const VALUE_LH = 1.08;
export const ICON_GAP = 24;
export const RULE_GAP = 20;
export const RULE_H = 8;
export const LABEL_GAP = 28;
export const CONTEXT_GAP = 16;
export const CHANGE_GAP = 32;

export type BigNumberInput = {
  value: number;
  countFrom: number;
  prefix: string;
  unit: string;
  label: string;
  context: string;
  change?: number;
  changeType: 'percent' | 'absolute';
  changeLabel: string;
  format: NumberFormat;
  decimals: string;
  hasIcon: boolean;
};

export type BigNumberLayout = {
  font: number;
  scale: Scale;
  decimals: number;
  finalDigits: string;
  digitsW: number;
  prefixW: number;
  suffixW: number;
  unitW: number;
  iconBox: number;
  label: Line[];
  context: Line[];
  changeText: string;
  changeLabel: Line[];
  changeFont: number;
  changeW: number;
  blockH: number;
};

export function layoutBigNumber(input: BigNumberInput, measure: Measure, spec: TemplateSpec = FS04_SPEC, valueMax = 260): BigNumberLayout {
  const T = spec.text;
  const scale = pickScale(input.value, input.format);
  const d = decimalsFor(input.value, scale, input.decimals);
  const finalDigits = formatDigits(input.value, scale, input.format, d);
  // digits are drawn with tabular figures, so every intermediate count-up value is at most this wide
  const rowW = (f: number) => {
    const p = input.prefix ? measure(input.prefix, f * PREFIX_SCALE, VALUE_WEIGHT) + f * 0.04 : 0;
    const dg = measure(finalDigits, f, VALUE_WEIGHT, { tabular: true });
    const sx = scale.suffix ? measure(scale.suffix, f * SUFFIX_SCALE, VALUE_WEIGHT) + f * 0.08 : 0;
    const u = input.unit ? measure(input.unit, f * UNIT_SCALE, VALUE_WEIGHT) + f * 0.1 : 0;
    return { p, dg, sx, u, total: p + dg + sx + u };
  };

  // change chip text
  let changeText = '';
  if (input.change !== undefined && Number.isFinite(input.change)) {
    const c = input.change;
    const sign = c > 0 ? '+' : c < 0 ? '−' : '±';
    if (input.changeType === 'percent') {
      const a = Math.abs(c);
      changeText = `${sign}${a.toFixed(Number.isInteger(a) ? 0 : 1)}%`;
    } else {
      const cs = pickScale(c, input.format);
      const cd = decimalsFor(c, cs, 'auto');
      changeText = `${sign}${input.prefix}${formatDigits(Math.abs(c), cs, input.format, cd)}${cs.suffix ? ` ${cs.suffix}` : ''}${input.unit ? ` ${input.unit}` : ''}`;
    }
  }
  const changeFont = changeText ? sharedFont([input.changeLabel], T.change_label, SAFE_W * 0.6, measure) : 0;
  const changeLabel = input.changeLabel && changeText ? fitText(input.changeLabel, T.change_label, SAFE_W * 0.6, measure, false).lines : [];
  const chipPad = changeFont * 0.5;
  const changeW = changeText
    ? chipPad * 2 + changeFont * 1.1 + 12 + measure(changeText, changeFont, 700) + (changeLabel.length ? 12 + measure(changeLabel[0].text, changeLabel[0].size, 500) : 0)
    : 0;
  const changeH = changeText ? changeFont * 1.2 + chipPad * 2 : 0;

  let valueCap = valueMax;
  let labelCap = T.label.fontMax;
  let contextCap = T.context.fontMax;
  const build = () => {
    let font = valueCap;
    while (font > 110 && rowW(font).total > SAFE_W * HEADROOM) font -= 4;
    const r = rowW(font);
    const iconBox = input.hasIcon ? Math.max(64, Math.min(112, Math.round(font * 0.42))) : 0;
    const label = fitText(input.label, T.label, SAFE_W, measure, true, labelCap).lines;
    const context = input.context ? fitText(input.context, T.context, SAFE_W, measure, true, contextCap).lines : [];
    const blockH =
      (iconBox ? iconBox + ICON_GAP : 0) +
      font * VALUE_LH +
      RULE_GAP + RULE_H +
      LABEL_GAP + blockHeight(label, T.label.lineHeight) +
      (context.length ? CONTEXT_GAP + blockHeight(context, T.context.lineHeight) : 0) +
      (changeH ? CHANGE_GAP + changeH : 0);
    return { font, r, iconBox, label, context, blockH };
  };
  let b = build();
  // shrink order: context → label → number, until the stack fits the 880px safe height
  while (b.blockH > SAFE_H && (contextCap > T.context.fontMin || labelCap > T.label.fontMin || valueCap > 120)) {
    if (contextCap > T.context.fontMin) contextCap -= 2;
    else if (labelCap > T.label.fontMin) labelCap -= 2;
    else valueCap -= 8;
    b = build();
  }
  // last resort for an extremely long number: scale the whole row to the safe width
  const overflow = b.r.total / (SAFE_W * HEADROOM);
  const font = overflow > 1 ? Math.floor(b.font / overflow) : b.font;
  const r = overflow > 1 ? rowW(font) : b.r;
  return {
    font,
    scale,
    decimals: d,
    finalDigits,
    digitsW: Math.ceil(r.dg),
    prefixW: r.p,
    suffixW: r.sx,
    unitW: r.u,
    iconBox: b.iconBox,
    label: b.label,
    context: b.context,
    changeText,
    changeLabel,
    changeFont,
    changeW,
    blockH: b.blockH,
  };
}

/* ================================================================== */
/* Timing                                                               */
/* ================================================================== */

export function numberAnimFrames(anim: string): number {
  if (anim === 'count_up') return 36;
  if (anim === 'count_up_pop') return 42;
  if (anim === 'none') return 1;
  return 18;
}

export function planBigNumber(
  L: BigNumberLayout,
  anims: { value: string; label: string; context: string },
  hasIcon: boolean,
  duration: number,
  cueTimes?: number[],
): Plan {
  const T = (lines: Line[]) => lines.map((l) => l.text).join(' ');
  const vDur = numberAnimFrames(anims.value);
  const units: Unit[] = [];
  let cue = 0;
  units.push({ key: 'value', label: 'Number', start: 6, dur: vDur, cue: cue++ });
  const lt = T(L.label);
  const labelStart = 6 + Math.min(vDur, 20);
  units.push({ key: 'label', label: 'Label', start: labelStart, dur: textAnimFrames(anims.label, words(lt).length, lt.length, 18), cue: cue++ });
  let last = labelStart;
  if (L.context.length) {
    const ct = T(L.context);
    last = labelStart + 10;
    units.push({ key: 'context', label: 'Context', start: last, dur: textAnimFrames(anims.context, words(ct).length, ct.length, 18), cue: cue++ });
  }
  if (L.changeText) units.push({ key: 'change', label: 'Change chip', start: Math.max(last + 2, 6 + vDur - 6), dur: 14, cue: cue++ });
  if (hasIcon) units.push({ key: 'icon', label: 'Icon', start: 2, dur: 14, follows: { key: 'value', offset: -4 } });
  units.push({ key: 'rule', label: 'Accent line', start: 6 + vDur - 10, dur: 14, follows: { key: 'value', offset: Math.max(0, vDur - 10) } });
  return planTimeline(duration, units, cueTimes);
}

/* ================================================================== */
/* Props → layout → plan (shared by the renderer and the preview)       */
/* ================================================================== */

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

/** Reads props, fits the layout and plans the timeline — shared by the renderer and the preview. */
export function prepareFS04(props: Record<string, unknown>, durationInFrames: number) {
  const S = FS04_SPEC.text;
  const O = FS04_SPEC.options;
  const A = (k: string) => readAnim(props, FS04_SPEC, k);
  const value = readNumber(props.value ?? props.number ?? props.stat) ?? 0;
  const icon = readFirst(props, ['icon', 'icon_name']);
  const input: BigNumberInput = {
    value,
    countFrom: readNumber(props.count_from) ?? 0,
    prefix: normaliseText(readFirst(props, ['prefix', 'currency']), S.prefix),
    unit: normaliseText(readFirst(props, ['unit', 'suffix']), S.unit),
    label: normaliseText(readFirst(props, ['label', 'title', 'text']), S.label),
    context: normaliseText(readFirst(props, ['context', 'subtitle', 'description']), S.context),
    change: readNumber(props.change ?? props.change_pct),
    changeType: opt(props, 'change_type', O.change_type.values as ('percent' | 'absolute')[], 'percent'),
    changeLabel: normaliseText(readFirst(props, ['change_label', 'comparison']), S.change_label),
    format: opt(props, 'format', O.format.values as NumberFormat[], 'indian_compact'),
    decimals: opt(props, 'decimals', O.decimals.values, 'auto'),
    hasIcon: Boolean(icon),
  };
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const align = opt(props, 'align', ['center', 'left'] as const, 'center');
  const style = readStyle(props);
  const accent = style.colors.accent;
  const sized = applySizes(FS04_SPEC, props);
  const measure = measureFor(style);
  const debug = props.show_safe_area === true;
  const L = layoutBigNumber(input, measure, sized.spec, sized.extra.value);
  const plan = planBigNumber(L, { value: A('value'), label: A('label'), context: A('context') }, input.hasIcon, durationInFrames, readCues(props));
  let direction = opt(props, 'direction', ['auto', 'up', 'down', 'flat'] as const, 'auto');
  if (direction === 'auto') direction = (input.change ?? 0) > 0 ? 'up' : (input.change ?? 0) < 0 ? 'down' : 'flat';
  const good = opt(props, 'good_direction', ['up', 'down'] as const, 'up');
  return { style, sized, S, A, input, icon, imageUrl, bg, align, accent, debug, L, plan, direction, good };
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */


function FS04BigNumberBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, S, A, input, icon, imageUrl, bg, align, accent, debug, L, plan, direction, good } = prepareFS04(props, durationInFrames);
  const w = plan.windows;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const rule = shapeState(A('rule'), progress(frame, w.rule.start, w.rule.dur));
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const items = align === 'center' ? 'center' : 'flex-start';

  // number animation
  const vAnim = A('value');
  const vp = progress(frame, w.value.start, w.value.dur);
  const counting = vAnim === 'count_up' || vAnim === 'count_up_pop';
  const countP = counting ? easeOutCubic(Math.min(1, vp / (vAnim === 'count_up_pop' ? 0.8 : 1))) : 1;
  const shown = counting ? input.countFrom + (input.value - input.countFrom) * countP : input.value;
  const digits = counting && countP < 1 ? formatDigits(shown, L.scale, input.format, L.decimals) : L.finalDigits;
  let rowStyle: CSSProperties;
  if (counting) {
    const pop = vAnim === 'count_up_pop' ? Math.sin(Math.PI * Math.min(1, Math.max(0, (vp - 0.8) / 0.2))) : 0;
    rowStyle = { opacity: Math.min(1, vp * 4), transform: `scale(${1 + 0.07 * pop})` };
  } else {
    rowStyle = lineStyle(vAnim === 'rise' ? 'fade_up' : vAnim, vp);
  }

  const muted = mutedFor(style, onFootage);
  const dirColor = direction === 'flat' ? muted : direction === good ? style.colors.positive : style.colors.negative;
  const dirIcon = direction === 'up' ? 'trending-up' : direction === 'down' ? 'trending-down' : 'arrow-right';
  const f = L.font;
  const valueText: CSSProperties = { fontFamily: fontFor(800), fontWeight: 800, lineHeight: 1, color: style.colors.text, whiteSpace: 'nowrap', textShadow: shadow, letterSpacing: '-0.02em' };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground
        mode={bg}
        imageUrl={imageUrl}
        align={align}
        accent={accent}
        frame={frame}
        durationInFrames={durationInFrames}
        colors={style.colors}
        motion={A('image_motion')}
        entry={A('image_entry')}
      />

      <SafeArea debug={debug}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: items,
            textAlign: align,
            ...exit,
          }}
        >
          {icon && w.icon && (
            <div
              {...leaf('icon', 'icon')}
              style={{
                width: L.iconBox,
                height: L.iconBox,
                marginBottom: ICON_GAP,
                borderRadius: '50%',
                background: style.colors.icon_bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...iconStyle(A('icon'), progress(frame, w.icon.start, w.icon.dur)),
              }}
            >
              <LucideIconView name={icon} size={Math.round(L.iconBox * 0.52)} color={style.colors.icon} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', height: f * VALUE_LH, transformOrigin: align === 'center' ? 'center' : 'left center', ...rowStyle }}>
            {input.prefix && (
              <span {...leaf('value-prefix', 'prefix')} style={{ ...valueText, fontSize: f * PREFIX_SCALE, marginRight: f * 0.04 }}>
                {input.prefix}
              </span>
            )}
            <span
              {...leaf('value-digits', 'value')}
              style={{
                ...valueText,
                fontSize: f,
                width: L.digitsW,
                display: 'inline-block',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: 0,
              }}
            >
              {digits}
            </span>
            {L.scale.suffix && (
              <span {...leaf('value-suffix', 'value (scale)')} style={{ ...valueText, fontSize: f * SUFFIX_SCALE, marginLeft: f * 0.08, color: accent }}>
                {L.scale.suffix}
              </span>
            )}
            {input.unit && (
              <span {...leaf('value-unit', 'unit')} style={{ ...valueText, fontSize: f * UNIT_SCALE, marginLeft: f * 0.1, color: accent }}>
                {input.unit}
              </span>
            )}
          </div>

          <div
            {...leaf('rule', 'accent line')}
            style={{ width: 120 * rule.length, height: RULE_H, borderRadius: 4, background: accent, marginTop: RULE_GAP, ...rule.style }}
          />

          <AnimatedText
            lines={L.label}
            anim={A('label')}
            start={w.label.start}
            dur={w.label.dur}
            frame={frame}
            weight={S.label.weight}
            lineHeight={S.label.lineHeight}
            shadow={shadow}
            align={align}
            group="label"
            input="label"
            style={{ marginTop: LABEL_GAP }}
          />

          {L.context.length > 0 && w.context && (
            <AnimatedText
              lines={L.context}
              anim={A('context')}
              start={w.context.start}
              dur={w.context.dur}
              frame={frame}
              weight={S.context.weight}
              lineHeight={S.context.lineHeight}
              color={muted}
              shadow={shadow}
              align={align}
              group="context"
              input="context"
              style={{ marginTop: CONTEXT_GAP }}
            />
          )}

          {L.changeText && w.change && (
            <div
              style={{
                marginTop: CHANGE_GAP,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: `${L.changeFont * 0.5}px`,
                paddingRight: L.changeFont * 0.7,
                borderRadius: 999,
                background: onFootage && !style.custom.has('card') ? cardColors(style, true).fill : withAlpha(dirColor, 0.12),
                border: `1.5px solid ${withAlpha(dirColor, 0.4)}`,
                ...cardStyle(A('change'), progress(frame, w.change.start, w.change.dur)),
              }}
            >
              <div {...leaf('change-icon', 'change (direction)')} style={{ display: 'flex' }}>
                <LucideIconView name={dirIcon} size={Math.round(L.changeFont * 1.1)} color={dirColor} />
              </div>
              <span {...leaf('change-value', 'change')} style={{ fontFamily: fontFor(700), fontSize: L.changeFont, fontWeight: 700, lineHeight: 1.2, color: dirColor, whiteSpace: 'nowrap' }}>
                {L.changeText}
              </span>
              {L.changeLabel.length > 0 && (
                <span
                  {...leaf('change-label', 'change_label')}
                  style={{ fontFamily: fontFor(500), fontSize: L.changeLabel[0].size, fontWeight: 500, lineHeight: 1.2, color: muted, whiteSpace: 'nowrap' }}
                >
                  {L.changeLabel[0].text}
                </span>
              )}
            </div>
          )}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const FS04BigNumber = withAutoFit(FS04BigNumberBase);
