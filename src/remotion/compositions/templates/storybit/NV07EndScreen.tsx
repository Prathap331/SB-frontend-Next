'use client';

/**
 * NV-07 · End Screen  (animation_type: "nv_end_screen")
 * The last 5–20 seconds of a video: a headline and framed empty slots where YouTube end-screen
 * elements (videos, playlist, subscribe) are placed in YouTube Studio.
 * Exception to the 3–8 s rule: YouTube end screens run 5–20 s, so this template does too.
 *
 * Slot positions in the 1920×1080 frame (place the YouTube elements over these):
 *   two_videos      subscribe circle x 100–340, y 470–710 · video 1 x 440–1100 · video 2 x 1160–1820, both y 405–776
 *   one_video       subscribe circle x 100–340, y 470–710 · video x 700–1820, y 290–920 (16:9)
 *   video_playlist  same boxes as two_videos (video 1 = video, video 2 = playlist)
 * (exact values are returned by endScreenSlots())
 *
 * Inputs (full list, limits and JSON Schema: NV07EndScreen.inputs.json):
 *   headline · sub · channel_name · slot_label_1 · slot_label_2 · image_url · layout · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [headline, slots]
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, progress, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_MARGIN } from './core/safeArea';
import { fontFor, mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';

export const NV07_SPEC: TemplateSpec = {
  id: 'NV-07',
  animationType: 'nv_end_screen',
  name: 'End Screen',
  pickWhen: 'The final 5–20 seconds of every video, under YouTube end-screen elements.',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  duration: { min: 150, default: 600, max: 600 },
  text: {
    headline: { label: 'Headline', required: false, minChars: 3, maxChars: 30, minWords: 1, maxWords: 6, maxWordChars: 18, maxLines: 1, fontMax: 72, fontMin: 44, weight: 800, lineHeight: 1.1, hint: 'Default "Watch next".', fills: 'Headline above the slots', example: 'Watch next' },
    sub: { label: 'Sub-line', required: false, minChars: 3, maxChars: 50, minWords: 1, maxWords: 9, maxWordChars: 18, maxLines: 1, fontMax: 32, fontMin: 22, weight: 500, lineHeight: 1.3, hint: '"Thanks for watching!"', fills: 'Line under the headline' },
    channel_name: { label: 'Channel name', required: false, minChars: 2, maxChars: 24, minWords: 1, maxWords: 4, maxWordChars: 16, maxLines: 1, fontMax: 28, fontMin: 20, weight: 700, lineHeight: 1.2, fills: 'Name under the subscribe circle' },
    slot_label_1: { label: 'Slot 1 label', required: false, minChars: 2, maxChars: 24, minWords: 1, maxWords: 4, maxWordChars: 16, maxLines: 1, fontMax: 26, fontMin: 18, weight: 600, lineHeight: 1.2, hint: '"Best for viewer" / "Latest upload".', fills: 'Small label under slot 1' },
    slot_label_2: { label: 'Slot 2 label', required: false, minChars: 2, maxChars: 24, minWords: 1, maxWords: 4, maxWordChars: 16, maxLines: 1, fontMax: 26, fontMin: 18, weight: 600, lineHeight: 1.2, fills: 'Small label under slot 2' },
  },
  lists: {},
  options: {
    layout: { label: 'Layout', values: ['two_videos', 'one_video', 'video_playlist'], default: 'two_videos', fills: 'Which YouTube end-screen elements you will add (see the slot positions in the template header)' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url (e.g. a blurred frame of the video), or transparent' },
  },
  animations: {
    headline: { label: 'Headline', kind: 'text', target: 'headline', default: 'rise' },
    sub: { label: 'Sub-line', kind: 'text', target: 'sub-line', default: 'fade' },
    slots: { label: 'Slots', kind: 'card', target: 'each empty slot frame', default: 'pop' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'drift' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'cut' },
  },
  cues: { description: 'headline → slots.', units: ['headline', 'slots'] },
  colors: ['card', 'card_border'],
  example: { headline: 'Watch next', sub: 'Thanks for watching!', channel_name: 'Storybit Explains', layout: 'two_videos', background: 'theme' },
};

export type Slot = { kind: 'subscribe' | 'video' | 'playlist'; x: number; y: number; w: number; h: number };

/** Slot boxes in SAFE-box coordinates (add 100 for frame coordinates). */
export function endScreenSlots(layout: 'two_videos' | 'one_video' | 'video_playlist'): Slot[] {
  const circle = 240;
  if (layout === 'one_video') {
    const vw = 1120;
    const vh = 630;
    return [
      { kind: 'subscribe', x: 0, y: 370, w: circle, h: circle },
      { kind: 'video', x: 600, y: 190, w: vw, h: vh },
    ];
  }
  const vw = 660;
  const vh = 371;
  return [
    { kind: 'subscribe', x: 0, y: 370, w: circle, h: circle },
    { kind: 'video', x: 340, y: 305, w: vw, h: vh },
    { kind: layout === 'video_playlist' ? 'playlist' : 'video', x: 1060, y: 305, w: vw, h: vh },
  ];
}

