'use client';

/**
 * NV-08 · Thank You Outro  (animation_type: "nv_thank_you")
 * "Thank you for watching!" with emojis, in twelve variants:
 *   confetti  — 🎉 ✨ 🎊 falling behind the text     hearts    — ❤️ 💖 rising up the sides
 *   wave      — a big 👋 waving above the title       stickers  — emoji stickers popping around the text
 *   actions   — 👍 Like · 💬 Comment · 🔁 Share · 🔔 Subscribe row     namaste — 🙏 with a warm glow
 *   fireworks — 🎆 bursts exploding in the corners     balloons  — 🎈 balloons floating up
 *   rocket    — 🚀 arcing across with a sparkle trail  diya      — a row of glowing 🪔 lamps (festive)
 *   reactions — live-stream ❤️ 😂 🔥 👍 floating up    sparkle   — ✨ twinkling around the text
 * Emojis use Noto Color Emoji (loaded by loadStorybitFonts).
 *
 * Inputs (full list, limits and JSON Schema: NV08ThankYou.inputs.json):
 *   title · subtitle · variant · emojis[] · actions[] { emoji, label } · image_url · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [hero, title, subtitle, extras]
 * Timing: 3–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec, type TextSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, words, type Line, type Measure } from './core/fit';
import { cardStyle, easeOutBack, exitStyle, iconStyle, progress, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W, FRAME_W, FRAME_H } from './core/safeArea';
import { overlaps, type Box } from './core/placement';
import { EMOJI_FONT, fontFor, mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

const ACTION_LABEL: TextSpec = { label: 'Action label', required: true, minChars: 2, maxChars: 14, minWords: 1, maxWords: 2, maxWordChars: 12, maxLines: 1, fontMax: 32, fontMin: 20, weight: 700, lineHeight: 1.2, fills: 'Label next to the action emoji' };
export const VARIANTS = ['confetti', 'hearts', 'wave', 'stickers', 'actions', 'namaste', 'fireworks', 'balloons', 'rocket', 'diya', 'reactions', 'sparkle'] as const;
type Variant = (typeof VARIANTS)[number];
const DEFAULT_EMOJIS: Record<Variant, string[]> = {
  confetti: ['🎉', '✨', '🎊', '⭐'],
  hearts: ['❤️', '💖', '💕', '💛'],
  wave: ['👋'],
  stickers: ['🙏', '😊', '🔔', '👍', '✨', '❤️'],
  actions: ['👍', '💬', '🔁', '🔔'],
  namaste: ['🙏'],
  fireworks: ['✨', '🎆', '💥', '⭐'],
  balloons: ['🎈', '🎈', '🎉'],
  rocket: ['🚀', '✨'],
  diya: ['🪔'],
  reactions: ['❤️', '😂', '🔥', '👍', '😮', '👏'],
  sparkle: ['✨', '⭐', '🌟'],
};
const DEFAULT_ACTIONS = [
  { emoji: '👍', label: 'Like' },
  { emoji: '💬', label: 'Comment' },
  { emoji: '🔁', label: 'Share' },
  { emoji: '🔔', label: 'Subscribe' },
];

export const NV08_SPEC: TemplateSpec = {
  id: 'NV-08',
  animationType: 'nv_thank_you',
  name: 'Thank You Outro',
  pickWhen: 'The closing line of the video: "Thank you for watching", with a friendly emoji animation.',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 150, max: 240 },
  text: {
    title: { label: 'Title', required: false, minChars: 2, maxChars: 40, minWords: 1, maxWords: 7, maxWordChars: 18, maxLines: 2, fontMax: 120, fontMin: 56, weight: 800, lineHeight: 1.08, hint: 'Default "Thank you for watching!" (e.g. "देखने के लिए धन्यवाद!").', fills: 'Big thank-you line', example: 'Thank you for watching!' },
    subtitle: { label: 'Subtitle', required: false, minChars: 3, maxChars: 60, minWords: 1, maxWords: 11, maxWordChars: 18, maxLines: 1, fontMax: 44, fontMin: 26, weight: 600, lineHeight: 1.25, hint: '"See you in the next one".', fills: 'Line under the title', example: 'See you in the next one' },
  },
  lists: {},
  custom: {
    inputs: [
      { path: 'emojis[]', type: 'list', required: false, fills: 'Emojis to use instead of the variant defaults (hero, confetti, hearts, stickers)', limits: '1–6 emojis' },
      { path: 'actions[]', type: 'list', required: false, fills: 'actions variant: the row of emoji + label chips (default 👍 Like · 💬 Comment · 🔁 Share · 🔔 Subscribe)', limits: '2–4 chips' },
      { path: 'actions[].emoji', type: 'text', required: true, fills: 'One emoji', limits: '1 emoji' },
      { path: 'actions[].label', type: 'text', required: true, fills: 'Chip label', limits: '2–14 chars' },
    ],
    schema: {
      emojis: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string', minLength: 1, maxLength: 8 }, description: 'Emojis to use instead of the variant defaults.' },
      actions: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'object', additionalProperties: false, required: ['emoji', 'label'], properties: { emoji: { type: 'string', minLength: 1, maxLength: 8 }, label: { type: 'string', minLength: 2, maxLength: 14 } } }, description: 'actions variant: emoji + label chips.' },
    },
  },
  options: {
    variant: { label: 'Variant', values: [...VARIANTS], default: 'confetti', fills: 'confetti · hearts · wave (👋) · stickers (emoji ring) · actions (like/comment/share/subscribe row) · namaste (🙏) · fireworks (🎆 bursts) · balloons (🎈) · rocket (🚀 flight) · diya (🪔 festive row) · reactions (live ❤️😂🔥) · sparkle (✨ twinkle)' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    hero: { label: 'Hero emoji', kind: 'icon', target: 'big emoji above the title (confetti, hearts, wave, namaste, fireworks)', default: 'bounce' },
    title: { label: 'Title', kind: 'text', target: 'thank-you line', default: 'slam' },
    subtitle: { label: 'Subtitle', kind: 'text', target: 'subtitle', default: 'fade_up' },
    extras: { label: 'Stickers / actions', kind: 'card', target: 'stickers, action chips or diya row', default: 'pop' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'everything', default: 'fade' },
  },
  cues: { description: 'hero emoji → title → subtitle → stickers / actions / diyas.', units: ['hero', 'title', 'subtitle', 'extras'] },
  colors: [],
  example: { title: 'Thank you for watching!', subtitle: 'See you in the next one', variant: 'confetti', background: 'theme' },
};

const HERO_VARIANTS: Variant[] = ['confetti', 'hearts', 'wave', 'namaste', 'fireworks'];
export const DIYA = 96;
export type ThanksLayout = { hero: number; title: Line[]; subtitle?: Line; diyas: number; actions: { emoji: string; label: Line; w: number }[]; chipH: number; blockH: number; top: number; stickers: Box[] };

export function layoutThanks(input: { variant: Variant; title: string; subtitle: string; actions: { emoji: string; label: string }[]; stickerCount: number }, measure: Measure, spec: TemplateSpec = NV08_SPEC): ThanksLayout {
  const T = spec.text;
  const hero = HERO_VARIANTS.includes(input.variant) ? (input.variant === 'wave' || input.variant === 'namaste' ? 170 : 120) : 0;
  const diyas = input.variant === 'diya' ? 5 : 0;
  // stickers need room around the text; hearts / balloons / reactions / sparkle live in the side bands, so the text stays narrower
  const width = input.variant === 'stickers' ? 1180 : ['hearts', 'balloons', 'reactions', 'sparkle'].includes(input.variant) ? 1000 : 1500;
  const title = fitText(input.title, T.title, width, measure).lines;
  const subtitle = input.subtitle ? fitText(input.subtitle, T.subtitle, width, measure, false).lines[0] : undefined;
  const chipH = 72;
  const actions = input.variant === 'actions' ? input.actions.map((a) => {
    const label = fitText(a.label, ACTION_LABEL, 260, measure, false).lines[0];
    return { emoji: a.emoji, label, w: Math.ceil(measure(label.text, label.size, 700)) + 40 + 44 + 12 };
  }) : [];
  const blockH = (hero ? hero + 24 : 0) + blockHeight(title, T.title.lineHeight) + (subtitle ? 18 + subtitle.size * T.subtitle.lineHeight : 0) + (actions.length ? 44 + chipH : 0) + (diyas ? 40 + DIYA : 0);
  const top = Math.max(0, (SAFE_H - blockH) / 2);
  // stickers: spots around the text block, never on it
  const stickers: Box[] = [];
  if (input.variant === 'stickers') {
    const tw = Math.max(...title.map((l) => measure(l.text, l.size, 800)), subtitle ? measure(subtitle.text, subtitle.size, 600) : 0);
    const block = { x: (SAFE_W - tw) / 2, y: top, w: tw, h: blockH };
    const S = 120;
    // left / right of the text, then diagonally above and below it (so short blocks still get six)
    const spots = [
      [block.x - S - 50, block.y + block.h / 2 - S / 2], [block.x + block.w + 50, block.y + block.h / 2 - S / 2],
      [block.x - S * 0.6, block.y - S - 30], [block.x + block.w - S * 0.4, block.y - S - 30],
      [block.x - S * 0.6, block.y + block.h + 30], [block.x + block.w - S * 0.4, block.y + block.h + 30],
    ];
    for (const [x, y] of spots.slice(0, input.stickerCount)) {
      const b = { x: Math.max(0, Math.min(SAFE_W - S, x)), y: Math.max(0, Math.min(SAFE_H - S, y)), w: S, h: S };
      // stickers are tilted up to 16°, which widens them by ~15 px each side: keep that much extra clearance
      if (!overlaps(b, { x: block.x - 10, y: block.y - 10, w: block.w + 20, h: block.h + 20 }, 20) && !stickers.some((q) => overlaps(b, q, 36))) stickers.push(b);
    }
  }
  return { hero, title, subtitle, diyas, actions, chipH, blockH, top, stickers };
}

export function planThanks(L: ThanksLayout, anims: { title: string; subtitle: string }, hasExtras: boolean, duration: number, cueTimes?: number[]): Plan {
  const t = L.title.map((l) => l.text).join(' ');
  const tDur = textAnimFrames(anims.title, words(t).length, t.length, 16);
  const units: Unit[] = [{ key: 'hero', label: 'Hero emoji', start: 4, dur: 16, cue: 0 }, { key: 'title', label: 'Title', start: 12, dur: tDur, cue: 1 }];
  let next = 12 + tDur;
  if (L.subtitle) {
    units.push({ key: 'subtitle', label: 'Subtitle', start: next + 2, dur: 14, cue: 2 });
    next += 14;
  }
  if (hasExtras) units.push({ key: 'extras', label: 'Stickers / actions', start: next + 4, dur: 16, cue: 3 });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareNV08(props: Record<string, unknown>, durationInFrames: number) {
  const S = NV08_SPEC.text;
  const A = (k: string) => readAnim(props, NV08_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(NV08_SPEC, props);
  const measure = measureFor(style);
  const variant = opt(props, 'variant', VARIANTS, 'confetti');
  const custom = (Array.isArray(props.emojis) ? props.emojis : []).filter((e): e is string => typeof e === 'string' && e.trim() !== '').map((e) => e.trim().slice(0, 8)).slice(0, 6);
  const emojis = custom.length ? custom : DEFAULT_EMOJIS[variant];
  const actions = (Array.isArray(props.actions) ? props.actions : [])
    .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
    .map((o) => ({ emoji: typeof o.emoji === 'string' ? o.emoji.trim().slice(0, 8) : '', label: normaliseText(typeof o.label === 'string' ? o.label : '', ACTION_LABEL) }))
    .filter((a) => a.emoji && a.label)
    .slice(0, 4);
  const L = layoutThanks({ variant, title: normaliseText(readFirst(props, ['title']), S.title) || 'Thank you for watching!', subtitle: normaliseText(readFirst(props, ['subtitle']), S.subtitle), actions: actions.length >= 2 ? actions : DEFAULT_ACTIONS, stickerCount: Math.min(6, Math.max(emojis.length, 4)) }, measure, sized.spec);
  const plan = planThanks(L, { title: A('title'), subtitle: A('subtitle') }, variant === 'stickers' || variant === 'actions' || variant === 'diya', durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, variant, emojis, L, plan, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

/** Deterministic pseudo-random in [0,1) for particle i, channel k. */
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type P = { e: string; x: number; y: number; size: number; rot?: number; op: number; scale?: number };

