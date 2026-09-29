'use client';

/**
 * DG-10 · Funnel  (animation_type: "dg_funnel")
 * 3–6 stages narrowing top to bottom — sales / user / hiring funnels, "1 crore applied, 1,000 selected".
 * Each band can carry a number (counts up) and the share kept from the stage above; stage names sit in a
 * column beside the funnel.
 *
 * Inputs (full list, limits and JSON Schema: DG10Funnel.inputs.json):
 *   title · stages[] { label, sub, value } · prefix · unit · source · image_url
 *   show_rates · format · decimals · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, stage 1…6]
 * Timing: 3–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText, linesAt, sharedFont, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, progress } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { FORMAT_HELP, NUMBER_FORMATS, readNumber, type NumberFormat } from './core/numbers';
import { axisFormatter } from './core/chart';
import { numberAnimState } from './core/numberRow';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, guide, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

export const DG10_SPEC: TemplateSpec = {
  id: 'DG-10',
  animationType: 'dg_funnel',
  name: 'Funnel',
  pickWhen: 'Something narrows stage by stage: applicants → selected, visitors → buyers, users → paying users.',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 180, max: 240 },
  text: {
    title: { label: 'Heading', required: false, minChars: 3, maxChars: 44, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 1, fontMax: 52, fontMin: 36, weight: 800, lineHeight: 1.05, fills: 'Heading above the funnel', example: 'From applicant to officer (illustrative)' },
    prefix: { label: 'Prefix', required: false, minChars: 1, maxChars: 3, minWords: 1, maxWords: 1, maxWordChars: 3, maxLines: 1, fontMax: 40, fontMin: 16, weight: 800, lineHeight: 1, fills: 'Symbol before values', noSize: true },
    unit: { label: 'Unit', required: false, minChars: 1, maxChars: 8, minWords: 1, maxWords: 1, maxWordChars: 8, maxLines: 1, fontMax: 40, fontMin: 16, weight: 800, lineHeight: 1, fills: 'Unit after values', noSize: true },
    source: { label: 'Source', required: false, minChars: 3, maxChars: 60, minWords: 1, maxWords: 10, maxWordChars: 18, maxLines: 1, fontMax: 22, fontMin: 16, weight: 500, lineHeight: 1.25, fills: 'Source line' },
  },
  lists: {
    stages: {
      label: 'Stage',
      fills: 'Stages, widest (first) to narrowest (last)',
      minItems: 3,
      maxItems: 6,
      fields: {
        label: { label: 'Label', required: true, minChars: 2, maxChars: 26, minWords: 1, maxWords: 5, maxWordChars: 16, maxLines: 1, fontMax: 36, fontMin: 22, weight: 800, lineHeight: 1.15, fills: 'Stage name' },
        sub: { label: 'Sub-line', required: false, minChars: 2, maxChars: 40, minWords: 1, maxWords: 7, maxWordChars: 16, maxLines: 1, fontMax: 24, fontMin: 16, weight: 500, lineHeight: 1.25, fills: 'Detail under the stage name' },
      },
      numbers: { value: { label: 'Value', required: false, fills: 'How many at this stage (raw number)' } },
    },
  },
  options: {
    show_rates: { label: 'Rates', values: ['on', 'off'], default: 'on', fills: 'Show the % kept from the stage above (needs values)' },
    format: { label: 'Number format', values: [...NUMBER_FORMATS], default: 'indian_compact', fills: FORMAT_HELP },
    decimals: { label: 'Decimals', values: ['auto', '0', '1', '2'], default: 'auto', fills: 'Decimal places shown' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    bands: { label: 'Bands', kind: 'card', target: 'each funnel band', default: 'slide_up' },
    values: { label: 'Values', kind: 'number', target: 'numbers in the bands', default: 'count_up' },
    labels: { label: 'Stage labels', kind: 'text', target: 'names beside the funnel', default: 'slide_left' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the funnel', default: 'fade_up' },
  },
  cues: { description: 'Fixed slots: heading → stage 1 … stage 6.', units: ['heading', 'stage 1', 'stage 2', 'stage 3', 'stage 4', 'stage 5', 'stage 6'] },
  colors: [],
  example: {
    title: 'From applicant to officer (illustrative)',
    stages: [
      { label: 'Applied', value: 1300000 },
      { label: 'Prelims cleared', value: 14000 },
      { label: 'Mains cleared', value: 2800 },
      { label: 'Selected', sub: 'Across all services', value: 1000 },
    ],
    format: 'indian_full',
    background: 'theme',
  },
};

type Stage = { label: string; sub: string; value?: number };
export const FUNNEL_W = 1000;
export const BAND_GAP = 10;
export const COL_GAP = 60;
export type FunnelLayout = { title: Line[]; titleH: number; source?: Line; top: number; bandH: number; widths: number[]; labels: Line[]; subs: (Line | undefined)[]; valueTexts: string[]; fmt: (v: number) => string; valueFont: number; rates: string[]; rateFont: number; colX: number; colW: number };

export function layoutFunnel(input: { title: string; source: string; stages: Stage[]; prefix: string; unit: string; format: NumberFormat; decimals: string; rates: boolean }, measure: Measure, spec: TemplateSpec = DG10_SPEC): FunnelLayout {
  const F = spec.lists.stages.fields;
  const n = Math.max(1, input.stages.length);
  const title = input.title ? fitText(input.title, spec.text.title, SAFE_W, measure, false).lines : [];
  const titleH = title.length ? title[0].size * 1.05 + 30 : 0;
  const source = input.source ? fitText(input.source, spec.text.source, SAFE_W, measure, false).lines[0] : undefined;
  const sourceH = source ? source.size * 1.25 + 20 : 0;
  const avail = SAFE_H - titleH - sourceH;
  const bandH = Math.min(150, (avail - BAND_GAP * (n - 1)) / n);
  const top = titleH + (avail - (bandH * n + BAND_GAP * (n - 1))) / 2;
  // each band's width at its top edge; the last band ends at 36% of the top width
  const widths = Array.from({ length: n + 1 }, (_, i) => FUNNEL_W * (1 - (0.64 * i) / n));
  const colX = FUNNEL_W + COL_GAP;
  const colW = SAFE_W - colX;
  const lf = sharedFont(input.stages.map((s) => s.label), F.label, colW, measure, Math.min(F.label.fontMax, Math.round(bandH * 0.36)));
  const labels = input.stages.map((s) => linesAt(s.label, lf, F.label, colW, measure, false)[0]);
  const hasSub = input.stages.some((s) => s.sub);
  const sf = hasSub ? sharedFont(input.stages.map((s) => s.sub || ' '), F.sub, colW, measure, Math.min(F.sub.fontMax, Math.round(lf * 0.7))) : 0;
  const subs = input.stages.map((s) => (s.sub ? linesAt(s.sub, sf, F.sub, colW, measure, false)[0] : undefined));
  const vals = input.stages.map((s) => s.value).filter((v): v is number => v !== undefined);
  const f = vals.length ? axisFormatter(vals, input.format, input.decimals, input.prefix, input.unit) : null;
  const valueTexts = input.stages.map((s) => (s.value !== undefined && f ? f.fmt(s.value) : ''));
  const rates = input.stages.map((s, i) => {
    const prev = input.stages[i - 1]?.value;
    if (!input.rates || i === 0 || s.value === undefined || !prev) return '';
    const r = (s.value / prev) * 100;
    return `${r >= 10 ? Math.round(r) : r >= 1 ? r.toFixed(1) : r.toFixed(2)}% of previous`;
  });
  // numbers fit the narrowest part of their band
  let valueFont = Math.min(56, Math.round(bandH * 0.42));
  const narrow = (i: number) => widths[i + 1] * 0.8;
  while (valueFont > 18 && valueTexts.some((t, i) => t && measure(t, valueFont, 800) > narrow(i))) valueFont -= 2;
  let rateFont = Math.max(14, Math.round(valueFont * 0.45));
  while (rateFont > 12 && rates.some((t, i) => t && measure(t, rateFont, 600) > narrow(i))) rateFont -= 1;
  const rateFits = bandH >= valueFont * 1.1 + rateFont * 1.25 + 8;
  return { title, titleH, source, top, bandH, widths, labels, subs, valueTexts, fmt: f ? f.fmt : String, valueFont, rates: rateFits ? rates : rates.map(() => ''), rateFont, colX, colW };
}

export function planFunnel(n: number, hasTitle: boolean, duration: number, cueTimes?: number[]): Plan {
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const first = hasTitle ? 16 : 6;
  const gap = n > 1 ? Math.max(6, Math.min(26, Math.floor((budget - first - 30) / (n - 1)))) : 0;
  const units: Unit[] = [];
  if (hasTitle) units.push({ key: 'title', label: 'Heading', start: 2, dur: 14, cue: 0 });
  for (let i = 0; i < n; i++) {
    units.push({ key: `band${i}`, label: `Stage ${i + 1}`, start: first + i * gap, dur: 14, cue: 1 + i });
    units.push({ key: `value${i}`, label: `Stage ${i + 1} value`, start: first + i * gap + 4, dur: 26, follows: { key: `band${i}`, offset: 4 } });
    units.push({ key: `label${i}`, label: `Stage ${i + 1} label`, start: first + i * gap + 2, dur: 14, follows: { key: `band${i}`, offset: 2 } });
  }
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareDG10(props: Record<string, unknown>, durationInFrames: number) {
  const S = DG10_SPEC.text;
  const F = DG10_SPEC.lists.stages.fields;
  const A = (k: string) => readAnim(props, DG10_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DG10_SPEC, props);
  const measure = measureFor(style);
  const stages: Stage[] = (Array.isArray(props.stages) ? props.stages : [])
    .map((x) => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      return { label: normaliseText(typeof o.label === 'string' ? o.label : '', F.label), sub: normaliseText(typeof o.sub === 'string' ? o.sub : '', F.sub), value: readNumber(o.value) };
    })
    .filter((s) => s.label)
    .slice(0, 6);
  const L = layoutFunnel(
    { title: normaliseText(readFirst(props, ['title']), S.title), source: normaliseText(readFirst(props, ['source']), S.source), stages, prefix: normaliseText(readFirst(props, ['prefix']), S.prefix), unit: normaliseText(readFirst(props, ['unit']), S.unit), format: opt(props, 'format', NUMBER_FORMATS, 'indian_compact'), decimals: opt(props, 'decimals', ['auto', '0', '1', '2'] as const, 'auto'), rates: opt(props, 'show_rates', ['on', 'off'] as const, 'on') === 'on' },
    measure,
    sized.spec,
  );
  const plan = planFunnel(stages.length, L.title.length > 0, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, stages, L, plan, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

function DG10FunnelBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, stages, L, plan, imageUrl, bg, debug } = prepareDG10(props, durationInFrames);
  const w = plan.windows;
  const F = DG10_SPEC.lists.stages.fields;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const n = stages.length;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="left" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.title.length > 0 && w.title && <AnimatedText lines={L.title} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={800} lineHeight={1.05} shadow={shadow} group="title" input="title" />}
          {stages.map((s, i) => {
            const y = L.top + i * (L.bandH + BAND_GAP);
            const wt = L.widths[i];
            const wb = L.widths[i + 1];
            const bw = w[`band${i}`];
            const vw = w[`value${i}`];
            const lw = w[`label${i}`];
            const vp = progress(frame, vw.start, vw.dur);
            const vs = numberAnimState(A('values'), vp);
            const valueText = s.value !== undefined && vs.counting && vs.countP < 1 ? L.fmt(s.value * vs.countP) : L.valueTexts[i];
            const labelBlock = L.labels[i].size * F.label.lineHeight + (L.subs[i] ? L.subs[i]!.size * F.sub.lineHeight : 0);
            return (
              <div key={i}>
                <div style={{ position: 'absolute', left: 0, top: y, width: 1000, height: L.bandH, ...cardStyle(A('bands'), progress(frame, bw.start, bw.dur)) }}>
                  <svg {...guide(`band-${i}`, `stages[${i}]`)} width={1000} height={L.bandH} style={{ position: 'absolute', left: 0, top: 0 }}>
                    <path d={`M ${(1000 - wt) / 2} 0 H ${(1000 + wt) / 2} L ${(1000 + wb) / 2} ${L.bandH} H ${(1000 - wb) / 2} Z`} fill={withAlpha(accent, 1 - (0.5 * i) / Math.max(1, n - 1))} />
                  </svg>
                  {L.valueTexts[i] && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span {...leaf(`value-${i}`, `stages[${i}].value`)} style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: L.valueFont, lineHeight: 1.1, color: style.colors.on_accent, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', opacity: vs.counting ? Math.min(1, vp * 4) : vp > 0 ? 1 : 0 }}>{valueText}</span>
                      {L.rates[i] && <span {...leaf(`rate-${i}`, 'rate (computed)')} style={{ fontFamily: fontFor(600), fontWeight: 600, fontSize: L.rateFont, lineHeight: 1.25, color: withAlpha(style.colors.on_accent, 0.85), whiteSpace: 'nowrap', opacity: progress(frame, vw.start + vw.dur - 6, 8) }}>{L.rates[i]}</span>}
                    </div>
                  )}
                </div>
                <div style={{ position: 'absolute', left: L.colX, top: y + (L.bandH - labelBlock) / 2, width: L.colW, display: 'flex', flexDirection: 'column' }}>
                  <AnimatedText lines={[L.labels[i]]} anim={A('labels')} start={lw.start} dur={lw.dur} frame={frame} weight={F.label.weight} lineHeight={F.label.lineHeight} shadow={shadow} group={`label-${i}`} input={`stages[${i}].label`} />
                  {L.subs[i] && <span {...leaf(`sub-${i}`, `stages[${i}].sub`)} style={{ fontFamily: fontFor(500), fontWeight: 500, fontSize: L.subs[i]!.size, lineHeight: F.sub.lineHeight, color: mutedFor(style, onFootage), whiteSpace: 'nowrap', opacity: progress(frame, lw.start + 4, lw.dur) }}>{L.subs[i]!.text}</span>}
                </div>
              </div>
            );
          })}
          {L.source && <span {...leaf('source', 'source')} style={{ position: 'absolute', left: 0, bottom: 0, fontFamily: fontFor(500), fontWeight: 500, fontSize: L.source.size, lineHeight: 1.25, color: withAlpha(style.colors.muted, 0.85), whiteSpace: 'nowrap' }}>{L.source.text}</span>}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const DG10Funnel = withAutoFit(DG10FunnelBase);
