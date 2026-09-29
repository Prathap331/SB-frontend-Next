'use client';

/**
 * DV-12 · Gauge / Meter  (animation_type: "dv_gauge")
 * A half-circle meter: coloured zones (e.g. Safe · Moderate · Severe), a needle that sweeps to the value,
 * the value counting up in the middle, a label, and min / max marks. AQI, inflation vs target, speed,
 * credit score, how full a dam is. Real, sourced values only.
 *
 * Inputs (full list, limits and JSON Schema: DV12Gauge.inputs.json):
 *   value (required) · min · max · label (required) · zones[] { to, label, tone } · prefix · unit · source
 *   format · decimals · image_url · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [gauge, needle, label, source]
 * Timing: 3–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type Issue, type TemplateSpec, type TextSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, type Line, type Measure } from './core/fit';
import { easeInOutCubic, exitStyle, progress } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { FORMAT_HELP, NUMBER_FORMATS, readNumber, type NumberFormat } from './core/numbers';
import { axisFormatter } from './core/chart';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, guide, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

const ZONE_LABEL: TextSpec = { label: 'Zone label', required: false, minChars: 2, maxChars: 14, minWords: 1, maxWords: 2, maxWordChars: 12, maxLines: 1, fontMax: 24, fontMin: 16, weight: 700, lineHeight: 1.2, fills: 'Name of a zone' };

export const DV12_SPEC: TemplateSpec = {
  id: 'DV-12',
  animationType: 'dv_gauge',
  name: 'Gauge / Meter',
  pickWhen: 'One value on a scale with good / bad zones: AQI, inflation vs target, a score, how full something is.',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 150, max: 240 },
  numbers: {
    value: { label: 'Value', required: true, fills: 'The reading', example: 312 },
    min: { label: 'Minimum', required: false, fills: 'Start of the scale (default 0)' },
    max: { label: 'Maximum', required: false, fills: 'End of the scale (default: the last zone end, or 100)' },
  },
  text: {
    label: { label: 'Label', required: true, minChars: 2, maxChars: 50, minWords: 1, maxWords: 9, maxWordChars: 18, maxLines: 2, fontMax: 44, fontMin: 26, weight: 700, lineHeight: 1.2, hint: 'What is measured: "Delhi AQI, 3 Nov (illustrative)".', fills: 'Line under the value', example: 'Delhi air quality (illustrative)' },
    prefix: { label: 'Prefix', required: false, minChars: 1, maxChars: 3, minWords: 1, maxWords: 1, maxWordChars: 3, maxLines: 1, fontMax: 40, fontMin: 16, weight: 800, lineHeight: 1, fills: 'Symbol before the value', noSize: true },
    unit: { label: 'Unit', required: false, minChars: 1, maxChars: 8, minWords: 1, maxWords: 1, maxWordChars: 8, maxLines: 1, fontMax: 40, fontMin: 16, weight: 800, lineHeight: 1, fills: 'Unit after the value', noSize: true },
    source: { label: 'Source', required: false, minChars: 3, maxChars: 60, minWords: 1, maxWords: 10, maxWordChars: 18, maxLines: 1, fontMax: 22, fontMin: 16, weight: 500, lineHeight: 1.25, fills: 'Source line' },
  },
  lists: {},
  custom: {
    inputs: [
      { path: 'zones[]', type: 'list', required: false, fills: 'Coloured bands along the dial, low to high', limits: '1–5 zones' },
      { path: 'zones[].to', type: 'number', required: true, fills: 'Where the zone ends on the scale' },
      { path: 'zones[].label', type: 'text', required: false, fills: 'Zone name ("Good", "Severe")', limits: '2–14 chars' },
      { path: 'zones[].tone', type: 'choice', required: false, fills: 'Colour of the zone', values: ['good', 'ok', 'warn', 'bad', 'neutral'] },
    ],
    schema: { zones: { type: 'array', maxItems: 5, items: { type: 'object', additionalProperties: false, required: ['to'], properties: { to: { type: 'number' }, label: { type: 'string', minLength: 2, maxLength: 14 }, tone: { type: 'string', enum: ['good', 'ok', 'warn', 'bad', 'neutral'] } } } } },
  },
  options: {
    format: { label: 'Number format', values: [...NUMBER_FORMATS], default: 'plain', fills: FORMAT_HELP },
    decimals: { label: 'Decimals', values: ['auto', '0', '1', '2'], default: 'auto', fills: 'Decimal places shown' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    gauge: { label: 'Dial', kind: 'shape', target: 'the dial and its zones', default: 'grow' },
    needle: { label: 'Needle', kind: 'number', target: 'needle sweep and value count', default: 'count_up' },
    label: { label: 'Label', kind: 'text', target: 'label', default: 'fade_up' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'everything', default: 'fade_up' },
  },
  cues: { description: 'gauge → needle (value is said) → label → source.', units: ['gauge', 'needle', 'label', 'source'] },
  colors: ['positive', 'negative'],
  validate: (props) => {
    const issues: Issue[] = [];
    const v = readNumber(props.value);
    const mn = readNumber(props.min) ?? 0;
    const zones = Array.isArray(props.zones) ? (props.zones as Record<string, unknown>[]) : [];
    const mx = readNumber(props.max) ?? readNumber(zones[zones.length - 1]?.to) ?? 100;
    if (v !== undefined && (v < mn || v > mx)) issues.push({ field: 'value', level: 'warning', message: `Value ${v} is outside the scale ${mn}–${mx}; the needle stops at the end` });
    return issues;
  },
  example: {
    value: 312,
    max: 500,
    label: 'Delhi air quality, AQI (illustrative)',
    zones: [
      { to: 50, label: 'Good', tone: 'good' },
      { to: 100, label: 'Satisfactory', tone: 'ok' },
      { to: 200, label: 'Moderate', tone: 'warn' },
      { to: 300, label: 'Poor', tone: 'bad' },
      { to: 500, label: 'Severe', tone: 'bad' },
    ],
    format: 'plain',
    background: 'theme',
  },
};

type Zone = { from: number; to: number; label: string; tone: string };
export const R = 400;
export const THICK = 64;
export type GaugeLayout = { cx: number; cy: number; zones: Zone[]; zoneLabels: (Line | undefined)[]; zoneBoxes: ({ x: number; y: number; w: number; h: number } | null)[]; valueText: string; valueFont: number; label: Line[]; source?: Line; min: number; max: number; fmt: (v: number) => string; ends: [string, string] };

export function layoutGauge(input: { value: number; min: number; max: number; zones: Zone[]; label: string; source: string; prefix: string; unit: string; format: NumberFormat; decimals: string }, measure: Measure, spec: TemplateSpec = DV12_SPEC): GaugeLayout {
  const T = spec.text;
  const f = axisFormatter([input.value, input.min, input.max], input.format, input.decimals, input.prefix, input.unit);
  const valueText = f.fmt(input.value);
  let valueFont = 120;
  while (valueFont > 44 && measure(valueText, valueFont, 800) > R * 1.15) valueFont -= 4;
  const label = fitText(input.label, T.label, SAFE_W * 0.7, measure).lines;
  const source = input.source ? fitText(input.source, T.source, SAFE_W, measure, false).lines[0] : undefined;
  const zoneLabels = input.zones.map((z) => (z.label ? fitText(z.label, ZONE_LABEL, 220, measure, false).lines[0] : undefined));
  // the value sits under the needle's hub, then the label
  const belowH = 20 + valueFont + 16 + blockHeight(label, T.label.lineHeight) + (source ? 20 + source.size * 1.25 : 0);
  // dial (radius + zone labels above it) and the label block must fit the safe box together
  const total = R + THICK / 2 + 60 + belowH;
  const cy = (SAFE_H - total) / 2 + 60 + R + THICK / 2;
  // zone names sit just outside the dial, centred on their zone; one that would touch another is left out
  const cx = SAFE_W / 2;
  const frac = (v: number) => Math.max(0, Math.min(1, (v - input.min) / (input.max - input.min)));
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const zoneBoxes = input.zones.map((z, i) => {
    const lab = zoneLabels[i];
    if (!lab) return null;
    const f = (frac(z.from) + frac(z.to)) / 2;
    const r = R + THICK / 2 + 28;
    const px = cx + Math.cos(Math.PI * (1 - f)) * r;
    const py = cy - Math.sin(Math.PI * (1 - f)) * r;
    const w = Math.ceil(measure(lab.text, lab.size, 700)) + 8;
    const h = Math.ceil(lab.size * 1.2);
    // anchor away from the dial: left side labels end at the point, right side labels start there
    const x = f < 0.35 ? px - w : f > 0.65 ? px : px - w / 2;
    const b = { x, y: py - h / 2 - (f > 0.2 && f < 0.8 ? h / 2 : 0), w, h };
    if (b.x < 0 || b.y < 0 || b.x + w > SAFE_W || placed.some((q) => b.x < q.x + q.w + 10 && b.x + b.w + 10 > q.x && b.y < q.y + q.h + 4 && b.y + b.h + 4 > q.y)) return null;
    placed.push(b);
    return b;
  });
  return { cx, cy, zones: input.zones, zoneLabels, zoneBoxes, valueText, valueFont, label, source, min: input.min, max: input.max, fmt: f.fmt, ends: [f.fmt(input.min), f.fmt(input.max)] };
}

export function planGauge(hasSource: boolean, duration: number, cueTimes?: number[]): Plan {
  const units: Unit[] = [
    { key: 'gauge', label: 'Dial', start: 4, dur: 18, cue: 0 },
    { key: 'needle', label: 'Needle', start: 22, dur: 36, cue: 1 },
    { key: 'label', label: 'Label', start: 44, dur: 16, cue: 2 },
  ];
  if (hasSource) units.push({ key: 'source', label: 'Source', start: 64, dur: 12, cue: 3 });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareDV12(props: Record<string, unknown>, durationInFrames: number) {
  const S = DV12_SPEC.text;
  const A = (k: string) => readAnim(props, DV12_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DV12_SPEC, props);
  const measure = measureFor(style);
  const min = readNumber(props.min) ?? 0;
  const rawZones = (Array.isArray(props.zones) ? props.zones : [])
    .map((x) => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const to = readNumber(o.to);
      return to !== undefined ? { to, label: normaliseText(typeof o.label === 'string' ? o.label : '', ZONE_LABEL), tone: typeof o.tone === 'string' ? o.tone : 'neutral' } : null;
    })
    .filter((z): z is { to: number; label: string; tone: string } => z !== null && z.to > min)
    .sort((a, b) => a.to - b.to)
    .slice(0, 5);
  let max = readNumber(props.max) ?? (rawZones.length ? rawZones[rawZones.length - 1].to : 100);
  if (max <= min) max = min + 1;
  let prev = min;
  const zones: Zone[] = rawZones.filter((z) => z.to <= max).map((z) => {
    const zz = { from: prev, to: z.to, label: z.label, tone: z.tone };
    prev = z.to;
    return zz;
  });
  if (!zones.length) zones.push({ from: min, to: max, label: '', tone: 'neutral' });
  else if (prev < max) zones.push({ from: prev, to: max, label: '', tone: 'neutral' });
  const value = readNumber(props.value) ?? min;
  const L = layoutGauge({ value, min, max, zones, label: normaliseText(readFirst(props, ['label', 'title']), S.label), source: normaliseText(readFirst(props, ['source']), S.source), prefix: normaliseText(readFirst(props, ['prefix']), S.prefix), unit: normaliseText(readFirst(props, ['unit']), S.unit), format: opt(props, 'format', NUMBER_FORMATS, 'plain'), decimals: opt(props, 'decimals', ['auto', '0', '1', '2'] as const, 'auto') }, measure, sized.spec);
  const plan = planGauge(Boolean(L.source), durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, value, L, plan, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

function DV12GaugeBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, value, L, plan, imageUrl, bg, debug } = prepareDV12(props, durationInFrames);
  const w = plan.windows;
  const S = DV12_SPEC.text;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const TONE: Record<string, string> = { good: style.colors.positive, ok: '#A3D977', warn: '#F5B83D', bad: style.colors.negative, neutral: withAlpha(style.colors.text, 0.3) };
  // the dial runs from the left end (min) over the top to the right end (max)
  const frac = (v: number) => Math.max(0, Math.min(1, (v - L.min) / (L.max - L.min)));
  const gp = A('gauge') === 'none' ? 1 : easeInOutCubic(progress(frame, w.gauge.start, w.gauge.dur));
  const np = A('needle') === 'none' || A('needle') === 'static' ? (frame >= w.needle.start ? 1 : 0) : easeInOutCubic(progress(frame, w.needle.start, w.needle.dur));
  // a small overshoot then settle, like a real needle
  const settle = np < 1 ? np : 1;
  const overshoot = np >= 1 ? 0 : Math.sin(np * Math.PI) * 0.03;
  const nf = Math.min(1, frac(value) * settle + overshoot);
  const ang = Math.PI * (1 - nf); // radians from the positive x axis
  const shown = A('needle') === 'count_up' && np < 1 ? L.fmt(L.min + (value - L.min) * np) : L.valueText;
  const pt = (f: number, r: number) => ({ x: L.cx + Math.cos(Math.PI * (1 - f)) * r, y: L.cy - Math.sin(Math.PI * (1 - f)) * r });
  const band = (f0: number, f1: number) => {
    const a = pt(f0, R);
    const b = pt(f1, R);
    return `M ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y}`;
  };
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={style.colors.accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          <svg {...guide('dial', 'zones')} width={SAFE_W} height={SAFE_H} style={{ position: 'absolute', left: 0, top: 0 }}>
            <path d={band(0, 1)} fill="none" stroke={withAlpha(style.colors.text, 0.08)} strokeWidth={THICK} />
            {L.zones.map((z, i) => {
              const f0 = frac(z.from);
              const f1 = Math.min(frac(z.to), gp);
              if (f1 <= f0) return null;
              return <path key={i} d={band(f0 + 0.004, f1 - 0.004)} fill="none" stroke={TONE[z.tone] ?? TONE.neutral} strokeWidth={THICK} />;
            })}
            {/* needle */}
            {np > 0 && (
              <>
                <line x1={L.cx} y1={L.cy} x2={L.cx + Math.cos(ang) * (R - THICK * 0.2)} y2={L.cy - Math.sin(ang) * (R - THICK * 0.2)} stroke={style.colors.text} strokeWidth={10} strokeLinecap="round" />
                <circle cx={L.cx} cy={L.cy} r={22} fill={style.colors.text} />
              </>
            )}
          </svg>
          {L.zones.map((z, i) => {
            const lab = L.zoneLabels[i];
            const b = L.zoneBoxes[i];
            if (!lab || !b) return null;
            return (
              <span key={i} {...leaf(`zone-${i}`, `zones[${i}].label`)} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, textAlign: 'center', fontFamily: fontFor(700), fontWeight: 700, fontSize: lab.size, lineHeight: 1.2, color: TONE[z.tone] ?? mutedFor(style, onFootage), whiteSpace: 'nowrap', opacity: gp >= frac(z.to) - 0.01 ? 1 : 0 }}>
                {lab.text}
              </span>
            );
          })}
          <span {...leaf('value', 'value')} style={{ position: 'absolute', left: L.cx - R * 0.6, width: R * 1.2, top: L.cy + THICK / 2 + 20, textAlign: 'center', fontFamily: fontFor(800), fontWeight: 800, fontSize: L.valueFont, lineHeight: 1, color: style.colors.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', textShadow: shadow, opacity: np > 0 ? 1 : 0 }}>
            {shown}
          </span>
          {([0, 1] as const).map((k) => (
            <span key={k} {...leaf(`end-${k}`, k ? 'max' : 'min')} style={{ position: 'absolute', left: k ? L.cx + R - THICK / 2 - 75 : L.cx - R + THICK / 2 - 75, width: 150, top: L.cy + THICK / 2 + 6, textAlign: 'center', fontFamily: fontFor(600), fontWeight: 600, fontSize: 22, lineHeight: 1.2, color: mutedFor(style, onFootage), whiteSpace: 'nowrap', opacity: gp }}>
              {L.ends[k]}
            </span>
          ))}
          <AnimatedText lines={L.label} anim={A('label')} start={w.label.start} dur={w.label.dur} frame={frame} weight={S.label.weight} lineHeight={S.label.lineHeight} shadow={shadow} align="center" group="label" input="label" style={{ position: 'absolute', left: 0, width: SAFE_W, top: L.cy + THICK / 2 + 20 + L.valueFont + 16 }} />
          {L.source && w.source && <span {...leaf('source', 'source')} style={{ position: 'absolute', left: 0, bottom: 0, width: SAFE_W, textAlign: 'center', fontFamily: fontFor(500), fontWeight: 500, fontSize: L.source.size, lineHeight: 1.25, color: withAlpha(style.colors.muted, 0.85), whiteSpace: 'nowrap', opacity: progress(frame, w.source.start, w.source.dur) }}>{L.source.text}</span>}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const DV12Gauge = withAutoFit(DV12GaugeBase);