/** Decorative emoji layer (full frame, behind the text). Every variant keeps its emojis off the text or passes behind it. */
function particlesFor(variant: Variant, emojis: string[], frame: number, D: number): P[] {
  const E = (i: number) => emojis[i % emojis.length];
  const out: P[] = [];
  if (variant === 'confetti' || variant === 'hearts') {
    const n = variant === 'confetti' ? 26 : 18;
    for (let i = 0; i < n; i++) {
      const size = 36 + rnd(i, 1) * 34;
      const delay = rnd(i, 3) * D * 0.5;
      const t = Math.max(0, (frame - delay) / D) * (0.6 + rnd(i, 2) * 0.7);
      const sway = Math.sin((frame / 30) * (1 + rnd(i, 5)) + i) * 26;
      const side = i % 2 ? 1 : 0;
      // confetti falls over the whole width; hearts rise up the two sides only
      const x = variant === 'confetti' ? rnd(i, 4) * FRAME_W : side ? FRAME_W - 90 - rnd(i, 4) * 260 : 30 + rnd(i, 4) * 260;
      const y = variant === 'confetti' ? -80 + t * (FRAME_H + 160) : FRAME_H + 60 - t * (FRAME_H + 160);
      out.push({ e: E(i), x: x + sway, y, size, rot: variant === 'confetti' ? (frame * (2 + rnd(i, 6) * 4) + i * 40) % 360 : sway * 0.6, op: (frame < delay ? 0 : Math.min(1, (frame - delay) / 8)) * 0.88 });
    }
  } else if (variant === 'fireworks') {
    // bursts in the four corners and top centre, each repeating every 1.5 s, sparks flying outwards
    const spots = [[0.13, 0.22], [0.87, 0.2], [0.11, 0.8], [0.89, 0.78], [0.5, 0.09]];
    spots.forEach(([fx, fy], b) => {
      const start = 4 + b * 9;
      if (frame < start) return;
      const ph = ((frame - start) % 45) / 45;
      const cx = fx * FRAME_W;
      const cy = fy * FRAME_H;
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * Math.PI * 2 + b;
        const r = 20 + ph * 170;
        out.push({ e: E(k + b), x: cx + Math.cos(ang) * r - 18, y: cy + Math.sin(ang) * r + ph * ph * 40 - 18, size: 36 * (1 - ph * 0.4), op: Math.max(0, 1 - ph * 1.1) });
      }
      out.push({ e: '💥', x: cx - 30, y: cy - 30, size: 60 * (1 - ph), op: Math.max(0, 1 - ph * 3) });
    });
  } else if (variant === 'balloons') {
    // balloons drift up the two side bands, each with its own sway
    for (let i = 0; i < 14; i++) {
      const delay = rnd(i, 3) * D * 0.35;
      const t = Math.max(0, (frame - delay) / D) * (0.55 + rnd(i, 2) * 0.4);
      const sway = Math.sin(frame / 22 + i * 1.7) * 30;
      const side = i % 2 ? 1 : 0;
      const x = side ? FRAME_W - 380 + rnd(i, 4) * 260 : 40 + rnd(i, 4) * 260;
      out.push({ e: E(i), x: x + sway, y: FRAME_H + 40 - t * (FRAME_H + 240), size: 70 + rnd(i, 1) * 50, rot: sway * 0.3, op: frame < delay ? 0 : 1 });
    }
  } else if (variant === 'rocket') {
    // one rocket arcs from bottom-left to top-right in the first half, leaving a fading sparkle trail
    const fly = Math.max(1, D * 0.55);
    const pos = (q: number) => {
      const x0 = -120, y0 = FRAME_H + 60, x1 = FRAME_W + 120, y1 = -140, cx = FRAME_W * 0.35, cy = FRAME_H * 0.05;
      const u = 1 - q;
      return { x: u * u * x0 + 2 * u * q * cx + q * q * x1, y: u * u * y0 + 2 * u * q * cy + q * q * y1 };
    };
    const q = Math.min(1, frame / fly);
    for (let k = 1; k <= 16; k++) {
      const tq = q - k * 0.025;
      if (tq <= 0) continue;
      const p = pos(tq);
      const age = k / 16;
      out.push({ e: emojis[1] ?? '✨', x: p.x - 16 + Math.sin(k * 3.1) * 14, y: p.y - 16 + Math.cos(k * 2.3) * 14, size: 34 * (1 - age * 0.5), op: (1 - age) * (q < 1 ? 1 : Math.max(0, 1 - (frame - fly) / 20)) });
    }
    if (q < 1) {
      const p = pos(q);
      const p2 = pos(Math.min(1, q + 0.01));
      const ang = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI;
      out.push({ e: emojis[0] ?? '🚀', x: p.x - 55, y: p.y - 55, size: 110, rot: ang + 45, op: 1 });
    }
  } else if (variant === 'reactions') {
    // live-stream style: reactions bubble up the right and left edges and fade out
    for (let i = 0; i < 22; i++) {
      const start = (i * D) / 26;
      if (frame < start) continue;
      const age = (frame - start) / 50;
      if (age > 1) continue;
      const right = i % 3 !== 0;
      const x = (right ? FRAME_W - 180 : 60) + Math.sin(age * 6 + i) * 35 + rnd(i, 4) * 60;
      out.push({ e: E(i), x, y: FRAME_H - 120 - age * FRAME_H * 0.5, size: 64, scale: age < 0.12 ? 0.4 + age * 5 : 1, op: age > 0.7 ? (1 - age) / 0.3 : 1 });
    }
  } else if (variant === 'sparkle') {
    // stars twinkle in the outer bands (top, bottom, sides) — never over the text
    for (let i = 0; i < 24; i++) {
      const band = i % 4;
      const x = band < 2 ? rnd(i, 4) * FRAME_W : band === 2 ? 40 + rnd(i, 4) * 240 : FRAME_W - 280 + rnd(i, 4) * 240;
      const y = band === 0 ? 30 + rnd(i, 5) * 150 : band === 1 ? FRAME_H - 190 + rnd(i, 5) * 150 : 200 + rnd(i, 5) * (FRAME_H - 400);
      const tw = 0.5 + 0.5 * Math.sin(frame / 7 + i * 2.3);
      const appear = Math.min(1, Math.max(0, (frame - i * 2) / 10));
      out.push({ e: E(i), x, y, size: 30 + rnd(i, 1) * 34, scale: 0.6 + 0.5 * tw, op: appear * (0.35 + 0.65 * tw) });
    }
  }
  return out;
}

