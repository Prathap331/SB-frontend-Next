'use client';

/**
 * VO-07 · Image Montage  (animation_type: "vo_image_montage")
 * 2–8 pictures shown one after another (≈ 0.8–2 s each): a quick montage or a chronological sequence.
 * Each picture can carry a label, a date and a value ("₹45 a litre"). Two looks:
 *   cut    — full-frame pictures that cut / fade / slide / zoom from one to the next, with slow motion
 *   stack  — photo cards dealt on top of each other, the earlier ones still peeking out underneath
 *
 * Inputs (full list, limits and JSON Schema: VO07ImageMontage.inputs.json):
 *   images[] { image_url, label, date, value } · look · transition · counter · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [image 1…8]
 * Timing: 3–8s from clock.durationInFrames; one cue per picture puts each change on the beat.
 */
import { Img } from './core/remotionSafe';
import type { TemplateProps } from '../../../types';
import { readNonEmptyString } from '../../../props';
import { applySizes, normaliseText, readAnim, type TemplateSpec, type TextSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText, type Line, type Measure } from './core/fit';
import { cardStyle, easeInOutCubic, exitStyle, imageMotionStyle, progress } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W, FRAME_W } from './core/safeArea';
import { fontFor, readStyle, styleVars, withAlpha } from './core/style';
import { FOOTAGE_SHADOW, StoryBackground, guide, leaf } from './core/shared';

const LABEL: TextSpec = { label: 'Label', required: false, minChars: 2, maxChars: 40, minWords: 1, maxWords: 7, maxWordChars: 18, maxLines: 2, fontMax: 44, fontMin: 26, weight: 800, lineHeight: 1.15, hint: 'What is shown.', fills: 'Label of the picture' };
const DATE: TextSpec = { label: 'Date', required: false, minChars: 2, maxChars: 16, minWords: 1, maxWords: 3, maxWordChars: 12, maxLines: 1, fontMax: 30, fontMin: 20, weight: 800, lineHeight: 1.2, hint: '"1991", "Aug 2016".', fills: 'Date chip' };
const VALUE: TextSpec = { label: 'Value', required: false, minChars: 1, maxChars: 16, minWords: 1, maxWords: 3, maxWordChars: 14, maxLines: 1, fontMax: 72, fontMin: 36, weight: 800, lineHeight: 1.05, hint: 'A number for this picture: "₹45", "1.2 crore".', fills: 'Big value in the corner' };

export const VO07_SPEC: TemplateSpec = {
  id: 'VO-07',
  animationType: 'vo_image_montage',
  name: 'Image Montage',
  pickWhen: 'A quick sequence of pictures, or photos in chronological order (a city through the decades, prices over the years).',
  placement: 'full',
  duration: { min: 90, default: 150, max: 240 },
  text: {},
  lists: {
    images: {
      label: 'Image',
      fills: 'Pictures in the order they appear',
      minItems: 2,
      maxItems: 8,
      image: { required: true, fills: 'The picture' },
      fields: { label: LABEL, date: DATE, value: VALUE },
    },
  },
  options: {
    look: { label: 'Look', values: ['cut', 'stack'], default: 'cut', fills: 'cut: full-frame pictures one after another · stack: photo cards dealt on top of each other' },
    transition: { label: 'Transition', values: ['cut', 'fade', 'slide', 'zoom'], default: 'cut', fills: 'How one full-frame picture changes to the next (cut look)' },
    counter: { label: 'Counter', values: ['off', 'on'], default: 'off', fills: 'Show "2 / 5" in the corner' },
    background: { label: 'Background', values: ['theme', 'transparent'], default: 'theme', fills: 'Behind the cards (stack look)' },
  },
  animations: {
    image_motion: { label: 'Picture motion', kind: 'image_motion', target: 'slow movement inside each picture', default: 'push_in' },
    captions: { label: 'Captions', kind: 'card', target: 'label / date / value of each picture', default: 'slide_up' },
    exit: { label: 'Exit', kind: 'exit', target: 'the last picture and its caption', default: 'fade' },
  },
  cues: { description: 'One cue per picture: the moment it appears.', units: ['image 1', 'image 2', 'image 3', 'image 4', 'image 5', 'image 6', 'image 7', 'image 8'] },
  colors: [],
  example: {
    images: [
      { image_url: 'https://example.com/1991.jpg', date: '1991', label: 'Before liberalisation' },
      { image_url: 'https://example.com/2001.jpg', date: '2001', label: 'The IT boom' },
      { image_url: 'https://example.com/2016.jpg', date: '2016', label: 'UPI launches' },
      { image_url: 'https://example.com/2025.jpg', date: '2025', label: 'Payments everywhere' },
    ],
    look: 'cut',
    transition: 'fade',
  },
};

