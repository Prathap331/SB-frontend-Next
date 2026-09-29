'use client';

/**
 * NV-01 · Chapter Card  (animation_type: "nv_chapter_card")
 * Opens a new chapter / part of a long video: chapter number, title, optional sub-line and
 * optional progress dots ("chapter 2 of 5").
 *
 * Inputs (full list, limits and JSON Schema: NV01ChapterCard.inputs.json):
 *   number (required) · total · title (required) · label · sub · image_url · layout · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [number, title, sub]
 * Timing: 3–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, words, type Line, type Measure } from './core/fit';
import { exitStyle, iconStyle, lineStyle, progress, shapeState, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { readNumber } from './core/numbers';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

export const NV01_SPEC: TemplateSpec = {
  id: 'NV-01',
  animationType: 'nv_chapter_card',
  name: 'Chapter Card',
  pickWhen: 'A new chapter or part of a long video begins.',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 105, max: 240 },
  numbers: {
    number: { label: 'Chapter number', required: true, fills: 'Big chapter number', min: 1, max: 99, integer: true, example: 2 },
    total: { label: 'Total chapters', required: false, fills: 'Shows progress dots (e.g. 2 of 5)', min: 2, max: 12, integer: true, example: 5 },
  },
  text: {
    label: { label: 'Label', required: false, minChars: 2, maxChars: 14, minWords: 1, maxWords: 2, maxWordChars: 12, maxLines: 1, fontMax: 34, fontMin: 24, weight: 700, lineHeight: 1.2, hint: 'Word before the number (default "Chapter"): "Part", "Step", "अध्याय".', fills: 'Small label with the number', example: 'Chapter' },
    title: { label: 'Title', required: true, minChars: 2, maxChars: 40, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 2, fontMax: 120, fontMin: 64, weight: 800, lineHeight: 1.05, hint: 'Chapter title.', fills: 'Chapter title', example: 'The rise of UPI' },
    sub: { label: 'Sub-line', required: false, minChars: 3, maxChars: 60, minWords: 1, maxWords: 11, maxWordChars: 18, maxLines: 2, fontMax: 38, fontMin: 26, weight: 500, lineHeight: 1.35, hint: 'What this chapter covers.', fills: 'Line under the title' },
  },
  lists: {},
  options: {
    layout: { label: 'Layout', values: ['split', 'stacked'], default: 'split', fills: 'split: big number left, title right · stacked: label + number above a centred title' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    number: { label: 'Number', kind: 'text', target: 'chapter number', default: 'slam' },
    label: { label: 'Label', kind: 'text', target: 'label', default: 'fade' },
    divider: { label: 'Divider / progress', kind: 'shape', target: 'divider line and progress dots', default: 'grow' },
    title: { label: 'Title', kind: 'text', target: 'title', default: 'rise' },
    sub: { label: 'Sub-line', kind: 'text', target: 'sub-line', default: 'fade_up' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: { description: 'number → title → sub. Missing elements are skipped.', units: ['number', 'title', 'sub'] },
  colors: [],
  example: { number: 2, total: 5, label: 'Chapter', title: 'The rise of UPI', sub: 'How a government project beat the card giants', layout: 'split', background: 'theme' },
};

export const DIVIDER_GAP = 56;
export type ChapterLayout = { layout: 'split' | 'stacked'; numLine: Line; label: Line[]; title: Line[]; sub: Line[]; numW: number; textW: number; blockH: number };

export function layoutChapter(input: { num: string; label: string; title: string; sub: string; layout: 'split' | 'stacked'; dots: boolean }, measure: Measure, spec: TemplateSpec = NV01_SPEC): ChapterLayout {
  const T = spec.text;
  const numSpec = { ...T.title, fontMax: input.layout === 'split' ? 340 : 200, fontMin: 120, maxLines: 1, weight: 800, lineHeight: 1 };
  const numLine = fitText(input.num, numSpec, 560, measure, false).lines[0];
  const label = input.label ? fitText(input.label, T.label, input.layout === 'split' ? 460 : SAFE_W, measure, false).lines : [];
  // the number column is as wide as the number or its label, whichever is wider
  const labelW = label.length ? measure(label[0].text, label[0].size, T.label.weight) * 1.3 : 0;
  const numW = input.layout === 'split' ? Math.ceil(Math.max(measure(numLine.text, numLine.size, 800), 180, labelW)) : 0;
  const textW = input.layout === 'split' ? SAFE_W - numW - DIVIDER_GAP * 2 - 6 : SAFE_W;
  const sub = input.sub ? fitText(input.sub, T.sub, textW, measure).lines : [];
  let cap = T.title.fontMax;
  let title = fitText(input.title, T.title, textW, measure, true, cap).lines;
  const dotsH = input.dots ? 44 : 0;
  const h = () =>
    input.layout === 'split'
      ? Math.max(numLine.size + (label.length ? 60 : 0), blockHeight(title, T.title.lineHeight) + (sub.length ? 28 + blockHeight(sub, T.sub.lineHeight) : 0) + dotsH)
      : (label.length ? 50 : 0) + numLine.size + 30 + blockHeight(title, T.title.lineHeight) + (sub.length ? 28 + blockHeight(sub, T.sub.lineHeight) : 0) + dotsH;
  while (h() > SAFE_H && cap > T.title.fontMin) {
    cap -= 4;
    title = fitText(input.title, T.title, textW, measure, true, cap).lines;
  }
  return { layout: input.layout, numLine, label, title, sub, numW, textW, blockH: h() };
}

export function planChapter(L: ChapterLayout, anims: { number: string; title: string; sub: string; label: string }, duration: number, cueTimes?: number[]): Plan {
  const T = (lines: Line[]) => lines.map((l) => l.text).join(' ');
  const nDur = textAnimFrames(anims.number, 1, L.numLine.text.length, 14);
  const units: Unit[] = [{ key: 'number', label: 'Number', start: 4, dur: nDur, cue: 0 }];
  const t0 = 4 + nDur;
  const tt = T(L.title);
  const tDur = textAnimFrames(anims.title, words(tt).length, tt.length, Math.round(18 * (1 + 0.33 * (L.title.length - 1))));
  units.push({ key: 'title', label: 'Title', start: t0, dur: tDur, cue: 1 });
  if (L.sub.length) {
    const s = T(L.sub);
    units.push({ key: 'sub', label: 'Sub-line', start: t0 + tDur - 2, dur: textAnimFrames(anims.sub, words(s).length, s.length, 16), cue: 2 });
  }
  if (L.label.length) units.push({ key: 'label', label: 'Label', start: 2, dur: 12, follows: { key: 'number', offset: -2 } });
  units.push({ key: 'divider', label: 'Divider / progress', start: t0 - 4, dur: 16, follows: { key: 'title', offset: -4 } });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareNV01(props: Record<string, unknown>, durationInFrames: number) {
  const S = NV01_SPEC.text;
  const A = (k: string) => readAnim(props, NV01_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(NV01_SPEC, props);
  const measure = measureFor(style);
  const n = Math.max(1, Math.min(99, Math.round(readNumber(props.number) ?? 1)));
  const totalRaw = readNumber(props.total);
  const total = totalRaw !== undefined && totalRaw >= 2 && totalRaw <= 12 && totalRaw >= n ? Math.round(totalRaw) : 0;
  const layout = opt(props, 'layout', ['split', 'stacked'] as const, 'split');
  const label = normaliseText(readFirst(props, ['label']), S.label) || 'Chapter';
  const L = layoutChapter({ num: layout === 'split' ? String(n).padStart(2, '0') : String(n), label, title: normaliseText(readFirst(props, ['title']), S.title), sub: normaliseText(readFirst(props, ['sub', 'subtitle']), S.sub), layout, dots: total > 0 }, measure, sized.spec);
  const plan = planChapter(L, { number: A('number'), title: A('title'), sub: A('sub'), label: A('label') }, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, n, total, L, plan, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

function NV01ChapterCardBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, n, total, L, plan, imageUrl, bg, debug } = prepareNV01(props, durationInFrames);
  const w = plan.windows;
  const S = NV01_SPEC.text;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const div = shapeState(A('divider'), progress(frame, w.divider.start, w.divider.dur));
  const split = L.layout === 'split';
  const align = split ? 'left' : 'center';
  const numEl = (
    <AnimatedText lines={[L.numLine]} anim={A('number')} start={w.number.start} dur={w.number.dur} frame={frame} weight={800} lineHeight={1} letterSpacing="-0.04em" color={accent} shadow={shadow} align={split ? 'left' : 'center'} group="number" input="number" />
  );
  const dots = total > 0 && (
    <div style={{ display: 'flex', gap: 12, marginTop: 36 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} {...leaf(`dot-${i}`, 'total (progress)')} style={{ width: i + 1 === n ? 44 : 16, height: 16, borderRadius: 8, background: i + 1 <= n ? accent : withAlpha(style.colors.text, 0.25), ...iconStyle(A('divider') === 'none' ? 'none' : 'pop', progress(frame, w.divider.start + i * 2, 10)) }} />
      ))}
    </div>
  );
  const textCol = (
    <div style={{ width: L.textW, display: 'flex', flexDirection: 'column', alignItems: split ? 'flex-start' : 'center' }}>
      <AnimatedText lines={L.title} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={S.title.weight} lineHeight={S.title.lineHeight} letterSpacing="-0.02em" shadow={shadow} align={align} group="title" input="title" />
      {L.sub.length > 0 && w.sub && <AnimatedText lines={L.sub} anim={A('sub')} start={w.sub.start} dur={w.sub.dur} frame={frame} weight={S.sub.weight} lineHeight={S.sub.lineHeight} color={mutedFor(style, onFootage)} shadow={shadow} align={align} group="sub" input="sub" style={{ marginTop: 28 }} />}
      {dots}
    </div>
  );
  const labelEl = L.label.length > 0 && w.label && (
    <span {...leaf('label', 'label')} style={{ fontFamily: fontFor(S.label.weight), fontWeight: S.label.weight, fontSize: L.label[0].size, lineHeight: 1.2, color: style.colors.text, letterSpacing: '0.18em', textTransform: 'uppercase', whiteSpace: 'nowrap', textShadow: shadow, ...lineStyle(A('label'), progress(frame, w.label.start, w.label.dur)) }}>
      {L.label[0].text}
    </span>
  );
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align={split ? 'left' : 'center'} accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        {split ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: DIVIDER_GAP, ...exit }}>
            <div style={{ width: L.numW, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16 }}>
              {labelEl}
              {numEl}
            </div>
            <div {...leaf('divider', 'divider')} style={{ width: 6, height: Math.min(SAFE_H, L.blockH) * div.length, borderRadius: 3, background: withAlpha(accent, 0.8), ...div.style }} />
            {textCol}
          </div>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', ...exit }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 30 }}>
              {labelEl}
              {numEl}
            </div>
            {textCol}
          </div>
        )}
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const NV01ChapterCard = withAutoFit(NV01ChapterCardBase);
