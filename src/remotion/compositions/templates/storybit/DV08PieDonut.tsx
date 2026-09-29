'use client';

/**
 * DV-08 · Pie / Donut Chart  (animation_type: "dv_pie_donut")
 * Share of a whole in 2–6 slices: the ring sweeps in clockwise, a legend lists each slice with its
 * share, one slice can be highlighted (it pops out), and a donut shows a big number in its centre.
 *
 * Inputs (full list, limits and JSON Schema: DV08PieDonut.inputs.json):
 *   title · slices[] { label, value, highlight } · center_label · prefix · unit · source · image_url
 *   chart · show · center · sort · highlight · format · decimals · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, chart, center value, source]
 * Timing: 3–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, words, type Line, type Measure } from './core/fit';
import { cardStyle, easeInOutCubic, easeOutBack, exitStyle, progress, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { FORMAT_HELP, NUMBER_FORMATS, readNumber, type NumberFormat } from './core/numbers';
import { arcPath, axisFormatter } from './core/chart';
import { numberAnimState } from './core/numberRow';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, mutedFor, readStyle, seriesColor, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, guide, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

/* ================================================================== */
/* Content spec                                                         */
/* ================================================================== */

export const DV08_SPEC: TemplateSpec = {
  id: 'DV-08',
  animationType: 'dv_pie_donut',
  name: 'Pie / Donut Chart',
  pickWhen: '"X% of…", market share, a budget split, or how a whole divides into 2–6 parts.',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 180, max: 240 },
  text: {
    title: {
      label: 'Heading',
      required: false,
      minChars: 3,
      maxChars: 50,
      minWords: 1,
      maxWords: 10,
      maxWordChars: 18,
      maxLines: 1,
      fontMax: 60,
      fontMin: 40,
      weight: 800,
      lineHeight: 1.04,
      hint: 'What the whole is: "Where each ₹100 of tax goes".',
      fills: 'Heading above the chart',
      example: 'UPI market share (illustrative)',
    },
    center_label: {
      label: 'Centre label',
      required: false,
      minChars: 2,
      maxChars: 24,
      minWords: 1,
      maxWords: 5,
      maxWordChars: 14,
      maxLines: 2,
      fontMax: 30,
      fontMin: 18,
      weight: 600,
      lineHeight: 1.2,
      hint: 'Words under the centre number: "of all payments".',
      fills: 'Text under the number in the donut centre',
      example: 'of all UPI payments',
    },
    prefix: { label: 'Prefix', required: false, minChars: 1, maxChars: 3, minWords: 1, maxWords: 1, maxWordChars: 3, maxLines: 1, fontMax: 40, fontMin: 16, weight: 700, lineHeight: 1, fills: 'Symbol before raw values', noSize: true },
    unit: { label: 'Unit', required: false, minChars: 1, maxChars: 8, minWords: 1, maxWords: 1, maxWordChars: 8, maxLines: 1, fontMax: 40, fontMin: 16, weight: 700, lineHeight: 1, fills: 'Unit after raw values', noSize: true },
    source: {
      label: 'Source',
      required: false,
      minChars: 3,
      maxChars: 60,
      minWords: 1,
      maxWords: 10,
      maxWordChars: 18,
      maxLines: 1,
      fontMax: 24,
      fontMin: 18,
      weight: 500,
      lineHeight: 1.25,
      hint: '"Source: NPCI, March 2025".',
      fills: 'Source line under the chart',
    },
  },
  lists: {
    slices: {
      label: 'Slice',
      fills: 'Parts of the whole, clockwise from 12 o\'clock (unless sorted)',
      minItems: 2,
      maxItems: 6,
      fields: {
        label: {
          label: 'Label',
          required: true,
          minChars: 1,
          maxChars: 24,
          minWords: 1,
          maxWords: 4,
          maxWordChars: 14,
          maxLines: 2,
          fontMax: 40,
          fontMin: 24,
          weight: 600,
          lineHeight: 1.2,
          hint: 'Part name: "PhonePe", "Defence".',
          fills: 'Legend label',
        },
      },
      numbers: {
        value: { label: 'Value', required: true, fills: 'Raw value of the slice (shares are computed from the total)', min: 0 },
        highlight: { label: 'Highlight', required: false, fills: '1 = pop this slice out and show it in the centre', min: 0, max: 1, integer: true },
      },
    },
  },
  options: {
    chart: { label: 'Chart', values: ['donut', 'pie'], default: 'donut', fills: 'Ring with a centre number, or a full pie' },
    show: { label: 'Legend values', values: ['percent', 'value', 'both'], default: 'percent', fills: 'Share of the total, the raw value, or both' },
    center: { label: 'Centre number', values: ['auto', 'highlight', 'total', 'none'], default: 'auto', fills: 'Donut centre: auto = highlighted (or largest) slice %, total = sum of values' },
    sort: { label: 'Sort', values: ['none', 'desc'], default: 'none', fills: 'Keep the given order or largest first' },
    highlight: { label: 'Highlight', values: ['none', 'max', 'min'], default: 'none', fills: 'Slice that pops out (slices[].highlight = 1 also works)' },
    format: { label: 'Number format', values: [...NUMBER_FORMATS], default: 'indian_compact', fills: FORMAT_HELP },
    decimals: { label: 'Decimals', values: ['auto', '0', '1', '2'], default: 'auto', fills: 'Decimal places for raw values' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    slices: { label: 'Slices', kind: 'shape', target: 'ring / pie sweeping in clockwise', default: 'grow' },
    legend: { label: 'Legend rows', kind: 'card', target: 'each legend row', default: 'slide_left' },
    highlight: { label: 'Highlight pop', kind: 'shape', target: 'highlighted slice moving out', default: 'pop' },
    center: { label: 'Centre number', kind: 'number', target: 'number in the donut centre', default: 'count_up' },
    source: { label: 'Source', kind: 'text', target: 'source line', default: 'fade' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: {
    description: 'heading → chart starts sweeping → centre number → source. Missing elements are skipped.',
    units: ['heading', 'chart', 'centre number', 'source'],
  },
  colors: ['series_2', 'series_3', 'series_4', 'series_5', 'series_6'],
  sizes: { center: { label: 'Centre number', min: 48, max: 140, fills: 'Number in the donut centre' } },
  example: {
    title: 'UPI market share (illustrative)',
    slices: [
      { label: 'PhonePe', value: 47, highlight: 1 },
      { label: 'Google Pay', value: 36 },
      { label: 'Paytm', value: 7 },
      { label: 'Others', value: 10 },
    ],
    center_label: 'of all UPI payments',
    chart: 'donut',
    show: 'percent',
    source: 'Source: illustrative figures',
    background: 'theme',
  },
};

/* ================================================================== */
/* Layout                                                               */
/* ================================================================== */

export type Slice = { label: string; value: number; highlight: boolean };
export const HEADING_GAP = 36;
export const SOURCE_GAP = 22;
export const CHART_GAP = 90;
export const POP = 22;
export const SWATCH = 28;
export const ROW_GAP = 22;

export type PieLayout = {
  heading: Line[];
  source: Line[];
  area: { top: number; height: number };
  D: number;
  R: number;
  inner: number;
  angles: { a0: number; a1: number }[];
  percents: string[];
  valueTexts: string[];
  groupX: number;
  legendX: number;
  legendW: number;
  labels: Line[][];
  valueFont: number;
  valueW: number;
  rowH: number[];
  centerText: string;
  centerTarget: number;
  centerPct: boolean;
  centerFont: number;
  centerLabel: Line[];
  blockH: number;
};

/** Whole-number percentages that add up to exactly 100 (largest remainder). */
function roundShares(values: number[], d: number): number[] {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const m = 10 ** d;
  const raw = values.map((v) => (v / total) * 100 * m);
  const floor = raw.map(Math.floor);
  let rest = 100 * m - floor.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) if (rest-- > 0) floor[i] += 1;
  return floor.map((x) => x / m);
}

export function layoutPie(
  input: { title: string; source: string; slices: Slice[]; chart: 'donut' | 'pie'; show: string; center: string; centerLabel: string; prefix: string; unit: string; format: NumberFormat; decimals: string },
  measure: Measure,
  spec: TemplateSpec = DV08_SPEC,
  centerMax = 140,
): PieLayout {
  const T = spec.text;
  const F = spec.lists.slices.fields;
  const heading = input.title ? fitText(input.title, T.title, SAFE_W, measure, false).lines : [];
  const headingH = heading.length ? blockHeight(heading, T.title.lineHeight) + HEADING_GAP : 0;
  const source = input.source ? fitText(input.source, T.source, SAFE_W, measure, false).lines : [];
  const sourceH = source.length ? SOURCE_GAP + blockHeight(source, T.source.lineHeight) : 0;
  const area = { top: headingH, height: SAFE_H - headingH - sourceH };
  const D = Math.min(640, area.height);
  const R = D / 2 - POP;
  const inner = input.chart === 'donut' ? R * 0.6 : 0;

  const vals = input.slices.map((s) => Math.max(0, s.value));
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const pd = vals.some((v) => v > 0 && (v / total) * 100 < 1) ? 1 : 0;
  const shares = roundShares(vals, pd);
  let acc = 0;
  const angles = vals.map((v) => {
    const a0 = (acc / total) * Math.PI * 2;
    acc += v;
    return { a0, a1: (acc / total) * Math.PI * 2 };
  });
  const f = axisFormatter(vals, input.format, input.decimals, input.prefix, input.unit);
  const percents = shares.map((s) => `${s.toFixed(pd)}%`);
  const valueTexts = vals.map((v, i) => (input.show === 'value' ? f.fmt(v) : input.show === 'both' ? `${percents[i]} · ${f.fmt(v)}` : percents[i]));

  // chart + legend form one group, centred in the safe box; the legend is capped so values stay near their labels
  const legendW = Math.min(820, SAFE_W - D - CHART_GAP);
  const groupX = (SAFE_W - (D + CHART_GAP + legendW)) / 2;
  const legendX = groupX + D + CHART_GAP;
  let labelCap = F.label.fontMax;
  const build = () => {
    // value column never takes more than half the legend width
    let valueFont = Math.min(labelCap + 4, 48);
    const widest = () => Math.max(...valueTexts.map((t) => measure(t, valueFont, 800)));
    while (valueFont > 18 && widest() + 12 > legendW * 0.5) valueFont -= 2;
    if (widest() + 12 > legendW * 0.5) valueFont = Math.floor((valueFont * (legendW * 0.5 - 12)) / widest());
    const valueW = Math.ceil(widest()) + 12;
    const textW = legendW - SWATCH - 18 - valueW - 24;
    const lf = sharedFont(input.slices.map((s) => s.label), F.label, textW, measure, labelCap);
    const labels = input.slices.map((s) => linesAt(s.label, lf, F.label, textW, measure));
    const rowH = labels.map((l) => Math.max(blockHeight(l, F.label.lineHeight), valueFont * 1.2));
    const h = rowH.reduce((a, b) => a + b, 0) + ROW_GAP * (rowH.length - 1);
    return { valueFont, valueW, labels, rowH, h };
  };
  let b = build();
  while (b.h > area.height && labelCap > F.label.fontMin) {
    labelCap -= 2;
    b = build();
  }

  // centre (donut only)
  const hi = input.slices.findIndex((s) => s.highlight);
  const largest = vals.indexOf(Math.max(...vals));
  let centerText = '';
  let centerTarget = 0;
  let centerPct = true;
  if (input.chart === 'donut' && input.center !== 'none') {
    if (input.center === 'total') {
      centerText = f.fmt(total);
      centerTarget = total;
      centerPct = false;
    } else {
      const i = hi >= 0 ? hi : input.center === 'highlight' ? -1 : largest;
      if (i >= 0) {
        centerText = percents[i];
        centerTarget = shares[i];
      }
    }
  }
  const holeW = inner * 2 * 0.78;
  let centerFont = 0;
  if (centerText) {
    centerFont = centerMax;
    while (centerFont > 36 && measure(centerText, centerFont, 800, { tabular: true }) > holeW) centerFont -= 4;
    const wNow = measure(centerText, centerFont, 800, { tabular: true });
    if (wNow > holeW) centerFont = Math.floor((centerFont * holeW) / wNow);
  }
  const centerLabel = centerText && input.centerLabel ? fitText(input.centerLabel, T.center_label, holeW, measure, true).lines : [];
  // keep number + label inside the hole
  while (centerFont > 24 && centerFont * 1.05 + blockHeight(centerLabel, T.center_label.lineHeight) > inner * 2 * 0.78) centerFont -= 4;

  return {
    heading,
    source,
    area,
    D,
    R,
    inner,
    angles,
    percents,
    valueTexts,
    groupX,
    legendX,
    legendW,
    labels: b.labels,
    valueFont: b.valueFont,
    valueW: b.valueW,
    rowH: b.rowH,
    centerText,
    centerTarget,
    centerPct,
    centerFont,
    centerLabel,
    blockH: SAFE_H,
  };
}

/* ================================================================== */
/* Timing                                                               */
/* ================================================================== */

export const SWEEP = 42;

export function planPie(L: PieLayout, anims: { title: string; source: string }, hasHighlight: boolean, duration: number, cueTimes?: number[]): Plan {
  const T = (lines: Line[]) => lines.map((l) => l.text).join(' ');
  const units: Unit[] = [];
  let cue = 0;
  if (L.heading.length) {
    const h = T(L.heading);
    units.push({ key: 'title', label: 'Heading', start: 2, dur: textAnimFrames(anims.title, words(h).length, h.length, 18), cue: cue++ });
  }
  const first = L.heading.length ? 18 : 6;
  units.push({ key: 'slices', label: 'Slices', start: first, dur: SWEEP, cue: cue++ });
  if (L.centerText) units.push({ key: 'center', label: 'Centre number', start: first + SWEEP - 6, dur: 30, cue: cue++ });
  if (L.source.length) {
    const s = T(L.source);
    units.push({ key: 'source', label: 'Source', start: first + SWEEP + 6, dur: textAnimFrames(anims.source, words(s).length, s.length, 14), cue: cue++ });
  }
  L.angles.forEach((a, i) => {
    const off = Math.round((a.a0 / (Math.PI * 2)) * SWEEP);
    units.push({ key: `row${i}`, label: `Legend row ${i + 1}`, start: first + off, dur: 14, follows: { key: 'slices', offset: off } });
  });
  if (hasHighlight) units.push({ key: 'pop', label: 'Highlight pop', start: first + SWEEP, dur: 14, follows: { key: 'slices', offset: SWEEP } });
  return planTimeline(duration, units, cueTimes);
}

/* ================================================================== */
/* Props → layout → plan (shared by the renderer and the preview)       */
/* ================================================================== */

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareDV08(props: Record<string, unknown>, durationInFrames: number) {
  const S = DV08_SPEC.text;
  const SL = DV08_SPEC.lists.slices;
  const A = (k: string) => readAnim(props, DV08_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DV08_SPEC, props);
  const measure = measureFor(style);
  let slices: Slice[] = (Array.isArray(props.slices) ? props.slices : [])
    .map((s): Slice | null => {
      const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
      const label = typeof o.label === 'string' ? o.label : typeof o.name === 'string' ? o.name : '';
      const value = readNumber(o.value);
      return label && value !== undefined && value >= 0 ? { label: normaliseText(label, SL.fields.label), value, highlight: o.highlight === 1 || o.highlight === true } : null;
    })
    .filter((s): s is Slice => s !== null && Boolean(s.label))
    .slice(0, SL.maxItems);
  if (opt(props, 'sort', ['none', 'desc'] as const, 'none') === 'desc') slices = [...slices].sort((a, b) => b.value - a.value);
  const hl = opt(props, 'highlight', ['none', 'max', 'min'] as const, 'none');
  if (hl !== 'none' && slices.length && !slices.some((s) => s.highlight)) {
    const idx = slices.reduce((bi, s, i) => ((hl === 'max' ? s.value > slices[bi].value : s.value < slices[bi].value) ? i : bi), 0);
    slices = slices.map((s, i) => ({ ...s, highlight: i === idx }));
  }
  // only one slice pops out
  const firstHi = slices.findIndex((s) => s.highlight);
  slices = slices.map((s, i) => ({ ...s, highlight: i === firstHi }));
  const input = {
    title: normaliseText(readFirst(props, ['title', 'heading']), S.title),
    source: normaliseText(readFirst(props, ['source']), S.source),
    slices,
    chart: opt(props, 'chart', ['donut', 'pie'] as const, 'donut'),
    show: opt(props, 'show', ['percent', 'value', 'both'] as const, 'percent'),
    center: opt(props, 'center', ['auto', 'highlight', 'total', 'none'] as const, 'auto'),
    centerLabel: normaliseText(readFirst(props, ['center_label']), S.center_label),
    prefix: normaliseText(readFirst(props, ['prefix']), S.prefix),
    unit: normaliseText(readFirst(props, ['unit']), S.unit),
    format: opt(props, 'format', NUMBER_FORMATS, 'indian_compact'),
    decimals: opt(props, 'decimals', ['auto', '0', '1', '2'] as const, 'auto'),
  };
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const debug = props.show_safe_area === true;
  const L = layoutPie(input, measure, sized.spec, sized.extra.center);
  const plan = planPie(L, { title: A('title'), source: A('source') }, firstHi >= 0, durationInFrames, readCues(props));
  return { style, sized, A, input, imageUrl, bg, debug, L, plan };
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */

function DV08PieDonutBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, input, imageUrl, bg, debug, L, plan } = prepareDV08(props, durationInFrames);
  const w = plan.windows;
  const S = DV08_SPEC.text;
  const F = DV08_SPEC.lists.slices.fields;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const muted = mutedFor(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const anyHi = input.slices.some((s) => s.highlight);
  const colorOf = (i: number) => (anyHi && !input.slices[i].highlight ? withAlpha(seriesColor(style.colors, i), 0.45) : seriesColor(style.colors, i));

  const sw = w.slices;
  const sAnim = A('slices');
  const sp = progress(frame, sw.start, sw.dur);
  const sweepTo = sAnim === 'grow' ? easeInOutCubic(sp) * Math.PI * 2 : Math.PI * 2;
  const sliceOpacity = sAnim === 'fade' ? sp : sAnim === 'none' ? (sp > 0 ? 1 : 0) : sAnim === 'pop' ? Math.min(1, sp * 2) : 1;
  const sliceScale = sAnim === 'pop' ? Math.max(0, easeOutBack(sp)) : 1;
  const popP = w.pop ? (A('highlight') === 'none' ? (frame >= w.pop.start ? 1 : 0) : A('highlight') === 'fade' ? progress(frame, w.pop.start, w.pop.dur) : easeOutBack(progress(frame, w.pop.start, w.pop.dur))) : 0;

  const cx = L.D / 2;
  const cy = L.D / 2;
  const chartTop = L.area.top + (L.area.height - L.D) / 2;
  const legendH = L.rowH.reduce((a, b) => a + b, 0) + ROW_GAP * (L.rowH.length - 1);
  const legendTop = L.area.top + (L.area.height - legendH) / 2;

  const center = () => {
    if (!L.centerText || !w.center) return null;
    const p = progress(frame, w.center.start, w.center.dur);
    const st = numberAnimState(A('center'), p);
    const shown = st.counting && st.countP < 1 && L.centerPct ? `${(L.centerTarget * st.countP).toFixed(L.centerText.includes('.') ? 1 : 0)}%` : L.centerText;
    return (
      <div style={{ position: 'absolute', left: 0, top: 0, width: L.D, height: L.D, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: Math.min(1, p * 4), transform: `scale(${1 + 0.06 * st.pop})` }}>
        <span {...leaf('center', 'centre number (from slices)')} style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: L.centerFont, lineHeight: 1.05, color: style.colors.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', textShadow: shadow }}>
          {shown}
        </span>
        {L.centerLabel.length > 0 && (
          <AnimatedText lines={L.centerLabel} anim="fade" start={w.center.start} dur={12} frame={frame} weight={S.center_label.weight} lineHeight={S.center_label.lineHeight} color={muted} shadow={shadow} align="center" group="center-label" input="center_label" />
        )}
      </div>
    );
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.heading.length > 0 && w.title && (
            <AnimatedText lines={L.heading} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={S.title.weight} lineHeight={S.title.lineHeight} letterSpacing="-0.02em" shadow={shadow} group="title" input="title" />
          )}

          <div style={{ position: 'absolute', left: L.groupX, top: chartTop, width: L.D, height: L.D }}>
            <svg {...guide('chart', 'slices[].value')} width={L.D} height={L.D} style={{ position: 'absolute', left: 0, top: 0, opacity: sliceOpacity, transform: `scale(${sliceScale})` }}>
              {L.angles.map((a, i) => {
                const a1 = Math.min(a.a1, sweepTo);
                if (a1 <= a.a0) return null;
                const mid = (a.a0 + a.a1) / 2;
                const off = input.slices[i].highlight ? POP * popP : 0;
                const gap = L.angles.length > 1 ? 0.012 : 0;
                return (
                  <path
                    key={i}
                    d={arcPath(cx + off * Math.sin(mid), cy - off * Math.cos(mid), L.R, L.inner, a.a0 + gap, Math.max(a.a0 + gap, a1 - gap))}
                    fill={colorOf(i)}
                  />
                );
              })}
            </svg>
            {center()}
          </div>

          {input.slices.map((s, i) => {
            const rw = w[`row${i}`];
            const top = legendTop + L.rowH.slice(0, i).reduce((a, b) => a + b, 0) + ROW_GAP * i;
            return (
              <div key={i} style={{ position: 'absolute', left: L.legendX, top, width: L.legendW, height: L.rowH[i], display: 'flex', alignItems: 'center', gap: 18, ...cardStyle(A('legend'), progress(frame, rw.start, rw.dur)) }}>
                <div {...leaf(`swatch-${i}`, `slices[${i}] colour`)} style={{ width: SWATCH, height: SWATCH, borderRadius: 8, background: colorOf(i), flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <AnimatedText lines={L.labels[i]} anim="none" start={rw.start} dur={1} frame={frame} weight={F.label.weight} lineHeight={F.label.lineHeight} color={s.highlight || !anyHi ? style.colors.text : muted} shadow={shadow} group={`label-${i}`} input={`slices[${i}].label`} />
                </div>
                <span {...leaf(`value-${i}`, `slices[${i}].value`)} style={{ width: L.valueW, textAlign: 'right', fontFamily: fontFor(800), fontWeight: 800, fontSize: L.valueFont, lineHeight: 1.2, color: s.highlight ? accent : style.colors.text, whiteSpace: 'nowrap', textShadow: shadow }}>
                  {L.valueTexts[i]}
                </span>
              </div>
            );
          })}

          {L.source.length > 0 && w.source && (
            <AnimatedText lines={L.source} anim={A('source')} start={w.source.start} dur={w.source.dur} frame={frame} weight={S.source.weight} lineHeight={S.source.lineHeight} color={withAlpha(style.colors.muted, 0.85)} shadow={shadow} group="source" input="source" style={{ position: 'absolute', left: 0, bottom: 0 }} />
          )}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const DV08PieDonut = withAutoFit(DV08PieDonutBase);
