'use client';

/**
 * FS-08 · Quote Card  (animation_type: "fs_quote_card")
 * A quotation with speaker, role and source — centred, or beside a portrait.
 * Only real, verbatim, sourced quotes. Never invent or paraphrase a quote and attribute it to a real person.
 *
 * Inputs (full list, limits and JSON Schema: FS08QuoteCard.inputs.json):
 *   quote (required) · speaker (required) · role · source · highlight · portrait_url · image_url
 *   layout · align · quote_mark · portrait_shape · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [quote, speaker, source]
 * Timing: 3–8s from clock.durationInFrames. When the speaker is cued, word-by-word quote animations
 * stretch to fill the time until the speaker appears (so the reveal follows the narration).
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type Issue, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, iconStyle, isSentenceAnim, progress, shapeState, textAnimFrames } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readBgMode, readFirst, highlightWords } from './core/shared';
import { Img } from 'remotion';

/* ================================================================== */
/* Content spec                                                         */
/* ================================================================== */

export const FS08_SPEC: TemplateSpec = {
  id: 'FS-08',
  animationType: 'fs_quote_card',
  name: 'Quote Card',
  pickWhen: 'Narration quotes a real person, speech, document or report word for word.',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  images: {
    portrait_url: { label: 'Portrait', required: false, fills: 'Photo of the speaker (portrait_left / portrait_right layouts)' },
  },
  duration: { min: 90, default: 180, max: 240 },
  text: {
    quote: {
      label: 'Quote',
      required: true,
      minChars: 10,
      maxChars: 160,
      minWords: 3,
      maxWords: 30,
      maxWordChars: 18,
      maxLines: 4,
      fontMax: 72,
      fontMin: 40,
      weight: 600,
      lineHeight: 1.3,
      hint: 'Verbatim words only, no quotation marks (the template adds them). Trim with "…" if needed.',
      fills: 'The quotation',
      example: 'At the stroke of the midnight hour, when the world sleeps, India will awake to life and freedom.',
    },
    speaker: {
      label: 'Speaker',
      required: true,
      minChars: 2,
      maxChars: 30,
      minWords: 1,
      maxWords: 5,
      maxWordChars: 16,
      maxLines: 1,
      fontMax: 40,
      fontMin: 28,
      weight: 700,
      lineHeight: 1.2,
      hint: 'Full name of the person quoted.',
      fills: 'Speaker name',
      example: 'Jawaharlal Nehru',
    },
    role: {
      label: 'Role',
      required: false,
      minChars: 2,
      maxChars: 40,
      minWords: 1,
      maxWords: 7,
      maxWordChars: 18,
      maxLines: 1,
      fontMax: 30,
      fontMin: 22,
      weight: 500,
      lineHeight: 1.25,
      hint: 'Who they are, at the time of the quote.',
      fills: 'Line under the speaker name',
      example: 'First Prime Minister of India',
    },
    source: {
      label: 'Source',
      required: false,
      minChars: 3,
      maxChars: 40,
      minWords: 1,
      maxWords: 7,
      maxWordChars: 18,
      maxLines: 1,
      fontMax: 24,
      fontMin: 20,
      weight: 500,
      lineHeight: 1.25,
      hint: 'Where and when it was said: speech, interview, book, date.',
      fills: 'Small source line',
      example: 'Tryst with Destiny speech, 1947',
    },
    highlight: {
      label: 'Highlight',
      required: false,
      minChars: 2,
      maxChars: 60,
      minWords: 1,
      maxWords: 10,
      maxWordChars: 18,
      maxLines: 1,
      fontMax: 72,
      fontMin: 40,
      weight: 600,
      lineHeight: 1.3,
      hint: 'Exact words from the quote to draw in the accent colour.',
      fills: 'Words of the quote drawn in the accent colour',
      example: 'India will awake to life and freedom',
      noSize: true,
    },
  },
  lists: {},
  options: {
    layout: {
      label: 'Layout',
      values: ['centered', 'portrait_left', 'portrait_right'],
      default: 'centered',
      fills: 'Quote alone, or beside a portrait (portrait layouts need portrait_url; without it the card is centred)',
    },
    align: { label: 'Align', values: ['center', 'left'], default: 'center', fills: 'Text alignment in the centred layout (portrait layouts are left-aligned)' },
    quote_mark: { label: 'Quote mark', values: ['on', 'off'], default: 'on', fills: 'Large accent quote mark above the quote' },
    portrait_shape: { label: 'Portrait shape', values: ['circle', 'rounded'], default: 'circle', fills: 'Shape of the portrait' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    quote_mark: { label: 'Quote mark', kind: 'icon', target: 'large quote mark', default: 'pop' },
    quote: { label: 'Quote', kind: 'text', target: 'the quotation', default: 'word_fade' },
    portrait: { label: 'Portrait', kind: 'card', target: 'speaker photo', default: 'pop' },
    rule: { label: 'Accent line', kind: 'shape', target: 'line before the speaker', default: 'grow' },
    speaker: { label: 'Speaker', kind: 'text', target: 'speaker name', default: 'slide_left' },
    role: { label: 'Role', kind: 'text', target: 'role line', default: 'fade' },
    source: { label: 'Source', kind: 'text', target: 'source line', default: 'fade' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: {
    description: 'quote = when the narrator starts the quote; speaker = when the name is said (the word-by-word reveal fills the gap); source is optional.',
    units: ['quote', 'speaker', 'source'],
  },
  colors: ['icon'],
  sizes: { quote_mark: { label: 'Quote mark', min: 60, max: 140, fills: 'Large quote mark' } },
  validate: (props) => {
    const issues: Issue[] = [];
    const q = typeof props.quote === 'string' ? props.quote : '';
    const h = typeof props.highlight === 'string' ? props.highlight.trim() : '';
    if (h && q && highlightWords([{ text: q.trim().replace(/\s+/g, ' '), size: 0 }], h).size === 0)
      issues.push({ field: 'highlight', level: 'warning', message: 'Highlight phrase is not in the quote — nothing is highlighted' });
    if (/^["“‘'«]|["”’'»]$/.test(q.trim())) issues.push({ field: 'quote', level: 'warning', message: 'Leave out quotation marks — the template adds its own' });
    return issues;
  },
  example: {
    quote: 'At the stroke of the midnight hour, when the world sleeps, India will awake to life and freedom.',
    speaker: 'Jawaharlal Nehru',
    role: 'First Prime Minister of India',
    source: 'Tryst with Destiny speech, 1947',
    highlight: 'India will awake to life and freedom',
    layout: 'centered',
    align: 'center',
    background: 'theme',
    animations: { quote: 'word_fade' },
    cue_times: [0.2, 4.2],
  },
};

/* ================================================================== */
/* Layout                                                               */
/* ================================================================== */

export type QuoteLayoutMode = 'centered' | 'portrait_left' | 'portrait_right';

export const CENTER_MAX_W = 1500;
export const PORTRAIT = 380;
export const PORTRAIT_GAP = 90;
export const MARK_GAP = 28;
export const ATTR_GAP = 44;
export const RULE_W = 56;
export const RULE_GAP = 22;
export const SOURCE_GAP = 14;

export type QuoteLayout = {
  mode: QuoteLayoutMode;
  textW: number;
  mark: number;
  quote: Line[];
  quoteFont: number;
  speaker: Line[];
  role: Line[];
  source: Line[];
  blockH: number;
};

/** Quote-mark box: the glyph is drawn inside a 4:3 box sized from the quote font. */
export const markBox = (size: number) => ({ w: Math.round(size * 1.34), h: size });

export function layoutQuote(
  input: { quote: string; speaker: string; role: string; source: string; mode: QuoteLayoutMode; mark: boolean },
  measure: Measure,
  spec: TemplateSpec = FS08_SPEC,
  markMax = 100,
): QuoteLayout {
  const T = spec.text;
  const mode = input.mode;
  const textW = mode === 'centered' ? CENTER_MAX_W : SAFE_W - PORTRAIT - PORTRAIT_GAP;
  const attrW = textW - RULE_W - RULE_GAP;
  const speaker = fitText(input.speaker, T.speaker, attrW, measure, false).lines;
  const role = input.role ? fitText(input.role, T.role, attrW, measure, false).lines : [];
  const source = input.source ? fitText(input.source, T.source, textW, measure, false).lines : [];
  const attrH =
    ATTR_GAP +
    blockHeight(speaker, T.speaker.lineHeight) +
    (role.length ? blockHeight(role, T.role.lineHeight) : 0) +
    (source.length ? SOURCE_GAP + blockHeight(source, T.source.lineHeight) : 0);

  let cap = T.quote.fontMax;
  const build = () => {
    const q = fitText(input.quote, T.quote, textW, measure, true, cap);
    const mark = input.mark ? Math.max(48, Math.min(markMax, Math.round(q.font * 1.4))) : 0;
    const h = (mark ? mark + MARK_GAP : 0) + blockHeight(q.lines, T.quote.lineHeight) + attrH;
    return { q, mark, h };
  };
  let b = build();
  while (b.h > SAFE_H && cap > T.quote.fontMin) {
    cap -= 2;
    b = build();
  }
  const blockH = mode === 'centered' ? b.h : Math.max(b.h, PORTRAIT);
  return { mode, textW, mark: b.mark, quote: b.q.lines, quoteFont: b.q.font, speaker, role, source, blockH };
}

/* ================================================================== */
/* Timing                                                               */
/* ================================================================== */

export function planQuote(
  L: QuoteLayout,
  anims: { quote: string; speaker: string; role: string; source: string },
  hasPortrait: boolean,
  duration: number,
  cueTimes?: number[],
): Plan {
  const T = (lines: Line[]) => lines.map((l) => l.text).join(' ');
  const q = T(L.quote);
  const qDur = textAnimFrames(anims.quote, words(q).length, q.length, Math.round(18 * (1 + 0.33 * (L.quote.length - 1))));
  const qStart = L.mark || hasPortrait ? 10 : 4;
  const units: Unit[] = [{ key: 'quote', label: 'Quote', start: qStart, dur: qDur, cue: 0 }];
  const sp = T(L.speaker);
  const spStart = qStart + qDur + 4;
  units.push({ key: 'speaker', label: 'Speaker', start: spStart, dur: textAnimFrames(anims.speaker, words(sp).length, sp.length, 16), cue: 1 });
  if (L.source.length) {
    const so = T(L.source);
    units.push({ key: 'source', label: 'Source', start: spStart + 12, dur: textAnimFrames(anims.source, words(so).length, so.length, 14), cue: 2 });
  }
  if (L.mark) units.push({ key: 'mark', label: 'Quote mark', start: 2, dur: 14, follows: { key: 'quote', offset: -8 } });
  if (hasPortrait) units.push({ key: 'portrait', label: 'Portrait', start: 2, dur: 16, follows: { key: 'quote', offset: -8 } });
  units.push({ key: 'rule', label: 'Accent line', start: spStart - 2, dur: 12, follows: { key: 'speaker', offset: -2 } });
  if (L.role.length) {
    const r = T(L.role);
    units.push({ key: 'role', label: 'Role', start: spStart + 6, dur: textAnimFrames(anims.role, words(r).length, r.length, 14), follows: { key: 'speaker', offset: 6 } });
  }
  const plan = planTimeline(duration, units, cueTimes);
  // word-by-word reveals follow the narration: stretch the quote to the speaker's entrance when cued
  const w = plan.windows;
  if (plan.cued && isSentenceAnim(anims.quote) && w.speaker && w.speaker.start - 4 > w.quote.start + w.quote.dur) {
    const budget = duration - exitFrames(duration) - MIN_HOLD;
    w.quote.dur = Math.min(w.speaker.start - 4 - w.quote.start, budget - w.quote.start);
  }
  return plan;
}

/* ================================================================== */
/* Props → layout → plan (shared by the renderer and the preview)       */
/* ================================================================== */

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareFS08(props: Record<string, unknown>, durationInFrames: number) {
  const S = FS08_SPEC.text;
  const A = (k: string) => readAnim(props, FS08_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(FS08_SPEC, props);
  const measure = measureFor(style);
  const strip = (t: string) => t.replace(/^["“‘'«\s]+|["”’'»\s]+$/g, '');
  const quote = normaliseText(strip(readFirst(props, ['quote', 'text']) ?? ''), S.quote);
  const speaker = normaliseText(readFirst(props, ['speaker', 'name', 'author']), S.speaker);
  const role = normaliseText(readFirst(props, ['role', 'title']), S.role);
  const source = normaliseText(readFirst(props, ['source']), S.source);
  const highlight = normaliseText(readFirst(props, ['highlight']), S.highlight);
  const portrait = readFirst(props, ['portrait_url', 'portrait']);
  let mode = opt(props, 'layout', ['centered', 'portrait_left', 'portrait_right'] as const, 'centered');
  if (mode !== 'centered' && !portrait) mode = 'centered';
  const align = mode === 'centered' ? opt(props, 'align', ['center', 'left'] as const, 'center') : 'left';
  const mark = opt(props, 'quote_mark', ['on', 'off'] as const, 'on') === 'on';
  const shape = opt(props, 'portrait_shape', ['circle', 'rounded'] as const, 'circle');
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const debug = props.show_safe_area === true;
  const L = layoutQuote({ quote, speaker, role, source, mode, mark }, measure, sized.spec, sized.extra.quote_mark);
  const plan = planQuote(L, { quote: A('quote'), speaker: A('speaker'), role: A('role'), source: A('source') }, mode !== 'centered', durationInFrames, readCues(props));
  return { style, sized, S, A, highlight, portrait, align, shape, imageUrl, bg, debug, L, plan };
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */

/** Opening-quote glyph (Material "format_quote" turned 180°), cropped to its ink. */
function QuoteMark({ size, color }: { size: number; color: string }) {
  const b = markBox(size);
  return (
    <svg width={b.w} height={b.h} viewBox="4.6 6.6 14.8 11" style={{ display: 'block', transform: 'rotate(180deg)' }}>
      <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" fill={color} />
    </svg>
  );
}

export function FS08QuoteCard({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, S, A, highlight, portrait, align, shape, imageUrl, bg, debug, L, plan } = prepareFS08(props, durationInFrames);
  const w = plan.windows;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const muted = mutedFor(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const rule = shapeState(A('rule'), progress(frame, w.rule.start, w.rule.dur));
  const items = align === 'center' ? 'center' : 'flex-start';

  const text = (
    <div style={{ width: L.textW, display: 'flex', flexDirection: 'column', alignItems: items }}>
      {L.mark > 0 && w.mark && (
        <div {...leaf('mark', 'quote_mark')} style={{ marginBottom: MARK_GAP, ...iconStyle(A('quote_mark'), progress(frame, w.mark.start, w.mark.dur)) }}>
          <QuoteMark size={L.mark} color={style.custom.has('icon') ? style.colors.icon : accent} />
        </div>
      )}
      <AnimatedText
        lines={L.quote}
        anim={A('quote')}
        start={w.quote.start}
        dur={w.quote.dur}
        frame={frame}
        weight={S.quote.weight}
        lineHeight={S.quote.lineHeight}
        shadow={shadow}
        align={align}
        group="quote"
        input="quote"
        highlight={highlight}
        highlightColor={accent}
      />
      <div style={{ marginTop: ATTR_GAP, display: 'flex', alignItems: 'center', gap: RULE_GAP }}>
        <div {...leaf('rule', 'accent line')} style={{ width: RULE_W * rule.length, height: 6, borderRadius: 3, background: accent, ...rule.style }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <AnimatedText
            lines={L.speaker}
            anim={A('speaker')}
            start={w.speaker.start}
            dur={w.speaker.dur}
            frame={frame}
            weight={S.speaker.weight}
            lineHeight={S.speaker.lineHeight}
            shadow={shadow}
            group="speaker"
            input="speaker"
          />
          {L.role.length > 0 && w.role && (
            <AnimatedText
              lines={L.role}
              anim={A('role')}
              start={w.role.start}
              dur={w.role.dur}
              frame={frame}
              weight={S.role.weight}
              lineHeight={S.role.lineHeight}
              color={muted}
              shadow={shadow}
              group="role"
              input="role"
            />
          )}
        </div>
      </div>
      {L.source.length > 0 && w.source && (
        <AnimatedText
          lines={L.source}
          anim={A('source')}
          start={w.source.start}
          dur={w.source.dur}
          frame={frame}
          weight={S.source.weight}
          lineHeight={S.source.lineHeight}
          color={withAlpha(style.colors.muted, onFootage ? 0.95 : 0.8)}
          shadow={shadow}
          align={align}
          group="source"
          input="source"
          style={{ marginTop: SOURCE_GAP }}
        />
      )}
    </div>
  );

  // the soft halo is drawn inside the portrait box so nothing crosses the safe margin
  const radius = shape === 'circle' ? '50%' : 36;
  const portraitEl = portrait && w.portrait && (
    <div
      {...leaf('portrait', 'portrait_url')}
      style={{
        width: PORTRAIT,
        height: PORTRAIT,
        flexShrink: 0,
        boxSizing: 'border-box',
        padding: 14,
        borderRadius: radius,
        background: withAlpha(accent, 0.15),
        ...cardStyle(A('portrait'), progress(frame, w.portrait.start, w.portrait.dur)),
      }}
    >
      <div style={{ width: '100%', height: '100%', borderRadius: shape === 'circle' ? '50%' : 26, overflow: 'hidden', border: `6px solid ${accent}`, boxSizing: 'border-box' }}>
        <Img src={portrait} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground
        mode={bg}
        imageUrl={imageUrl}
        align={align === 'center' ? 'center' : 'left'}
        accent={accent}
        frame={frame}
        durationInFrames={durationInFrames}
        colors={style.colors}
        motion={A('image_motion')}
        entry={A('image_entry')}
      />

      <SafeArea debug={debug}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: L.mode === 'portrait_right' ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: L.mode === 'centered' ? (align === 'center' ? 'center' : 'flex-start') : 'flex-start',
            gap: PORTRAIT_GAP,
            ...exit,
          }}
        >
          {L.mode !== 'centered' && portraitEl}
          {text}
        </div>
      </SafeArea>
    </div>
  );
}
