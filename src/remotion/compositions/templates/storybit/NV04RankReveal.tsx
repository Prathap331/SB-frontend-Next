'use client';

/**
 * NV-04 · Countdown Rank Reveal  (animation_type: "nv_rank_reveal")
 * The start of each item in a "Top 10" listicle: a huge "#7", the item title, an optional sub-line
 * and an optional picture card.
 *
 * Inputs (full list, limits and JSON Schema: NV04RankReveal.inputs.json):
 *   rank (required) · title (required) · sub · picture_url · image_url · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [rank, title, sub]
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from './core/remotionSafe';
import type { TemplateProps } from '../../../types';
import { readImageUrl } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, imageMotionStyle, progress, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { readNumber } from './core/numbers';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { mutedFor, readStyle, styleVars } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

export const NV04_SPEC: TemplateSpec = {
  id: 'NV-04',
  animationType: 'nv_rank_reveal',
  name: 'Countdown Rank Reveal',
  pickWhen: 'Each item of a "Top N" countdown or listicle starts: "Number 7…".',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  images: { picture_url: { label: 'Picture', required: false, fills: 'Picture of the item (card on the right)' } },
  duration: { min: 90, default: 105, max: 240 },
  numbers: { rank: { label: 'Rank', required: true, fills: 'The rank number shown as #N', min: 1, max: 100, integer: true, example: 7 } },
  text: {
    title: { label: 'Title', required: true, minChars: 2, maxChars: 35, minWords: 1, maxWords: 7, maxWordChars: 18, maxLines: 2, fontMax: 110, fontMin: 56, weight: 800, lineHeight: 1.06, hint: 'The item.', fills: 'Item title', example: 'Kerala backwaters' },
    sub: { label: 'Sub-line', required: false, minChars: 3, maxChars: 60, minWords: 1, maxWords: 11, maxWordChars: 18, maxLines: 2, fontMax: 38, fontMin: 26, weight: 500, lineHeight: 1.35, hint: 'One line of detail.', fills: 'Line under the title', example: 'Houseboats through 900 km of canals' },
  },
  lists: {},
  options: { background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' } },
  animations: {
    rank: { label: 'Rank', kind: 'text', target: 'the #N', default: 'slam' },
    title: { label: 'Title', kind: 'text', target: 'title', default: 'rise' },
    sub: { label: 'Sub-line', kind: 'text', target: 'sub-line', default: 'fade_up' },
    picture: { label: 'Picture', kind: 'card', target: 'picture card', default: 'slide_left' },
    picture_motion: { label: 'Picture motion', kind: 'image_motion', target: 'movement inside the picture', default: 'push_in' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: { description: 'rank (when "number seven" is said) → title → sub.', units: ['rank', 'title', 'sub'] },
  colors: [],
  example: { rank: 7, title: 'Kerala backwaters', sub: 'Houseboats through 900 km of canals', background: 'theme' },
};

export const PIC_W = 720;
export const PIC_GAP = 80;
export type RankLayout = { rank: Line; title: Line[]; sub: Line[]; textW: number; pic: boolean; blockH: number };
export function layoutRank(input: { rank: string; title: string; sub: string; pic: boolean }, measure: Measure, spec: TemplateSpec = NV04_SPEC): RankLayout {
  const T = spec.text;
  const textW = input.pic ? SAFE_W - PIC_W - PIC_GAP : SAFE_W;
  const rank = fitText(input.rank, { ...T.title, fontMax: 300, fontMin: 120, maxLines: 1 }, textW, measure, false).lines[0];
  const sub = input.sub ? fitText(input.sub, T.sub, textW, measure).lines : [];
  let cap = T.title.fontMax;
  let title = fitText(input.title, T.title, textW, measure, true, cap).lines;
  const h = () => rank.size + 16 + blockHeight(title, T.title.lineHeight) + (sub.length ? 24 + blockHeight(sub, T.sub.lineHeight) : 0);
  while (h() > SAFE_H && cap > T.title.fontMin) {
    cap -= 4;
    title = fitText(input.title, T.title, textW, measure, true, cap).lines;
  }
  return { rank, title, sub, textW, pic: input.pic, blockH: h() };
}
export function planRank(L: RankLayout, anims: { rank: string; title: string; sub: string }, duration: number, cueTimes?: number[]): Plan {
  const T = (lines: Line[]) => lines.map((l) => l.text).join(' ');
  const rDur = textAnimFrames(anims.rank, 1, L.rank.text.length, 14);
  const tt = T(L.title);
  const tDur = textAnimFrames(anims.title, words(tt).length, tt.length, Math.round(18 * (1 + 0.33 * (L.title.length - 1))));
  const units: Unit[] = [{ key: 'rank', label: 'Rank', start: 4, dur: rDur, cue: 0 }, { key: 'title', label: 'Title', start: 4 + rDur, dur: tDur, cue: 1 }];
  if (L.sub.length) {
    const s = T(L.sub);
    units.push({ key: 'sub', label: 'Sub-line', start: 4 + rDur + tDur - 2, dur: textAnimFrames(anims.sub, words(s).length, s.length, 16), cue: 2 });
  }
  if (L.pic) units.push({ key: 'picture', label: 'Picture', start: 4 + rDur, dur: 18, follows: { key: 'title', offset: 0 } });
  return planTimeline(duration, units, cueTimes);
}

export function prepareNV04(props: Record<string, unknown>, durationInFrames: number) {
  const S = NV04_SPEC.text;
  const A = (k: string) => readAnim(props, NV04_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(NV04_SPEC, props);
  const measure = measureFor(style);
  const rank = Math.max(1, Math.min(100, Math.round(readNumber(props.rank) ?? 1)));
  const picture = readFirst(props, ['picture_url', 'picture']);
  const L = layoutRank({ rank: `#${rank}`, title: normaliseText(readFirst(props, ['title', 'name']), S.title), sub: normaliseText(readFirst(props, ['sub', 'subtitle']), S.sub), pic: Boolean(picture) }, measure, sized.spec);
  const plan = planRank(L, { rank: A('rank'), title: A('title'), sub: A('sub') }, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, L, plan, picture, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

function NV04RankRevealBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, picture, imageUrl, bg, debug } = prepareNV04(props, durationInFrames);
  const w = plan.windows;
  const S = NV04_SPEC.text;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const picH = Math.round(PIC_W * 0.75);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="left" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: L.textW, height: SAFE_H, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
            <AnimatedText lines={[L.rank]} anim={A('rank')} start={w.rank.start} dur={w.rank.dur} frame={frame} weight={800} lineHeight={1} letterSpacing="-0.04em" color={accent} shadow={shadow} group="rank" input="rank" />
            <AnimatedText lines={L.title} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={S.title.weight} lineHeight={S.title.lineHeight} letterSpacing="-0.02em" shadow={shadow} group="title" input="title" style={{ marginTop: 16 }} />
            {L.sub.length > 0 && w.sub && <AnimatedText lines={L.sub} anim={A('sub')} start={w.sub.start} dur={w.sub.dur} frame={frame} weight={S.sub.weight} lineHeight={S.sub.lineHeight} color={mutedFor(style, onFootage)} shadow={shadow} group="sub" input="sub" style={{ marginTop: 24 }} />}
          </div>
          {picture && w.picture && (
            <div {...leaf('picture', 'picture_url')} style={{ position: 'absolute', left: SAFE_W - PIC_W, top: (SAFE_H - picH) / 2, width: PIC_W, height: picH, borderRadius: 28, overflow: 'hidden', border: `6px solid ${accent}`, boxSizing: 'border-box', ...cardStyle(A('picture'), progress(frame, w.picture.start, w.picture.dur)) }}>
              <Img src={picture} style={{ width: '100%', height: '100%', objectFit: 'cover', ...imageMotionStyle(A('picture_motion'), frame / Math.max(1, durationInFrames)) }} />
            </div>
          )}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const NV04RankReveal = withAutoFit(NV04RankRevealBase);
