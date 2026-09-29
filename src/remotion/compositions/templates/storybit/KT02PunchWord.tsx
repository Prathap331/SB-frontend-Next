'use client';

/**
 * KT-02 · Punch Word  (animation_type: "kt_punch_word")
 * One big word (or two) slams onto the screen for emphasis — "BANNED", "FREE", "GONE" — with an
 * optional impact shake and flash, and an optional small line underneath.
 * Works over footage (default) or on its own background.
 *
 * Inputs (full list, limits and JSON Schema: KT02PunchWord.inputs.json):
 *   word (required) · sub · image_url · look · case · impact · position · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [word, sub]
 * Timing: 1.5–8s from clock.durationInFrames. The shake moves the word only; shaking the footage is an
 * FFmpeg effect (EM-02).
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText, words, type Line, type Measure } from './core/fit';
import { exitStyle, progress, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { OVERLAY_DURATION } from './core/overlay';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

export const KT02_SPEC: TemplateSpec = {
  id: 'KT-02',
  animationType: 'kt_punch_word',
  name: 'Punch Word',
  pickWhen: 'A single word the narrator hits hard: "BANNED", "FREE", "GONE", "NEVER".',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: OVERLAY_DURATION,
  text: {
    word: { label: 'Word', required: true, minChars: 1, maxChars: 14, minWords: 1, maxWords: 2, maxWordChars: 12, maxLines: 1, fontMax: 360, fontMin: 120, weight: 800, lineHeight: 1, hint: 'One or two words. Shouted words work best.', fills: 'The punch word', example: 'BANNED' },
    sub: { label: 'Sub-line', required: false, minChars: 2, maxChars: 36, minWords: 1, maxWords: 7, maxWordChars: 16, maxLines: 1, fontMax: 44, fontMin: 26, weight: 600, lineHeight: 1.2, hint: 'Small context under the word: "in 23 countries".', fills: 'Small line under the word' },
  },
  lists: {},
  options: {
    look: { label: 'Look', values: ['fill', 'outline', 'box'], default: 'fill', fills: 'Solid word, outlined word, or word on an accent box' },
    case: { label: 'Letter case', values: ['upper', 'as_given'], default: 'upper', fills: 'Force capitals, or keep the case you sent' },
    impact: { label: 'Impact', values: ['shake', 'flash', 'both', 'none'], default: 'both', fills: 'What happens when the word lands: a short shake, a flash, both, or nothing' },
    position: { label: 'Position', values: ['center', 'lower', 'upper'], default: 'center', fills: 'Vertical position inside the safe box' },
    background: { label: 'Background', values: ['transparent', 'theme', 'image'], default: 'transparent', fills: 'Over footage (default), theme gradient, or image_url' },
  },
  animations: {
    word: { label: 'Word', kind: 'text', target: 'the word', default: 'slam' },
    sub: { label: 'Sub-line', kind: 'text', target: 'sub-line', default: 'fade_up' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'cut' },
    exit: { label: 'Exit', kind: 'exit', target: 'word and sub-line', default: 'scale_down' },
  },
  cues: { description: 'word = the moment the word is spoken (it lands then); sub = when the sub-line appears.', units: ['word', 'sub'] },
  colors: ['on_accent'],
  sizes: {},
  example: { word: 'BANNED', sub: 'in 23 countries', impact: 'both', background: 'transparent' },
};

export type PunchLayout = { word: Line; sub?: Line; boxPad: number; blockH: number; blockW: number };
export function layoutPunch(input: { word: string; sub: string; box: boolean }, measure: Measure, spec: TemplateSpec = KT02_SPEC): PunchLayout {
  const T = spec.text;
  const boxPad = input.box ? 36 : 0;
  const word = fitText(input.word, T.word, SAFE_W - boxPad * 2, measure, false).lines[0];
  const sub = input.sub ? fitText(input.sub, T.sub, SAFE_W, measure, false).lines[0] : undefined;
  const blockH = word.size * T.word.lineHeight + boxPad * 2 + (sub ? 24 + sub.size * T.sub.lineHeight : 0);
  const blockW = measure(word.text, word.size, T.word.weight) + boxPad * 2;
  return { word, sub, boxPad, blockH, blockW };
}
export function planPunch(L: PunchLayout, anims: { word: string; sub: string }, duration: number, cueTimes?: number[]): Plan {
  const wDur = textAnimFrames(anims.word, 1, L.word.text.length, 10);
  const units: Unit[] = [{ key: 'word', label: 'Word', start: 4, dur: wDur, cue: 0 }];
  if (L.sub) units.push({ key: 'sub', label: 'Sub-line', start: 4 + wDur + 4, dur: textAnimFrames(anims.sub, words(L.sub.text).length, L.sub.text.length, 12), cue: 1 });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareKT02(props: Record<string, unknown>, durationInFrames: number) {
  const S = KT02_SPEC.text;
  const A = (k: string) => readAnim(props, KT02_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(KT02_SPEC, props);
  const measure = measureFor(style);
  const upper = opt(props, 'case', ['upper', 'as_given'] as const, 'upper') === 'upper';
  let word = normaliseText(readFirst(props, ['word', 'text']), S.word);
  if (upper) word = word.toLocaleUpperCase();
  const look = opt(props, 'look', ['fill', 'outline', 'box'] as const, 'fill');
  const imageUrl = readImageUrl(props);
  const bgRaw = readNonEmptyString(props, 'background');
  const bg = bgRaw === 'theme' || bgRaw === 'image' ? readBgMode(props, imageUrl) : 'transparent';
  const L = layoutPunch({ word, sub: normaliseText(readFirst(props, ['sub', 'subtitle']), S.sub), box: look === 'box' }, measure, sized.spec);
  const plan = planPunch(L, { word: A('word'), sub: A('sub') }, durationInFrames, readCues(props));
  return { style, sized, A, L, plan, look, imageUrl, bg, impact: opt(props, 'impact', ['shake', 'flash', 'both', 'none'] as const, 'both'), position: opt(props, 'position', ['center', 'lower', 'upper'] as const, 'center'), debug: props.show_safe_area === true };
}

function KT02PunchWordBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, look, imageUrl, bg, impact, position, debug } = prepareKT02(props, durationInFrames);
  const w = plan.windows;
  const S = KT02_SPEC.text;
  const accent = style.colors.accent;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const land = w.word.start + w.word.dur;
  const since = frame - land;
  const shake = (impact === 'shake' || impact === 'both') && since >= 0 && since < 10 ? Math.sin(since * 2.6) * 14 * (1 - since / 10) : 0;
  const flash = (impact === 'flash' || impact === 'both') && since >= -2 && since < 8 ? Math.max(0, 0.55 * (1 - Math.abs(since - 1) / 7)) : 0;
  const top = position === 'center' ? (SAFE_H - L.blockH) / 2 : position === 'upper' ? SAFE_H * 0.08 : SAFE_H - L.blockH - SAFE_H * 0.06;
  const wordColor = look === 'box' ? style.colors.on_accent : look === 'outline' ? 'transparent' : style.colors.text;
  const shadow = bg === 'theme' ? 'none' : '0 8px 40px rgba(0,0,0,0.55)';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      {bg !== 'transparent' && <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />}
      {flash > 0 && <div style={{ position: 'absolute', inset: 0, background: `rgba(255,255,255,${flash})` }} />}
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', left: 0, top, width: SAFE_W, height: L.blockH, display: 'flex', flexDirection: 'column', alignItems: 'center', ...exit }}>
          <div style={{ transform: `translateX(${shake}px)`, display: 'flex' }}>
            <div style={{ padding: L.boxPad, borderRadius: 24, background: look === 'box' ? accent : 'transparent', display: 'flex' }}>
              <AnimatedText
                lines={[L.word]}
                anim={A('word')}
                start={w.word.start}
                dur={w.word.dur}
                frame={frame}
                weight={S.word.weight}
                lineHeight={S.word.lineHeight}
                letterSpacing="-0.03em"
                color={wordColor}
                shadow={look === 'box' ? 'none' : shadow}
                align="center"
                group="word"
                input="word"
                style={look === 'outline' ? { WebkitTextStroke: `${Math.max(4, Math.round(L.word.size / 40))}px ${style.colors.text}` } : undefined}
              />
            </div>
          </div>
          {L.sub && w.sub && (
            <AnimatedText lines={[L.sub]} anim={A('sub')} start={w.sub.start} dur={w.sub.dur} frame={frame} weight={S.sub.weight} lineHeight={S.sub.lineHeight} color={style.custom.has('muted') ? style.colors.muted : '#E8EAF6'} shadow={FOOTAGE_SHADOW} align="center" group="sub" input="sub" style={{ marginTop: 24, padding: bg === 'transparent' ? '4px 16px' : 0, borderRadius: 10, background: bg === 'transparent' ? withAlpha(style.colors.scrim, 0.5) : 'transparent' }} />
          )}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const KT02PunchWord = withAutoFit(KT02PunchWordBase);
