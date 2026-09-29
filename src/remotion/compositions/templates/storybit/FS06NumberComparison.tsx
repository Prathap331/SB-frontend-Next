'use client';

/**
 * FS-06 · Number Comparison  (animation_type: "fs_number_comparison")
 * Value A vs value B with the difference between them — side by side, before → after, or two bars.
 * Both numbers share one format and one size so they compare honestly.
 *
 * Inputs (full list, limits and JSON Schema: FS06NumberComparison.inputs.json):
 *   value_a, value_b (numbers, required) · label_a, label_b (required) · title · prefix · unit
 *   context · change_label · icon_a · icon_b
 *   layout · format · decimals · show_change · good_direction · highlight · background · image_url
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, A, B, change, context]
 * Timing: 3–8s from clock.durationInFrames. Everything stays inside the 100px safe margin.
 */
import type { CSSProperties } from 'react';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, sharedFont, linesAt, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, iconStyle, lineStyle, progress, shapeState, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { FORMAT_HELP, NUMBER_FORMATS, decimalsFor, formatDigits, pickScale, readNumber, type NumberFormat, type Scale } from './core/numbers';
import { NUMBER_LH, NumberRow, fitNumberRows, measureNumberRow, numberAnimFrames, numberAnimState, type NumberParts } from './core/numberRow';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { cardColors, fontFor, mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

/* ================================================================== */
/* Content spec                                                         */
/* ================================================================== */

const SIDE_LABEL = {
  required: true,
  minChars: 2,
  maxChars: 25,
  minWords: 1,
  maxWords: 4,
  maxWordChars: 14,
  maxLines: 2,
  fontMax: 44,
  fontMin: 28,
  weight: 600,
  lineHeight: 1.2,
} as const;

export const FS06_SPEC: TemplateSpec = {
  id: 'FS-06',
  animationType: 'fs_number_comparison',
  name: 'Number Comparison',
  pickWhen: 'Two figures are compared, or the same metric before and after: "from ₹12 lakh to ₹45 lakh", "India 7% vs China 5%".',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 150, max: 240 },
  numbers: {
    value_a: { label: 'Value A', required: true, fills: 'First (left / before) number', hint: 'Raw value, e.g. 1200000.', example: 1200000 },
    value_b: { label: 'Value B', required: true, fills: 'Second (right / after) number', hint: 'Raw value, same unit as value A.', example: 4500000 },
  },
  text: {
    title: {
      label: 'Heading',
      required: false,
      minChars: 3,
      maxChars: 40,
      minWords: 1,
      maxWords: 8,
      maxWordChars: 18,
      maxLines: 1,
      fontMax: 64,
      fontMin: 44,
      weight: 800,
      lineHeight: 1.04,
      hint: 'What is being compared: "Average salary, 2015 vs 2025".',
      fills: 'Heading above the comparison',
      example: 'Average IT salary',
    },
    label_a: { ...SIDE_LABEL, label: 'Label A', hint: 'What value A is: "2015", "India", "Before".', fills: 'Label under value A', example: '2015' },
    label_b: { ...SIDE_LABEL, label: 'Label B', hint: 'What value B is.', fills: 'Label under value B', example: '2025' },
    prefix: {
      label: 'Prefix',
      required: false,
      minChars: 1,
      maxChars: 3,
      minWords: 1,
      maxWords: 1,
      maxWordChars: 3,
      maxLines: 1,
      fontMax: 120,
      fontMin: 50,
      weight: 800,
      lineHeight: 1,
      hint: 'Currency or symbol for both values: ₹, $.',
      fills: 'Symbol before both numbers',
      example: '₹',
      noSize: true,
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
      fontMax: 90,
      fontMin: 36,
      weight: 800,
      lineHeight: 1,
      hint: 'Unit for both values: %, km, per year.',
      fills: 'Unit after both numbers',
      example: '/yr',
      noSize: true,
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
      hint: 'Words after the difference: "in ten years", "higher".',
      fills: 'Text after the difference',
      example: 'in ten years',
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
      fontMax: 34,
      fontMin: 26,
      weight: 500,
      lineHeight: 1.35,
      hint: 'One line explaining why the difference matters.',
      fills: 'Supporting line at the bottom',
      example: 'Salaries grew almost four times faster than rent',
    },
  },
  icons: {
    icon_a: { label: 'Icon A', required: false, fills: 'Icon above value A', fallback: 'none (no icon)', example: 'calendar' },
    icon_b: { label: 'Icon B', required: false, fills: 'Icon above value B', fallback: 'none (no icon)', example: 'calendar' },
  },
  lists: {},
  options: {
    layout: {
      label: 'Layout',
      values: ['side_by_side', 'before_after', 'bars'],
      default: 'side_by_side',
      fills: 'side_by_side: two cards with VS · before_after: A → B with an arrow · bars: two bars sized by value (positive values only)',
    },
    format: { label: 'Number format', values: [...NUMBER_FORMATS], default: 'indian_compact', fills: FORMAT_HELP },
    decimals: { label: 'Decimals', values: ['auto', '0', '1', '2'], default: 'auto', fills: 'Decimal places shown' },
    show_change: {
      label: 'Show difference',
      values: ['auto', 'percent', 'multiple', 'absolute', 'none'],
      default: 'auto',
      fills: 'How B differs from A: +275% · 3.8× · +₹33 L · hidden (auto picks percent, or multiple for big jumps)',
    },
    good_direction: { label: 'Good direction', values: ['up', 'down'], default: 'up', fills: 'Which direction is shown green (down for prices, deaths, pollution)' },
    highlight: { label: 'Highlight', values: ['none', 'a', 'b', 'higher', 'lower'], default: 'none', fills: 'Which value is drawn in the accent colour' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    cards: { label: 'Cards / bars', kind: 'card', target: 'the two cards (side_by_side, before_after) or bar columns', default: 'fade' },
    icons: { label: 'Icons', kind: 'icon', target: 'icons above the values', default: 'pop' },
    values: { label: 'Numbers', kind: 'number', target: 'both numbers', default: 'count_up' },
    labels: { label: 'Labels', kind: 'text', target: 'labels under the numbers', default: 'fade_up' },
    connector: { label: 'VS / arrow / bars', kind: 'shape', target: 'VS badge, arrow, or bar growth', default: 'grow' },
    change: { label: 'Difference chip', kind: 'card', target: 'difference chip', default: 'slide_up' },
    context: { label: 'Context', kind: 'text', target: 'supporting line', default: 'fade_up' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: {
    description: 'One cue per element that is present, in order: heading, value A, value B, difference, context. Missing elements are skipped.',
    units: ['heading', 'value A', 'value B', 'difference', 'context'],
  },
  colors: ['icon', 'icon_bg', 'card', 'card_border', 'positive', 'negative'],
  sizes: { values: { label: 'Numbers', min: 80, max: 200, fills: 'Both numbers (prefix, scale and unit follow)' } },
  example: {
    title: 'Average IT salary',
    prefix: '₹',
    value_a: 1200000,
    label_a: '2015',
    value_b: 4500000,
    label_b: '2025',
    change_label: 'in ten years',
    context: 'Salaries grew almost four times faster than rent',
    layout: 'before_after',
    format: 'indian_compact',
    highlight: 'b',
    background: 'theme',
    cue_times: [0.1, 0.8, 2.0, 3.0, 3.8],
  },
};

/* ================================================================== */
/* Layout                                                               */
/* ================================================================== */

export type Layout06 = 'side_by_side' | 'before_after' | 'bars';

export const HEADING_GAP = 48;
export const CARD_PAD = 40;
export const ICON_GAP = 18;
export const LABEL_GAP = 20;
export const CHANGE_GAP = 36;
export const CONTEXT_GAP = 20;
export const BAR_W = 200;
export const BAR_GAP = 16;
export const MID = { side_by_side: 180, before_after: 260, bars: 240 } as const;

export type CompareInput = {
  a: number;
  b: number;
  prefix: string;
  unit: string;
  title: string;
  labelA: string;
  labelB: string;
  context: string;
  changeLabel: string;
  format: NumberFormat;
  decimals: string;
  showChange: string;
  layout: Layout06;
  iconA: boolean;
  iconB: boolean;
};

export type CompareLayout = {
  layout: Layout06;
  heading: Line[];
  headingH: number;
  colW: number;
  inner: number;
  font: number;
  scale: Scale;
  decimals: number;
  partsA: NumberParts;
  partsB: NumberParts;
  digitsWA: number;
  digitsWB: number;
  iconBox: number;
  labelA: Line[];
  labelB: Line[];
  labelFont: number;
  cardH: number;
  barMaxH: number;
  barA: number;
  barB: number;
  change: { text: string; dir: 'up' | 'down' | 'flat' } | null;
  changeLabel: Line[];
  changeFont: number;
  changeH: number;
  context: Line[];
  blockH: number;
};

function describeChange(inp: CompareInput, scale: Scale, d: number): { text: string; dir: 'up' | 'down' | 'flat' } | null {
  const { a, b } = inp;
  if (inp.showChange === 'none') return null;
  const diff = b - a;
  const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±';
  const pct = a !== 0 ? (diff / Math.abs(a)) * 100 : NaN;
  const ratio = a > 0 && b > 0 ? b / a : NaN;
  let mode = inp.showChange;
  if (mode === 'auto') mode = Number.isFinite(pct) && Math.abs(pct) < 300 ? 'percent' : Number.isFinite(ratio) && ratio >= 1 ? 'multiple' : 'absolute';
  if (mode === 'percent' && !Number.isFinite(pct)) mode = 'absolute';
  if (mode === 'multiple' && !(Number.isFinite(ratio) && ratio >= 1)) mode = Number.isFinite(pct) ? 'percent' : 'absolute';
  if (mode === 'percent') {
    const x = Math.abs(pct);
    return { text: `${sign}${x.toFixed(x >= 10 || Number.isInteger(x) ? 0 : 1)}%`, dir };
  }
  if (mode === 'multiple') return { text: `${ratio.toFixed(ratio >= 10 ? 0 : 1)}×`, dir };
  const digits = formatDigits(Math.abs(diff), scale, inp.format, d);
  return { text: `${sign}${inp.prefix}${digits}${scale.suffix ? ` ${scale.suffix}` : ''}${inp.unit ? ` ${inp.unit}` : ''}`, dir };
}

export function layoutCompare(inp: CompareInput, measure: Measure, spec: TemplateSpec = FS06_SPEC, valuesMax = 200): CompareLayout {
  const T = spec.text;
  // bars need positive values; otherwise fall back to side by side
  const layout: Layout06 = inp.layout === 'bars' && (inp.a < 0 || inp.b < 0) ? 'side_by_side' : inp.layout;
  const heading = inp.title ? fitText(inp.title, T.title, SAFE_W, measure, false).lines : [];
  const headingH = heading.length ? blockHeight(heading, T.title.lineHeight) + HEADING_GAP : 0;
  const colW = (SAFE_W - MID[layout]) / 2;
  const inner = layout === 'bars' ? colW : colW - CARD_PAD * 2;

  // one scale + decimals for both numbers, chosen from the larger one
  const big = Math.abs(inp.a) >= Math.abs(inp.b) ? inp.a : inp.b;
  const scale = pickScale(big, inp.format);
  const d = Math.max(decimalsFor(inp.a, scale, inp.decimals), decimalsFor(inp.b, scale, inp.decimals));
  const parts = (v: number): NumberParts => ({ prefix: inp.prefix, digits: formatDigits(v, scale, inp.format, d), suffix: scale.suffix, unit: inp.unit });
  const partsA = parts(inp.a);
  const partsB = parts(inp.b);

  const change = describeChange(inp, scale, d);
  const changeLabel = change && inp.changeLabel ? fitText(inp.changeLabel, T.change_label, SAFE_W * 0.5, measure, false).lines : [];
  const changeFont = change ? sharedFont([inp.changeLabel || 'x'], T.change_label, SAFE_W * 0.5, measure) : 0;
  const changeH = change ? Math.round(changeFont * 1.2 + changeFont) : 0;

  let valueCap = Math.min(valuesMax, layout === 'bars' ? 150 : valuesMax);
  let labelCap = T.label_a.fontMax;
  let contextCap = T.context.fontMax;
  const build = () => {
    const font = fitNumberRows([partsA, partsB], inner, 60, valueCap, measure);
    const labelFont = sharedFont([inp.labelA, inp.labelB], T.label_a, inner, measure, labelCap);
    const labelA = linesAt(inp.labelA, labelFont, T.label_a, inner, measure);
    const labelB = linesAt(inp.labelB, labelFont, T.label_b, inner, measure);
    const labelH = Math.max(blockHeight(labelA, T.label_a.lineHeight), blockHeight(labelB, T.label_b.lineHeight));
    const iconBox = inp.iconA || inp.iconB ? Math.max(56, Math.min(96, Math.round(font * 0.45))) : 0;
    const context = inp.context ? fitText(inp.context, T.context, SAFE_W, measure, true, contextCap).lines : [];
    const bottom = (change ? CHANGE_GAP + changeH : 0) + (context.length ? CONTEXT_GAP + blockHeight(context, T.context.lineHeight) : 0);
    const valueH = font * NUMBER_LH;
    let cardH = 0;
    let barMaxH = 0;
    if (layout === 'bars') {
      barMaxH = Math.max(120, Math.min(360, SAFE_H - headingH - bottom - (iconBox ? iconBox + ICON_GAP : 0) - valueH - BAR_GAP - LABEL_GAP - labelH));
      cardH = (iconBox ? iconBox + ICON_GAP : 0) + valueH + BAR_GAP + barMaxH + LABEL_GAP + labelH;
    } else {
      cardH = CARD_PAD * 2 + (iconBox ? iconBox + ICON_GAP : 0) + valueH + LABEL_GAP + labelH;
    }
    return { font, labelFont, labelA, labelB, iconBox, context, cardH, barMaxH, blockH: headingH + cardH + bottom };
  };
  let b = build();
  // shrink order: context → labels → numbers, until the stack fits the 880px safe height
  while (b.blockH > SAFE_H && (contextCap > T.context.fontMin || labelCap > T.label_a.fontMin || valueCap > 64)) {
    if (contextCap > T.context.fontMin) contextCap -= 2;
    else if (labelCap > T.label_a.fontMin) labelCap -= 2;
    else valueCap -= 8;
    b = build();
  }
  const maxAbs = Math.max(Math.abs(inp.a), Math.abs(inp.b)) || 1;
  const bar = (v: number) => Math.max(0.04, Math.abs(v) / maxAbs);
  return {
    layout,
    heading,
    headingH,
    colW,
    inner,
    font: b.font,
    scale,
    decimals: d,
    partsA,
    partsB,
    digitsWA: Math.ceil(measureNumberRow(partsA, b.font, measure).dg),
    digitsWB: Math.ceil(measureNumberRow(partsB, b.font, measure).dg),
    iconBox: b.iconBox,
    labelA: b.labelA,
    labelB: b.labelB,
    labelFont: b.labelFont,
    cardH: b.cardH,
    barMaxH: b.barMaxH,
    barA: bar(inp.a),
    barB: bar(inp.b),
    change,
    changeLabel,
    changeFont,
    changeH,
    context: b.context,
    blockH: b.blockH,
  };
}

/* ================================================================== */
/* Timing                                                               */
/* ================================================================== */

export function planCompare(
  L: CompareLayout,
  anims: { title: string; values: string; labels: string; context: string },
  hasIcon: { a: boolean; b: boolean },
  duration: number,
  cueTimes?: number[],
): Plan {
  const T = (lines: Line[]) => lines.map((l) => l.text).join(' ');
  const vDur = numberAnimFrames(anims.values);
  const units: Unit[] = [];
  let cue = 0;
  if (L.heading.length) {
    const h = T(L.heading);
    units.push({ key: 'title', label: 'Heading', start: 2, dur: textAnimFrames(anims.title, words(h).length, h.length, 18), cue: cue++ });
  }
  const first = L.heading.length ? 20 : 6;
  const gapAB = L.layout === 'before_after' ? 30 : 14;
  units.push({ key: 'a', label: 'Value A', start: first, dur: vDur, cue: cue++ });
  units.push({ key: 'b', label: 'Value B', start: first + gapAB, dur: vDur, cue: cue++ });
  let last = first + gapAB + vDur - 6;
  if (L.change) units.push({ key: 'change', label: 'Difference', start: last, dur: 14, cue: cue++ });
  if (L.context.length) {
    const c = T(L.context);
    last += 10;
    units.push({ key: 'context', label: 'Context', start: last, dur: textAnimFrames(anims.context, words(c).length, c.length, 18), cue: cue++ });
  }
  const la = T(L.labelA);
  const lb = T(L.labelB);
  units.push({ key: 'card_a', label: 'Card A', start: first - 2, dur: 12, follows: { key: 'a', offset: -2 } });
  units.push({ key: 'card_b', label: 'Card B', start: first + gapAB - 2, dur: 12, follows: { key: 'b', offset: -2 } });
  if (hasIcon.a) units.push({ key: 'icon_a', label: 'Icon A', start: first, dur: 14, follows: { key: 'a', offset: 0 } });
  if (hasIcon.b) units.push({ key: 'icon_b', label: 'Icon B', start: first + gapAB, dur: 14, follows: { key: 'b', offset: 0 } });
  units.push({ key: 'label_a', label: 'Label A', start: first + 8, dur: textAnimFrames(anims.labels, words(la).length, la.length, 16), follows: { key: 'a', offset: 8 } });
  units.push({ key: 'label_b', label: 'Label B', start: first + gapAB + 8, dur: textAnimFrames(anims.labels, words(lb).length, lb.length, 16), follows: { key: 'b', offset: 8 } });
  if (L.layout === 'bars') {
    units.push({ key: 'bar_a', label: 'Bar A', start: first, dur: vDur, follows: { key: 'a', offset: 0 } });
    units.push({ key: 'bar_b', label: 'Bar B', start: first + gapAB, dur: vDur, follows: { key: 'b', offset: 0 } });
  } else {
    units.push({ key: 'connector', label: L.layout === 'before_after' ? 'Arrow' : 'VS badge', start: first + 10, dur: 16, follows: { key: 'a', offset: 10 } });
  }
  return planTimeline(duration, units, cueTimes);
}

/* ================================================================== */
/* Props → layout → plan (shared by the renderer and the preview)       */
/* ================================================================== */

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareFS06(props: Record<string, unknown>, durationInFrames: number) {
  const S = FS06_SPEC.text;
  const O = FS06_SPEC.options;
  const A = (k: string) => readAnim(props, FS06_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(FS06_SPEC, props);
  const measure = measureFor(style);
  const iconA = readFirst(props, ['icon_a']);
  const iconB = readFirst(props, ['icon_b']);
  const input: CompareInput = {
    a: readNumber(props.value_a) ?? 0,
    b: readNumber(props.value_b) ?? 0,
    prefix: normaliseText(readFirst(props, ['prefix', 'currency']), S.prefix),
    unit: normaliseText(readFirst(props, ['unit', 'suffix']), S.unit),
    title: normaliseText(readFirst(props, ['title', 'heading']), S.title),
    labelA: normaliseText(readFirst(props, ['label_a']), S.label_a),
    labelB: normaliseText(readFirst(props, ['label_b']), S.label_b),
    context: normaliseText(readFirst(props, ['context', 'description']), S.context),
    changeLabel: normaliseText(readFirst(props, ['change_label']), S.change_label),
    format: opt(props, 'format', NUMBER_FORMATS, 'indian_compact'),
    decimals: opt(props, 'decimals', O.decimals.values, 'auto'),
    showChange: opt(props, 'show_change', O.show_change.values, 'auto'),
    layout: opt(props, 'layout', ['side_by_side', 'before_after', 'bars'] as const, 'side_by_side'),
    iconA: Boolean(iconA),
    iconB: Boolean(iconB),
  };
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const debug = props.show_safe_area === true;
  const L = layoutCompare(input, measure, sized.spec, sized.extra.values);
  const plan = planCompare(L, { title: A('title'), values: A('values'), labels: A('labels'), context: A('context') }, { a: input.iconA, b: input.iconB }, durationInFrames, readCues(props));
  const good = opt(props, 'good_direction', ['up', 'down'] as const, 'up');
  let highlight = opt(props, 'highlight', ['none', 'a', 'b', 'higher', 'lower'] as const, 'none') as string;
  if (highlight === 'higher') highlight = input.b >= input.a ? 'b' : 'a';
  if (highlight === 'lower') highlight = input.b <= input.a ? 'b' : 'a';
  return { style, sized, S, A, input, iconA, iconB, imageUrl, bg, debug, L, plan, good, highlight };
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */

function FS06NumberComparisonBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, S, A, input, iconA, iconB, imageUrl, bg, debug, L, plan, good, highlight } = prepareFS06(props, durationInFrames);
  const w = plan.windows;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const muted = mutedFor(style, onFootage);
  const card = cardColors(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const vAnim = A('values');

  const valueColor = (side: 'a' | 'b') => {
    if (highlight === side) return accent;
    if (highlight === 'none' && L.layout === 'before_after') return side === 'a' ? muted : style.colors.text;
    return style.colors.text;
  };

  const renderSide = (side: 'a' | 'b') => {
    const vw = w[side];
    const p = progress(frame, vw.start, vw.dur);
    const st = numberAnimState(vAnim, p);
    const target = side === 'a' ? input.a : input.b;
    const parts = side === 'a' ? L.partsA : L.partsB;
    const shown = st.counting && st.countP < 1 ? formatDigits(target * st.countP, L.scale, input.format, L.decimals) : parts.digits;
    const rowStyle: CSSProperties = st.counting
      ? { opacity: Math.min(1, p * 4), transform: `scale(${1 + 0.07 * st.pop})` }
      : lineStyle(vAnim === 'rise' ? 'fade_up' : vAnim, p);
    const icon = side === 'a' ? iconA : iconB;
    const iw = w[`icon_${side}`];
    const lw = w[`label_${side}`];
    const highlighted = highlight === side;
    const content = (
      <>
        {L.iconBox > 0 && (
          <div style={{ height: L.iconBox, marginBottom: ICON_GAP, display: 'flex', justifyContent: 'center' }}>
            {icon && iw && (
              <div
                {...leaf(`icon-${side}`, `icon_${side}`)}
                style={{
                  width: L.iconBox,
                  height: L.iconBox,
                  borderRadius: '50%',
                  background: style.colors.icon_bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...iconStyle(A('icons'), progress(frame, iw.start, iw.dur)),
                }}
              >
                <LucideIconView name={icon} size={Math.round(L.iconBox * 0.52)} color={style.colors.icon} />
              </div>
            )}
          </div>
        )}
        {L.layout === 'bars' && (
          <NumberRow
            parts={parts}
            shownDigits={shown}
            font={L.font}
            digitsW={side === 'a' ? L.digitsWA : L.digitsWB}
            color={valueColor(side)}
            accent={accent}
            shadow={shadow}
            group={`value-${side}`}
            inputs={{ value: `value_${side}` }}
            style={{ ...rowStyle, marginBottom: BAR_GAP }}
          />
        )}
        {L.layout === 'bars' ? (
          (() => {
            // the bar grows from the baseline and carries its number on top
            const bw = w[`bar_${side}`];
            const s2 = shapeState(A('connector'), progress(frame, bw.start, bw.dur));
            const h = L.barMaxH * (side === 'a' ? L.barA : L.barB);
            return (
              <div
                {...leaf(`bar-${side}`, `value_${side} (bar)`)}
                style={{
                  width: BAR_W,
                  height: Math.max(0, h * s2.length),
                  borderRadius: '14px 14px 4px 4px',
                  background: highlighted || (highlight === 'none' && side === 'b') ? accent : withAlpha(style.colors.text, 0.28),
                  ...s2.style,
                }}
              />
            );
          })()
        ) : (
          <NumberRow
            parts={parts}
            shownDigits={shown}
            font={L.font}
            digitsW={side === 'a' ? L.digitsWA : L.digitsWB}
            color={valueColor(side)}
            accent={accent}
            shadow={shadow}
            group={`value-${side}`}
            inputs={{ value: `value_${side}` }}
            style={rowStyle}
          />
        )}
        <AnimatedText
          lines={side === 'a' ? L.labelA : L.labelB}
          anim={A('labels')}
          start={lw.start}
          dur={lw.dur}
          frame={frame}
          weight={S.label_a.weight}
          lineHeight={S.label_a.lineHeight}
          color={highlighted ? style.colors.text : muted}
          shadow={shadow}
          align="center"
          group={`label-${side}`}
          input={`label_${side}`}
          style={{ marginTop: LABEL_GAP }}
        />
      </>
    );
    const cw = w[`card_${side}`];
    const cStyle = cardStyle(A('cards'), progress(frame, cw.start, cw.dur));
    if (L.layout === 'bars') {
      return (
        <div style={{ width: L.colW, height: L.cardH, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', ...cStyle }}>
          {content}
        </div>
      );
    }
    return (
      <div
        style={{
          width: L.colW,
          height: L.cardH,
          boxSizing: 'border-box',
          padding: CARD_PAD,
          borderRadius: 32,
          background: card.fill,
          border: `2px solid ${highlighted ? withAlpha(accent, 0.7) : card.border}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          ...cStyle,
        }}
      >
        {content}
      </div>
    );
  };

  const connector = () => {
    const cw = w.connector;
    if (!cw) return null;
    const st = shapeState(A('connector'), progress(frame, cw.start, cw.dur));
    if (L.layout === 'before_after') {
      const len = MID.before_after - 60;
      return (
        <div {...leaf('arrow', 'arrow (A → B)')} style={{ width: len, height: 40, position: 'relative', ...st.style }}>
          <div style={{ position: 'absolute', left: 0, top: 17, height: 6, width: (len - 26) * st.length, borderRadius: 3, background: accent }} />
          <div
            style={{
              position: 'absolute',
              left: (len - 30) * st.length,
              top: 4,
              width: 0,
              height: 0,
              borderTop: '16px solid transparent',
              borderBottom: '16px solid transparent',
              borderLeft: `28px solid ${accent}`,
              opacity: st.length > 0.05 ? 1 : 0,
            }}
          />
        </div>
      );
    }
    const size = 104;
    return (
      <div
        {...leaf('vs', 'VS badge')}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: accent,
          color: style.colors.on_accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: fontFor(800),
          fontWeight: 800,
          fontSize: 40,
          transform: `scale(${st.length})`,
          ...st.style,
        }}
      >
        VS
      </div>
    );
  };

  const dirColor = !L.change || L.change.dir === 'flat' ? muted : L.change.dir === good ? style.colors.positive : style.colors.negative;
  const dirIcon = !L.change ? 'arrow-right' : L.change.dir === 'up' ? 'trending-up' : L.change.dir === 'down' ? 'trending-down' : 'arrow-right';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground
        mode={bg}
        imageUrl={imageUrl}
        align="center"
        accent={accent}
        frame={frame}
        durationInFrames={durationInFrames}
        colors={style.colors}
        motion={A('image_motion')}
        entry={A('image_entry')}
      />

      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', ...exit }}>
          {L.heading.length > 0 && w.title && (
            <AnimatedText
              lines={L.heading}
              anim={A('title')}
              start={w.title.start}
              dur={w.title.dur}
              frame={frame}
              weight={S.title.weight}
              lineHeight={S.title.lineHeight}
              letterSpacing="-0.02em"
              shadow={shadow}
              align="center"
              group="title"
              input="title"
              style={{ marginBottom: HEADING_GAP }}
            />
          )}

          <div style={{ display: 'flex', alignItems: L.layout === 'bars' ? 'flex-end' : 'center', width: SAFE_W }}>
            {renderSide('a')}
            <div style={{ width: MID[L.layout], display: 'flex', justifyContent: 'center', alignItems: 'center', alignSelf: 'center' }}>{connector()}</div>
            {renderSide('b')}
          </div>

          {L.change && w.change && (
            <div
              style={{
                marginTop: CHANGE_GAP,
                height: L.changeH,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: `0 ${L.changeFont * 0.7}px 0 ${L.changeFont * 0.5}px`,
                borderRadius: 999,
                background: onFootage && !style.custom.has('card') ? card.fill : withAlpha(dirColor, 0.12),
                border: `1.5px solid ${withAlpha(dirColor, 0.4)}`,
                ...cardStyle(A('change'), progress(frame, w.change.start, w.change.dur)),
              }}
            >
              <div {...leaf('change-icon', 'difference (direction)')} style={{ display: 'flex' }}>
                <LucideIconView name={dirIcon} size={Math.round(L.changeFont * 1.1)} color={dirColor} />
              </div>
              <span {...leaf('change-value', 'difference (value_b − value_a)')} style={{ fontFamily: fontFor(700), fontSize: L.changeFont, fontWeight: 700, lineHeight: 1.2, color: dirColor, whiteSpace: 'nowrap' }}>
                {L.change.text}
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
              align="center"
              group="context"
              input="context"
              style={{ marginTop: CONTEXT_GAP }}
            />
          )}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const FS06NumberComparison = withAutoFit(FS06NumberComparisonBase);
