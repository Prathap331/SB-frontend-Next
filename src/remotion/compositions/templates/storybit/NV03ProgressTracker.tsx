'use client';

/**
 * NV-03 · Progress Tracker  (animation_type: "nv_progress_tracker")   — overlay on footage
 * A slim bar at the top (or bottom) showing where the viewer is in the video: 2–8 named sections, the
 * finished ones filled, the current one filling up and highlighted. Keeps people watching long videos.
 *
 * Inputs (full list, limits and JSON Schema: NV03ProgressTracker.inputs.json):
 *   sections[] { label } · current (required) · position · look
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [bar, fill]
 * current = number of the section now playing (1 = first).
 * Timing: 1.5–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readNonEmptyString } from '../../../props';
import { applySizes, normaliseText, readAnim, type TemplateSpec, type TextSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { sharedFont, linesAt, type Line, type Measure } from './core/fit';
import { cardStyle, easeInOutCubic, exitStyle, progress } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { readNumber } from './core/numbers';
import { OVERLAY_DURATION } from './core/overlay';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, readStyle, styleVars, withAlpha } from './core/style';
import { leaf } from './core/shared';

const LABEL: TextSpec = { label: 'Label', required: true, minChars: 1, maxChars: 22, minWords: 1, maxWords: 4, maxWordChars: 16, maxLines: 1, fontMax: 26, fontMin: 14, weight: 700, lineHeight: 1.2, fills: 'Section name' };

export const NV03_SPEC: TemplateSpec = {
  id: 'NV-03',
  animationType: 'nv_progress_tracker',
  name: 'Progress Tracker',
  pickWhen: 'At the start of each section of a long video: shows the sections and where we are now.',
  placement: 'overlay',
  duration: OVERLAY_DURATION,
  numbers: { current: { label: 'Current section', required: true, fills: 'Number of the section now starting (1 = first)', min: 1, max: 8, integer: true, example: 2 } },
  text: {},
  lists: { sections: { label: 'Section', fills: 'Sections of the video in order', minItems: 2, maxItems: 8, fields: { label: LABEL } } },
  options: {
    position: { label: 'Position', values: ['top', 'bottom'], default: 'top', fills: 'Top or bottom of the safe area' },
    look: { label: 'Look', values: ['segments', 'line'], default: 'segments', fills: 'segments: a pill per section · line: one thin line with dots and names under it' },
  },
  animations: {
    bar: { label: 'Bar', kind: 'card', target: 'the tracker', default: 'fade' },
    fill: { label: 'Fill', kind: 'shape', target: 'the current section filling up', default: 'grow' },
    exit: { label: 'Exit', kind: 'exit', target: 'the tracker', default: 'fade' },
  },
  cues: { description: 'bar → fill (the new section begins).', units: ['bar', 'fill'] },
  colors: [],
  example: { sections: [{ label: 'The idea' }, { label: 'The rise' }, { label: 'The crash' }, { label: 'What now' }], current: 3, position: 'top', look: 'segments' },
};

export const BAR_H = 56;
export type TrackerLayout = { labels: Line[]; segW: number[]; totalW: number; gap: number };

export function layoutTracker(input: { labels: string[] }, measure: Measure): TrackerLayout {
  const n = Math.max(1, input.labels.length);
  const gap = 10;
  const avail = SAFE_W - gap * (n - 1);
  // equal segments when everything fits, otherwise the font shrinks until it does
  const f = sharedFont(input.labels, LABEL, avail / n - 36, measure);
  const labels = input.labels.map((t) => linesAt(t, f, LABEL, avail / n - 36, measure, false)[0]);
  const segW = labels.map(() => avail / n);
  return { labels, segW, totalW: SAFE_W, gap };
}

export function planTracker(duration: number, cueTimes?: number[]): Plan {
  const units: Unit[] = [
    { key: 'bar', label: 'Bar', start: 2, dur: 12, cue: 0 },
    { key: 'fill', label: 'Fill', start: 14, dur: 24, cue: 1 },
  ];
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareNV03(props: Record<string, unknown>, durationInFrames: number) {
  const A = (k: string) => readAnim(props, NV03_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(NV03_SPEC, props);
  const labels = (Array.isArray(props.sections) ? props.sections : []).map((x) => normaliseText(typeof x === 'string' ? x : x && typeof x === 'object' && typeof (x as Record<string, unknown>).label === 'string' ? ((x as Record<string, unknown>).label as string) : '', LABEL)).filter(Boolean).slice(0, 8);
  const L = layoutTracker({ labels }, measureFor(style));
  const current = Math.max(0, Math.min(labels.length - 1, Math.round(readNumber(props.current) ?? 1) - 1));
  const plan = planTracker(durationInFrames, readCues(props));
  return { style, sized, A, L, plan, current, bottom: opt(props, 'position', ['top', 'bottom'] as const, 'top') === 'bottom', line: opt(props, 'look', ['segments', 'line'] as const, 'segments') === 'line', debug: props.show_safe_area === true };
}

export function NV03ProgressTracker({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, current, bottom, line, debug } = prepareNV03(props, durationInFrames);
  const w = plan.windows;
  const accent = style.colors.accent;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const fp = A('fill') === 'none' ? (frame >= w.fill.start ? 1 : 0) : easeInOutCubic(progress(frame, w.fill.start, w.fill.dur));
  const n = L.labels.length;
  const top = bottom ? SAFE_H - (line ? 76 : BAR_H) : 0;
  let x = 0;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', left: 0, top, width: SAFE_W, height: line ? 76 : BAR_H, ...exit, ...cardStyle(A('bar'), progress(frame, w.bar.start, w.bar.dur)) }}>
          {line ? (
            <>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 12, height: 6, borderRadius: 3, background: withAlpha('#FFFFFF', 0.3) }} />
              <div style={{ position: 'absolute', left: 0, top: 12, height: 6, borderRadius: 3, background: accent, width: (SAFE_W / n) * (current + fp * 0.5) }} />
              {L.labels.map((lb, i) => {
                const cx = (SAFE_W / n) * (i + 0.5);
                const done = i < current || (i === current && fp > 0);
                return (
                  <div key={i}>
                    <div style={{ position: 'absolute', left: cx - 11, top: 4, width: 22, height: 22, borderRadius: '50%', background: done ? accent : '#3A3F55', border: '3px solid #FFFFFF', boxSizing: 'border-box' }} />
                    <span {...leaf(`section-${i}`, `sections[${i}].label`)} style={{ position: 'absolute', left: cx - L.segW[i] / 2 + 8, width: L.segW[i] - 16, top: 34, textAlign: 'center', fontFamily: fontFor(700), fontWeight: 700, fontSize: lb.size, lineHeight: 1.2, color: i === current ? accent : '#FFFFFF', whiteSpace: 'nowrap', textShadow: '0 2px 6px rgba(0,0,0,0.8)', opacity: i === current || done ? 1 : 0.75 }}>
                      {lb.text}
                    </span>
                  </div>
                );
              })}
            </>
          ) : (
            L.labels.map((lb, i) => {
              const left = x;
              x += L.segW[i] + L.gap;
              const fill = i < current ? 1 : i === current ? fp : 0;
              const cur = i === current;
              return (
                <div key={i} style={{ position: 'absolute', left, top: 0, width: L.segW[i], height: BAR_H, borderRadius: 12, overflow: 'hidden', background: withAlpha(style.colors.scrim, 0.7), border: cur ? `2px solid ${accent}` : `2px solid ${withAlpha('#FFFFFF', 0.12)}`, boxSizing: 'border-box' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, background: cur ? accent : withAlpha(accent, 0.45) }} />
                  <span {...leaf(`section-${i}`, `sections[${i}].label`)} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fontFor(700), fontWeight: 700, fontSize: lb.size, lineHeight: 1.2, color: cur && fill > 0.5 ? style.colors.on_accent : '#FFFFFF', whiteSpace: 'nowrap' }}>
                    {lb.text}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </SafeArea>
    </div>
  );
}
