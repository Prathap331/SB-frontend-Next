/**
 * Storybit motion presets (pure). Every animatable element picks one preset from its kind;
 * the template supplies the element's time window, the preset turns progress 0→1 into style.
 */
import type { CSSProperties } from 'react';

export const clamp01 = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v);
export const easeOutCubic = (t: number) => 1 - (1 - clamp01(t)) ** 3;
export const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = clamp01(t);
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};
export const easeOutBounce = (t: number) => {
  const x = clamp01(t);
  const n = 7.5625;
  const d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x - 1.5 / d) ** 2 + 0.75;
  if (x < 2.5 / d) return n * (x - 2.25 / d) ** 2 + 0.9375;
  return n * (x - 2.625 / d) ** 2 + 0.984375;
};
/** Progress of `frame` inside [start, start+dur]. */
export const progress = (frame: number, start: number, dur: number) => (dur <= 0 ? (frame >= start ? 1 : 0) : clamp01((frame - start) / dur));

/* ---------------- preset catalogues (the LLM / editor picks from these) ---------------- */

/** Whole-line text animations. */
export const LINE_ANIMS = ['rise', 'fade_up', 'fade', 'blur_in', 'scale_in', 'slam', 'slide_left', 'slide_right', 'none'] as const;
/** Sentence animations: words or letters animate one after another. */
export const SENTENCE_ANIMS = ['word_fade', 'word_pop', 'typewriter', 'letter_rise'] as const;
export const TEXT_ANIMS = [...LINE_ANIMS, ...SENTENCE_ANIMS] as const;
export const ICON_ANIMS = ['pop', 'spin_in', 'bounce', 'fade', 'wipe', 'none'] as const;
export const CARD_ANIMS = ['pop', 'slide_up', 'slide_left', 'fade', 'none'] as const;
export const SHAPE_ANIMS = ['grow', 'fade', 'pop', 'none'] as const;
export const IMAGE_MOTIONS = ['push_in', 'pull_out', 'pan_left', 'pan_right', 'drift', 'static'] as const;
export const IMAGE_ENTRIES = ['fade', 'blur_in', 'wipe', 'cut'] as const;
export const EXIT_ANIMS = ['fade_up', 'fade', 'slide_down', 'scale_down', 'cut'] as const;
/** Numbers: count up from 0 (or count_from) to the value, or animate as a whole line. */
export const NUMBER_ANIMS = ['count_up', 'count_up_pop', 'rise', 'fade_up', 'scale_in', 'blur_in', 'none'] as const;

export type TextAnim = (typeof TEXT_ANIMS)[number];
export type IconAnim = (typeof ICON_ANIMS)[number];
export type CardAnim = (typeof CARD_ANIMS)[number];
export type ShapeAnim = (typeof SHAPE_ANIMS)[number];
export type ImageMotion = (typeof IMAGE_MOTIONS)[number];
export type ImageEntry = (typeof IMAGE_ENTRIES)[number];
export type ExitAnim = (typeof EXIT_ANIMS)[number];

export type AnimKind = 'text' | 'number' | 'icon' | 'card' | 'shape' | 'image_motion' | 'image_entry' | 'exit';
export const ANIMS_BY_KIND: Record<AnimKind, readonly string[]> = {
  text: TEXT_ANIMS,
  number: NUMBER_ANIMS,
  icon: ICON_ANIMS,
  card: CARD_ANIMS,
  shape: SHAPE_ANIMS,
  image_motion: IMAGE_MOTIONS,
  image_entry: IMAGE_ENTRIES,
  exit: EXIT_ANIMS,
};

