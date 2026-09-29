'use client';

/**
 * KT-08 · Question Hook  (animation_type: "kt_question_hook")
 * A big question that opens a loop — "But why did it fail?" — with a large animated question mark
 * and an optional highlighted word and sub-line.
 *
 * Inputs (full list, limits and JSON Schema: KT08QuestionHook.inputs.json):
 *   question (required) · highlight · sub · image_url · mark · align · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [question, highlight, sub]
 * Timing: 1.5–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type Issue, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, words, type Line, type Measure } from './core/fit';
import { easeOutBack, exitStyle, iconStyle, progress, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { OVERLAY_DURATION } from './core/overlay';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, mutedFor, readStyle, styleVars } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, highlightWords, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

export const KT08_SPEC: TemplateSpec = {
  id: 'KT-08',
  animationType: 'kt_question_hook',
  name: 'Question Hook',
  pickWhen: 'Opening a loop with a question the video will answer: "But why did it fail?", "Who really owns it?"',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: OVERLAY_DURATION,
  text: {
    question: { label: 'Question', required: true, minChars: 5, maxChars: 60, minWords: 2, maxWords: 12, maxWordChars: 18, maxLines: 3, fontMax: 130, fontMin: 60, weight: 800, lineHeight: 1.08, hint: 'One question, ending with "?".', fills: 'The question', example: 'But why did it fail?' },
    highlight: { label: 'Highlight', required: false, minChars: 2, maxChars: 30, minWords: 1, maxWords: 5, maxWordChars: 18, maxLines: 1, fontMax: 130, fontMin: 60, weight: 800, lineHeight: 1.08, hint: 'Exact words from the question to draw in the accent colour.', fills: 'Words of the question in the accent colour', example: 'fail', noSize: true },
    sub: { label: 'Sub-line', required: false, minChars: 3, maxChars: 60, minWords: 1, maxWords: 11, maxWordChars: 18, maxLines: 2, fontMax: 40, fontMin: 26, weight: 500, lineHeight: 1.35, hint: 'A teaser: "The answer surprised everyone."', fills: 'Line under the question' },
  },
  lists: {},
  options: {
    mark: { label: 'Question mark', values: ['left', 'top', 'none'], default: 'left', fills: 'Big accent question mark beside or above the question' },
    align: { label: 'Align', values: ['left', 'center'], default: 'left', fills: 'Text alignment (a "top" mark centres automatically)' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    mark: { label: 'Question mark', kind: 'icon', target: 'the big question mark', default: 'spin_in' },
    question: { label: 'Question', kind: 'text', target: 'the question', default: 'word_pop' },
    sub: { label: 'Sub-line', kind: 'text', target: 'sub-line', default: 'fade_up' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: { description: 'question → highlight (when the key word is spoken; the mark wobbles then) → sub.', units: ['question', 'highlight', 'sub'] },
  colors: [],
  validate: (props) => {
    const issues: Issue[] = [];
    const q = typeof props.question === 'string' ? props.question.trim() : '';
    const h = typeof props.highlight === 'string' ? props.highlight.trim() : '';
    if (q && !q.endsWith('?')) issues.push({ field: 'question', level: 'warning', message: 'The question should end with "?"' });
    if (h && q && highlightWords([{ text: q.replace(/\s+/g, ' '), size: 0 }], h).size === 0) issues.push({ field: 'highlight', level: 'warning', message: 'Highlight phrase is not in the question' });
    return issues;
  },
  example: { question: 'But why did it fail?', highlight: 'fail', sub: 'The answer surprised everyone.', mark: 'left', background: 'theme' },
};

export const MARK_GAP = 56;
export type HookLayout = { question: Line[]; sub: Line[]; mark: number; textW: number; blockH: number };

export function layoutHook(input: { question: string; sub: string; mark: 'left' | 'top' | 'none' }, measure: Measure, spec: TemplateSpec = KT08_SPEC): HookLayout {
  const T = spec.text;
  let cap = T.question.fontMax;
  for (;;) {
    const markSize = input.mark === 'none' ? 0 : Math.round(cap * (input.mark === 'left' ? 2.4 : 1.6));
    const mark = input.mark === 'left' ? Math.min(markSize, 420) : Math.min(markSize, 260);
    const textW = input.mark === 'left' ? SAFE_W - mark * 0.62 - MARK_GAP : SAFE_W;
    const question = fitText(input.question, T.question, textW, measure, true, cap).lines;
    const sub = input.sub ? fitText(input.sub, T.sub, textW, measure).lines : [];
    const textH = blockHeight(question, T.question.lineHeight) + (sub.length ? 28 + blockHeight(sub, T.sub.lineHeight) : 0);
    const blockH = input.mark === 'top' ? mark + 20 + textH : Math.max(textH, mark);
    if (blockH <= SAFE_H || cap <= T.question.fontMin) return { question, sub, mark, textW, blockH };
    cap -= 6;
  }
}

export function planHook(L: HookLayout, anims: { question: string; sub: string }, hasHighlight: boolean, duration: number, cueTimes?: number[]): Plan {
  const q = L.question.map((l) => l.text).join(' ');
  const qDur = textAnimFrames(anims.question, words(q).length, q.length, Math.round(18 * (1 + 0.33 * (L.question.length - 1))));
  const units: Unit[] = [{ key: 'question', label: 'Question', start: 8, dur: qDur, cue: 0 }];
  let t = 8 + qDur;
  if (hasHighlight) {
    units.push({ key: 'highlight', label: 'Highlight / wobble', start: t, dur: 14, cue: 1 });
    t += 8;
  }
  if (L.sub.length) {
    const s = L.sub.map((l) => l.text).join(' ');
    units.push({ key: 'sub', label: 'Sub-line', start: t + 2, dur: textAnimFrames(anims.sub, words(s).length, s.length, 16), cue: 2 });
  }
  if (L.mark) units.push({ key: 'mark', label: 'Question mark', start: 2, dur: 18, follows: { key: 'question', offset: -6 } });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareKT08(props: Record<string, unknown>, durationInFrames: number) {
  const S = KT08_SPEC.text;
  const A = (k: string) => readAnim(props, KT08_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(KT08_SPEC, props);
  const measure = measureFor(style);
  const mark = opt(props, 'mark', ['left', 'top', 'none'] as const, 'left');
  const align = mark === 'top' ? 'center' : opt(props, 'align', ['left', 'center'] as const, 'left');
  const L = layoutHook({ question: normaliseText(readFirst(props, ['question', 'text', 'title']), S.question), sub: normaliseText(readFirst(props, ['sub', 'subtitle']), S.sub), mark }, measure, sized.spec);
  const hlRaw = normaliseText(readFirst(props, ['highlight']), S.highlight);
  const highlight = highlightWords(L.question, hlRaw).size ? hlRaw : '';
  const plan = planHook(L, { question: A('question'), sub: A('sub') }, Boolean(highlight), durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, L, plan, mark, align, highlight, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

function KT08QuestionHookBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, mark, align, highlight, imageUrl, bg, debug } = prepareKT08(props, durationInFrames);
  const w = plan.windows;
  const S = KT08_SPEC.text;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const hw = w.highlight;
  const wob = hw ? Math.sin(progress(frame, hw.start, hw.dur) * Math.PI * 3) * 10 * (1 - progress(frame, hw.start, hw.dur)) : 0;
  const hlOn = hw ? frame >= hw.start : true;
  const markEl = L.mark > 0 && w.mark && (
    <div {...leaf('mark', 'question mark')} style={{ width: L.mark * 0.62, height: L.mark, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible', ...iconStyle(A('mark'), progress(frame, w.mark.start, w.mark.dur)) }}>
      <span style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: L.mark, lineHeight: 1, color: accent, transform: `rotate(${wob}deg) scale(${1 + 0.04 * easeOutBack(Math.abs(wob) / 10)})`, display: 'block' }}>?</span>
    </div>
  );
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align={align} accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: mark === 'top' ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: mark === 'top' ? 20 : MARK_GAP, ...exit }}>
          {markEl}
          <div style={{ width: L.textW, display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start' }}>
            <AnimatedText lines={L.question} anim={A('question')} start={w.question.start} dur={w.question.dur} frame={frame} weight={S.question.weight} lineHeight={S.question.lineHeight} letterSpacing="-0.02em" shadow={shadow} align={align} group="question" input="question" highlight={hlOn ? highlight : undefined} highlightColor={accent} />
            {L.sub.length > 0 && w.sub && (
              <AnimatedText lines={L.sub} anim={A('sub')} start={w.sub.start} dur={w.sub.dur} frame={frame} weight={S.sub.weight} lineHeight={S.sub.lineHeight} color={mutedFor(style, onFootage)} shadow={shadow} align={align} group="sub" input="sub" style={{ marginTop: 28 }} />
            )}
          </div>
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const KT08QuestionHook = withAutoFit(KT08QuestionHookBase);
