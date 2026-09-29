'use client';

/**
 * KT-03 · Stacked Kinetic Text  (animation_type: "kt_stacked_text")
 * 2–4 short lines of different sizes, revealed one after another — punchy multi-part statements:
 * "Not ₹10 lakh. / Not ₹1 crore. / ₹100 crore."  Each line can be small, normal or big, and accented.
 *
 * Inputs (full list, limits and JSON Schema: KT03StackedText.inputs.json):
 *   lines[] { text, size, accent } · image_url · align · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [line 1, line 2, …]
 * Timing: 1.5–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText, words, type Line, type Measure } from './core/fit';
import { exitStyle, progress, textAnimFrames } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { OVERLAY_DURATION } from './core/overlay';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { readStyle, styleVars } from './core/style';
import { AnimatedText, StoryBackground, readBgMode } from './core/shared';
import { withAutoFit } from './core/autofit';

export const KT03_SPEC: TemplateSpec = {
  id: 'KT-03',
  animationType: 'kt_stacked_text',
  name: 'Stacked Kinetic Text',
  pickWhen: 'A punchy statement in 2–4 beats, often building up: "Not ₹10 lakh. Not ₹1 crore. ₹100 crore."',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: OVERLAY_DURATION,
  text: {},
  lists: {
    lines: {
      label: 'Line',
      fills: 'Lines top to bottom, revealed in order',
      minItems: 2,
      maxItems: 4,
      fields: {
        text: { label: 'Text', required: true, minChars: 1, maxChars: 28, minWords: 1, maxWords: 6, maxWordChars: 16, maxLines: 1, fontMax: 200, fontMin: 44, weight: 800, lineHeight: 1.05, hint: 'Short: one beat per line.', fills: 'Line text' },
      },
      numbers: {
        size: { label: 'Size', required: false, fills: '1 = small, 2 = normal (default), 3 = big', min: 1, max: 3, integer: true },
        accent: { label: 'Accent', required: false, fills: '1 = draw this line in the accent colour', min: 0, max: 1, integer: true },
      },
    },
  },
  options: {
    align: { label: 'Align', values: ['center', 'left'], default: 'center', fills: 'Horizontal alignment' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    lines: { label: 'Lines', kind: 'text', target: 'each line', default: 'slam' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all lines', default: 'fade_up' },
  },
  cues: { description: 'One cue per line, when that beat is spoken.', units: ['line 1', 'line 2', 'line 3', 'line 4'] },
  colors: [],
  example: {
    lines: [
      { text: 'Not ₹10 lakh.', size: 2 },
      { text: 'Not ₹1 crore.', size: 2 },
      { text: '₹100 crore.', size: 3, accent: 1 },
    ],
    align: 'center',
    background: 'theme',
  },
};

export type StackLine = { text: string; size: 1 | 2 | 3; accent: boolean };
const SCALE = { 1: 0.5, 2: 0.72, 3: 1 } as const;
const GAP = 18;
export type StackLayout = { lines: Line[]; blockH: number };

export function layoutStack(input: { lines: StackLine[] }, measure: Measure, spec: TemplateSpec = KT03_SPEC): StackLayout {
  const F = spec.lists.lines.fields.text;
  let cap = F.fontMax;
  for (;;) {
    const lines = input.lines.map((l) => {
      const r = { ...F, weight: l.size === 1 ? 600 : F.weight, fontMax: Math.max(F.fontMin, Math.round(cap * SCALE[l.size])), fontMin: Math.min(F.fontMin, Math.round(cap * SCALE[l.size])) };
      return fitText(l.text, r, SAFE_W, measure, false).lines[0];
    });
    const blockH = lines.reduce((a, l) => a + l.size * F.lineHeight, 0) + GAP * (lines.length - 1);
    if (blockH <= SAFE_H || cap <= F.fontMin) return { lines, blockH };
    cap -= 8;
  }
}

export function planStack(L: StackLayout, anim: string, duration: number, cueTimes?: number[]): Plan {
  const n = L.lines.length;
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const gap = n > 1 ? Math.max(6, Math.min(24, Math.floor((budget - 6 - 16) / (n - 1)))) : 0;
  const units: Unit[] = L.lines.map((l, i) => ({ key: `line${i}`, label: `Line ${i + 1}`, start: 4 + i * gap, dur: textAnimFrames(anim, words(l.text).length, l.text.length, 12), cue: i }));
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareKT03(props: Record<string, unknown>, durationInFrames: number) {
  const LS = KT03_SPEC.lists.lines;
  const A = (k: string) => readAnim(props, KT03_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(KT03_SPEC, props);
  const measure = measureFor(style);
  const lines: StackLine[] = (Array.isArray(props.lines) ? props.lines : [])
    .map((l): StackLine | null => {
      const o = (typeof l === 'string' ? { text: l } : l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
      const text = typeof o.text === 'string' ? normaliseText(o.text, LS.fields.text) : '';
      const sz = o.size === 1 || o.size === 3 ? o.size : 2;
      return text ? { text, size: sz as 1 | 2 | 3, accent: o.accent === 1 || o.accent === true } : null;
    })
    .filter((l): l is StackLine => l !== null)
    .slice(0, LS.maxItems);
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const L = layoutStack({ lines }, measure, sized.spec);
  const plan = planStack(L, A('lines'), durationInFrames, readCues(props));
  return { style, sized, A, lines, L, plan, imageUrl, bg, align: opt(props, 'align', ['center', 'left'] as const, 'center'), debug: props.show_safe_area === true };
}

function KT03StackedTextBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, lines, L, plan, imageUrl, bg, align, debug } = prepareKT03(props, durationInFrames);
  const w = plan.windows;
  const F = KT03_SPEC.lists.lines.fields.text;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const shadow = bg === 'theme' ? 'none' : '0 6px 32px rgba(0,0,0,0.6)';
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      {bg !== 'transparent' && <StoryBackground mode={bg} imageUrl={imageUrl} align={align} accent={style.colors.accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />}
      {bg === 'transparent' && <StoryBackground mode="transparent" align={align} accent={style.colors.accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} />}
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: align === 'center' ? 'center' : 'flex-start', gap: GAP, ...exit }}>
          {L.lines.map((l, i) => (
            <AnimatedText
              key={i}
              lines={[l]}
              anim={A('lines')}
              start={w[`line${i}`].start}
              dur={w[`line${i}`].dur}
              frame={frame}
              weight={lines[i].size === 1 ? 600 : F.weight}
              lineHeight={F.lineHeight}
              letterSpacing="-0.02em"
              color={lines[i].accent ? style.colors.accent : style.colors.text}
              shadow={shadow}
              align={align}
              group={`line-${i}`}
              input={`lines[${i}].text`}
            />
          ))}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const KT03StackedText = withAutoFit(KT03StackedTextBase);
