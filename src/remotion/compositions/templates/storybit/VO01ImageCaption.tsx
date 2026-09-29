'use client';

/**
 * VO-01 · Image + Label / Caption  (animation_type: "vo_image_caption")
 * A photo that needs naming or explaining: the image fills the frame with slow motion, and a label
 * tag and / or a caption bar sits in a corner. Without image_url it works as an overlay on footage.
 *
 * Inputs (full list, limits and JSON Schema: VO01ImageCaption.inputs.json):
 *   image_url · label · caption · credit
 *   position · fit · caption_style · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [label, caption]
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from 'remotion';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { applySizes, normaliseText, readAnim, type Issue, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, imageEntryStyle, imageMotionStyle, progress, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, leaf, readFirst } from './core/shared';

/* ================================================================== */
/* Content spec                                                         */
/* ================================================================== */

export const VO01_SPEC: TemplateSpec = {
  id: 'VO-01',
  animationType: 'vo_image_caption',
  name: 'Image + Label / Caption',
  pickWhen: 'Showing a specific photo that needs a name or one line of explanation (a place, an object, an archive picture).',
  placement: 'both',
  image: { label: 'Image', required: true, fills: 'The photo, full frame' },
  duration: { min: 90, default: 150, max: 240 },
  text: {
    label: { label: 'Label', required: false, minChars: 2, maxChars: 30, minWords: 1, maxWords: 5, maxWordChars: 18, maxLines: 1, fontMax: 44, fontMin: 28, weight: 800, lineHeight: 1.15, hint: 'What it is: "Gateway of India, 1924".', fills: 'Label tag', example: 'Howrah Bridge, Kolkata' },
    caption: { label: 'Caption', required: false, minChars: 5, maxChars: 100, minWords: 2, maxWords: 18, maxWordChars: 18, maxLines: 2, fontMax: 38, fontMin: 26, weight: 500, lineHeight: 1.35, hint: 'One or two lines that explain the picture.', fills: 'Caption under the label', example: 'Opened in 1943, it carries more than a lakh vehicles a day' },
    credit: { label: 'Credit', required: false, minChars: 3, maxChars: 40, minWords: 1, maxWords: 7, maxWordChars: 18, maxLines: 1, fontMax: 22, fontMin: 18, weight: 500, lineHeight: 1.25, hint: 'Photo credit or source: "Photo: Wikimedia Commons".', fills: 'Small credit in the opposite corner' },
  },
  lists: {},
  options: {
    position: { label: 'Position', values: ['bottom_left', 'bottom_center', 'top_left'], default: 'bottom_left', fills: 'Where the label and caption sit (inside the safe box)' },
    fit: { label: 'Image fit', values: ['cover', 'contain'], default: 'cover', fills: 'Fill the frame (crops edges) or show the whole image over a blurred copy' },
    caption_style: { label: 'Caption style', values: ['panel', 'bar', 'plain'], default: 'panel', fills: 'panel: dark rounded box · bar: full-width strip along the bottom of the safe box · plain: text with a shadow' },
  },
  animations: {
    image_motion: { label: 'Image motion', kind: 'image_motion', target: 'the image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Image entry', kind: 'image_entry', target: 'the image (first 12 frames)', default: 'fade' },
    panel: { label: 'Panel', kind: 'card', target: 'caption panel / bar', default: 'slide_up' },
    label: { label: 'Label', kind: 'text', target: 'label tag', default: 'slide_left' },
    caption: { label: 'Caption', kind: 'text', target: 'caption', default: 'fade_up' },
    credit: { label: 'Credit', kind: 'text', target: 'credit', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'label, caption and credit', default: 'fade' },
  },
  cues: { description: 'label → caption. Missing elements are skipped.', units: ['label', 'caption'] },
  colors: ['card'],
  validate: (props) => {
    const issues: Issue[] = [];
    const has = (k: string) => typeof props[k] === 'string' && (props[k] as string).trim();
    if (!has('label') && !has('caption')) issues.push({ field: 'label', level: 'error', message: 'Give a label, a caption, or both' });
    return issues;
  },
  example: { image_url: 'https://example.com/howrah-bridge.jpg', label: 'Howrah Bridge, Kolkata', caption: 'Opened in 1943, it carries more than a lakh vehicles a day', credit: 'Photo: Wikimedia Commons', position: 'bottom_left' },
};