export const ANIM_DESCRIPTIONS: Record<string, string> = {
  rise: 'Line rises out of a mask',
  fade_up: 'Fades in while moving up',
  fade: 'Fades in',
  blur_in: 'Sharpens from a blur',
  scale_in: 'Grows from 85% while fading in',
  slam: 'Slams in from big to normal size with a bounce',
  slide_left: 'Slides in from the left',
  slide_right: 'Slides in from the right',
  none: 'Appears instantly',
  word_fade: 'Words fade up one after another',
  word_pop: 'Words pop in one after another',
  typewriter: 'Letters are typed out',
  letter_rise: 'Letters rise one after another',
  count_up: 'Counts up to the value',
  count_up_pop: 'Counts up, then pops when it lands',
  pop: 'Pops in with a small overshoot',
  spin_in: 'Spins in a quarter turn while growing',
  bounce: 'Drops in and bounces',
  wipe: 'Revealed left to right',
  slide_up: 'Slides up while fading in',
  grow: 'Draws out from its start',
  push_in: 'Slow zoom in (1.00 → 1.08)',
  pull_out: 'Slow zoom out (1.08 → 1.00)',
  pan_left: 'Slow pan towards the left',
  pan_right: 'Slow pan towards the right',
  drift: 'Slow zoom with a slight rotation',
  static: 'No movement',
  cut: 'No transition',
  slide_down: 'Moves down while fading out',
  scale_down: 'Shrinks slightly while fading out',
};

const EXIT_DESCRIPTIONS: Record<string, string> = {
  fade_up: 'Fades out while moving up',
  fade: 'Fades out',
  slide_down: 'Moves down while fading out',
  scale_down: 'Shrinks slightly while fading out',
  cut: 'Disappears instantly at the cut',
};

/** Human description of a preset for a given kind (exit presets read differently from entrances). */
export const describeAnim = (kind: AnimKind, value: string) =>
  (kind === 'exit' ? EXIT_DESCRIPTIONS[value] : undefined) ?? ANIM_DESCRIPTIONS[value] ?? value;

export const isSentenceAnim = (a: string) => (SENTENCE_ANIMS as readonly string[]).includes(a);

/** Natural duration (frames) for a text animation, based on how much text it animates. */
export function textAnimFrames(anim: string, words: number, chars: number, base: number): number {
  if (anim === 'none') return 1;
  if (anim === 'typewriter') return Math.round(Math.min(60, Math.max(14, chars * 1.3)));
  if (anim === 'letter_rise') return Math.round(Math.min(54, Math.max(16, chars * 1 + 14)));
  if (anim === 'word_fade' || anim === 'word_pop') return Math.round(Math.min(48, Math.max(14, words * 4 + 12)));
  return base;
}

/* ---------------- style functions ---------------- */

/** Whole-element text style at progress p (0 → 1). `rise` is handled by a mask in AnimatedText. */
export function lineStyle(anim: string, p: number): CSSProperties {
  const e = easeOutCubic(p);
  switch (anim) {
    case 'rise':
      return { transform: `translateY(${(1 - e) * 110}%)` };
    case 'fade_up':
      return { opacity: e, transform: `translateY(${(1 - e) * 24}px)` };
    case 'fade':
      return { opacity: e };
    case 'blur_in':
      return { opacity: e, filter: `blur(${(1 - e) * 14}px)` };
    case 'scale_in':
      return { opacity: e, transform: `scale(${0.85 + 0.15 * e})` };
    case 'slam': {
      const b = easeOutBack(p);
      return { opacity: clamp01(p * 3), transform: `scale(${1.9 - 0.9 * b})` };
    }
    case 'slide_left':
      return { opacity: e, transform: `translateX(${(1 - e) * -40}px)` };
    case 'slide_right':
      return { opacity: e, transform: `translateX(${(1 - e) * 40}px)` };
    case 'none':
      return { opacity: p > 0 ? 1 : 0 };
    default:
      return { opacity: e };
  }
}

/** Per-word / per-letter style for sentence animations. */
export function pieceStyle(anim: string, p: number): CSSProperties {
  switch (anim) {
    case 'word_pop': {
      const b = easeOutBack(p);
      return { opacity: clamp01(p * 2), transform: `scale(${0.4 + 0.6 * b})`, display: 'inline-block' };
    }
    case 'letter_rise': {
      const e = easeOutCubic(p);
      return { opacity: e, transform: `translateY(${(1 - e) * 0.5}em)`, display: 'inline-block' };
    }
    case 'typewriter':
      return { opacity: p >= 1 ? 1 : 0 };
    default: {
      const e = easeOutCubic(p);
      return { opacity: e, transform: `translateY(${(1 - e) * 0.35}em)`, display: 'inline-block' };
    }
  }
}

