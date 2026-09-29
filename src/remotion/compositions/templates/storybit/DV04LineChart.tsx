'use client';

/**
 * DV-04 · Line Chart  (animation_type: "dv_line_chart")
 * 1–4 series over 4–40 points: lines draw left to right, optional area fill, value at each line's
 * end, up to 3 annotations (peak, crash, event), an optional reference line and a source line.
 * `transform` can index every series to 100 at the first point, or show running totals.
 *
 * Inputs (full list, limits and JSON Schema: DV04LineChart.inputs.json):
 *   title · x_labels[] · series[] { name, values[] } · annotations[] { at, text } · prefix · unit
 *   reference_value · reference_label · source · image_url
 *   transform · area · show_points · end_labels · format · decimals · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, lines, annotation 1–3, reference, source]
 * Timing: 3–8s from clock.durationInFrames.
 */
import { useId } from 'react';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type Issue, type TemplateSpec, type TextSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, words, type Line, type Measure } from './core/fit';
import { cardStyle, easeInOutCubic, exitStyle, iconStyle, progress, shapeState, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { FORMAT_HELP, NUMBER_FORMATS, readNumber, type NumberFormat } from './core/numbers';
import { axisFormatter, valueAxis } from './core/chart';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, mutedFor, readStyle, seriesColor, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, guide, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

/* ================================================================== */
/* Content spec                                                         */
/* ================================================================== */

const SMALL = (label: string, fills: string, maxChars: number, maxWords: number): TextSpec => ({
  label,
  required: false,
  minChars: 1,
  maxChars,
  minWords: 1,
  maxWords,
  maxWordChars: 14,
  maxLines: 1,
  fontMax: 26,
  fontMin: 16,
  weight: 600,
  lineHeight: 1.2,
  fills,
});

export const DV04_SPEC: TemplateSpec = {
  id: 'DV-04',
  animationType: 'dv_line_chart',
  name: 'Line Chart',
  pickWhen: 'A trend over time: growth, a crash, a peak, a recovery, or 2–4 things changing over the same years.',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 180, max: 240 },
  text: {
    title: { ...SMALL('Heading', 'Heading above the chart', 50, 10), required: false, minChars: 3, maxWordChars: 18, fontMax: 60, fontMin: 40, weight: 800, lineHeight: 1.04, hint: 'What is measured: "Petrol price in Delhi (₹/litre)".', example: 'Sensex, 2019–2025 (illustrative)' },
    prefix: { ...SMALL('Prefix', 'Symbol before every value', 3, 1), maxWordChars: 3, weight: 800, noSize: true, hint: '₹, $.' },
    unit: { ...SMALL('Unit', 'Unit after every value', 8, 1), maxWordChars: 8, weight: 800, noSize: true, hint: '%, /litre, pts.' },
    reference_label: { ...SMALL('Reference label', 'Label on the reference line', 24, 4), minChars: 2, hint: '"Pre-covid level", "Target".' },
    source: { ...SMALL('Source', 'Source line under the chart', 60, 10), minChars: 3, maxWordChars: 18, fontMax: 24, fontMin: 18, weight: 500, lineHeight: 1.25, hint: '"Source: RBI, 2025".' },
    axis_labels: { ...SMALL('Axis labels', 'Year / month labels and value labels on the axes', 12, 3), noSize: false, fontMax: 26, fontMin: 16, weight: 500 },
  },
  numbers: {
    reference_value: { label: 'Reference value', required: false, fills: 'Dashed line across the chart at this value' },
  },
  lists: {},
  custom: {
    inputs: [
      { path: 'x_labels[]', type: 'array', required: true, fills: 'Labels along the bottom, left to right (years, months)', limits: '4–40 labels · 1–12 chars each' },
      { path: 'series[]', type: 'list', required: true, fills: 'Lines on the chart (first line uses the accent colour)', limits: '1–4 series' },
      { path: 'series[].name', type: 'text', required: false, fills: 'Series name in the legend (needed when there are 2+ series)', limits: '1–20 chars · 1–4 words' },
      { path: 'series[].values[]', type: 'array', required: true, fills: 'One raw number per x label (null for a gap)', limits: 'same length as x_labels' },
      { path: 'annotations[]', type: 'list', required: false, fills: 'Callouts on points (peak, crash, event)', limits: '0–3 items' },
      { path: 'annotations[].at', type: 'text', required: true, fills: 'Which point: an x label ("2020") or its 0-based index', limits: 'x label or integer' },
      { path: 'annotations[].text', type: 'text', required: true, fills: 'Callout text', limits: '2–25 chars · 1–5 words' },
      { path: 'annotations[].series', type: 'number', required: false, fills: 'Which series the point is on (1–4, default 1)', limits: 'integer 1–4' },
    ],
    schema: {
      x_labels: { type: 'array', minItems: 4, maxItems: 40, items: { type: 'string', minLength: 1, maxLength: 12 }, description: 'Labels along the bottom, left to right.' },
      series: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        description: 'Lines. values must have one number per x label (null for a gap).',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['values'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 20, description: 'Legend name (needed with 2+ series).' },
            values: { type: 'array', minItems: 4, maxItems: 40, items: { type: ['number', 'null'] }, description: 'Raw numbers, same length as x_labels.' },
          },
        },
      },
      annotations: {
        type: 'array',
        maxItems: 3,
        description: 'Callouts on points.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['at', 'text'],
          properties: {
            at: { type: ['string', 'integer'], description: 'x label or 0-based index of the point.' },
            text: { type: 'string', minLength: 2, maxLength: 25, description: 'Callout text, 1–5 words.' },
            series: { type: 'integer', minimum: 1, maximum: 4, description: 'Series number (default 1).' },
          },
        },
      },
    },
    required: ['x_labels', 'series'],
  },
  options: {
    transform: { label: 'Transform', values: ['none', 'indexed', 'cumulative'], default: 'none', fills: 'none · indexed (every series = 100 at the first point, to compare growth) · cumulative (running total)' },
    area: { label: 'Area fill', values: ['auto', 'on', 'off'], default: 'auto', fills: 'Shade under the line (auto = on for a single series)' },
    show_points: { label: 'Points', values: ['auto', 'on', 'off'], default: 'auto', fills: 'Dots on each point (auto = on up to 12 points)' },
    end_labels: { label: 'End labels', values: ['on', 'off'], default: 'on', fills: 'Value at the end of each line' },
    format: { label: 'Number format', values: [...NUMBER_FORMATS], default: 'indian_compact', fills: FORMAT_HELP },
    decimals: { label: 'Decimals', values: ['auto', '0', '1', '2'], default: 'auto', fills: 'Decimal places shown' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    grid: { label: 'Grid and axes', kind: 'shape', target: 'grid lines and axis labels', default: 'fade' },
    lines: { label: 'Lines', kind: 'shape', target: 'each line (draws left to right)', default: 'grow' },
    points: { label: 'Points', kind: 'icon', target: 'dots on the line', default: 'pop' },
    end_labels: { label: 'End labels', kind: 'card', target: 'value at the end of each line', default: 'slide_left' },
    annotations: { label: 'Annotations', kind: 'card', target: 'callouts on points', default: 'pop' },
    reference: { label: 'Reference line', kind: 'shape', target: 'dashed reference line', default: 'grow' },
    source: { label: 'Source', kind: 'text', target: 'source line', default: 'fade' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: {
    description: 'heading (skipped if absent) → lines start drawing → annotation 1 → annotation 2 → annotation 3 → reference line → source. Annotation slots are fixed: send null for an annotation you do not have.',
    units: ['heading', 'lines', 'annotation 1', 'annotation 2', 'annotation 3', 'reference line', 'source'],
  },
  colors: ['series_2', 'series_3', 'series_4'],
  validate: (props) => {
    const issues: Issue[] = [];
    const n = Array.isArray(props.x_labels) ? props.x_labels.length : 0;
    if (n < 4) issues.push({ field: 'x_labels', level: 'error', message: `x_labels needs 4–40 labels (got ${n})` });
    const series = Array.isArray(props.series) ? (props.series as Record<string, unknown>[]) : [];
    if (!series.length) issues.push({ field: 'series', level: 'error', message: 'At least one series is required' });
    series.forEach((s, i) => {
      const len = Array.isArray(s?.values) ? (s.values as unknown[]).length : 0;
      if (len !== n) issues.push({ field: `series[${i}].values`, level: 'warning', message: `Series ${i + 1} has ${len} values for ${n} labels — extra values are dropped, missing ones are gaps` });
      if (series.length > 1 && !(typeof s?.name === 'string' && s.name.trim())) issues.push({ field: `series[${i}].name`, level: 'warning', message: `Series ${i + 1} has no name for the legend` });
    });
    return issues;
  },
  example: {
    title: 'Monthly UPI transactions (billion, illustrative)',
    x_labels: ['2019', '2020', '2021', '2022', '2023', '2024', '2025'],
    series: [{ name: 'UPI', values: [0.8, 1.3, 3.2, 6.6, 10.2, 14.4, 18.4] }],
    annotations: [{ at: '2020', text: 'Lockdown boost' }],
    format: 'plain',
    area: 'auto',
    source: 'Source: illustrative figures',
    background: 'theme',
  },
};

/* ================================================================== */
/* Layout                                                               */
/* ================================================================== */

export type Series = { name: string; values: (number | null)[] };
export type Annotation = { index: number; series: number; text: string };

export const HEADING_GAP = 32;
export const LEGEND_GAP = 28;
export const SOURCE_GAP = 22;
export const X_LABEL_GAP = 14;
export const Y_LABEL_GAP = 16;
export const END_GAP = 14;

export type Placed = { x: number; y: number; w: number; h: number };

export type LineLayout = {
  heading: Line[];
  legend: { text: Line; x: number; w: number }[];
  legendH: number;
  source: Line[];
  axisFont: number;
  plot: { left: number; top: number; width: number; height: number };
  yTicks: { v: number; y: number; label: string }[];
  xLabels: { i: number; x: number; text: string; left: number; w: number }[];
  xFont: number;
  points: { x: number; y: number | null }[][];
  endLabels: { series: number; text: string; y: number; x: number; w: number }[];
  endFont: number;
  annotations: (Annotation & { box: Placed; px: number; py: number; font: number; line: Line })[];
  refY?: number;
  refLabel: Line[];
  toY: (v: number) => number;
  blockH: number;
};

export function layoutLine(
  input: { title: string; source: string; x: string[]; series: Series[]; annotations: Annotation[]; prefix: string; unit: string; format: NumberFormat; decimals: string; endLabels: boolean; reference?: number; refLabel: string },
  measure: Measure,
  spec: TemplateSpec = DV04_SPEC,
): LineLayout {
  const T = spec.text;
  const heading = input.title ? fitText(input.title, T.title, SAFE_W, measure, false).lines : [];
  const headingH = heading.length ? blockHeight(heading, T.title.lineHeight) + HEADING_GAP : 0;
  const source = input.source ? fitText(input.source, T.source, SAFE_W, measure, false).lines : [];
  const sourceH = source.length ? SOURCE_GAP + blockHeight(source, T.source.lineHeight) : 0;
  const axisFont = T.axis_labels.fontMax;

  // legend (2+ series): one row of swatch + name
  let legend: LineLayout['legend'] = [];
  let legendH = 0;
  if (input.series.length > 1) {
    const lf = sharedFont(input.series.map((s) => s.name || 'Series'), { ...T.axis_labels, maxLines: 1 }, 380, measure);
    let x = 0;
    legend = input.series.map((s) => {
      const text = linesAt(s.name || 'Series', lf, { ...T.axis_labels, maxLines: 1 }, 380, measure, false)[0];
      const w = 32 + measure(text.text, text.size, 600);
      const item = { text, x, w };
      x += w + 36;
      return item;
    });
    legendH = Math.round(lf * 1.3) + LEGEND_GAP;
  }

  const all = input.series.flatMap((s) => s.values).filter((v): v is number => v !== null && Number.isFinite(v));
  const withRef = input.reference !== undefined ? [...all, input.reference] : all;
  const ax = valueAxis(withRef.length ? withRef : [0, 1], 4);
  const f = axisFormatter([...withRef, ax.max, ax.min], input.format, input.decimals, input.prefix, input.unit);
  const tickLabels = ax.ticks.map((v) => f.fmt(v));
  const yLabelW = Math.ceil(Math.max(...tickLabels.map((t) => measure(t, axisFont * 0.9, 500)))) + Y_LABEL_GAP;

  const endFont = Math.round(axisFont * 1.15);
  const lastVals = input.series.map((s) => [...s.values].reverse().find((v) => v !== null && Number.isFinite(v)) as number | undefined);
  const endTexts = lastVals.map((v) => (v === undefined ? '' : f.fmt(v)));
  const endW = input.endLabels ? Math.ceil(Math.max(0, ...endTexts.map((t) => measure(t, endFont, 800)))) + END_GAP + 8 : 24;

  const n = input.x.length;
  const xl = sharedFont(input.x, { ...T.axis_labels, maxLines: 1 }, 220, measure);
  const xLabelH = Math.round(xl * 1.25);
  const top = headingH + legendH;
  const plot = { left: yLabelW, top, width: SAFE_W - yLabelW - endW, height: SAFE_H - top - sourceH - xLabelH - X_LABEL_GAP };
  const toY = (v: number) => plot.top + plot.height * (1 - (v - ax.min) / (ax.max - ax.min || 1));
  const toX = (i: number) => plot.left + (n > 1 ? (i * plot.width) / (n - 1) : plot.width / 2);

  // x labels: show every k-th so they never touch; always show the last
  const maxW = Math.max(...input.x.map((t) => measure(t, xl, 500))) + 16;
  const k = Math.max(1, Math.ceil((maxW * (n - 1)) / Math.max(1, plot.width)));
  const place = (i: number) => {
    const tw = Math.ceil(measure(input.x[i], xl, 500));
    // centred under the point, but never past the plot's left edge or the safe box's right edge
    return { i, x: toX(i), text: input.x[i], w: tw, left: Math.max(plot.left, Math.min(SAFE_W - tw, toX(i) - tw / 2)) };
  };
  const xLabels: LineLayout['xLabels'] = [];
  for (let i = 0; i < n; i += k) {
    const c = place(i);
    const prev = xLabels[xLabels.length - 1];
    if (!prev || c.left >= prev.left + prev.w + 16) xLabels.push(c);
  }
  if (xLabels[xLabels.length - 1]?.i !== n - 1) {
    const last = place(n - 1);
    while (xLabels.length && xLabels[xLabels.length - 1].left + xLabels[xLabels.length - 1].w + 16 > last.left) xLabels.pop();
    xLabels.push(last);
  }

  const points = input.series.map((s) => s.values.map((v, i) => ({ x: toX(i), y: v !== null && Number.isFinite(v) ? toY(v) : null })));

  // end labels: at each line's last value, pushed apart so they never overlap
  const lh = endFont * 1.25;
  let endLabels = input.endLabels
    ? input.series
        .map((_, si) => {
          const pts = points[si].filter((p) => p.y !== null);
          const last = pts[pts.length - 1];
          return last ? { series: si, text: endTexts[si], y: (last.y as number) - lh / 2, x: plot.left + plot.width + END_GAP, w: endW - END_GAP } : null;
        })
        .filter((e): e is NonNullable<typeof e> => e !== null)
    : [];
  endLabels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i++) if (endLabels[i].y < endLabels[i - 1].y + lh) endLabels[i].y = endLabels[i - 1].y + lh;
  const overflow = endLabels.length ? endLabels[endLabels.length - 1].y + lh - (plot.top + plot.height) : 0;
  if (overflow > 0) endLabels = endLabels.map((e) => ({ ...e, y: e.y - overflow }));
  endLabels = endLabels.map((e) => ({ ...e, y: Math.max(plot.top, e.y) }));

  // annotations: pill above the point (or below if there is no room / it would hit another pill)
  const af = T.axis_labels.fontMax - 2;
  const placed: Placed[] = [];
  const refLabel = input.reference !== undefined && input.refLabel ? fitText(input.refLabel, T.reference_label, 300, measure, false).lines : [];
  if (refLabel.length && input.reference !== undefined) {
    const rh = refLabel[0].size * 1.2;
    placed.push({ x: plot.left + 12, y: Math.max(plot.top, toY(input.reference) - 8 - rh), w: measure(refLabel[0].text, refLabel[0].size, 600) + 16, h: rh });
  }
  const annotations = input.annotations
    .filter((a) => points[a.series]?.[a.index]?.y !== null && points[a.series]?.[a.index] !== undefined)
    .sort((a, b) => a.index - b.index)
    .map((a) => {
      const pt = points[a.series][a.index];
      const line = fitText(a.text, { ...T.axis_labels, maxLines: 1, fontMax: af }, 360, measure, false).lines[0];
      const w = Math.ceil(measure(line.text, line.size, 600)) + 28;
      const h = Math.round(line.size * 1.2 + 16);
      const x = Math.max(plot.left, Math.min(plot.left + plot.width - w, pt.x - w / 2));
      const py = pt.y as number;
      const hits = (b: Placed) => placed.some((q) => b.x < q.x + q.w + 6 && b.x + b.w + 6 > q.x && b.y < q.y + q.h + 6 && b.y + b.h + 6 > q.y);
      const inside = (b: Placed) => b.y >= plot.top && b.y + b.h <= plot.top + plot.height;
      // try above, then below, then further away on each side until a free spot is found
      let box: Placed | null = null;
      for (let k = 0; k < 8 && !box; k++) {
        for (const c of [{ x, y: py - 22 - h - k * (h + 10), w, h }, { x, y: py + 22 + k * (h + 10), w, h }]) {
          if (inside(c) && !hits(c)) {
            box = c;
            break;
          }
        }
      }
      if (!box) return null; // no free spot anywhere in the plot: leave this callout out rather than overlap
      placed.push(box);
      return { ...a, box, px: pt.x, py, font: line.size, line };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  return {
    heading,
    legend,
    legendH,
    source,
    axisFont,
    plot,
    yTicks: ax.ticks.map((v, i) => ({ v, y: toY(v), label: tickLabels[i] })),
    xLabels,
    xFont: xl,
    points,
    endLabels,
    endFont,
    annotations,
    refY: input.reference !== undefined ? toY(input.reference) : undefined,
    refLabel,
    toY,
    blockH: SAFE_H,
  };
}

/* ================================================================== */
/* Timing                                                               */
/* ================================================================== */

export const DRAW_FRAMES = 48;

export function planLine(L: LineLayout, anims: { title: string; source: string }, nSeries: number, hasRef: boolean, duration: number, cueTimes?: number[]): Plan {
  const T = (lines: Line[]) => lines.map((l) => l.text).join(' ');
  const units: Unit[] = [];
  let cue = 0;
  if (L.heading.length) {
    const h = T(L.heading);
    units.push({ key: 'title', label: 'Heading', start: 2, dur: textAnimFrames(anims.title, words(h).length, h.length, 18), cue: cue++ });
  }
  const first = L.heading.length ? 20 : 8;
  const stagger = 8;
  const draw = DRAW_FRAMES + stagger * (nSeries - 1);
  units.push({ key: 'lines', label: 'Lines', start: first, dur: draw, cue: cue++ });
  const n = L.points[0]?.length ?? 1;
  const annCue = cue;
  L.annotations.forEach((a, i) => {
    const frac = n > 1 ? a.index / (n - 1) : 1;
    units.push({ key: `ann${i}`, label: `Annotation ${i + 1}`, start: first + a.series * stagger + Math.round(frac * DRAW_FRAMES) + 2, dur: 14, cue: annCue + i });
  });
  cue = annCue + 3;
  const end = first + draw;
  if (hasRef) units.push({ key: 'reference', label: 'Reference line', start: end + 2, dur: 16, cue: cue });
  cue++;
  if (L.source.length) {
    const s = T(L.source);
    units.push({ key: 'source', label: 'Source', start: end + 8, dur: textAnimFrames(anims.source, words(s).length, s.length, 14), cue: cue });
  }
  units.push({ key: 'grid', label: 'Grid and axes', start: first - 8, dur: 14, follows: { key: 'lines', offset: -8 } });
  for (let s = 0; s < nSeries; s++) {
    units.push({ key: `line${s}`, label: `Line ${s + 1}`, start: first + s * stagger, dur: DRAW_FRAMES, follows: { key: 'lines', offset: s * stagger } });
    units.push({ key: `end${s}`, label: `End label ${s + 1}`, start: first + s * stagger + DRAW_FRAMES - 4, dur: 14, follows: { key: 'lines', offset: s * stagger + DRAW_FRAMES - 4 } });
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

export function prepareDV04(props: Record<string, unknown>, durationInFrames: number) {
  const S = DV04_SPEC.text;
  const A = (k: string) => readAnim(props, DV04_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DV04_SPEC, props);
  const measure = measureFor(style);
  const x = (Array.isArray(props.x_labels) ? props.x_labels : [])
    .map((t) => (typeof t === 'number' ? String(t) : typeof t === 'string' ? t.trim().slice(0, 12) : ''))
    .slice(0, 40);
  const n = x.length;
  const transform = opt(props, 'transform', ['none', 'indexed', 'cumulative'] as const, 'none');
  const series: Series[] = (Array.isArray(props.series) ? props.series : [])
    .slice(0, 4)
    .map((s) => {
      const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
      let values = (Array.isArray(o.values) ? o.values : []).slice(0, n).map((v) => (v === null ? null : readNumber(v) ?? null));
      while (values.length < n) values.push(null);
      if (transform === 'cumulative') {
        let acc = 0;
        values = values.map((v) => (v === null ? null : (acc += v)));
      }
      if (transform === 'indexed') {
        const base = values.find((v) => v !== null && v !== 0);
        values = values.map((v) => (v === null || base === undefined || base === null ? null : (v / base) * 100));
      }
      return { name: normaliseText(typeof o.name === 'string' ? o.name : '', { ...S.axis_labels, maxChars: 20, maxWords: 4 }), values };
    });
  const annotations: Annotation[] = (Array.isArray(props.annotations) ? props.annotations : [])
    .slice(0, 3)
    .map((a) => {
      const o = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
      const at = o.at;
      const index = typeof at === 'number' ? Math.round(at) : typeof at === 'string' ? x.indexOf(at.trim()) : -1;
      const sIdx = typeof o.series === 'number' ? Math.round(o.series) - 1 : 0;
      return { index, series: Math.max(0, Math.min(series.length - 1, sIdx)), text: normaliseText(typeof o.text === 'string' ? o.text : '', { ...S.axis_labels, maxChars: 25, maxWords: 5 }) };
    })
    .filter((a) => a.index >= 0 && a.index < n && a.text);
  const input = {
    title: normaliseText(readFirst(props, ['title', 'heading']), S.title),
    source: normaliseText(readFirst(props, ['source']), S.source),
    x,
    series,
    annotations,
    prefix: transform === 'indexed' ? '' : normaliseText(readFirst(props, ['prefix']), S.prefix),
    unit: transform === 'indexed' ? '' : normaliseText(readFirst(props, ['unit']), S.unit),
    format: transform === 'indexed' ? ('plain' as NumberFormat) : opt(props, 'format', NUMBER_FORMATS, 'indian_compact'),
    decimals: opt(props, 'decimals', ['auto', '0', '1', '2'] as const, 'auto'),
    endLabels: opt(props, 'end_labels', ['on', 'off'] as const, 'on') === 'on',
    reference: readNumber(props.reference_value),
    refLabel: normaliseText(readFirst(props, ['reference_label']), S.reference_label),
  };
  const areaOpt = opt(props, 'area', ['auto', 'on', 'off'] as const, 'auto');
  const area = areaOpt === 'on' || (areaOpt === 'auto' && series.length === 1);
  const pointsOpt = opt(props, 'show_points', ['auto', 'on', 'off'] as const, 'auto');
  const showPoints = pointsOpt === 'on' || (pointsOpt === 'auto' && n <= 12);
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const debug = props.show_safe_area === true;
  const L = layoutLine(input, measure, sized.spec);
  const plan = planLine(L, { title: A('title'), source: A('source') }, series.length, input.reference !== undefined, durationInFrames, readCues(props));
  return { style, sized, A, input, area, showPoints, imageUrl, bg, debug, L, plan };
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */

function DV04LineChartBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, input, area, showPoints, imageUrl, bg, debug, L, plan } = prepareDV04(props, durationInFrames);
  const uid = useId().replace(/:/g, '');
  const w = plan.windows;
  const S = DV04_SPEC.text;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const muted = mutedFor(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const grid = shapeState(A('grid'), progress(frame, w.grid.start, w.grid.dur));
  const { plot } = L;
  const bottom = plot.top + plot.height;
  const lineW = Math.max(4, Math.round(SAFE_H / 160));

  const pathFor = (si: number) => {
    let d = '';
    let pen = false;
    for (const p of L.points[si]) {
      if (p.y === null) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
      pen = true;
    }
    return d.trim();
  };
  const areaFor = (si: number) => {
    const pts = L.points[si].filter((p) => p.y !== null);
    if (pts.length < 2) return '';
    const base = Math.min(bottom, L.toY(Math.max(L.yTicks[0].v, Math.min(0, L.yTicks[L.yTicks.length - 1].v))));
    return `M ${pts[0].x} ${base} ${pts.map((p) => `L ${p.x.toFixed(1)} ${(p.y as number).toFixed(1)}`).join(' ')} L ${pts[pts.length - 1].x} ${base} Z`;
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.heading.length > 0 && w.title && (
            <AnimatedText lines={L.heading} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={S.title.weight} lineHeight={S.title.lineHeight} letterSpacing="-0.02em" shadow={shadow} group="title" input="title" />
          )}

          {L.legend.map((g, i) => (
            <div key={i} style={{ position: 'absolute', left: g.x, top: L.plot.top - L.legendH, display: 'flex', alignItems: 'center', gap: 12, opacity: grid.style.opacity ?? grid.length }}>
              <div {...leaf(`legend-${i}-swatch`, `series[${i}].name`)} style={{ width: 20, height: 6, borderRadius: 3, background: seriesColor(style.colors, i) }} />
              <span {...leaf(`legend-${i}`, `series[${i}].name`)} style={{ fontFamily: fontFor(600), fontWeight: 600, fontSize: g.text.size, lineHeight: 1.2, color: style.colors.text, whiteSpace: 'nowrap', textShadow: shadow }}>
                {g.text.text}
              </span>
            </div>
          ))}

          {/* grid + y labels */}
          {L.yTicks.map((t, i) => (
            <div key={`y${i}`}>
              <div {...guide(`grid-${i}`, 'grid line')} style={{ position: 'absolute', left: plot.left, top: Math.min(bottom - 1, t.y), width: plot.width * grid.length, height: 1.5, background: withAlpha(style.colors.text, i === 0 ? 0.35 : 0.12), ...grid.style }} />
              <span
                {...leaf(`ylabel-${i}`, 'axis label')}
                style={{ position: 'absolute', left: 0, width: plot.left - Y_LABEL_GAP, textAlign: 'right', top: Math.max(0, Math.min(SAFE_H - L.axisFont * 1.1, t.y - L.axisFont * 0.55)), fontFamily: fontFor(500), fontWeight: 500, fontSize: L.axisFont * 0.9, lineHeight: 1.2, color: muted, whiteSpace: 'nowrap', opacity: grid.style.opacity ?? grid.length }}
              >
                {t.label}
              </span>
            </div>
          ))}
          {L.xLabels.map((xl, i) => (
            <span
              key={`x${i}`}
              {...leaf(`xlabel-${i}`, `x_labels[${xl.i}]`)}
              style={{ position: 'absolute', top: bottom + X_LABEL_GAP, left: xl.left, fontFamily: fontFor(500), fontWeight: 500, fontSize: L.xFont, lineHeight: 1.2, color: muted, whiteSpace: 'nowrap', opacity: grid.style.opacity ?? grid.length }}
            >
              {xl.text}
            </span>
          ))}

          {/* reference */}
          {L.refY !== undefined && w.reference && (() => {
            const st = shapeState(A('reference'), progress(frame, w.reference.start, w.reference.dur));
            return (
              <>
                <div {...guide('reference', 'reference_value')} style={{ position: 'absolute', left: plot.left, top: Math.max(plot.top, Math.min(bottom - 3, L.refY! - 1.5)), width: plot.width * st.length, height: 0, borderTop: `3px dashed ${withAlpha(style.colors.text, 0.7)}`, ...st.style }} />
                {L.refLabel.length > 0 && (
                  <span {...leaf('reference-label', 'reference_label')} style={{ position: 'absolute', left: plot.left + 12, top: Math.max(plot.top, L.refY! - 8 - L.refLabel[0].size * 1.2), fontFamily: fontFor(600), fontWeight: 600, fontSize: L.refLabel[0].size, lineHeight: 1.2, color: style.colors.text, padding: '0 8px', borderRadius: 6, background: withAlpha(style.colors.background_2, 0.75), whiteSpace: 'nowrap', opacity: st.length }}>
                    {L.refLabel[0].text}
                  </span>
                )}
              </>
            );
          })()}

          {/* lines */}
          <svg {...guide('lines', 'series[].values')} width={SAFE_W} height={SAFE_H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
            <defs>
              {input.series.map((_, si) => {
                const lw = w[`line${si}`];
                const p = lw ? easeInOutCubic(progress(frame, lw.start, lw.dur)) : 1;
                return (
                  <clipPath key={si} id={`${uid}-clip${si}`}>
                    <rect x={plot.left - 10} y={0} width={(plot.width + 20) * p} height={SAFE_H} />
                  </clipPath>
                );
              })}
              {input.series.map((_, si) => (
                <linearGradient key={`g${si}`} id={`${uid}-grad${si}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={seriesColor(style.colors, si)} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={seriesColor(style.colors, si)} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {input.series.map((_, si) => {
              const lw = w[`line${si}`];
              const st = shapeState(A('lines'), lw ? progress(frame, lw.start, lw.dur) : 1);
              const color = seriesColor(style.colors, si);
              return (
                <g key={si} clipPath={A('lines') === 'grow' ? `url(#${uid}-clip${si})` : undefined} style={{ opacity: (st.style.opacity as number | undefined) ?? (st.length > 0 ? 1 : 0) }}>
                  {area && <path d={areaFor(si)} fill={`url(#${uid}-grad${si})`} />}
                  <path d={pathFor(si)} fill="none" stroke={color} strokeWidth={lineW} strokeLinejoin="round" strokeLinecap="round" />
                </g>
              );
            })}
          </svg>

          {/* points */}
          {showPoints &&
            input.series.map((_, si) =>
              L.points[si].map((p, i) => {
                if (p.y === null) return null;
                const lw = w[`line${si}`];
                const n = L.points[si].length;
                const at = lw ? lw.start + (n > 1 ? (i / (n - 1)) * lw.dur : 0) : 0;
                const r = lineW * 1.6;
                return (
                  <div
                    key={`${si}-${i}`}
                    {...guide(`point-${si}-${i}`, `series[${si}].values[${i}]`)}
                    style={{ position: 'absolute', left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: style.colors.background_2, border: `${Math.max(2, lineW * 0.6)}px solid ${seriesColor(style.colors, si)}`, boxSizing: 'border-box', ...iconStyle(A('points'), progress(frame, at, 10)) }}
                  />
                );
              }),
            )}

          {/* end labels */}
          {L.endLabels.map((e) => {
            const ew = w[`end${e.series}`];
            return (
              <span
                key={e.series}
                {...leaf(`end-${e.series}`, `series[${e.series}].values (last)`)}
                style={{ position: 'absolute', left: e.x, top: e.y, fontFamily: fontFor(800), fontWeight: 800, fontSize: L.endFont, lineHeight: 1.25, color: seriesColor(style.colors, e.series), whiteSpace: 'nowrap', textShadow: shadow, ...cardStyle(A('end_labels'), ew ? progress(frame, ew.start, ew.dur) : 1) }}
              >
                {e.text}
              </span>
            );
          })}

          {/* annotations */}
          {L.annotations.map((a, i) => {
            const aw = w[`ann${i}`];
            const st = cardStyle(A('annotations'), aw ? progress(frame, aw.start, aw.dur) : 1);
            const color = seriesColor(style.colors, a.series);
            const above = a.box.y + a.box.h <= a.py;
            return (
              <div key={i}>
                <div style={{ position: 'absolute', left: a.px - 1.5, top: above ? a.box.y + a.box.h : a.py, width: 3, height: Math.abs(above ? a.py - a.box.y - a.box.h : a.box.y - a.py), background: withAlpha(color, 0.8), ...st }} />
                <div
                  {...leaf(`ann-${i}`, `annotations[${i}].text`)}
                  style={{ position: 'absolute', left: a.box.x, top: a.box.y, width: a.box.w, height: a.box.h, boxSizing: 'border-box', borderRadius: 999, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', ...st }}
                >
                  <span style={{ fontFamily: fontFor(700), fontWeight: 700, fontSize: a.font, lineHeight: 1.2, color: style.colors.on_accent, whiteSpace: 'nowrap' }}>{a.line.text}</span>
                </div>
              </div>
            );
          })}

          {L.source.length > 0 && w.source && (
            <AnimatedText
              lines={L.source}
              anim={A('source')}
              start={w.source.start}
              dur={w.source.dur}
              frame={frame}
              weight={S.source.weight}
              lineHeight={S.source.lineHeight}
              color={withAlpha(style.colors.muted, 0.85)}
              shadow={shadow}
              group="source"
              input="source"
              style={{ position: 'absolute', left: 0, bottom: 0 }}
            />
          )}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const DV04LineChart = withAutoFit(DV04LineChartBase);