export type EndLayout = { headline: Line; sub?: Line; channel?: Line; labels: (Line | undefined)[]; slots: Slot[] };
export function layoutEnd(input: { headline: string; sub: string; channel: string; l1: string; l2: string; layout: 'two_videos' | 'one_video' | 'video_playlist' }, measure: Measure, spec: TemplateSpec = NV07_SPEC): EndLayout {
  const T = spec.text;
  const slots = endScreenSlots(input.layout);
  const headW = input.layout === 'one_video' ? 1120 : 1380;
  const headline = fitText(input.headline, T.headline, headW, measure, false).lines[0];
  const sub = input.sub ? fitText(input.sub, T.sub, headW, measure, false).lines[0] : undefined;
  const channel = input.channel ? fitText(input.channel, T.channel_name, 240, measure, false).lines[0] : undefined;
  const vids = slots.filter((s) => s.kind !== 'subscribe');
  const labels = [input.l1, input.l2].map((l, i) => (l && vids[i] ? fitText(l, i === 0 ? T.slot_label_1 : T.slot_label_2, vids[i].w, measure, false).lines[0] : undefined));
  return { headline, sub, channel, labels, slots };
}
export function planEnd(L: EndLayout, anims: { headline: string }, duration: number, cueTimes?: number[]): Plan {
  const units: Unit[] = [
    { key: 'headline', label: 'Headline', start: 6, dur: textAnimFrames(anims.headline, words(L.headline.text).length, L.headline.text.length, 18), cue: 0 },
    { key: 'slots', label: 'Slots', start: 20, dur: 14, cue: 1 },
  ];
  if (L.sub) units.push({ key: 'sub', label: 'Sub-line', start: 16, dur: 14, follows: { key: 'headline', offset: 10 } });
  L.slots.forEach((_, i) => units.push({ key: `slot${i}`, label: `Slot ${i + 1}`, start: 20 + i * 6, dur: 16, follows: { key: 'slots', offset: i * 6 } }));
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareNV07(props: Record<string, unknown>, durationInFrames: number) {
  const S = NV07_SPEC.text;
  const A = (k: string) => readAnim(props, NV07_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(NV07_SPEC, props);
  const measure = measureFor(style);
  const layout = opt(props, 'layout', ['two_videos', 'one_video', 'video_playlist'] as const, 'two_videos');
  const L = layoutEnd({ headline: normaliseText(readFirst(props, ['headline', 'title']), S.headline) || 'Watch next', sub: normaliseText(readFirst(props, ['sub']), S.sub), channel: normaliseText(readFirst(props, ['channel_name']), S.channel_name), l1: normaliseText(readFirst(props, ['slot_label_1']), S.slot_label_1), l2: normaliseText(readFirst(props, ['slot_label_2']), S.slot_label_2), layout }, measure, sized.spec);
  const plan = planEnd(L, { headline: A('headline') }, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, L, plan, layout, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

export function NV07EndScreen({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, layout, imageUrl, bg, debug } = prepareNV07(props, durationInFrames);
  const w = plan.windows;
  const S = NV07_SPEC.text;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const headX = layout === 'one_video' ? 600 : 340;
  const headBottom = Math.min(...L.slots.filter((s) => s.kind !== 'subscribe').map((s) => s.y)) - 40;
  const pulse = 0.5 + 0.5 * Math.sin((frame / 30) * Math.PI * 1.2);
  let vi = 0;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          <div style={{ position: 'absolute', left: headX, bottom: SAFE_H - headBottom, display: 'flex', flexDirection: 'column' }}>
            <AnimatedText lines={[L.headline]} anim={A('headline')} start={w.headline.start} dur={w.headline.dur} frame={frame} weight={S.headline.weight} lineHeight={S.headline.lineHeight} letterSpacing="-0.02em" shadow={shadow} group="headline" input="headline" />
            {L.sub && w.sub && <AnimatedText lines={[L.sub]} anim={A('sub')} start={w.sub.start} dur={w.sub.dur} frame={frame} weight={S.sub.weight} lineHeight={S.sub.lineHeight} color={mutedFor(style, onFootage)} shadow={shadow} group="sub" input="sub" style={{ marginTop: 8 }} />}
          </div>
          {L.slots.map((s, i) => {
            const sw = w[`slot${i}`];
            const st = cardStyle(A('slots'), progress(frame, sw.start, sw.dur));
            if (s.kind === 'subscribe') {
              return (
                <div key={i} style={{ position: 'absolute', left: s.x, top: s.y, width: s.w, ...st }}>
                  <div {...leaf('slot-subscribe', 'subscribe element slot')} style={{ width: s.w, height: s.h, borderRadius: '50%', border: `6px solid ${accent}`, boxSizing: 'border-box', background: withAlpha(accent, 0.12), boxShadow: `inset 0 0 0 ${Math.round(10 * pulse)}px ${withAlpha(accent, 0.25)}` }} />
                  {L.channel && (
                    <span {...leaf('channel', 'channel_name')} style={{ position: 'absolute', left: 0, width: s.w, top: s.h + 18, textAlign: 'center', fontFamily: fontFor(S.channel_name.weight), fontWeight: S.channel_name.weight, fontSize: L.channel.size, lineHeight: 1.2, color: style.colors.text, whiteSpace: 'nowrap', textShadow: shadow }}>
                      {L.channel.text}
                    </span>
                  )}
                </div>
              );
            }
            const label = L.labels[vi++];
            return (
              <div key={i} style={{ position: 'absolute', left: s.x, top: s.y, width: s.w, ...st }}>
                <div {...leaf(`slot-${i}`, `${s.kind} element slot`)} style={{ width: s.w, height: s.h, borderRadius: 18, border: `3px solid ${style.custom.has('card_border') ? style.colors.card_border : withAlpha(style.colors.text, 0.35)}`, background: style.custom.has('card') ? style.colors.card : withAlpha(style.colors.scrim, 0.35), boxSizing: 'border-box' }} />
                {label && (
                  <span {...leaf(`slot-${i}-label`, `slot_label_${vi}`)} style={{ position: 'absolute', left: 0, top: s.h + 14, fontFamily: fontFor(600), fontWeight: 600, fontSize: label.size, lineHeight: 1.2, color: mutedFor(style, onFootage), whiteSpace: 'nowrap', textShadow: shadow }}>
                    {label.text}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </SafeArea>
      {/* frame coordinates of the slots, for whoever sets up the end screen in YouTube Studio */}
      <div data-end-screen-slots={JSON.stringify(L.slots.map((s) => ({ ...s, x: s.x + SAFE_MARGIN, y: s.y + SAFE_MARGIN })))} style={{ display: 'none' }} />
    </div>
  );
}