export function iconStyle(anim: string, p: number): CSSProperties {
  switch (anim) {
    case 'pop':
      return { transform: `scale(${Math.max(0, easeOutBack(p))})` };
    case 'spin_in':
      return { opacity: clamp01(p * 2), transform: `rotate(${(1 - easeOutCubic(p)) * -90}deg) scale(${0.5 + 0.5 * easeOutCubic(p)})` };
    case 'bounce':
      return { opacity: clamp01(p * 3), transform: `translateY(${(1 - easeOutBounce(p)) * -60}px)` };
    case 'fade':
      return { opacity: easeOutCubic(p) };
    case 'wipe':
      return { clipPath: `inset(0 ${(1 - easeInOutCubic(p)) * 100}% 0 0)` };
    case 'none':
      return { opacity: p > 0 ? 1 : 0 };
    default:
      return { opacity: easeOutCubic(p) };
  }
}

export function cardStyle(anim: string, p: number): CSSProperties {
  const e = easeOutCubic(p);
  switch (anim) {
    case 'pop':
      return { opacity: e, transform: `scale(${0.85 + 0.15 * easeOutBack(p)})` };
    case 'slide_up':
      return { opacity: e, transform: `translateY(${(1 - e) * 28}px)` };
    case 'slide_left':
      return { opacity: e, transform: `translateX(${(1 - e) * -36}px)` };
    case 'fade':
      return { opacity: e };
    case 'none':
      return { opacity: p > 0 ? 1 : 0 };
    default:
      return { opacity: e };
  }
}

/** Shapes (rules, connectors): returns fraction of length drawn plus opacity/scale. */
export function shapeState(anim: string, p: number): { length: number; style: CSSProperties } {
  switch (anim) {
    case 'grow':
      return { length: easeOutCubic(p), style: {} };
    case 'fade':
      return { length: 1, style: { opacity: easeOutCubic(p) } };
    case 'pop':
      return { length: 1, style: { opacity: clamp01(p * 2), transform: `scale(${Math.max(0, easeOutBack(p))})` } };
    case 'none':
      return { length: p > 0 ? 1 : 0, style: {} };
    default:
      return { length: easeOutCubic(p), style: {} };
  }
}

/** Background image motion across the whole clip (t = frame / duration). */
export function imageMotionStyle(motion: string, t: number): CSSProperties {
  const x = clamp01(t);
  switch (motion) {
    case 'push_in':
      return { transform: `scale(${1 + 0.08 * x})` };
    case 'pull_out':
      return { transform: `scale(${1.08 - 0.08 * x})` };
    case 'pan_left':
      return { transform: `scale(1.1) translateX(${2.5 - 5 * x}%)` };
    case 'pan_right':
      return { transform: `scale(1.1) translateX(${-2.5 + 5 * x}%)` };
    case 'drift':
      return { transform: `scale(${1.04 + 0.05 * x}) rotate(${-0.8 + 1.6 * x}deg)` };
    default:
      return {};
  }
}

export function imageEntryStyle(entry: string, p: number): CSSProperties {
  const e = easeOutCubic(p);
  switch (entry) {
    case 'blur_in':
      return { opacity: e, filter: `blur(${(1 - e) * 24}px)` };
    case 'wipe':
      return { clipPath: `inset(0 ${(1 - easeInOutCubic(p)) * 100}% 0 0)` };
    case 'cut':
      return {};
    default:
      return { opacity: e };
  }
}

export function exitStyle(anim: string, p: number): CSSProperties {
  if (p <= 0) return {};
  const e = easeOutCubic(p);
  switch (anim) {
    case 'fade':
      return { opacity: 1 - e };
    case 'slide_down':
      return { opacity: 1 - e, transform: `translateY(${24 * e}px)` };
    case 'scale_down':
      return { opacity: 1 - e, transform: `scale(${1 - 0.08 * e})` };
    case 'cut':
      return {};
    default:
      return { opacity: 1 - e, transform: `translateY(${-16 * e}px)` };
  }
}