type Pic = { image?: string; label: string; date: string; value: string };
export const CARD_W = 1040;
export const CARD_H = 650;
export type MontageLayout = { labels: Line[][]; dates: (Line | undefined)[]; values: (Line | undefined)[]; dateW: number[]; capW: number[] };

export function layoutMontage(input: { pics: Pic[]; stack: boolean }, measure: Measure): MontageLayout {
  const room = input.stack ? CARD_W - 80 : SAFE_W;
  const values = input.pics.map((p) => (p.value ? fitText(p.value, VALUE, Math.min(480, room * 0.4), measure, false).lines[0] : undefined));
  // the caption takes what the value leaves free on the same line
  const capW = values.map((v) => Math.min(input.stack ? room : 1100, room - (v ? Math.ceil(measure(v.text, v.size, 800)) + 40 : 0)));
  const labels = input.pics.map((p, i) => (p.label ? fitText(p.label, LABEL, capW[i], measure).lines : []));
  const dates = input.pics.map((p) => (p.date ? fitText(p.date, DATE, 360, measure, false).lines[0] : undefined));
  const dateW = dates.map((d) => (d ? Math.ceil(measure(d.text, d.size, 800)) + 28 : 0));
  return { labels, dates, values, dateW, capW };
}

export function planMontage(n: number, duration: number, cueTimes?: number[]): Plan {
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  // pictures share the clip evenly (the last one also holds until the exit)
  const gap = n > 1 ? Math.max(12, Math.floor((budget - 10) / n)) : 0;
  const units: Unit[] = [];
  for (let i = 0; i < n; i++) units.push({ key: `img${i}`, label: `Image ${i + 1}`, start: 2 + i * gap, dur: 10, cue: i });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareVO07(props: Record<string, unknown>, durationInFrames: number) {
  const A = (k: string) => readAnim(props, VO07_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(VO07_SPEC, props);
  const measure = measureFor(style);
  const s = (o: Record<string, unknown>, k: string) => (typeof o[k] === 'string' ? (o[k] as string) : typeof o[k] === 'number' ? String(o[k]) : '');
  const pics: Pic[] = (Array.isArray(props.images) ? props.images : [])
    .map((x) => {
      const o = (x && typeof x === 'object' ? x : typeof x === 'string' ? { image_url: x } : {}) as Record<string, unknown>;
      return { image: s(o, 'image_url') || undefined, label: normaliseText(s(o, 'label') || s(o, 'caption'), LABEL), date: normaliseText(s(o, 'date') || s(o, 'year'), DATE), value: normaliseText(s(o, 'value'), VALUE) };
    })
    .slice(0, 8);
  const stack = opt(props, 'look', ['cut', 'stack'] as const, 'cut') === 'stack';
  const L = layoutMontage({ pics, stack }, measure);
  const plan = planMontage(pics.length, durationInFrames, readCues(props));
  return { style, sized, A, pics, L, plan, stack, transition: opt(props, 'transition', ['cut', 'fade', 'slide', 'zoom'] as const, 'cut'), counter: opt(props, 'counter', ['off', 'on'] as const, 'off') === 'on', bg: opt(props, 'background', ['theme', 'transparent'] as const, 'theme'), debug: props.show_safe_area === true };
}

const TILT = [-4, 3, -2, 4, -3, 2, -4, 3];

export function VO07ImageMontage({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, pics, L, plan, stack, transition, counter, bg, debug } = prepareVO07(props, durationInFrames);
  const w = plan.windows;
  const accent = style.colors.accent;
  const n = pics.length;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  // current picture = the latest one that has started
  let cur = 0;
  for (let i = 0; i < n; i++) if (frame >= w[`img${i}`].start) cur = i;
  const startOf = (i: number) => w[`img${i}`].start;
  const endOf = (i: number) => (i + 1 < n ? startOf(i + 1) + 10 : durationInFrames);
  const motionT = (i: number) => progress(frame, startOf(i), Math.max(1, endOf(i) - startOf(i)));

  /** Caption block for picture i (only the current picture has one at a time). */
  const caption = (i: number, x: number, bottom: number, width: number) => {
    const lab = L.labels[i];
    const d = L.dates[i];
    if (!lab.length && !d) return null;
    const cs = cardStyle(A('captions'), progress(frame, startOf(i) + 4, 12));
    return (
      <div key={`cap${i}`} style={{ position: 'absolute', left: x, bottom, width, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, ...cs }}>
        {d && (
          <span {...leaf(`date-${i}`, `images[${i}].date`)} style={{ height: d.size * 1.2 + 12, boxSizing: 'border-box', padding: '6px 14px', borderRadius: 10, background: accent, fontFamily: fontFor(800), fontWeight: 800, fontSize: d.size, lineHeight: 1.2, color: style.colors.on_accent, whiteSpace: 'nowrap' }}>
            {d.text}
          </span>
        )}
        {lab.map((l, k) => (
          <span key={k} {...leaf(`label-${i}-${k}`, `images[${i}].label`)} style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: l.size, lineHeight: LABEL.lineHeight, color: '#FFFFFF', textShadow: FOOTAGE_SHADOW, whiteSpace: 'nowrap' }}>
            {l.text}
          </span>
        ))}
      </div>
    );
  };
  const valueEl = (i: number, right: number, bottom: number) => {
    const v = L.values[i];
    if (!v) return null;
    return (
      <span key={`val${i}`} {...leaf(`value-${i}`, `images[${i}].value`)} style={{ position: 'absolute', right, bottom, fontFamily: fontFor(800), fontWeight: 800, fontSize: v.size, lineHeight: 1.05, color: '#FFFFFF', textShadow: FOOTAGE_SHADOW, whiteSpace: 'nowrap', ...cardStyle('pop', progress(frame, startOf(i) + 6, 12)) }}>
        {v.text}
      </span>
    );
  };
  const counterEl = counter && n > 1 && (
    <span {...leaf('counter', 'counter')} style={{ position: 'absolute', right: 0, top: 0, padding: '6px 14px', borderRadius: 999, background: withAlpha(style.colors.scrim, 0.7), fontFamily: fontFor(700), fontWeight: 700, fontSize: 24, lineHeight: 1.2, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
      {cur + 1} / {n}
    </span>
  );

  if (!stack) {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000', ...styleVars(style) }}>
        {pics.map((p, i) => {
          if (i < cur - 1 || i > cur) return null;
          const tp = progress(frame, startOf(i), 10);
          const e = easeInOutCubic(tp);
          // transitions only affect the incoming picture (the previous one stays underneath)
          const tr = i === 0 || transition === 'cut' ? {} : transition === 'fade' ? { opacity: e } : transition === 'slide' ? { transform: `translateX(${(1 - e) * FRAME_W}px)` } : { opacity: e, transform: `scale(${1.25 - 0.25 * e})` };
          return (
            <div key={i} style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...tr }}>
              {p.image ? <Img src={p.image} style={{ width: '100%', height: '100%', objectFit: 'cover', ...imageMotionStyle(A('image_motion'), motionT(i)) }} /> : <div style={{ width: '100%', height: '100%', background: '#333' }} />}
            </div>
          );
        })}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 40%)' }} />
        <SafeArea debug={debug}>
          <div style={{ position: 'absolute', inset: 0, ...exit }}>
            {caption(cur, 0, 0, L.capW[cur])}
            {valueEl(cur, 0, 0)}
            {counterEl}
          </div>
        </SafeArea>
      </div>
    );
  }

  // stack look: photo cards dealt on top of each other
  const cx = (SAFE_W - CARD_W) / 2;
  const cy = (SAFE_H - CARD_H) / 2 - 10;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      {bg === 'theme' && <StoryBackground mode="theme" align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} />}
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {pics.map((p, i) => {
            if (i > cur) return null;
            const e = easeInOutCubic(progress(frame, startOf(i), 12));
            const top = i === cur;
            // the new card flies in from below and lands straight; earlier cards shrink back a little and keep a tilt
            const depth = Math.min(3, cur - i);
            const scale = 1 - depth * 0.03;
            // earlier cards peek out to the side they are tilted towards (kept inside the safe box)
            const dx = top ? 0 : Math.sign(TILT[i]) * depth * 26;
            const dy = top ? 0 : -depth * 14;
            const pad = 16;
            return (
              <div key={i} style={{ position: 'absolute', left: cx, top: cy, width: CARD_W, height: CARD_H, transform: `translate(${dx}px, ${dy + (1 - e) * 700}px) rotate(${top ? TILT[i] * (1 - e) : TILT[i]}deg) scale(${scale})`, opacity: Math.min(1, e * 2) }}>
                <div style={{ position: 'absolute', inset: 0, background: '#F7F5EF', boxShadow: '0 14px 30px rgba(0,0,0,0.4)', padding: pad, boxSizing: 'border-box' }}>
                  <div {...(top ? guide(`card-${i}`, `images[${i}].image_url`) : {})} style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#222' }}>
                    {p.image && <Img src={p.image} style={{ width: '100%', height: '100%', objectFit: 'cover', ...imageMotionStyle(A('image_motion'), motionT(i)) }} />}
                  </div>
                </div>
                {top && (
                  <>
                    <div style={{ position: 'absolute', left: pad, right: pad, bottom: pad, height: '45%', background: 'linear-gradient(0deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%)' }} />
                    {caption(i, 40, 36, L.capW[i])}
                    {valueEl(i, 40, 36)}
                  </>
                )}
              </div>
            );
          })}
          {counterEl}
        </div>
      </SafeArea>
    </div>
  );
}
