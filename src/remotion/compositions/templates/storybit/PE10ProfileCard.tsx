'use client';

/**
 * PE-10 · Profile Card  (animation_type: "pe_profile_card")
 * A person's fact card: portrait, name, role, 2–6 key facts (Born · Education · Net worth…) and optional
 * tags. For introducing a founder, politician, athlete or suspect with the facts that matter.
 * Real, sourced facts only.
 *
 * Inputs (full list, limits and JSON Schema: PE10ProfileCard.inputs.json):
 *   name (required) · role · facts[] { label, value } · tags[] { text } · portrait_url · image_url · side · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [card, name, fact 1…6, tags]
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from 'remotion';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec, type TextSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, imageMotionStyle, progress, textAnimFrames } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { cardColors, fontFor, mutedFor, readStyle, styleVars, withAlpha, readHex } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

const FACT_LABEL: TextSpec = { label: 'Fact label', required: true, minChars: 2, maxChars: 18, minWords: 1, maxWords: 3, maxWordChars: 14, maxLines: 1, fontMax: 22, fontMin: 15, weight: 700, lineHeight: 1.2, fills: 'What the fact is' };
const FACT_VALUE: TextSpec = { label: 'Fact value', required: true, minChars: 1, maxChars: 40, minWords: 1, maxWords: 7, maxWordChars: 18, maxLines: 2, fontMax: 34, fontMin: 20, weight: 700, lineHeight: 1.2, fills: 'The fact' };
const TAG: TextSpec = { label: 'Tag', required: true, minChars: 2, maxChars: 22, minWords: 1, maxWords: 4, maxWordChars: 16, maxLines: 1, fontMax: 24, fontMin: 16, weight: 700, lineHeight: 1.2, fills: 'Short tag' };

export const PE10_SPEC: TemplateSpec = {
  id: 'PE-10',
  animationType: 'pe_profile_card',
  name: 'Profile Card',
  pickWhen: 'Introducing a person with the key facts about them: a founder, politician, athlete, accused.',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  images: { portrait_url: { label: 'Portrait', required: true, fills: 'Photo of the person (initials are shown only if it fails to load)' } },
  duration: { min: 90, default: 180, max: 240 },
  text: {
    name: { label: 'Name', required: true, minChars: 2, maxChars: 34, minWords: 1, maxWords: 5, maxWordChars: 18, maxLines: 2, fontMax: 72, fontMin: 40, weight: 800, lineHeight: 1.05, fills: 'Full name', example: 'Sample Person' },
    role: { label: 'Role', required: false, minChars: 2, maxChars: 50, minWords: 1, maxWords: 9, maxWordChars: 18, maxLines: 2, fontMax: 34, fontMin: 22, weight: 600, lineHeight: 1.25, fills: 'Role / what they are known for', example: 'Founder & CEO, Example Ltd' },
  },
  lists: {
    facts: { label: 'Fact', fills: 'Key facts', minItems: 2, maxItems: 6, bgColor: 'this fact’s panel', fields: { label: FACT_LABEL, value: FACT_VALUE } },
    tags: { label: 'Tag', fills: 'Short tags under the facts', minItems: 1, maxItems: 4, optional: true, fields: { text: TAG } },
  },
  options: {
    side: { label: 'Portrait side', values: ['left', 'right'], default: 'left', fills: 'Which side the portrait is on' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    card: { label: 'Card', kind: 'card', target: 'the card', default: 'pop' },
    portrait_motion: { label: 'Portrait motion', kind: 'image_motion', target: 'slow movement inside the portrait', default: 'push_in' },
    name: { label: 'Name', kind: 'text', target: 'name', default: 'rise' },
    facts: { label: 'Facts', kind: 'card', target: 'each fact', default: 'slide_up' },
    tags: { label: 'Tags', kind: 'card', target: 'tags', default: 'pop' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the card', default: 'fade_up' },
  },
  cues: { description: 'Fixed slots: card → name → fact 1…6 → tags.', units: ['card', 'name', 'fact 1', 'fact 2', 'fact 3', 'fact 4', 'fact 5', 'fact 6', 'tags'] },
  colors: ['card', 'card_border'],
  example: {
    name: 'Sample Person',
    role: 'Founder & CEO, Example Ltd',
    portrait_url: 'https://example.com/portrait.jpg',
    facts: [
      { label: 'Born', value: '1975, Pune' },
      { label: 'Education', value: 'B.Tech, IIT Bombay' },
      { label: 'Company value', value: '₹12,000 Cr (illustrative)' },
      { label: 'Known for', value: 'Replace with the real fact' },
    ],
    tags: [{ text: 'Entrepreneur' }, { text: 'Philanthropist' }],
    background: 'theme',
  },
};

export const CARD_PAD = 48;
export const GAP = 48;
export type ProfileLayout = { cardW: number; photoW: number; photoH: number; textW: number; name: Line[]; role: Line[]; factCols: number; factW: number; labels: Line[]; values: Line[][]; factH: number; tags: Line[]; tagW: number[]; cardH: number };

export function layoutProfile(input: { name: string; role: string; facts: { label: string; value: string }[]; tags: string[] }, measure: Measure, spec: TemplateSpec = PE10_SPEC): ProfileLayout {
  const T = spec.text;
  const cardW = SAFE_W;
  const photoW = 460;
  const textW = cardW - CARD_PAD * 2 - photoW - GAP;
  const factCols = input.facts.length > 3 ? 2 : 1;
  const factW = (textW - (factCols - 1) * 32) / factCols;
  const tagsH0 = input.tags.length ? 56 : 0;
  let cap = T.name.fontMax;
  for (;;) {
    const name = fitText(input.name, T.name, textW, measure, true, cap).lines;
    const role = input.role ? fitText(input.role, T.role, textW, measure, true, Math.min(T.role.fontMax, Math.round(cap * 0.5))).lines : [];
    const lf = sharedFont(input.facts.map((f) => f.label.toLocaleUpperCase()), FACT_LABEL, factW, measure);
    const vf = sharedFont(input.facts.map((f) => f.value), FACT_VALUE, factW, measure, Math.min(FACT_VALUE.fontMax, Math.round(cap * 0.5)));
    const labels = input.facts.map((f) => linesAt(f.label.toLocaleUpperCase(), lf, FACT_LABEL, factW, measure, false)[0]);
    const values = input.facts.map((f) => linesAt(f.value, vf, FACT_VALUE, factW, measure));
    const factH = Math.max(...values.map((v, i) => labels[i].size * 1.2 + 6 + blockHeight(v, FACT_VALUE.lineHeight))) + 20;
    const rows = Math.ceil(input.facts.length / factCols);
    // tags share one row: shrink them together, then drop trailing ones until the row fits
    let tf = sharedFont(input.tags, TAG, 360, measure);
    const rowW = (list: string[], f: number) => list.reduce((a, t) => a + Math.ceil(measure(t, f, 700)) + 32, 0) + 12 * Math.max(0, list.length - 1);
    let tagList = [...input.tags];
    while (tf > TAG.fontMin && rowW(tagList, tf) > textW) tf -= 1;
    while (tagList.length && rowW(tagList, tf) > textW) tagList = tagList.slice(0, -1);
    const tags = tagList.map((t) => linesAt(t, tf, TAG, 360, measure, false)[0]);
    const tagW = tags.map((t) => Math.ceil(measure(t.text, t.size, 700)) + 32);
    const textH = blockHeight(name, T.name.lineHeight) + (role.length ? 10 + blockHeight(role, T.role.lineHeight) : 0) + 30 + rows * factH + (tags.length ? 18 + tagsH0 : 0);
    const cardH = Math.max(textH + CARD_PAD * 2, 560);
    if (cardH <= SAFE_H || cap <= T.name.fontMin) {
      // the card hugs its content: no empty band on the right when the text is short
      const w = (l: Line, wt: number) => measure(l.text, l.size, wt);
      const factNeed = Math.max(0, ...labels.map((l) => w(l, FACT_LABEL.weight) * 1.12), ...values.flat().map((l) => w(l, FACT_VALUE.weight)));
      const used = Math.ceil(Math.max(...name.map((l) => w(l, T.name.weight)), ...role.map((l) => w(l, T.role.weight)), factCols * factNeed + (factCols - 1) * 32, tagW.reduce((a, b) => a + b, 0) + 12 * Math.max(0, tagW.length - 1), 360)) + 8;
      const tw = Math.min(textW, used);
      const fw = (tw - (factCols - 1) * 32) / factCols;
      const ch = Math.min(SAFE_H, cardH);
      return { cardW: CARD_PAD * 2 + photoW + GAP + tw, photoW, photoH: ch - CARD_PAD * 2, textW: tw, name, role, factCols, factW: fw, labels, values, factH, tags, tagW, cardH: ch };
    }
    cap -= 4;
  }
}

export function planProfile(L: ProfileLayout, anims: { name: string }, duration: number, cueTimes?: number[]): Plan {
  const nm = L.name.map((l) => l.text).join(' ');
  const n = L.values.length;
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const nDur = textAnimFrames(anims.name, words(nm).length, nm.length, 18);
  const first = 14 + nDur;
  const gap = n > 1 ? Math.max(5, Math.min(18, Math.floor((budget - first - 30) / n))) : 0;
  const units: Unit[] = [
    { key: 'card', label: 'Card', start: 2, dur: 14, cue: 0 },
    { key: 'name', label: 'Name', start: 12, dur: nDur, cue: 1 },
  ];
  for (let i = 0; i < n; i++) units.push({ key: `fact${i}`, label: `Fact ${i + 1}`, start: first + i * gap, dur: 12, cue: 2 + i });
  if (L.tags.length) units.push({ key: 'tags', label: 'Tags', start: first + n * gap + 4, dur: 14, cue: 8 });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function preparePE10(props: Record<string, unknown>, durationInFrames: number) {
  const S = PE10_SPEC.text;
  const A = (k: string) => readAnim(props, PE10_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(PE10_SPEC, props);
  const measure = measureFor(style);
  const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
  const facts = (Array.isArray(props.facts) ? props.facts : [])
    .map((x) => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      return { label: normaliseText(str(o.label), FACT_LABEL), value: normaliseText(str(o.value), FACT_VALUE), bg: readHex(o.bg_color) };
    })
    .filter((f) => f.label && f.value)
    .slice(0, 6);
  const tags = (Array.isArray(props.tags) ? props.tags : []).map((x) => normaliseText(typeof x === 'string' ? x : x && typeof x === 'object' ? str((x as Record<string, unknown>).text) : '', TAG)).filter(Boolean).slice(0, 4);
  const L = layoutProfile({ name: normaliseText(readFirst(props, ['name']), S.name), role: normaliseText(readFirst(props, ['role', 'title']), S.role), facts, tags }, measure, sized.spec);
  const plan = planProfile(L, { name: A('name') }, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, L, plan, factBg: facts.map((f) => f.bg), portrait: readFirst(props, ['portrait_url', 'photo_url']), right: opt(props, 'side', ['left', 'right'] as const, 'left') === 'right', imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

function PE10ProfileCardBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, factBg, portrait, right, imageUrl, bg, debug } = preparePE10(props, durationInFrames);
  const w = plan.windows;
  const S = PE10_SPEC.text;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const card = cardColors(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const top = (SAFE_H - L.cardH) / 2;
  const photoX = right ? L.cardW - CARD_PAD - L.photoW : CARD_PAD;
  const textX = right ? CARD_PAD : CARD_PAD + L.photoW + GAP;
  const initials = L.name.map((l) => l.text).join(' ').split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', left: (SAFE_W - L.cardW) / 2, top, width: L.cardW, height: L.cardH, ...exit }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 32, background: card.fill, border: `2px solid ${card.border}`, ...cardStyle(A('card'), progress(frame, w.card.start, w.card.dur)) }} />
          <div {...leaf('portrait', 'portrait_url')} style={{ position: 'absolute', left: photoX, top: CARD_PAD, width: L.photoW, height: L.photoH, borderRadius: 22, overflow: 'hidden', background: withAlpha(accent, 0.2), display: 'flex', alignItems: 'center', justifyContent: 'center', ...cardStyle(A('card'), progress(frame, w.card.start + 4, w.card.dur)) }}>
            {portrait ? <Img src={portrait} style={{ width: '100%', height: '100%', objectFit: 'cover', ...imageMotionStyle(A('portrait_motion'), frame / Math.max(1, durationInFrames)) }} /> : <span style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: 160, color: accent }}>{initials || '?'}</span>}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, background: accent }} />
          </div>
          <div style={{ position: 'absolute', left: textX, top: CARD_PAD, width: L.textW, height: L.cardH - CARD_PAD * 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <AnimatedText lines={L.name} anim={A('name')} start={w.name.start} dur={w.name.dur} frame={frame} weight={800} lineHeight={S.name.lineHeight} letterSpacing="-0.02em" shadow={shadow} group="name" input="name" />
            {L.role.length > 0 && <AnimatedText lines={L.role} anim="fade" start={w.name.start + 6} dur={w.name.dur} frame={frame} weight={S.role.weight} lineHeight={S.role.lineHeight} color={accent} shadow={shadow} group="role" input="role" style={{ marginTop: 10 }} />}
            <div style={{ height: 2, background: withAlpha(style.colors.text, 0.15), margin: '22px 0 8px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${L.factCols}, ${L.factW}px)`, columnGap: 32, gridAutoRows: `${L.factH}px` }}>
              {L.values.map((v, i) => {
                const fw = w[`fact${i}`];
                return (
                  <div key={i} style={{ position: 'relative', zIndex: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', ...cardStyle(A('facts'), progress(frame, fw.start, fw.dur)) }}>
                    {/* a panel behind every fact: bg_color when given, otherwise a soft tint */}
                    <div style={{ position: 'absolute', zIndex: -1, left: -14, right: -14, top: 3, bottom: 3, borderRadius: 14, background: factBg[i] ?? withAlpha(style.colors.text, 0.045) }} />
                    <span {...leaf(`fact-${i}-label`, `facts[${i}].label`)} style={{ fontFamily: fontFor(700), fontWeight: 700, fontSize: L.labels[i].size, lineHeight: 1.2, color: mutedFor(style, onFootage), letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{L.labels[i].text}</span>
                    <AnimatedText lines={v} anim="none" start={fw.start} dur={1} frame={frame} weight={FACT_VALUE.weight} lineHeight={FACT_VALUE.lineHeight} shadow={shadow} group={`fact-${i}-value`} input={`facts[${i}].value`} style={{ marginTop: 6 }} />
                  </div>
                );
              })}
            </div>
            {L.tags.length > 0 && w.tags && (
              <div style={{ display: 'flex', gap: 12, marginTop: 18, height: 44, alignItems: 'center' }}>
                {L.tags.map((t, i) => (
                  <span key={i} {...leaf(`tag-${i}`, `tags[${i}].text`)} style={{ width: L.tagW[i], boxSizing: 'border-box', textAlign: 'center', padding: '6px 0', borderRadius: 999, background: withAlpha(accent, 0.18), border: `1.5px solid ${withAlpha(accent, 0.6)}`, fontFamily: fontFor(700), fontWeight: 700, fontSize: t.size, lineHeight: 1.2, color: style.colors.text, whiteSpace: 'nowrap', ...cardStyle(A('tags'), progress(frame, w.tags!.start + i * 3, w.tags!.dur)) }}>
                    {t.text}
                  </span>
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
export const PE10ProfileCard = withAutoFit(PE10ProfileCardBase);
