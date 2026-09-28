'use client';

/**
 * Shared Storybit building blocks so every template looks and moves the same:
 * fonts, colours, the three background modes, and masked title lines.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Img } from 'remotion';
import { readNonEmptyString } from '../../../../props';
import type { Line } from './fit';
import { COLOR_SLOTS, fontFor, lighten, withAlpha, type Colors } from './style';
import {
  imageEntryStyle,
  imageMotionStyle,
  isSentenceAnim,
  lineStyle,
  pieceStyle,
  progress,
} from './motion';

export const FONT =
  '"Poppins", "Noto Sans Devanagari", "Noto Sans Telugu", "Noto Sans Tamil", system-ui, sans-serif';
export const INK = COLOR_SLOTS.text.default;
export const MUTED = COLOR_SLOTS.muted.default;
export const MUTED_ON_FOOTAGE = '#E8EAF6';
export const DEFAULT_ACCENT = '#F5A524';
export const FOOTAGE_SHADOW = '0 4px 24px rgba(0,0,0,0.55)';

export type BgMode = 'theme' | 'image' | 'transparent';
export type Align = 'left' | 'center';

export function readFirst(props: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = readNonEmptyString(props, k);
    if (v) return v;
  }
  return undefined;
}

export function readBgMode(props: Record<string, unknown>, imageUrl?: string): BgMode {
  const v = readNonEmptyString(props, 'background');
  if (v === 'theme' || v === 'image' || v === 'transparent') return v;
  return imageUrl ? 'image' : 'theme';
}

export function readAlign(props: Record<string, unknown>): Align {
  return readNonEmptyString(props, 'align') === 'center' ? 'center' : 'left';
}

/** Full-bleed background. May cross the safe margin (backgrounds only). */
export function StoryBackground({
  mode,
  imageUrl,
  align,
  accent,
  frame,
  durationInFrames,
  motion = 'push_in',
  entry = 'fade',
  colors,
}: {
  mode: BgMode;
  imageUrl?: string;
  align: Align;
  accent: string;
  frame: number;
  durationInFrames: number;
  motion?: string;
  entry?: string;
  /** Style colours (background, background_2, scrim). Defaults to the Storybit navy theme. */
  colors?: Pick<Colors, 'background' | 'background_2' | 'scrim'>;
}) {
  const bg1 = colors?.background ?? COLOR_SLOTS.background.default;
  const bg2 = colors?.background_2 ?? COLOR_SLOTS.background_2.default;
  const scrim = colors?.scrim ?? COLOR_SLOTS.scrim.default;
  const inP = progress(frame, 0, 12);
  const t = frame / Math.max(1, durationInFrames);

  if (mode === 'theme') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: entry === 'cut' ? 1 : inP,
          background: `radial-gradient(120% 90% at 15% 20%, ${lighten(bg1, 0.08)} 0%, ${bg1} 45%, ${bg2} 100%)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 1100,
            height: 1100,
            right: -300 + frame * 0.4,
            bottom: -520,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${withAlpha(accent, 0.2)} 0%, ${withAlpha(accent, 0)} 65%)`,
          }}
        />
      </div>
    );
  }

  if (mode === 'image' && imageUrl) {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...imageEntryStyle(entry, inP) }}>
        <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', ...imageMotionStyle(motion, t) }} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              align === 'left'
                ? `linear-gradient(90deg, ${withAlpha(scrim, 0.88)} 0%, ${withAlpha(scrim, 0.6)} 45%, ${withAlpha(scrim, 0.15)} 100%)`
                : `radial-gradient(80% 70% at 50% 50%, ${withAlpha(scrim, 0.78)} 0%, ${withAlpha(scrim, 0.35)} 100%)`,
          }}
        />
      </div>
    );
  }

  // transparent: FFmpeg footage sits underneath; add a soft scrim for legibility.
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: (entry === 'cut' ? 1 : inP) * 0.85,
        background:
          align === 'left'
            ? `linear-gradient(90deg, ${withAlpha(scrim, 0.6)} 0%, ${withAlpha(scrim, 0)} 70%)`
            : `radial-gradient(70% 60% at 50% 50%, ${withAlpha(scrim, 0.55)} 0%, ${withAlpha(scrim, 0)} 100%)`,
      }}
    />
  );
}

/**
 * Leaf markers for the preview's overlap checker. Every visible text line, icon and shape
 * carries data-sb="leaf"; leaves in the same group (e.g. a node and its icon) may overlap.
 */
/** A guide line (axis, reference line) is meant to cross other elements: checked for the margin only. */
export const guide = (group: string, input?: string) => ({ ...leaf(group, input), 'data-sb-kind': 'guide' });

export const leaf = (group: string, input?: string) => ({
  'data-sb': 'leaf',
  'data-sb-group': group,
  ...(input ? { 'data-sb-input': input } : {}),
});

/** Scripts whose letters must not be split (conjuncts / matras): letter animations fall back to words. */
const COMPLEX_SCRIPT = /[\u0900-\u0DFF\u0E00-\u0FFF\u1000-\u109F]/;

/** Style for the n-th highlighted word (0-based) out of `count` highlighted words. */
export type HighlightStyle = (order: number, count: number) => CSSProperties;

/**
 * Animated text block. Handles every text preset:
 *   line presets (rise, fade_up, fade, blur_in, scale_in, slide_left, slide_right, none) — lines stagger,
 *   sentence presets (word_fade, word_pop, typewriter, letter_rise) — words/letters run in reading order
 *   across all lines. Layout never changes during the animation (hidden pieces keep their space).
 * Optional highlight: a phrase whose words get `highlightColor`, or a custom per-word style (marker, underline).
 */
