'use client';

/**
 * FS-01 · Title Card  (animation_type: "fs_title_card")
 * Title with optional kicker and subtitle over a theme background, an image, or footage.
 *
 * Content limits (FS01_SPEC in titleCardLayout.ts):
 *   kicker   optional  2–20 chars · 1–3 words  · 1 line  · 34→26px
 *   title    required  3–40 chars · 1–8 words  · 2 lines · 150→84px · longest word 18
 *   subtitle optional  8–60 chars · 2–10 words · 2 lines · 46→34px
 * Timing: 3–8s (clock.durationInFrames). Optional cue_times (seconds from start) pin
 *   kicker → title → subtitle to voice timestamps; otherwise natural spacing, compressed to fit.
 * Animations: props.animations = { kicker, kicker_rule, title, subtitle, image_motion, image_entry, exit }
 *   (values in FS01_SPEC.animations; any omitted slot uses its default).
 * Options: background, align, image_url, accent_color, show_safe_area (preview only).
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl } from '../../../props';
import { normaliseText, readAnim, type TemplateSpec, HERO_TITLE, BACKGROUND_IMAGE, applySizes } from './core/contentSpec';
import { measureFor } from './core/measure';
import { mutedFor, readStyle, styleVars } from './core/style';
import { exitStyle, progress, shapeState, textAnimFrames } from './core/motion';
import { readCues, planTimeline, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readAlign, readBgMode, readFirst } from './core/shared';
import { blockHeight, fitText, type Line, type Measure, words } from './core/fit';
import { withAutoFit } from './core/autofit';

/* ================================================================== */
/* Content spec, layout and timing                                     */
/* ================================================================== */