/* ================================================================== */
/* Layout                                                               */
/* ================================================================== */

export const PANEL_PAD = 28;
export const LABEL_GAP = 12;
export type CaptionLayout = { boxW: number; label: Line[]; caption: Line[]; credit: Line[]; boxH: number };

export function layoutCaption(input: { label: string; caption: string; credit: string; bar: boolean }, measure: Measure, spec: TemplateSpec = VO01_SPEC): CaptionLayout {
  const T = spec.text;
  const boxW = input.bar ? SAFE_W : 1200;
  const inner = boxW - PANEL_PAD * 2;
  const label = input.label ? fitText(input.label, T.label, inner, measure, false).lines : [];
  const caption = input.caption ? fitText(input.caption, T.caption, inner, measure).lines : [];
  const credit = input.credit ? fitText(input.credit, T.credit, 560, measure, false).lines : [];
  const boxH = PANEL_PAD * 2 + blockHeight(label, T.label.lineHeight) + (label.length && caption.length ? LABEL_GAP : 0) + blockHeight(caption, T.caption.lineHeight);
  return { boxW, label, caption, credit, boxH: Math.min(boxH, SAFE_H) };
}

export function planCaption(L: CaptionLayout, anims: { label: string; caption: string; credit: string }, duration: number, cueTimes?: number[]): Plan {
  const T = (lines: Line[]) => lines.map((l) => l.text).join(' ');
  const units: Unit[] = [];
  let t = 10;
  if (L.label.length) {
    const l = T(L.label);
    units.push({ key: 'label', label: 'Label', start: t, dur: textAnimFrames(anims.label, words(l).length, l.length, 16), cue: 0 });
    t += 10;
  }
  if (L.caption.length) {
    const c = T(L.caption);
    units.push({ key: 'caption', label: 'Caption', start: t, dur: textAnimFrames(anims.caption, words(c).length, c.length, 18), cue: 1 });
  }
  const anchor = L.label.length ? 'label' : 'caption';
  units.push({ key: 'panel', label: 'Panel', start: 6, dur: 14, follows: { key: anchor, offset: -4 } });
  if (L.credit.length) {
    const cr = T(L.credit);
    units.push({ key: 'credit', label: 'Credit', start: t + 12, dur: textAnimFrames(anims.credit, words(cr).length, cr.length, 12), follows: { key: anchor, offset: 16 } });
  }
  return planTimeline(duration, units, cueTimes);
}

