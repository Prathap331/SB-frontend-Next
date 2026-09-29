'use client';

/**
 * UI-01 · Social Post  (animation_type: "ui_social_post")
 * A tweet-style post card: avatar, name, handle, verified tick, post text (with an optional highlighted
 * phrase), optional picture, date and counts (replies / reposts / likes). Generic look — no platform logos.
 * Only real posts, word for word, with their real author and date; label recreations.
 *
 * Inputs (full list, limits and JSON Schema: UI01SocialPost.inputs.json):
 *   name (required) · handle · text (required) · highlight · date · verified · replies · reposts · likes · views
 *   avatar_url · post_image_url · image_url · theme_style · label · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [card, text, highlight, counts]
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from 'remotion';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type Issue, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, words, type Line, type Measure } from './core/fit';
import { cardStyle, easeInOutCubic, exitStyle, progress, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { formatDigits, pickScale, readNumber } from './core/numbers';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, StoryBackground, highlightWords, leaf, readBgMode, readFirst, type HighlightStyle } from './core/shared';
import { withAutoFit } from './core/autofit';

export const UI01_SPEC: TemplateSpec = {
  id: 'UI-01',
  animationType: 'ui_social_post',
  name: 'Social Post',
  pickWhen: 'Quoting a real post from X / Twitter, Threads or similar: who said it, what, when, how it spread.',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  images: {
    avatar_url: { label: 'Avatar', required: false, fills: 'Profile picture (first letter of the name if missing)' },
    post_image_url: { label: 'Post image', required: false, fills: 'Picture attached to the post' },
  },
  duration: { min: 90, default: 180, max: 240 },
  numbers: {
    replies: { label: 'Replies', required: false, fills: 'Reply count (raw number)' },
    reposts: { label: 'Reposts', required: false, fills: 'Repost count' },
    likes: { label: 'Likes', required: false, fills: 'Like count' },
    views: { label: 'Views', required: false, fills: 'View count' },
  },
  text: {
    name: { label: 'Name', required: true, minChars: 1, maxChars: 30, minWords: 1, maxWords: 5, maxWordChars: 18, maxLines: 1, fontMax: 36, fontMin: 24, weight: 800, lineHeight: 1.2, fills: 'Display name', example: 'Sample Account' },
    handle: { label: 'Handle', required: false, minChars: 2, maxChars: 24, minWords: 1, maxWords: 1, maxWordChars: 24, maxLines: 1, fontMax: 28, fontMin: 20, weight: 500, lineHeight: 1.2, hint: 'Without the @.', fills: '@handle', example: 'sample_account' },
    text: { label: 'Post text', required: true, minChars: 2, maxChars: 280, minWords: 1, maxWords: 55, maxWordChars: 22, maxLines: 7, fontMax: 44, fontMin: 26, weight: 500, lineHeight: 1.35, hint: 'The post, word for word.', fills: 'Body of the post', example: 'Replace with the real post text, word for word.' },
    highlight: { label: 'Highlight', required: false, minChars: 2, maxChars: 80, minWords: 1, maxWords: 14, maxWordChars: 22, maxLines: 1, fontMax: 44, fontMin: 26, weight: 500, lineHeight: 1.35, hint: 'Exact words from the post to mark.', fills: 'Phrase marked in the post', noSize: true },
    date: { label: 'Date', required: false, minChars: 2, maxChars: 30, minWords: 1, maxWords: 6, maxWordChars: 14, maxLines: 1, fontMax: 24, fontMin: 18, weight: 500, lineHeight: 1.2, hint: '"9:41 PM · 12 Mar 2025".', fills: 'Time and date line', example: '9:41 PM · 12 Mar 2025' },
    label: { label: 'Label', required: false, minChars: 2, maxChars: 28, minWords: 1, maxWords: 4, maxWordChars: 16, maxLines: 1, fontMax: 22, fontMin: 16, weight: 700, lineHeight: 1.2, hint: 'e.g. "Recreated post" / "Post since deleted".', fills: 'Small tag above the card' },
  },
  lists: {},
  options: {
    verified: { label: 'Verified tick', values: ['off', 'on'], default: 'off', fills: 'Show a verified tick next to the name' },
    theme_style: { label: 'Card look', values: ['dark', 'light'], default: 'dark', fills: 'Dark or light card' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    card: { label: 'Card', kind: 'card', target: 'the post card', default: 'pop' },
    text: { label: 'Post text', kind: 'text', target: 'post text', default: 'word_fade' },
    highlight: { label: 'Highlight', kind: 'shape', target: 'marker over the highlighted words', default: 'grow' },
    counts: { label: 'Counts', kind: 'number', target: 'replies / reposts / likes / views', default: 'count_up' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the card', default: 'fade_up' },
  },
  cues: { description: 'card → text → highlight → counts.', units: ['card', 'text', 'highlight', 'counts'] },
  colors: [],
  validate: (props) => {
    const issues: Issue[] = [];
    const t = typeof props.text === 'string' ? props.text.replace(/\s+/g, ' ').trim() : '';
    const h = typeof props.highlight === 'string' ? props.highlight.trim() : '';
    if (h && t && highlightWords([{ text: t, size: 0 }], h).size === 0) issues.push({ field: 'highlight', level: 'warning', message: 'Highlight phrase is not in the post text' });
    return issues;
  },
  example: { name: 'Sample Account', handle: 'sample_account', verified: 'on', text: 'Replace with the real post text, word for word.', date: '9:41 PM · 12 Mar 2025', replies: 1200, reposts: 8400, likes: 52000, theme_style: 'dark', background: 'theme' },
};

export const CARD_W = 1180;
export const PAD = 44;
export const AVATAR = 88;
const STATS = [
  { key: 'replies', icon: 'message-circle' },
  { key: 'reposts', icon: 'repeat' },
  { key: 'likes', icon: 'heart' },
  { key: 'views', icon: 'bar-chart' },
] as const;
export type PostLayout = { name: Line; handle?: Line; date?: Line; label?: Line; text: Line[]; imgH: number; cardH: number; stats: { icon: string; value: number; text: string }[] };

const fmtCount = (v: number) => {
  const sc = pickScale(v, 'intl_compact');
  const d = sc.div > 1 && Math.abs(v / sc.div) < 10 ? 1 : 0;
  return `${formatDigits(v, sc, 'intl_compact', d)}${sc.suffix}`;
};

export function layoutPost(input: { name: string; handle: string; date: string; label: string; text: string; hasImage: boolean; stats: { icon: string; value: number }[] }, measure: Measure, spec: TemplateSpec = UI01_SPEC): PostLayout {
  const T = spec.text;
  const inner = CARD_W - PAD * 2;
  const name = fitText(input.name, T.name, inner - AVATAR - 260, measure, false).lines[0];
  const handle = input.handle ? fitText(`@${input.handle.replace(/^@/, '')}`, T.handle, inner - AVATAR - 60, measure, false).lines[0] : undefined;
  const date = input.date ? fitText(input.date, T.date, inner, measure, false).lines[0] : undefined;
  const label = input.label ? fitText(input.label, T.label, 600, measure, false).lines[0] : undefined;
  const labelH = label ? label.size * 1.2 + 26 : 0;
  const stats = input.stats.map((s) => ({ ...s, text: fmtCount(s.value) }));
  const statsH = stats.length ? 56 : 0;
  const head = AVATAR + 24;
  const fixed = PAD * 2 + head + (date ? date.size * 1.2 + 18 : 0) + statsH + labelH;
  let cap = T.text.fontMax;
  for (;;) {
    const text = fitText(input.text, T.text, inner, measure, true, cap).lines;
    const textH = blockHeight(text, T.text.lineHeight) + 18;
    const room = SAFE_H - fixed - textH;
    const imgH = input.hasImage ? Math.max(0, Math.min(420, room - 16)) : 0;
    if (room >= (input.hasImage ? 160 : 0) || cap <= T.text.fontMin) {
      const img = input.hasImage && imgH >= 120 ? imgH : 0;
      return { name, handle, date, label, text, imgH: img, cardH: Math.min(SAFE_H - labelH, fixed - labelH + textH + (img ? img + 16 : 0)), stats };
    }
    cap -= 2;
  }
}

export function planPost(L: PostLayout, anim: string, hasHighlight: boolean, duration: number, cueTimes?: number[]): Plan {
  const t = L.text.map((l) => l.text).join(' ');
  const tDur = textAnimFrames(anim, words(t).length, t.length, 20);
  const units: Unit[] = [
    { key: 'card', label: 'Card', start: 4, dur: 14, cue: 0 },
    { key: 'text', label: 'Post text', start: 16, dur: tDur, cue: 1 },
  ];
  let next = 16 + tDur;
  if (hasHighlight) {
    units.push({ key: 'highlight', label: 'Highlight', start: next + 2, dur: 16, cue: 2 });
    next += 12;
  }
  if (L.stats.length) units.push({ key: 'counts', label: 'Counts', start: next + 4, dur: 28, cue: 3 });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareUI01(props: Record<string, unknown>, durationInFrames: number) {
  const S = UI01_SPEC.text;
  const A = (k: string) => readAnim(props, UI01_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(UI01_SPEC, props);
  const measure = measureFor(style);
  const postImage = readFirst(props, ['post_image_url']);
  const stats = STATS.map((s) => ({ icon: s.icon, value: readNumber(props[s.key]) })).filter((s): s is { icon: (typeof STATS)[number]['icon']; value: number } => s.value !== undefined && s.value >= 0);
  const L = layoutPost({ name: normaliseText(readFirst(props, ['name', 'author']), S.name), handle: normaliseText(readFirst(props, ['handle']), S.handle), date: normaliseText(readFirst(props, ['date']), S.date), label: normaliseText(readFirst(props, ['label']), S.label), text: normaliseText(readFirst(props, ['text', 'post']), S.text), hasImage: Boolean(postImage), stats }, measure, sized.spec);
  const hl = normaliseText(readFirst(props, ['highlight']), S.highlight);
  const highlight = highlightWords(L.text, hl).size ? hl : '';
  const plan = planPost(L, A('text'), Boolean(highlight), durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, L, plan, highlight, postImage, avatar: readFirst(props, ['avatar_url']), verified: opt(props, 'verified', ['off', 'on'] as const, 'off') === 'on', light: opt(props, 'theme_style', ['dark', 'light'] as const, 'dark') === 'light', imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

function UI01SocialPostBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, highlight, postImage, avatar, verified, light, imageUrl, bg, debug } = prepareUI01(props, durationInFrames);
  const w = plan.windows;
  const S = UI01_SPEC.text;
  const accent = style.colors.accent;
  const C = light ? { card: '#FFFFFF', ink: '#0F1419', muted: '#536471', line: '#EFF3F4' } : { card: '#15181C', ink: '#E7E9EA', muted: '#8B98A5', line: '#2F3336' };
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const labelH = L.label ? L.label.size * 1.2 + 26 : 0;
  const top = labelH + (SAFE_H - labelH - L.cardH) / 2;
  const left = (SAFE_W - CARD_W) / 2;
  const hw = w.highlight;
  const hp = hw ? progress(frame, hw.start, hw.dur) : 0;
  const marker: HighlightStyle = (order, count) => {
    const q = easeInOutCubic(Math.min(1, Math.max(0, hp * count - order)));
    return { backgroundImage: `linear-gradient(${withAlpha(accent, 0.4)}, ${withAlpha(accent, 0.4)})`, backgroundRepeat: 'no-repeat', backgroundPosition: 'left 60%', backgroundSize: `${q * 100}% 80%` };
  };
  const cw = w.counts;
  const cp = cw ? easeInOutCubic(progress(frame, cw.start, cw.dur)) : 1;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.label && <span {...leaf('label', 'label')} style={{ position: 'absolute', left, top: top - labelH, fontFamily: fontFor(700), fontWeight: 700, fontSize: L.label.size, lineHeight: 1.2, color: '#FFFFFF', background: withAlpha(style.colors.scrim, 0.65), padding: '4px 14px', borderRadius: 8, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{L.label.text}</span>}
          <div style={{ position: 'absolute', left, top, width: CARD_W, height: L.cardH, boxSizing: 'border-box', padding: PAD, borderRadius: 28, background: C.card, border: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', ...cardStyle(A('card'), progress(frame, w.card.start, w.card.dur)) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, height: AVATAR, marginBottom: 24 }}>
              <div {...leaf('avatar', 'avatar_url')} style={{ width: AVATAR, height: AVATAR, borderRadius: '50%', overflow: 'hidden', background: accent, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatar ? <Img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: 40, color: style.colors.on_accent }}>{L.name.text.slice(0, 1).toUpperCase()}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span {...leaf('name', 'name')} style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: L.name.size, lineHeight: 1.2, color: C.ink, whiteSpace: 'nowrap' }}>{L.name.text}</span>
                  {verified && (
                    <div {...leaf('verified', 'verified')} style={{ width: L.name.size * 0.9, height: L.name.size * 0.9, borderRadius: '50%', background: '#1D9BF0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LucideIconView name="check" size={Math.round(L.name.size * 0.6)} color="#FFFFFF" />
                    </div>
                  )}
                </div>
                {L.handle && <span {...leaf('handle', 'handle')} style={{ fontFamily: fontFor(500), fontWeight: 500, fontSize: L.handle.size, lineHeight: 1.2, color: C.muted, whiteSpace: 'nowrap' }}>{L.handle.text}</span>}
              </div>
            </div>
            <AnimatedText lines={L.text} anim={A('text')} start={w.text.start} dur={w.text.dur} frame={frame} weight={S.text.weight} lineHeight={S.text.lineHeight} color={C.ink} shadow="none" group="text" input="text" highlight={highlight} highlightStyle={marker} style={{ marginBottom: 18 }} />
            {L.imgH > 0 && postImage && (
              <div {...leaf('post-image', 'post_image_url')} style={{ width: '100%', height: L.imgH, borderRadius: 18, overflow: 'hidden', marginBottom: 16, flexShrink: 0 }}>
                <Img src={postImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            {L.date && <span {...leaf('date', 'date')} style={{ fontFamily: fontFor(500), fontWeight: 500, fontSize: L.date.size, lineHeight: 1.2, color: C.muted, whiteSpace: 'nowrap', marginBottom: 18 }}>{L.date.text}</span>}
            {L.stats.length > 0 && (
              <div style={{ display: 'flex', gap: 48, alignItems: 'center', height: 56, borderTop: `1px solid ${C.line}`, paddingTop: 14, boxSizing: 'border-box', opacity: cw ? Math.min(1, progress(frame, cw.start, 8) * 1) : 1 }}>
                {L.stats.map((s, i) => (
                  <div key={i} {...leaf(`stat-${i}`, s.icon)} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <LucideIconView name={s.icon} size={26} color={C.muted} />
                    <span style={{ fontFamily: fontFor(600), fontWeight: 600, fontSize: 24, lineHeight: 1.2, color: C.muted, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{cp < 1 ? fmtCount(s.value * cp) : s.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const UI01SocialPost = withAutoFit(UI01SocialPostBase);
