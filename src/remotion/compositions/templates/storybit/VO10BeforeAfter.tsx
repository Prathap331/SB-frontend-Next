'use client';

/**
 * VO-10 · Before / After  (animation_type: "vo_before_after")
 * Two pictures of the same thing compared: a slider wipes from "before" to "after" (stopping half-way or
 * going all the way), or they sit side by side, or cross-fade. Labels and dates on each side.
 * Then-vs-now cities, construction progress, a river before and after pollution.
 *
 * Inputs (full list, limits and JSON Schema: VO10BeforeAfter.inputs.json):
 *   before_url (required) · after_url (required) · before_label · after_label · before_date · after_date · caption
 *   mode · stop_at · style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [before, reveal, caption]
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from 'remotion';
import type { TemplateProps } from '../../../types';
import { readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText, type Line, type Measure } from './core/fit';
import { easeInOutCubic, exitStyle, imageMotionStyle, progress } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_W, FRAME_W, FRAME_H, SAFE_MARGIN } from './core/safeArea';
import { fontFor, readStyle, styleVars, withAlpha } from './core/style';
import { FOOTAGE_SHADOW, guide, leaf, readFirst } from './core/shared';

export const VO10_SPEC: TemplateSpec = {
  id: 'VO-10',
  animationType: 'vo_before_after',
  name: 'Before / After',
  pickWhen: 'Then vs now, before vs after: the same place, product or person compared in two pictures.',
  placement: 'full',
  images: {
    before_url: { label: 'Before picture', required: true, fills: 'The "before" picture' },
    after_url: { label: 'After picture', required: true, fills: 'The "after" picture (same framing works best)' },
  },
  duration: { min: 90, default: 150, max: 240 },
  text: {
    before_label: { label: 'Before label', required: false, minChars: 2, maxChars: 16, minWords: 1, maxWords: 3, maxWordChars: 14, maxLines: 1, fontMax: 34, fontMin: 22, weight: 800, lineHeight: 1.2, hint: 'Default "Before" (e.g. "पहले").', fills: 'Label on the before side' },
    after_label: { label: 'After label', required: false, minChars: 2, maxChars: 16, minWords: 1, maxWords: 3, maxWordChars: 14, maxLines: 1, fontMax: 34, fontMin: 22, weight: 800, lineHeight: 1.2, hint: 'Default "After" (e.g. "अब").', fills: 'Label on the after side' },
    before_date: { label: 'Before date', required: false, minChars: 2, maxChars: 16, minWords: 1, maxWords: 3, maxWordChars: 12, maxLines: 1, fontMax: 26, fontMin: 18, weight: 600, lineHeight: 1.2, fills: 'Date under the before label', example: '2005' },
    after_date: { label: 'After date', required: false, minChars: 2, maxChars: 16, minWords: 1, maxWords: 3, maxWordChars: 12, maxLines: 1, fontMax: 26, fontMin: 18, weight: 600, lineHeight: 1.2, fills: 'Date under the after label', example: '2025' },
    caption: { label: 'Caption', required: false, minChars: 3, maxChars: 70, minWords: 1, maxWords: 12, maxWordChars: 18, maxLines: 1, fontMax: 34, fontMin: 22, weight: 700, lineHeight: 1.25, fills: 'Caption along the bottom' },
  },
  lists: {},
  options: {
    mode: { label: 'Mode', values: ['wipe', 'split', 'fade'], default: 'wipe', fills: 'wipe: a slider reveals the after picture · split: side by side · fade: before fades into after' },
    stop_at: { label: 'Wipe stops at', values: ['half', 'full'], default: 'half', fills: 'wipe only: slider rests in the middle (both visible) or goes all the way' },
  },
  animations: {
    image_motion: { label: 'Picture motion', kind: 'image_motion', target: 'slow movement inside both pictures', default: 'push_in' },
    labels: { label: 'Labels', kind: 'card', target: 'before / after labels', default: 'pop' },
    exit: { label: 'Exit', kind: 'exit', target: 'labels and caption', default: 'fade' },
  },
  cues: { description: 'before (the before picture is described) → reveal (the change) → caption.', units: ['before', 'reveal', 'caption'] },
  colors: [],
  example: { before_url: 'https://example.com/before.jpg', after_url: 'https://example.com/after.jpg', before_date: '2005', after_date: '2025', caption: 'The same street, twenty years apart (sample)', mode: 'wipe', stop_at: 'half' },
};

type Chip = { label: Line; date?: Line; w: number; h: number };
export type BALayout = { chips: [Chip, Chip]; caption?: Line };

export function layoutBA(input: { bl: string; al: string; bd: string; ad: string; caption: string }, measure: Measure, spec: TemplateSpec = VO10_SPEC): BALayout {
  const T = spec.text;
  const chip = (l: string, d: string, ls: typeof T.before_label, ds: typeof T.before_date): Chip => {
    const label = fitText(l.toLocaleUpperCase(), ls, 420, measure, false).lines[0];
    const date = d ? fitText(d, ds, 420, measure, false).lines[0] : undefined;
    const w = Math.ceil(Math.max(measure(label.text, label.size, 800) + label.size * 0.08 * label.text.length, date ? measure(date.text, date.size, 600) : 0)) + 36;
    const h = Math.ceil(label.size * 1.2 + (date ? date.size * 1.2 + 2 : 0) + 20);
    return { label, date, w, h };
  };
  return {
    chips: [chip(input.bl, input.bd, T.before_label, T.before_date), chip(input.al, input.ad, T.after_label, T.after_date)],
    caption: input.caption ? fitText(input.caption, T.caption, SAFE_W - 80, measure, false).lines[0] : undefined,
  };
}

export function planBA(hasCaption: boolean, duration: number, cueTimes?: number[]): Plan {
  const units: Unit[] = [
    { key: 'before', label: 'Before', start: 4, dur: 14, cue: 0 },
    { key: 'reveal', label: 'Reveal', start: 30, dur: 36, cue: 1 },
  ];
  if (hasCaption) units.push({ key: 'caption', label: 'Caption', start: 70, dur: 14, cue: 2 });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareVO10(props: Record<string, unknown>, durationInFrames: number) {
  const S = VO10_SPEC.text;
  const A = (k: string) => readAnim(props, VO10_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(VO10_SPEC, props);
  const L = layoutBA({ bl: normaliseText(readFirst(props, ['before_label']), S.before_label) || 'Before', al: normaliseText(readFirst(props, ['after_label']), S.after_label) || 'After', bd: normaliseText(readFirst(props, ['before_date']), S.before_date), ad: normaliseText(readFirst(props, ['after_date']), S.after_date), caption: normaliseText(readFirst(props, ['caption']), S.caption) }, measureFor(style), sized.spec);
  const plan = planBA(Boolean(L.caption), durationInFrames, readCues(props));
  return { style, sized, A, L, plan, before: readFirst(props, ['before_url']), after: readFirst(props, ['after_url']), mode: opt(props, 'mode', ['wipe', 'split', 'fade'] as const, 'wipe'), full: opt(props, 'stop_at', ['half', 'full'] as const, 'half') === 'full', debug: props.show_safe_area === true };
}

export function VO10BeforeAfter({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, before, after, mode, full, debug } = prepareVO10(props, durationInFrames);
  const w = plan.windows;
  const accent = style.colors.accent;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const motion = imageMotionStyle(A('image_motion'), frame / Math.max(1, durationInFrames));
  const rp = easeInOutCubic(progress(frame, w.reveal.start, w.reveal.dur));
  const pic = (src: string | undefined) => (src ? <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', ...motion }} /> : <div style={{ width: '100%', height: '100%', background: '#333' }} />);
  // wipe: the divider moves from the right edge to the middle (or all the way to the left)
  const divX = mode === 'wipe' ? FRAME_W * (1 - rp * (full ? 1 : 0.5)) : FRAME_W / 2;
  const bChip = L.chips[0];
  const aChip = L.chips[1];
  const chipEl = (c: Chip, key: string, input: string, x: number, show: number, col: string) => (
    <div key={key} {...leaf(`chip-${key}`, input)} style={{ position: 'absolute', left: x, top: 0, width: c.w, height: c.h, boxSizing: 'border-box', padding: '10px 18px', borderRadius: 14, background: withAlpha(style.colors.scrim, 0.78), borderLeft: `5px solid ${col}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: Math.min(1, show), transform: `scale(${0.9 + 0.1 * Math.min(1, show)})`, transformOrigin: 'left top' }}>
      <span style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: c.label.size, lineHeight: 1.2, letterSpacing: '0.08em', color: '#FFFFFF', whiteSpace: 'nowrap' }}>{c.label.text}</span>
      {c.date && <span style={{ fontFamily: fontFor(600), fontWeight: 600, fontSize: c.date.size, lineHeight: 1.2, color: col, whiteSpace: 'nowrap' }}>{c.date.text}</span>}
    </div>
  );
  const bShow = progress(frame, w.before.start, w.before.dur);
  const aShow = mode === 'wipe' ? progress(frame, w.reveal.start + w.reveal.dur * 0.3, 10) : progress(frame, w.reveal.start, 12);
  // in a full wipe or fade the before label leaves as the after picture takes over
  const bGone = (mode === 'wipe' && full) || mode === 'fade' ? 1 - progress(frame, w.reveal.start + w.reveal.dur * 0.6, 10) : 1;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000', ...styleVars(style) }}>
      {mode === 'split' ? (
        <>
          <div style={{ position: 'absolute', left: 0, top: 0, width: FRAME_W / 2 - 4, height: FRAME_H, overflow: 'hidden' }}>{pic(before)}</div>
          <div style={{ position: 'absolute', left: FRAME_W / 2 + 4, top: 0, width: FRAME_W / 2 - 4, height: FRAME_H, overflow: 'hidden', clipPath: `inset(0 ${(1 - rp) * 100}% 0 0)` }}>{pic(after)}</div>
        </>
      ) : (
        <>
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>{pic(before)}</div>
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...(mode === 'fade' ? { opacity: rp } : { clipPath: `inset(0 0 0 ${divX}px)` }) }}>{pic(after)}</div>
        </>
      )}
      {mode === 'wipe' && rp > 0 && rp < 1.01 && divX > 2 && (
        <>
          <div style={{ position: 'absolute', left: divX - 3, top: 0, width: 6, height: FRAME_H, background: '#FFFFFF', boxShadow: '0 0 16px rgba(0,0,0,0.6)' }} />
          {divX > SAFE_MARGIN + 40 && divX < FRAME_W - SAFE_MARGIN - 40 && (
            <div {...guide('handle', 'slider')} style={{ position: 'absolute', left: divX - 36, top: FRAME_H / 2 - 36, width: 72, height: 72, borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }}>
              <LucideIconView name="chevrons-left-right" size={36} color="#222222" />
            </div>
          )}
        </>
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 260, background: 'linear-gradient(0deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)' }} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {bShow * bGone > 0.001 && chipEl(bChip, 'before', 'before_label / before_date', 0, bShow * bGone, '#B8BCC8')}
          {chipEl(aChip, 'after', 'after_label / after_date', mode === 'wipe' && !full ? Math.min(SAFE_W - aChip.w, FRAME_W / 2 - SAFE_MARGIN + 24) : SAFE_W - aChip.w, aShow, accent)}
          {L.caption && w.caption && (
            <span {...leaf('caption', 'caption')} style={{ position: 'absolute', left: 0, bottom: 0, width: SAFE_W, textAlign: 'center', fontFamily: fontFor(700), fontWeight: 700, fontSize: L.caption.size, lineHeight: 1.25, color: '#FFFFFF', textShadow: FOOTAGE_SHADOW, whiteSpace: 'nowrap', opacity: progress(frame, w.caption.start, w.caption.dur) }}>
              {L.caption.text}
            </span>
          )}
        </div>
      </SafeArea>
    </div>
  );
}