export const FS01_SPEC: TemplateSpec = {
  id: 'FS-01',
  animationType: 'fs_title_card',
  name: 'Title Card',
  pickWhen: 'Opening the video or a new section; narration introduces a named topic.',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 120, max: 240 },
  text: {
    kicker: {
      label: 'Kicker',
      required: false,
      minChars: 2,
      maxChars: 20,
      minWords: 1,
      maxWords: 3,
      maxWordChars: 16,
      maxLines: 1,
      fontMax: 34,
      fontMin: 26,
      weight: 600,
      lineHeight: 1.2,
      hint: 'Label above the title, e.g. "Chapter 2".',
      fills: 'Small accent-coloured label above the title',
      example: 'Chapter 2',
    },
    title: HERO_TITLE,
    subtitle: {
      label: 'Subtitle',
      required: false,
      minChars: 8,
      maxChars: 60,
      minWords: 2,
      maxWords: 10,
      maxWordChars: 18,
      maxLines: 2,
      fontMax: 46,
      fontMin: 34,
      weight: 500,
      lineHeight: 1.3,
      hint: 'One supporting line.',
      fills: 'Supporting line under the title',
      example: "The story of India's digital payment boom",
    },
  },
  lists: {},
  options: {
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
    align: { label: 'Align', values: ['left', 'center'], default: 'left', fills: 'Horizontal alignment of all text' },
  },
  animations: {
    kicker: { label: 'Kicker', kind: 'text', target: 'kicker text', default: 'slide_left' },
    kicker_rule: { label: 'Accent line', kind: 'shape', target: 'accent line (beside kicker, or under title)', default: 'grow' },
    title: { label: 'Title', kind: 'text', target: 'title (each line)', default: 'rise' },
    subtitle: { label: 'Subtitle', kind: 'text', target: 'subtitle', default: 'fade_up' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: {
    description: 'One cue per element that is present, in order. Missing elements are skipped.',
    units: ['kicker', 'title', 'subtitle'],
  },
  example: {
    kicker: 'Chapter 2',
    title: 'How UPI changed India',
    subtitle: "The story of India's digital payment boom",
    background: 'theme',
    align: 'left',
    animations: { title: 'rise', subtitle: 'fade_up' },
    cue_times: [0.2, 0.6, 1.8],
  },
};

export const KICKER_RULE_W = 64;
export const KICKER_RULE_GAP = 20;
export const KICKER_GAP = 28;
export const RULE_GAP = 28;
export const RULE_H = 8;
export const SUB_GAP = 32;

export type TitleCardLayout = {
  kicker: Line[];
  title: Line[];
  titleFont: number;
  subtitle: Line[];
  blockH: number;
};

export function layoutTitleCard(
  input: { title: string; kicker?: string; subtitle?: string },
  measure: Measure,
  spec: TemplateSpec = FS01_SPEC,
): TitleCardLayout {
  const S = spec.text;
  const kicker = input.kicker ? fitText(input.kicker, S.kicker, SAFE_W - KICKER_RULE_W - KICKER_RULE_GAP, measure, false).lines : [];
  const subtitle = input.subtitle ? fitText(input.subtitle, S.subtitle, SAFE_W, measure).lines : [];
  const rest =
    (kicker.length ? blockHeight(kicker, S.kicker.lineHeight) + KICKER_GAP : RULE_GAP + RULE_H) +
    (subtitle.length ? SUB_GAP + blockHeight(subtitle, S.subtitle.lineHeight) : 0);

  let cap = S.title.fontMax;
  let t = fitText(input.title, S.title, SAFE_W, measure, true, cap);
  while (blockHeight(t.lines, S.title.lineHeight) + rest > SAFE_H && cap > S.title.fontMin) {
    cap -= 4;
    t = fitText(input.title, S.title, SAFE_W, measure, true, cap);
  }
  return { kicker, title: t.lines, titleFont: t.font, subtitle, blockH: blockHeight(t.lines, S.title.lineHeight) + rest };
}

/** Beat-synced plan: kicker → title → subtitle, with the accent line tied to the kicker (or title). */
export function planTitleCard(
  L: TitleCardLayout,
  anims: { kicker: string; title: string; subtitle: string },
  duration: number,
  cueTimes?: number[],
): Plan {
  const T = (lines: { text: string }[]) => lines.map((l) => l.text).join(' ');
  const units: Unit[] = [];
  let cue = 0;
  const hasKicker = L.kicker.length > 0;
  if (hasKicker) {
    const t = T(L.kicker);
    units.push({ key: 'kicker', label: 'Kicker', start: 4, dur: textAnimFrames(anims.kicker, words(t).length, t.length, 14), cue: cue++ });
  }
  const tt = T(L.title);
  const titleStart = hasKicker ? 10 : 4;
  const titleDur = textAnimFrames(anims.title, words(tt).length, tt.length, Math.round(18 * (1 + 0.33 * (L.title.length - 1))));
  units.push({ key: 'title', label: 'Title', start: titleStart, dur: titleDur, cue: cue++ });
  if (L.subtitle.length) {
    const st = T(L.subtitle);
    units.push({ key: 'subtitle', label: 'Subtitle', start: titleStart + titleDur - 4, dur: textAnimFrames(anims.subtitle, words(st).length, st.length, 18), cue: cue++ });
  }
  units.push(
    hasKicker
      ? { key: 'rule', label: 'Accent line', start: 2, dur: 14, follows: { key: 'kicker', offset: -2 } }
      : { key: 'rule', label: 'Accent line', start: titleStart + titleDur - 10, dur: 14, follows: { key: 'title', offset: Math.max(0, titleDur - 10) } },
  );
  return planTimeline(duration, units, cueTimes);
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */

/** Reads props, fits the layout and plans the timeline — shared by the renderer and the preview. */
export function prepareFS01(props: Record<string, unknown>, durationInFrames: number) {
  const S = FS01_SPEC.text;
  const A = (k: string) => readAnim(props, FS01_SPEC, k);

  const title = normaliseText(readFirst(props, ['title', 'headline', 'text']), S.title);
  const subtitle = normaliseText(readFirst(props, ['subtitle', 'sub_title', 'subheading']), S.subtitle);
  const kicker = normaliseText(readFirst(props, ['kicker', 'eyebrow', 'label']), S.kicker);
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const align = readAlign(props);
  const style = readStyle(props);
  const accent = style.colors.accent;
  const sized = applySizes(FS01_SPEC, props);
  const measure = measureFor(style);
  const debug = props.show_safe_area === true;

  const L = layoutTitleCard({ title, kicker, subtitle }, measure, sized.spec);
  const plan = planTitleCard(L, { kicker: A('kicker'), title: A('title'), subtitle: A('subtitle') }, durationInFrames, readCues(props));
  return { style, sized, S, A, title, subtitle, kicker, imageUrl, bg, align, accent, debug, L, plan };
}

function FS01TitleCardBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, S, A, imageUrl, bg, align, accent, debug, L, plan } = prepareFS01(props, durationInFrames);
  const w = plan.windows;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const rule = shapeState(A('kicker_rule'), progress(frame, w.rule.start, w.rule.dur));
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const items = align === 'center' ? 'center' : 'flex-start';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground
        mode={bg}
        imageUrl={imageUrl}
        align={align}
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
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: items,
            textAlign: align,
            ...exit,
          }}
        >
          {L.kicker.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: KICKER_RULE_GAP, marginBottom: KICKER_GAP }}>
              <div
                {...leaf('kicker-rule', 'accent line')}
                style={{ width: KICKER_RULE_W * rule.length, height: 6, borderRadius: 3, background: accent, ...rule.style }}
              />
              <AnimatedText
                lines={L.kicker}
                anim={A('kicker')}
                start={w.kicker.start}
                dur={w.kicker.dur}
                frame={frame}
                weight={S.kicker.weight}
                lineHeight={S.kicker.lineHeight}
                color={accent}
                shadow={shadow}
                group="kicker"
                input="kicker"
              />
            </div>
          )}

          <AnimatedText
            lines={L.title}
            anim={A('title')}
            start={w.title.start}
            dur={w.title.dur}
            frame={frame}
            weight={S.title.weight}
            lineHeight={S.title.lineHeight}
            letterSpacing="-0.02em"
            shadow={shadow}
            align={align}
            group="title"
            input="title"
          />

          {L.kicker.length === 0 && (
            <div
              {...leaf('rule', 'accent line')}
              style={{ width: 120 * rule.length, height: RULE_H, borderRadius: 4, background: accent, marginTop: RULE_GAP, ...rule.style }}
            />
          )}

          {L.subtitle.length > 0 && (
            <AnimatedText
              lines={L.subtitle}
              anim={A('subtitle')}
              start={w.subtitle.start}
              dur={w.subtitle.dur}
              frame={frame}
              weight={S.subtitle.weight}
              lineHeight={S.subtitle.lineHeight}
              color={mutedFor(style, onFootage)}
              shadow={shadow}
              align={align}
              group="subtitle"
              input="subtitle"
              style={{ marginTop: SUB_GAP }}
            />
          )}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const FS01TitleCard = withAutoFit(FS01TitleCardBase);