export function AnimatedText({
  lines,
  anim,
  start,
  dur,
  frame,
  weight,
  lineHeight,
  color = `var(--sb-text, ${INK})`,
  shadow,
  align = 'left',
  group,
  input,
  letterSpacing,
  style,
  highlight,
  highlightColor,
  highlightStyle,
  fontFamily,
}: {
  lines: Line[];
  anim: string;
  start: number;
  dur: number;
  frame: number;
  weight: number;
  lineHeight: number;
  color?: string;
  shadow: string;
  align?: Align | 'right';
  group: string;
  /** Prop path this text comes from, e.g. "steps[2].title" (preview label only). */
  input?: string;
  letterSpacing?: string;
  style?: CSSProperties;
  /** Phrase inside the text to emphasise (first match, case-insensitive). */
  highlight?: string;
  /** Simple emphasis: highlighted words in this colour. */
  highlightColor?: string;
  /** Custom emphasis per highlighted word (overrides highlightColor). */
  highlightStyle?: HighlightStyle;
  /** Explicit font stack (default: heading font for weight ≥ 700, body font otherwise). Must match the measure used for layout. */
  fontFamily?: string;
}) {
  const hi = highlightWords(lines, highlight);
  const hiOrder = new Map([...hi].sort((x, y) => x - y).map((w, i) => [w, i]));
  const wordStyle = (gi: number): CSSProperties | undefined => {
    if (!hi.has(gi)) return undefined;
    if (highlightStyle) return highlightStyle(hiOrder.get(gi)!, hi.size);
    return highlightColor ? { color: highlightColor } : undefined;
  };
  const alignItems = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  const n = lines.length;
  const base = (l: Line): CSSProperties => ({
    fontFamily: fontFamily ?? fontFor(weight),
    fontSize: l.size,
    fontWeight: weight,
    lineHeight,
    letterSpacing,
    color,
    whiteSpace: 'nowrap',
    textShadow: shadow,
  });

  const sentence = isSentenceAnim(anim);
  const fullText = lines.map((l) => l.text).join(' ');
  const letters = sentence && (anim === 'typewriter' || anim === 'letter_rise') && !COMPLEX_SCRIPT.test(fullText);
  const totalPieces = !sentence ? 0 : letters ? lines.reduce((s2, l) => s2 + Array.from(l.text).length, 0) : lines.reduce((s2, l) => s2 + l.text.split(' ').length, 0);
  const pd = anim === 'typewriter' ? 0 : Math.min(14, dur * 0.5);
  const gap = totalPieces > 1 ? (dur - pd) / (totalPieces - 1) : 0;
  const pieceAnim = anim === 'typewriter' ? 'typewriter' : anim;

  // Words are always rendered as spans so emphasis can wrap them; a space sits inside the
  // span only when the next word is emphasised too (so markers join up but never overhang).
  let gi = 0;
  let k = 0;
  const renderLine = (l: Line) => {
    const ws = l.text.split(' ');
    return ws.map((w, j) => {
      const my = gi++;
      const last = j === ws.length - 1;
      const joinSpace = !last && hi.has(my) && hi.has(my + 1);
      let inner: ReactNode = w;
      if (sentence && letters) {
        const chars = Array.from(w);
        inner = chars.map((c, ci) => {
          const p = progress(frame, start + k++ * gap, pd);
          return (
            <span key={ci} style={pieceStyle(pieceAnim, p)}>
              {c}
            </span>
          );
        });
      } else if (sentence) {
        const p = progress(frame, start + k++ * gap, pd);
        inner = <span style={pieceStyle(pieceAnim, p)}>{w}</span>;
      }
      const space = last ? null : letters ? (() => {
        const p = progress(frame, start + k++ * gap, pd);
        return <span style={{ opacity: p >= 1 ? 1 : 0 }}>{' '}</span>;
      })() : ' ';
      return (
        <span key={j}>
          <span style={wordStyle(my)}>
            {inner}
            {joinSpace ? space : null}
          </span>
          {joinSpace ? null : space}
        </span>
      );
    });
  };

  if (sentence) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems, ...style }}>
        {lines.map((l, i) => (
          <div key={i} {...leaf(`${group}-${i}`, input)} style={base(l)}>
            {renderLine(l)}
          </div>
        ))}
      </div>
    );
  }

  const per = n > 1 ? dur / (1 + 0.33 * (n - 1)) : dur;
  const stagger = per * 0.33;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems, ...style }}>
      {lines.map((l, i) => {
        const p = progress(frame, start + i * stagger, per);
        const pad = l.size * 0.12;
        const mask = anim === 'rise';
        return (
          <div
            key={i}
            style={
              mask
                ? { display: 'flex', overflow: 'hidden', paddingTop: pad, marginTop: -pad, paddingBottom: pad, marginBottom: -pad }
                : { display: 'flex' }
            }
          >
            <div {...leaf(`${group}-${i}`, input)} style={{ ...base(l), ...lineStyle(anim, p) }}>
              {hi.size ? renderLine(l) : l.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Word indices (across all lines) covered by the first case-insensitive match of `phrase`. */
export function highlightWords(lines: Line[], phrase?: string): Set<number> {
  const out = new Set<number>();
  if (!phrase || !phrase.trim()) return out;
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '');
  const all = lines.flatMap((l) => l.text.split(' ')).map(norm);
  const want = phrase.trim().split(/\s+/).map(norm).filter(Boolean);
  if (!want.length) return out;
  for (let i = 0; i + want.length <= all.length; i++) {
    if (want.every((w, j) => all[i + j] === w)) {
      for (let j = 0; j < want.length; j++) out.add(i + j);
      break;
    }
  }
  return out;
}
