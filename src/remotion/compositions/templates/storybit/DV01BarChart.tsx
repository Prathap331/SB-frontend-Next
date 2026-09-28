'use client';

/**
 * DV-01 · Bar Chart  (animation_type: "dv_bar_chart")
 * 3–10 bars comparing values across categories — vertical or horizontal, optional sorting,
 * highlighted bars, a reference / threshold line and a source line. Negative values grow down
 * (or left) from a zero line. All values share one format so they compare honestly.
 *
 * Inputs (full list, limits and JSON Schema: DV01BarChart.inputs.json):
 *   title · bars[] { label, value, highlight } · prefix · unit · reference_value · reference_label
 *   source · image_url · orientation · sort · highlight · show_values · format · decimals · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, bars, reference, source]
 * Timing: 3–8s from clock.durationInFrames.
 */
import type { CSSProperties } from 'react';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, words, type Line, type Measure } from './core/fit';
import { exitStyle, lineStyle, progress, shapeState, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { FORMAT_HELP, NUMBER_FORMATS, decimalsFor, formatDigits, pickScale, readNumber, type NumberFormat, type Scale } from './core/numbers';
import { NumberRow, fitNumberRows, measureNumberRow, numberAnimFrames, numberAnimState, type NumberParts } from './core/numberRow';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, guide, leaf, readBgMode, readFirst } from './core/shared';

/* ================================================================== */
/* Content spec                                                         */
/* ================================================================== */

