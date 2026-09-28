'use client';

/**
 * DG-25 · Myth vs Fact  (animation_type: "dg_myth_fact")
 * Debunking: the myth appears, gets crossed out and stamped MYTH, then the fact appears with a
 * FACT stamp and an optional source. Split (side by side) or reveal (myth above, fact below).
 *
 * Inputs (full list, limits and JSON Schema: DG25MythFact.inputs.json):
 *   myth (required) · fact (required) · source · title · myth_label · fact_label · image_url · layout · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, myth, strike, fact, source]
 * Timing: 3–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, iconStyle, progress, shapeState, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { cardColors, fontFor, mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, guide, leaf, readBgMode, readFirst } from './core/shared';

export const DG25_SPEC: TemplateSpec = {
  id: 'DG-25',
  animationType: 'dg_myth_fact',
  name: 'Myth vs Fact',
  pickWhen: 'Debunking a common belief: "Many people think X. In fact, Y."',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 180, max: 240 },
  text: {
    title: { label: 'Heading', required: false, minChars: 3, maxChars: 40, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 1, fontMax: 56, fontMin: 40, weight: 800, lineHeight: 1.05, fills: 'Heading above the cards' },
    myth: { label: 'Myth', required: true, minChars: 8, maxChars: 90, minWords: 2, maxWords: 16, maxWordChars: 18, maxLines: 3, fontMax: 52, fontMin: 30, weight: 700, lineHeight: 1.2, hint: 'The belief, stated plainly.', fills: 'Myth text', example: 'UPI payments are charged a fee' },
    fact: { label: 'Fact', required: true, minChars: 8, maxChars: 130, minWords: 2, maxWords: 24, maxWordChars: 18, maxLines: 4, fontMax: 52, fontMin: 28, weight: 700, lineHeight: 1.22, hint: 'The correction, with a real source.', fills: 'Fact text', example: 'Regular person-to-person UPI payments are free for users' },
    source: { label: 'Source', required: false, minChars: 3, maxChars: 60, minWords: 1, maxWords: 10, maxWordChars: 18, maxLines: 1, fontMax: 24, fontMin: 18, weight: 500, lineHeight: 1.25, hint: '"Source: NPCI, 2024".', fills: 'Source under the fact' },
    myth_label: { label: 'Myth label', required: false, minChars: 2, maxChars: 12, minWords: 1, maxWords: 2, maxWordChars: 12, maxLines: 1, fontMax: 30, fontMin: 22, weight: 800, lineHeight: 1.2, hint: 'Default "Myth" (e.g. "मिथक").', fills: 'Stamp on the myth' },
    fact_label: { label: 'Fact label', required: false, minChars: 2, maxChars: 12, minWords: 1, maxWords: 2, maxWordChars: 12, maxLines: 1, fontMax: 30, fontMin: 22, weight: 800, lineHeight: 1.2, hint: 'Default "Fact" (e.g. "तथ्य").', fills: 'Stamp on the fact' },
  },
  lists: {},
  options: {
    layout: { label: 'Layout', values: ['split', 'reveal'], default: 'split', fills: 'split: myth left, fact right · reveal: myth on top, fact below' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    cards: { label: 'Cards', kind: 'card', target: 'myth and fact cards', default: 'pop' },
    myth: { label: 'Myth text', kind: 'text', target: 'myth text', default: 'fade_up' },
    strike: { label: 'Strike-through', kind: 'shape', target: 'line crossing out the myth', default: 'grow' },
    stamps: { label: 'Stamps', kind: 'icon', target: 'MYTH / FACT stamps', default: 'pop' },
    fact: { label: 'Fact text', kind: 'text', target: 'fact text', default: 'word_fade' },
    source: { label: 'Source', kind: 'text', target: 'source line', default: 'fade' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: { description: 'Fixed slots: heading → myth → strike (the "but that is wrong" moment) → fact → source. Send null for any you do not have.', units: ['heading', 'myth', 'strike', 'fact', 'source'] },
  colors: ['card', 'card_border', 'positive', 'negative'],
  example: { myth: 'UPI payments are charged a fee', fact: 'Regular person-to-person UPI payments are free for users', source: 'Source: replace with the real source', layout: 'split', background: 'theme' },
};

export const PAD = 40;
export const STAMP_GAP = 22;
export type MythLayout = { layout: 'split' | 'reveal'; title: Line[]; titleH: number; cardW: number; cardH: number; myth: Line[]; mythW: number[]; fact: Line[]; source?: Line; mythLabel: Line; factLabel: Line; stampH: number };

export function layoutMyth(input: { title: string; myth: string; fact: string; source: string; ml: string; fl: string; layout: 'split' | 'reveal' }, measure: Measure, spec: TemplateSpec = DG25_SPEC): MythLayout {
  const T = spec.text;
  const title = input.title ? fitText(input.title, T.title, SAFE_W, measure, false).lines : [];
  const titleH = title.length ? blockHeight(title, T.title.lineHeight) + 36 : 0;
  const split = input.layout === 'split';
  const cardW = split ? (SAFE_W - 48) / 2 : Math.min(1400, SAFE_W);
  const inner = cardW - PAD * 2;
  const mythLabel = fitText(input.ml.toLocaleUpperCase(), T.myth_label, inner, measure, false).lines[0];
  const factLabel = fitText(input.fl.toLocaleUpperCase(), T.fact_label, inner, measure, false).lines[0];
  const stampH = Math.round(Math.max(mythLabel.size, factLabel.size) * 1.2 + 20);
  const source = input.source ? fitText(input.source, T.source, inner, measure, false).lines[0] : undefined;
  let cap = Math.max(T.myth.fontMax, T.fact.fontMax);
  for (;;) {
    const myth = fitText(input.myth, T.myth, inner, measure, true, Math.min(cap, T.myth.fontMax)).lines;
    const fact = fitText(input.fact, T.fact, inner, measure, true, Math.min(cap, T.fact.fontMax)).lines;
    const mh = PAD * 2 + stampH + STAMP_GAP + blockHeight(myth, T.myth.lineHeight);
    const fh = PAD * 2 + stampH + STAMP_GAP + blockHeight(fact, T.fact.lineHeight) + (source ? 16 + source.size * 1.25 : 0);
    const cardH = split ? Math.max(mh, fh) : 0;
    const total = titleH + (split ? cardH : mh + 28 + fh);
    if (total <= SAFE_H || cap <= 28) return { layout: input.layout, title, titleH, cardW, cardH: split ? cardH : mh, myth, mythW: myth.map((l) => Math.ceil(measure(l.text, l.size, T.myth.weight))), fact, source, mythLabel, factLabel, stampH };
    cap -= 2;
  }
}
export function planMyth(L: MythLayout, anims: { title: string; myth: string; fact: string }, duration: number, cueTimes?: number[]): Plan {
  const T = (l: Line[]) => l.map((x) => x.text).join(' ');
  const units: Unit[] = [];
  let cue = 0;
  if (L.title.length) units.push({ key: 'title', label: 'Heading', start: 2, dur: textAnimFrames(anims.title, words(T(L.title)).length, T(L.title).length, 18), cue: cue });
  cue = 1;
  const t0 = L.title.length ? 16 : 4;
  const mDur = textAnimFrames(anims.myth, words(T(L.myth)).length, T(L.myth).length, 18);
  units.push({ key: 'myth', label: 'Myth', start: t0, dur: mDur, cue: cue++ });
  units.push({ key: 'strike', label: 'Strike + MYTH stamp', start: t0 + mDur + 10, dur: 14, cue: cue++ });
  const fDur = textAnimFrames(anims.fact, words(T(L.fact)).length, T(L.fact).length, 20);
  units.push({ key: 'fact', label: 'Fact', start: t0 + mDur + 30, dur: fDur, cue: cue++ });
  if (L.source) units.push({ key: 'source', label: 'Source', start: t0 + mDur + 30 + fDur, dur: 12, cue: cue });
  units.push({ key: 'myth_card', label: 'Myth card', start: t0 - 4, dur: 12, follows: { key: 'myth', offset: -4 } });
  units.push({ key: 'fact_card', label: 'Fact card', start: t0 + mDur + 26, dur: 12, follows: { key: 'fact', offset: -4 } });
  units.push({ key: 'fact_stamp', label: 'FACT stamp', start: t0 + mDur + 30, dur: 14, follows: { key: 'fact', offset: 0 } });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareDG25(props: Record<string, unknown>, durationInFrames: number) {
  const S = DG25_SPEC.text;
  const A = (k: string) => readAnim(props, DG25_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DG25_SPEC, props);
  const measure = measureFor(style);
  const layout = opt(props, 'layout', ['split', 'reveal'] as const, 'split');
  const L = layoutMyth({ title: normaliseText(readFirst(props, ['title']), S.title), myth: normaliseText(readFirst(props, ['myth']), S.myth), fact: normaliseText(readFirst(props, ['fact']), S.fact), source: normaliseText(readFirst(props, ['source']), S.source), ml: normaliseText(readFirst(props, ['myth_label']), S.myth_label) || 'Myth', fl: normaliseText(readFirst(props, ['fact_label']), S.fact_label) || 'Fact', layout }, measure, sized.spec);
  const plan = planMyth(L, { title: A('title'), myth: A('myth'), fact: A('fact') }, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, L, plan, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

export function DG25MythFact({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, imageUrl, bg, debug } = prepareDG25(props, durationInFrames);
  const w = plan.windows;
  const S = DG25_SPEC.text;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const muted = mutedFor(style, onFootage);
  const card = cardColors(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const bad = style.colors.negative;
  const good = style.colors.positive;
  const split = L.layout === 'split';
  const strike = shapeState(A('strike'), progress(frame, w.strike.start, w.strike.dur));
  const struck = frame >= w.strike.start;
  const factH = PAD * 2 + L.stampH + STAMP_GAP + blockHeight(L.fact, S.fact.lineHeight) + (L.source ? 16 + L.source.size * 1.25 : 0);
  const mythH = split ? L.cardH : PAD * 2 + L.stampH + STAMP_GAP + blockHeight(L.myth, S.myth.lineHeight);
  const totalH = L.titleH + (split ? L.cardH : mythH + 28 + factH);
  const top = (SAFE_H - totalH) / 2 + L.titleH;
  const mythBox = { x: split ? 0 : (SAFE_W - L.cardW) / 2, y: top, h: mythH };
  const factBox = { x: split ? SAFE_W - L.cardW : (SAFE_W - L.cardW) / 2, y: split ? top : top + mythH + 28, h: split ? L.cardH : factH };
  const stamp = (label: Line, color: string, icon: string, win: { start: number; dur: number }, input: string, show: boolean) => (
    <div {...leaf(`stamp-${input}`, input)} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: L.stampH, boxSizing: 'border-box', padding: '0 18px', borderRadius: 999, background: withAlpha(color, 0.16), border: `2px solid ${withAlpha(color, 0.6)}`, opacity: show ? 1 : 0, ...iconStyle(A('stamps'), progress(frame, win.start, win.dur)) }}>
      <LucideIconView name={icon} size={Math.round(label.size * 1.05)} color={color} />
      <span style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: label.size, lineHeight: 1.2, color, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{label.text}</span>
    </div>
  );
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={style.colors.accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.title.length > 0 && w.title && <AnimatedText lines={L.title} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={S.title.weight} lineHeight={S.title.lineHeight} shadow={shadow} align="center" group="title" input="title" style={{ position: 'absolute', left: 0, width: SAFE_W, top: top - L.titleH }} />}
          <div style={{ position: 'absolute', left: mythBox.x, top: mythBox.y, width: L.cardW, height: mythBox.h, boxSizing: 'border-box', padding: PAD, borderRadius: 26, background: card.fill, border: `2px solid ${struck ? withAlpha(bad, 0.6) : card.border}`, ...cardStyle(A('cards'), progress(frame, w.myth_card.start, w.myth_card.dur)) }}>
            {stamp(L.mythLabel, bad, 'x', w.strike, 'myth_label', struck)}
            <div style={{ position: 'relative', marginTop: STAMP_GAP, opacity: struck ? 0.7 : 1 }}>
              <AnimatedText lines={L.myth} anim={A('myth')} start={w.myth.start} dur={w.myth.dur} frame={frame} weight={S.myth.weight} lineHeight={S.myth.lineHeight} color={style.colors.text} shadow={shadow} group="myth" input="myth" />
              {/* strike-through: one line per text line, drawn left to right */}
              {L.myth.map((l, i) => (
                <div key={i} {...guide(`strike-${i}`, 'strike-through')} style={{ position: 'absolute', left: 0, top: i * l.size * S.myth.lineHeight + l.size * S.myth.lineHeight * 0.52, height: Math.max(4, Math.round(l.size / 9)), borderRadius: 3, width: L.mythW[i] * Math.min(1, Math.max(0, strike.length * L.myth.length - i)), background: bad, ...strike.style }} />
              ))}
            </div>
          </div>
          {w.fact && (
            <div style={{ position: 'absolute', left: factBox.x, top: factBox.y, width: L.cardW, height: factBox.h, boxSizing: 'border-box', padding: PAD, borderRadius: 26, background: card.fill, border: `2px solid ${withAlpha(good, 0.6)}`, ...cardStyle(A('cards'), progress(frame, w.fact_card.start, w.fact_card.dur)) }}>
              {stamp(L.factLabel, good, 'check', w.fact_stamp, 'fact_label', true)}
              <AnimatedText lines={L.fact} anim={A('fact')} start={w.fact.start} dur={w.fact.dur} frame={frame} weight={S.fact.weight} lineHeight={S.fact.lineHeight} color={style.colors.text} shadow={shadow} group="fact" input="fact" style={{ marginTop: STAMP_GAP }} />
              {L.source && w.source && <span {...leaf('source', 'source')} style={{ display: 'block', marginTop: 16, fontFamily: fontFor(500), fontWeight: 500, fontSize: L.source.size, lineHeight: 1.25, color: muted, whiteSpace: 'nowrap', opacity: progress(frame, w.source.start, w.source.dur) }}>{L.source.text}</span>}
            </div>
          )}
        </div>
      </SafeArea>
    </div>
  );
}