function Particles({ variant, emojis, frame, durationInFrames }: { variant: Variant; emojis: string[]; frame: number; durationInFrames: number }) {
  const ps = particlesFor(variant, emojis, frame, durationInFrames);
  if (!ps.length) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {ps.map((p, i) => (
        <span key={i} style={{ position: 'absolute', left: p.x, top: p.y, fontFamily: EMOJI_FONT, fontSize: p.size, lineHeight: 1, transform: `rotate(${p.rot ?? 0}deg) scale(${p.scale ?? 1})`, opacity: p.op }}>
          {p.e}
        </span>
      ))}
    </div>
  );
}

function NV08ThankYouBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, variant, emojis, L, plan, imageUrl, bg, debug } = prepareNV08(props, durationInFrames);
  const w = plan.windows;
  const S = NV08_SPEC.text;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const heroEmoji = variant === 'wave' ? emojis[0] ?? '👋' : variant === 'namaste' ? emojis[0] ?? '🙏' : variant === 'hearts' ? emojis[0] ?? '❤️' : variant === 'fireworks' ? (emojis.includes('🎆') ? '🎆' : emojis[0]) : emojis[0] ?? '🎉';
  const hp = progress(frame, w.hero.start, w.hero.dur);
  // wave: the hand rocks from the wrist; namaste: a slow breathing pulse; others: a small bob
  const since = Math.max(0, frame - w.hero.start - w.hero.dur);
  const heroMotion = variant === 'wave' ? `rotate(${Math.sin(since / 4) * 18 * Math.max(0.25, 1 - since / 90)}deg)` : variant === 'namaste' ? `scale(${1 + 0.04 * Math.sin(since / 10)})` : `translateY(${Math.sin(since / 8) * 6}px)`;
  let y = L.top;
  const heroTop = y;
  if (L.hero) y += L.hero + 24;
  const titleTop = y;
  y += blockHeight(L.title, S.title.lineHeight);
  const subTop = y + 18;
  if (L.subtitle) y += 18 + L.subtitle.size * S.subtitle.lineHeight;
  const actTop = y + 44;
  const diyaTop = y + 40;
  const actW = L.actions.reduce((a, c) => a + c.w, 0) + 20 * Math.max(0, L.actions.length - 1);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <div style={{ position: 'absolute', inset: 0, ...exit }}>
        <Particles variant={variant} emojis={emojis} frame={frame} durationInFrames={durationInFrames} />
      </div>
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.hero > 0 && (
            <div {...leaf('hero', 'variant / emojis[0]')} style={{ position: 'absolute', left: (SAFE_W - L.hero) / 2, top: heroTop, width: L.hero, height: L.hero, display: 'flex', alignItems: 'center', justifyContent: 'center', ...iconStyle(A('hero'), hp) }}>
              {variant === 'namaste' && <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', background: `radial-gradient(circle, ${withAlpha(accent, 0.45)} 0%, ${withAlpha(accent, 0)} 70%)`, transform: `scale(${1 + 0.08 * Math.sin(since / 10)})` }} />}
              <span style={{ position: 'relative', fontFamily: EMOJI_FONT, fontSize: L.hero * 0.82, lineHeight: 1, transform: heroMotion, transformOrigin: variant === 'wave' ? '70% 90%' : 'center', display: 'block' }}>{heroEmoji}</span>
            </div>
          )}
          <AnimatedText lines={L.title} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={800} lineHeight={S.title.lineHeight} letterSpacing="-0.02em" shadow={shadow} align="center" group="title" input="title" style={{ position: 'absolute', left: 0, width: SAFE_W, top: titleTop }} />
          {L.subtitle && w.subtitle && <AnimatedText lines={[L.subtitle]} anim={A('subtitle')} start={w.subtitle.start} dur={w.subtitle.dur} frame={frame} weight={S.subtitle.weight} lineHeight={S.subtitle.lineHeight} color={mutedFor(style, onFootage)} shadow={shadow} align="center" group="subtitle" input="subtitle" style={{ position: 'absolute', left: 0, width: SAFE_W, top: subTop }} />}
          {variant === 'actions' && w.extras && L.actions.map((a, i) => {
            const x = (SAFE_W - actW) / 2 + L.actions.slice(0, i).reduce((s, c) => s + c.w + 20, 0);
            return (
              <div key={i} {...leaf(`action-${i}`, `actions[${i}]`)} style={{ position: 'absolute', left: x, top: actTop, width: a.w, height: L.chipH, boxSizing: 'border-box', borderRadius: 999, background: withAlpha(style.colors.text, 0.1), border: `2px solid ${withAlpha(style.colors.text, 0.2)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, ...cardStyle(A('extras'), progress(frame, w.extras!.start + i * 4, w.extras!.dur)) }}>
                <span style={{ fontFamily: EMOJI_FONT, fontSize: 38, lineHeight: 1 }}>{a.emoji}</span>
                <span style={{ fontFamily: fontFor(700), fontWeight: 700, fontSize: a.label.size, lineHeight: 1.2, color: style.colors.text, whiteSpace: 'nowrap' }}>{a.label.text}</span>
              </div>
            );
          })}
          {variant === 'diya' && w.extras && Array.from({ length: L.diyas }, (_, i) => {
            const gap = 36;
            const x0 = (SAFE_W - (L.diyas * DIYA + (L.diyas - 1) * gap)) / 2;
            const dp = progress(frame, w.extras!.start + i * 4, w.extras!.dur);
            const flicker = 1 + 0.06 * Math.sin(frame / 3 + i * 1.9) + 0.04 * Math.sin(frame / 1.7 + i);
            return (
              <div key={i} {...leaf(`diya-${i}`, 'emojis')} style={{ position: 'absolute', left: x0 + i * (DIYA + gap), top: diyaTop, width: DIYA, height: DIYA, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', transform: `scale(${A('extras') === 'none' ? 1 : Math.max(0, easeOutBack(dp))})` }}>
                {/* warm glow that flickers like a flame */}
                <div style={{ position: 'absolute', left: '50%', top: '10%', width: DIYA * 0.9, height: DIYA * 0.9, marginLeft: -DIYA * 0.45, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,190,80,0.55) 0%, rgba(255,150,40,0) 70%)', transform: `scale(${flicker})` }} />
                <span style={{ position: 'relative', fontFamily: EMOJI_FONT, fontSize: DIYA * 0.8, lineHeight: 1 }}>{emojis[i % emojis.length]}</span>
              </div>
            );
          })}
          {variant === 'stickers' && w.extras && L.stickers.map((b, i) => {
            const sp = progress(frame, w.extras!.start + i * 3, w.extras!.dur);
            const tilt = (i % 2 ? 1 : -1) * (8 + (i % 3) * 4);
            return (
              <div key={i} {...leaf(`sticker-${i}`, 'emojis')} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${A('extras') === 'none' ? 1 : Math.max(0, easeOutBack(sp))}) rotate(${tilt}deg)`, opacity: sp > 0 || A('extras') === 'none' ? 1 : 0 }}>
                <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 6px 16px rgba(0,0,0,0.3)' }} />
                <span style={{ position: 'relative', fontFamily: EMOJI_FONT, fontSize: 70, lineHeight: 1 }}>{emojis[i % emojis.length]}</span>
              </div>
            );
          })}
        </div>
      </SafeArea>
    </div>
  );
}

// gentler growth than other templates: the emoji bands at the sides need to stay clear of the text
export const NV08ThankYou = withAutoFit(NV08ThankYouBase, 1.25);