/* ================================================================== */
/* Props → layout → plan                                                */
/* ================================================================== */

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareVO01(props: Record<string, unknown>, durationInFrames: number) {
  const S = VO01_SPEC.text;
  const A = (k: string) => readAnim(props, VO01_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(VO01_SPEC, props);
  const measure = measureFor(style);
  const imageUrl = readImageUrl(props);
  const position = opt(props, 'position', ['bottom_left', 'bottom_center', 'top_left'] as const, 'bottom_left');
  const fit = opt(props, 'fit', ['cover', 'contain'] as const, 'cover');
  const capStyle = opt(props, 'caption_style', ['panel', 'bar', 'plain'] as const, 'panel');
  const debug = props.show_safe_area === true;
  const L = layoutCaption({ label: normaliseText(readFirst(props, ['label', 'title']), S.label), caption: normaliseText(readFirst(props, ['caption', 'text']), S.caption), credit: normaliseText(readFirst(props, ['credit', 'source']), S.credit), bar: capStyle === 'bar' }, measure, sized.spec);
  const plan = planCaption(L, { label: A('label'), caption: A('caption'), credit: A('credit') }, durationInFrames, readCues(props));
  return { style, sized, A, imageUrl, position, fit, capStyle, debug, L, plan };
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */

export function VO01ImageCaption({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, imageUrl, position, fit, capStyle, debug, L, plan } = prepareVO01(props, durationInFrames);
  const w = plan.windows;
  const S = VO01_SPEC.text;
  const accent = style.colors.accent;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const t = frame / Math.max(1, durationInFrames);
  const inP = progress(frame, 0, 12);
  const top = position === 'top_left';
  const centered = position === 'bottom_center';
  const panelFill = style.custom.has('card') ? style.colors.card : withAlpha(style.colors.scrim, 0.78);
  const pw = w.panel;
  const panelStyle = pw ? cardStyle(A('panel'), progress(frame, pw.start, pw.dur)) : {};
  const boxLeft = centered ? (SAFE_W - L.boxW) / 2 : 0;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      {imageUrl && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: `radial-gradient(120% 90% at 15% 20%, ${style.colors.background} 0%, ${style.colors.background_2} 100%)`, ...imageEntryStyle(A('image_entry'), inP) }}>
          {fit === 'contain' && <Img src={imageUrl} style={{ position: 'absolute', inset: -40, width: 'calc(100% + 80px)', height: 'calc(100% + 80px)', objectFit: 'cover', filter: 'blur(40px) brightness(0.6)' }} />}
          <Img src={imageUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit, ...imageMotionStyle(A('image_motion'), t) }} />
          {/* soft scrim on the caption side so text stays readable on any photo */}
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(${top ? '180deg' : '0deg'}, ${withAlpha(style.colors.scrim, 0.55)} 0%, ${withAlpha(style.colors.scrim, 0)} 45%)` }} />
        </div>
      )}
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          <div
            style={{
              position: 'absolute',
              left: boxLeft,
              ...(top ? { top: 0 } : { bottom: 0 }),
              width: capStyle === 'plain' ? L.boxW : L.boxW,
              boxSizing: 'border-box',
              padding: PANEL_PAD,
              borderRadius: capStyle === 'bar' ? 16 : 24,
              background: capStyle === 'plain' ? 'transparent' : panelFill,
              borderLeft: capStyle === 'panel' ? `6px solid ${accent}` : undefined,
              display: 'flex',
              flexDirection: 'column',
              alignItems: centered ? 'center' : 'flex-start',
              ...panelStyle,
            }}
          >
            {L.label.length > 0 && w.label && (
              <AnimatedText lines={L.label} anim={A('label')} start={w.label.start} dur={w.label.dur} frame={frame} weight={S.label.weight} lineHeight={S.label.lineHeight} color={style.colors.text} shadow={FOOTAGE_SHADOW} align={centered ? 'center' : 'left'} group="label" input="label" />
            )}
            {L.caption.length > 0 && w.caption && (
              <AnimatedText lines={L.caption} anim={A('caption')} start={w.caption.start} dur={w.caption.dur} frame={frame} weight={S.caption.weight} lineHeight={S.caption.lineHeight} color={style.custom.has('muted') ? style.colors.muted : '#E8EAF6'} shadow={FOOTAGE_SHADOW} align={centered ? 'center' : 'left'} group="caption" input="caption" style={{ marginTop: L.label.length ? LABEL_GAP : 0 }} />
            )}
          </div>
          {L.credit.length > 0 && w.credit && (
            <span
              {...leaf('credit', 'credit')}
              style={{ position: 'absolute', right: 0, ...(top ? { bottom: 0 } : { top: 0 }), fontFamily: fontFor(S.credit.weight), fontWeight: S.credit.weight, fontSize: L.credit[0].size, lineHeight: S.credit.lineHeight, color: '#FFFFFFCC', textShadow: FOOTAGE_SHADOW, whiteSpace: 'nowrap', padding: '4px 12px', borderRadius: 8, background: withAlpha(style.colors.scrim, 0.45), ...cardStyle(A('credit') === 'none' ? 'none' : 'fade', progress(frame, w.credit.start, w.credit.dur)) }}
            >
              {L.credit[0].text}
            </span>
          )}
        </div>
      </SafeArea>
    </div>
  );
}