export const DV01_SPEC: TemplateSpec = {
  id: 'DV-01',
  animationType: 'dv_bar_chart',
  name: 'Bar Chart',
  pickWhen: 'Values compared across 3–10 categories: states, companies, years, products; rankings with numbers; a threshold to beat.',
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
      hint: 'What is measured, with the unit if helpful: "Monthly UPI payments (₹ lakh crore)".',
      fills: 'Heading above the chart',
      example: 'Top UPI apps by market share',
    },
    prefix: {
      label: 'Prefix',
      required: false,
      minChars: 1,
      maxChars: 3,
      minWords: 1,
      maxWords: 1,
      maxWordChars: 3,
      maxLines: 1,
      fontMax: 48,
      fontMin: 16,
      weight: 800,
      lineHeight: 1,
      hint: 'Currency or symbol before every value: ₹, $.',
      fills: 'Symbol before each value label',
      noSize: true,
    },
    unit: {
      label: 'Unit',
      required: false,
      minChars: 1,
      maxChars: 8,
      minWords: 1,
      maxWords: 1,
      maxWordChars: 8,
      maxLines: 1,
      fontMax: 48,
      fontMin: 16,
      weight: 800,
      lineHeight: 1,
      hint: 'Unit after every value: %, km, t.',
      fills: 'Unit after each value label',
      example: '%',
      noSize: true,
    },
    reference_label: {
      label: 'Reference label',
      required: false,
      minChars: 2,
      maxChars: 24,
      minWords: 1,
      maxWords: 4,
      maxWordChars: 14,
      maxLines: 1,
      fontMax: 26,
      fontMin: 18,
      weight: 600,
      lineHeight: 1.2,
      hint: 'Name of the reference line: "National average", "Target".',
      fills: 'Label on the reference line (vertical charts)',
    },
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
      hint: 'Where the data comes from: "Source: NPCI, March 2025".',
      fills: 'Source line under the chart',
      example: 'Source: NPCI, illustrative',
    },
  },
  numbers: {
    reference_value: { label: 'Reference value', required: false, fills: 'Dashed line across the chart at this value (average, target, threshold)' },
  },
  lists: {
    bars: {
      label: 'Bar',
      fills: 'One bar per category, in the order given (unless sorted)',
      minItems: 3,
      maxItems: 10,
      fields: {
        label: {
          label: 'Label',
          required: true,
          minChars: 1,
          maxChars: 18,
          minWords: 1,
          maxWords: 3,
          maxWordChars: 14,
          maxLines: 2,
          fontMax: 30,
          fontMin: 16,
          weight: 600,
          lineHeight: 1.2,
          hint: 'Category name: "PhonePe", "2024", "Kerala".',
          fills: 'Category label (under the bar, or left of it)',
        },
      },
      numbers: {
        value: { label: 'Value', required: true, fills: 'Bar value (raw number, same unit for all bars)' },
        highlight: { label: 'Highlight', required: false, fills: '1 = draw this bar in the accent colour (others turn grey)', min: 0, max: 1, integer: true },
      },
    },
  },
  options: {
    orientation: { label: 'Orientation', values: ['vertical', 'horizontal'], default: 'vertical', fills: 'Columns (vertical) or rows (horizontal, better for long labels)' },
    sort: { label: 'Sort', values: ['none', 'desc', 'asc'], default: 'none', fills: 'Keep the given order, or sort by value' },
    highlight: { label: 'Highlight', values: ['none', 'max', 'min', 'first', 'last'], default: 'none', fills: 'Which bar gets the accent colour (bars[].highlight = 1 also works)' },
    show_values: { label: 'Value labels', values: ['on', 'off'], default: 'on', fills: 'Numbers on the bars' },
    format: { label: 'Number format', values: [...NUMBER_FORMATS], default: 'indian_compact', fills: FORMAT_HELP },
    decimals: { label: 'Decimals', values: ['auto', '0', '1', '2'], default: 'auto', fills: 'Decimal places shown' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    axis: { label: 'Zero line', kind: 'shape', target: 'baseline / zero line', default: 'grow' },
    bars: { label: 'Bars', kind: 'shape', target: 'each bar (one after another)', default: 'grow' },
    values: { label: 'Value labels', kind: 'number', target: 'numbers on the bars', default: 'count_up' },
    labels: { label: 'Category labels', kind: 'text', target: 'category labels', default: 'fade_up' },
    reference: { label: 'Reference line', kind: 'shape', target: 'dashed reference line and its label', default: 'grow' },
    source: { label: 'Source', kind: 'text', target: 'source line', default: 'fade' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: {
    description: 'heading → bars start growing → reference line → source. Missing elements are skipped.',
    units: ['heading', 'bars', 'reference line', 'source'],
  },
  colors: ['negative'],
  sizes: { values: { label: 'Value labels', min: 18, max: 48, fills: 'Numbers on the bars' } },
  example: {
    title: 'UPI app market share (illustrative)',
    bars: [
      { label: 'PhonePe', value: 47 },
      { label: 'Google Pay', value: 36, highlight: 1 },
      { label: 'Paytm', value: 7 },
      { label: 'Others', value: 10 },
    ],
    unit: '%',
    format: 'plain',
    orientation: 'vertical',
    reference_value: 25,
    reference_label: 'Fair share',
    source: 'Source: illustrative figures',
    background: 'theme',
  },
};

/* ================================================================== */
/* Layout                                                               */
/* ================================================================== */

export type Bar = { label: string; value: number; highlight: boolean };
export const HEADING_GAP = 40;
export const SOURCE_GAP = 24;
export const LABEL_GAP = 14;
export const VALUE_GAP = 10;
export const H_LABEL_GAP = 20;

export type ChartLayout = {
  orientation: 'vertical' | 'horizontal';
  heading: Line[];
  headingH: number;
  source: Line[];
  sourceH: number;
  scale: Scale;
  decimals: number;
  parts: NumberParts[];
  valueFont: number;
  valueW: number[];
  labels: Line[][];
  labelH: number;
  refLabel: Line[];
  // geometry (px inside the plot box)
  plotW: number;
  plotH: number;
  plotTop: number;
  slot: number;
  barThick: number;
  labelW: number;
  valueBand: number;
  zero: number; // pixel position of the zero line along the value axis
  pxPerUnit: number;
  blockH: number;
};

export function layoutChart(
  input: { title: string; source: string; bars: Bar[]; prefix: string; unit: string; format: NumberFormat; decimals: string; orientation: 'vertical' | 'horizontal'; showValues: boolean; reference?: number; refLabel: string },
  measure: Measure,
  spec: TemplateSpec = DV01_SPEC,
  valuesMax = 48,
): ChartLayout {
  const F = spec.lists.bars.fields;
  const n = Math.max(1, input.bars.length);
  const heading = input.title ? fitText(input.title, spec.text.title, SAFE_W, measure, false).lines : [];
  const headingH = heading.length ? blockHeight(heading, spec.text.title.lineHeight) + HEADING_GAP : 0;
  const source = input.source ? fitText(input.source, spec.text.source, SAFE_W, measure, false).lines : [];
  const sourceH = source.length ? SOURCE_GAP + blockHeight(source, spec.text.source.lineHeight) : 0;
  const refLabel = input.reference !== undefined && input.refLabel ? fitText(input.refLabel, spec.text.reference_label, 320, measure, false).lines : [];

  const vals = input.bars.map((b) => b.value);
  const all = input.reference !== undefined ? [...vals, input.reference] : vals;
  const maxV = Math.max(0, ...all);
  const minV = Math.min(0, ...all);
  const big = Math.abs(maxV) >= Math.abs(minV) ? maxV : minV;
  const scale = pickScale(big || 1, input.format);
  const d = Math.max(...vals.map((v) => decimalsFor(v, scale, input.decimals)));
  const parts = vals.map((v) => ({ prefix: input.prefix, digits: formatDigits(v, scale, input.format, d), suffix: scale.suffix, unit: input.unit }));
  const span = maxV - minV || 1;

  if (input.orientation === 'vertical') {
    // the reference label sits in its own gutter on the right so it never covers a bar
    const gutter = refLabel.length ? Math.ceil(measure(refLabel[0].text, refLabel[0].size, spec.text.reference_label.weight)) + 32 : 0;
    const slot = (SAFE_W - gutter) / n;
    const barThick = Math.min(160, Math.round(slot * 0.62));
    const valueFont = input.showValues ? fitNumberRows(parts, slot - 8, 16, valuesMax, measure) : 0;
    const valueBand = input.showValues ? Math.round(valueFont * 1.1) + VALUE_GAP : 0;
    const lf = sharedFont(input.bars.map((b) => b.label), F.label, slot - 12, measure);
    const labels = input.bars.map((b) => linesAt(b.label, lf, F.label, slot - 12, measure));
    const labelH = Math.max(...labels.map((l) => blockHeight(l, F.label.lineHeight)));
    // value labels sit above positive bars and below negative ones: reserve a band on each side that has bars
    const bandTop = maxV > 0 ? valueBand : 0;
    const bandBottom = minV < 0 ? valueBand : 0;
    const plotH = Math.max(160, SAFE_H - headingH - sourceH - labelH - LABEL_GAP - bandTop - bandBottom);
    const pxPerUnit = plotH / span;
    const zero = bandTop + maxV * pxPerUnit;
    return {
      orientation: 'vertical',
      heading,
      headingH,
      source,
      sourceH,
      scale,
      decimals: d,
      parts,
      valueFont,
      valueW: parts.map((p) => Math.ceil(measureNumberRow(p, valueFont || 16, measure).dg)),
      labels,
      labelH,
      refLabel,
      plotW: SAFE_W - gutter,
      plotH: plotH + bandTop + bandBottom,
      plotTop: headingH,
      slot,
      barThick,
      labelW: slot - 12,
      valueBand,
      zero,
      pxPerUnit,
      blockH: headingH + plotH + bandTop + bandBottom + LABEL_GAP + labelH + sourceH,
    };
  }

  // horizontal
  const plotH = SAFE_H - headingH - sourceH;
  const slot = plotH / n;
  const barThick = Math.min(72, Math.round(slot * 0.62));
  const lf = sharedFont(input.bars.map((b) => b.label), { ...F.label, maxLines: 1 }, 400, measure, Math.min(F.label.fontMax, Math.round(slot * 0.45)));
  const labels = input.bars.map((b) => linesAt(b.label, lf, { ...F.label, maxLines: 1 }, 400, measure, false));
  const labelW = Math.min(400, Math.ceil(Math.max(...labels.map((l) => measure(l[0].text, l[0].size, F.label.weight)))) + 4);
  const valueFont = input.showValues ? fitNumberRows(parts, 300, 16, Math.min(valuesMax, Math.round(slot * 0.5)), measure) : 0;
  const valueBand = input.showValues ? Math.ceil(Math.max(...parts.map((p) => measureNumberRow(p, valueFont, measure).total))) + VALUE_GAP : 0;
  const plotW = SAFE_W - labelW - H_LABEL_GAP;
  const bandRight = maxV > 0 ? valueBand : 0;
  const bandLeft = minV < 0 ? valueBand : 0;
  const lengthPx = Math.max(200, plotW - bandRight - bandLeft);
  const pxPerUnit = lengthPx / span;
  const zero = bandLeft + -minV * pxPerUnit;
  return {
    orientation: 'horizontal',
    heading,
    headingH,
    source,
    sourceH,
    scale,
    decimals: d,
    parts,
    valueFont,
    valueW: parts.map((p) => Math.ceil(measureNumberRow(p, valueFont || 16, measure).dg)),
    labels,
    labelH: 0,
    refLabel,
    plotW,
    plotH,
    plotTop: headingH,
    slot,
    barThick,
    labelW,
    valueBand,
    zero,
    pxPerUnit,
    blockH: headingH + plotH + sourceH,
  };
}

/* ================================================================== */
/* Timing                                                               */
/* ================================================================== */

export function planChart(
  L: ChartLayout,
  bars: Bar[],
  anims: { title: string; values: string; labels: string; source: string },
  hasRef: boolean,
  duration: number,
  cueTimes?: number[],
): Plan {
  const T = (lines: Line[]) => lines.map((l) => l.text).join(' ');
  const units: Unit[] = [];
  let cue = 0;
  if (L.heading.length) {
    const h = T(L.heading);
    units.push({ key: 'title', label: 'Heading', start: 2, dur: textAnimFrames(anims.title, words(h).length, h.length, 18), cue: cue++ });
  }
  const first = L.heading.length ? 18 : 6;
  const n = bars.length;
  const stagger = Math.max(3, Math.min(8, Math.floor(40 / n)));
  const growDur = 24;
  units.push({ key: 'bars', label: 'Bars', start: first, dur: growDur + stagger * (n - 1), cue: cue++ });
  const barsEnd = first + growDur + stagger * (n - 1);
  if (hasRef) units.push({ key: 'reference', label: 'Reference line', start: barsEnd + 2, dur: 16, cue: cue++ });
  if (L.source.length) {
    const s = T(L.source);
    units.push({ key: 'source', label: 'Source', start: barsEnd + 8, dur: textAnimFrames(anims.source, words(s).length, s.length, 14), cue: cue++ });
  }
  units.push({ key: 'axis', label: 'Zero line', start: first - 6, dur: 14, follows: { key: 'bars', offset: -6 } });
  const vDur = numberAnimFrames(anims.values);
  bars.forEach((b, i) => {
    units.push({ key: `bar${i}`, label: `Bar ${i + 1}`, start: first + i * stagger, dur: growDur, follows: { key: 'bars', offset: i * stagger } });
    units.push({ key: `label${i}`, label: `Label ${i + 1}`, start: first + i * stagger, dur: textAnimFrames(anims.labels, 2, b.label.length, 12), follows: { key: 'bars', offset: i * stagger } });
    if (L.valueFont) units.push({ key: `value${i}`, label: `Value ${i + 1}`, start: first + i * stagger + 4, dur: Math.min(vDur, 30), follows: { key: 'bars', offset: i * stagger + 4 } });
  });
  return planTimeline(duration, units, cueTimes);
}

/* ================================================================== */
/* Props → layout → plan (shared by the renderer and the preview)       */
/* ================================================================== */

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareDV01(props: Record<string, unknown>, durationInFrames: number) {
  const S = DV01_SPEC.text;
  const BS = DV01_SPEC.lists.bars;
  const A = (k: string) => readAnim(props, DV01_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DV01_SPEC, props);
  const measure = measureFor(style);
  const raw = Array.isArray(props.bars) ? props.bars : Array.isArray(props.items) ? props.items : [];
  let bars: Bar[] = raw
    .map((b): Bar | null => {
      if (!b || typeof b !== 'object') return null;
      const o = b as Record<string, unknown>;
      const label = typeof o.label === 'string' ? o.label : typeof o.name === 'string' ? o.name : '';
      const value = readNumber(o.value);
      return label && value !== undefined ? { label: normaliseText(label, BS.fields.label), value, highlight: o.highlight === 1 || o.highlight === true } : null;
    })
    .filter((b): b is Bar => b !== null && Boolean(b.label))
    .slice(0, BS.maxItems);
  const sort = opt(props, 'sort', ['none', 'desc', 'asc'] as const, 'none');
  if (sort !== 'none') bars = [...bars].sort((a, b) => (sort === 'desc' ? b.value - a.value : a.value - b.value));
  const hl = opt(props, 'highlight', ['none', 'max', 'min', 'first', 'last'] as const, 'none');
  if (hl !== 'none' && bars.length) {
    const idx =
      hl === 'first' ? 0 : hl === 'last' ? bars.length - 1 : bars.reduce((bi, b, i) => ((hl === 'max' ? b.value > bars[bi].value : b.value < bars[bi].value) ? i : bi), 0);
    bars = bars.map((b, i) => ({ ...b, highlight: b.highlight || i === idx }));
  }
  const orientation = opt(props, 'orientation', ['vertical', 'horizontal'] as const, 'vertical');
  const reference = readNumber(props.reference_value);
  const input = {
    title: normaliseText(readFirst(props, ['title', 'heading']), S.title),
    source: normaliseText(readFirst(props, ['source']), S.source),
    bars,
    prefix: normaliseText(readFirst(props, ['prefix']), S.prefix),
    unit: normaliseText(readFirst(props, ['unit']), S.unit),
    format: opt(props, 'format', NUMBER_FORMATS, 'indian_compact'),
    decimals: opt(props, 'decimals', ['auto', '0', '1', '2'] as const, 'auto'),
    orientation,
    showValues: opt(props, 'show_values', ['on', 'off'] as const, 'on') === 'on',
    reference,
    refLabel: normaliseText(readFirst(props, ['reference_label']), S.reference_label),
  };
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const debug = props.show_safe_area === true;
  const L = layoutChart(input, measure, sized.spec, sized.extra.values);
  const plan = planChart(L, bars, { title: A('title'), values: A('values'), labels: A('labels'), source: A('source') }, reference !== undefined, durationInFrames, readCues(props));
  return { style, sized, A, input, imageUrl, bg, debug, L, plan };
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */

export function DV01BarChart({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, input, imageUrl, bg, debug, L, plan } = prepareDV01(props, durationInFrames);
  const w = plan.windows;
  const F = DV01_SPEC.lists.bars.fields;
  const S = DV01_SPEC.text;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const muted = mutedFor(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const anyHl = input.bars.some((b) => b.highlight);
  const barColor = (b: Bar) => (anyHl ? (b.highlight ? accent : withAlpha(style.colors.text, 0.3)) : b.value < 0 ? style.colors.negative : accent);
  const vertical = L.orientation === 'vertical';
  const axis = shapeState(A('axis'), progress(frame, w.axis.start, w.axis.dur));
  const ref = input.reference !== undefined && w.reference ? shapeState(A('reference'), progress(frame, w.reference.start, w.reference.dur)) : null;

  const valueLabel = (i: number) => {
    const vw = w[`value${i}`];
    if (!vw) return null;
    const p = progress(frame, vw.start, vw.dur);
    const st = numberAnimState(A('values'), p);
    const v = input.bars[i].value;
    const shown = st.counting && st.countP < 1 ? formatDigits(v * st.countP, L.scale, input.format, L.decimals) : L.parts[i].digits;
    const rowStyle: CSSProperties = st.counting ? { opacity: Math.min(1, p * 4), transform: `scale(${1 + 0.07 * st.pop})` } : lineStyle(A('values') === 'rise' ? 'fade_up' : A('values'), p);
    return (
      <NumberRow
        parts={L.parts[i]}
        shownDigits={shown}
        font={L.valueFont}
        digitsW={L.valueW[i]}
        color={input.bars[i].highlight ? accent : style.colors.text}
        accent={accent}
        shadow={shadow}
        group={`value-${i}`}
        inputs={{ value: `bars[${i}].value` }}
        style={rowStyle}
      />
    );
  };

  const plot = () => {
    if (vertical) {
      return (
        <div style={{ position: 'relative', width: SAFE_W, height: L.plotH + LABEL_GAP + L.labelH }}>
          {input.bars.map((b, i) => {
            const bw = w[`bar${i}`];
            const st = shapeState(A('bars'), progress(frame, bw.start, bw.dur));
            const len = Math.abs(b.value) * L.pxPerUnit;
            const cx = i * L.slot + L.slot / 2;
            const up = b.value >= 0;
            const h = len * st.length;
            const lw = w[`label${i}`];
            return (
              <div key={i}>
                <div
                  {...leaf(`bar-${i}`, `bars[${i}].value (bar)`)}
                  style={{
                    position: 'absolute',
                    left: cx - L.barThick / 2,
                    top: up ? L.zero - h : L.zero,
                    width: L.barThick,
                    height: Math.max(0, h),
                    borderRadius: up ? '12px 12px 3px 3px' : '3px 3px 12px 12px',
                    background: barColor(b),
                    ...st.style,
                  }}
                />
                {L.valueFont > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: i * L.slot,
                      width: L.slot,
                      top: up ? L.zero - h - VALUE_GAP - L.valueFont * 1.1 : L.zero + h + VALUE_GAP,
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    {valueLabel(i)}
                  </div>
                )}
                <div style={{ position: 'absolute', left: i * L.slot + 6, width: L.slot - 12, top: L.plotH + LABEL_GAP, display: 'flex', justifyContent: 'center' }}>
                  <AnimatedText
                    lines={L.labels[i]}
                    anim={A('labels')}
                    start={lw.start}
                    dur={lw.dur}
                    frame={frame}
                    weight={F.label.weight}
                    lineHeight={F.label.lineHeight}
                    color={b.highlight ? style.colors.text : muted}
                    shadow={shadow}
                    align="center"
                    group={`label-${i}`}
                    input={`bars[${i}].label`}
                  />
                </div>
              </div>
            );
          })}
          <div {...guide('axis', 'zero line')} style={{ position: 'absolute', left: 0, top: Math.max(0, Math.min(L.plotH - 3, L.zero - 1.5)), height: 3, width: L.plotW * axis.length, background: withAlpha(style.colors.text, 0.45), ...axis.style }} />
          {ref && (
            <>
              <div
                {...guide('reference', 'reference_value')}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: Math.max(0, Math.min(L.plotH - 3, L.zero - input.reference! * L.pxPerUnit - 1.5)),
                  width: SAFE_W * ref.length,
                  height: 0,
                  borderTop: `3px dashed ${withAlpha(style.colors.text, 0.75)}`,
                  ...ref.style,
                }}
              />
              {L.refLabel.length > 0 && (
                <span
                  {...leaf('reference-label', 'reference_label')}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: Math.max(0, L.zero - input.reference! * L.pxPerUnit - 8 - L.refLabel[0].size * 1.2),
                    fontFamily: fontFor(600),
                    fontWeight: 600,
                    fontSize: L.refLabel[0].size,
                    lineHeight: 1.2,
                    color: style.colors.text,
                    whiteSpace: 'nowrap',
                    textShadow: shadow,
                    padding: '0 8px',
                    borderRadius: 6,
                    background: withAlpha(style.colors.background_2, 0.7),
                    opacity: ref.length,
                  }}
                >
                  {L.refLabel[0].text}
                </span>
              )}
            </>
          )}
        </div>
      );
    }
    // horizontal
    return (
      <div style={{ position: 'relative', width: SAFE_W, height: L.plotH }}>
        {input.bars.map((b, i) => {
          const bw = w[`bar${i}`];
          const st = shapeState(A('bars'), progress(frame, bw.start, bw.dur));
          const len = Math.abs(b.value) * L.pxPerUnit * st.length;
          const cy = i * L.slot + L.slot / 2;
          const right = b.value >= 0;
          const x0 = L.labelW + H_LABEL_GAP;
          const lw = w[`label${i}`];
          return (
            <div key={i}>
              <div style={{ position: 'absolute', left: 0, width: L.labelW, top: cy - L.labels[i][0].size * 0.6, display: 'flex', justifyContent: 'flex-end' }}>
                <AnimatedText
                  lines={L.labels[i]}
                  anim={A('labels')}
                  start={lw.start}
                  dur={lw.dur}
                  frame={frame}
                  weight={F.label.weight}
                  lineHeight={F.label.lineHeight}
                  color={b.highlight ? style.colors.text : muted}
                  shadow={shadow}
                  align="right"
                  group={`label-${i}`}
                  input={`bars[${i}].label`}
                />
              </div>
              <div
                {...leaf(`bar-${i}`, `bars[${i}].value (bar)`)}
                style={{
                  position: 'absolute',
                  left: x0 + (right ? L.zero : L.zero - len),
                  top: cy - L.barThick / 2,
                  width: Math.max(0, len),
                  height: L.barThick,
                  borderRadius: right ? '3px 12px 12px 3px' : '12px 3px 3px 12px',
                  background: barColor(b),
                  ...st.style,
                }}
              />
              {L.valueFont > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: cy - L.valueFont * 0.55,
                    ...(right ? { left: x0 + L.zero + len + VALUE_GAP } : { right: SAFE_W - (x0 + L.zero - len - VALUE_GAP) }),
                    display: 'flex',
                  }}
                >
                  {valueLabel(i)}
                </div>
              )}
            </div>
          );
        })}
        <div {...guide('axis', 'zero line')} style={{ position: 'absolute', top: 0, left: Math.min(SAFE_W - 3, L.labelW + H_LABEL_GAP + L.zero - 1.5), width: 3, height: L.plotH * axis.length, background: withAlpha(style.colors.text, 0.45), ...axis.style }} />
        {ref && (
          <>
            <div
              {...guide('reference', 'reference_value')}
              style={{
                position: 'absolute',
                top: 0,
                left: Math.max(L.labelW + H_LABEL_GAP, Math.min(SAFE_W - 3, L.labelW + H_LABEL_GAP + L.zero + input.reference! * L.pxPerUnit - 1.5)),
                height: L.plotH * ref.length,
                width: 0,
                borderLeft: `3px dashed ${withAlpha(style.colors.text, 0.75)}`,
                ...ref.style,
              }}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', ...exit }}>
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
              group="title"
              input="title"
              style={{ marginBottom: HEADING_GAP }}
            />
          )}
          {plot()}
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
              style={{ marginTop: SOURCE_GAP }}
            />
          )}
        </div>
      </SafeArea>
    </div>
  );
}
