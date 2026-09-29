'use client';

/**
 * UI-07 · Newspaper Clipping  (animation_type: "ui_newspaper_clipping")
 * A paper cut-out with masthead, date, headline, an optional photo and a snippet of body text in
 * columns — for historical news ("back in 1998 the papers said…"). Only real, sourced reports.
 *
 * Inputs (full list, limits and JSON Schema: UI07NewspaperClipping.inputs.json):
 *   masthead (required) · date · headline (required) · body · photo_url · image_url · paper · tilt · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [clipping, headline, body]
 * Uses serif newspaper fonts (Playfair Display / Lora, with Noto fallbacks) regardless of style fonts.
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from 'remotion';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureWith } from './core/measure';
import { blockHeight, fitText, linesAt, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, progress, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontStack, readStyle, styleVars } from './core/style';
import { AnimatedText, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

export const UI07_SPEC: TemplateSpec = {
  id: 'UI-07',
  animationType: 'ui_newspaper_clipping',
  name: 'Newspaper Clipping',
  pickWhen: 'Historical or archival news: "In 1991 the papers reported…". Real, sourced reports only.',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  images: { photo_url: { label: 'Photo', required: false, fills: 'Photo printed on the clipping (shown in black and white)' } },
  duration: { min: 90, default: 150, max: 240 },
  text: {
    masthead: { label: 'Masthead', required: true, minChars: 2, maxChars: 30, minWords: 1, maxWords: 5, maxWordChars: 18, maxLines: 1, fontMax: 64, fontMin: 36, weight: 800, lineHeight: 1.1, hint: 'Newspaper name as printed.', fills: 'Masthead at the top of the clipping', example: 'The Example Herald' },
    date: { label: 'Date', required: false, minChars: 2, maxChars: 30, minWords: 1, maxWords: 6, maxWordChars: 14, maxLines: 1, fontMax: 22, fontMin: 16, weight: 600, lineHeight: 1.2, hint: '"Monday, 24 July 1991".', fills: 'Date line under the masthead' },
    headline: { label: 'Headline', required: true, minChars: 5, maxChars: 80, minWords: 2, maxWords: 14, maxWordChars: 18, maxLines: 3, fontMax: 80, fontMin: 40, weight: 800, lineHeight: 1.08, hint: 'The real headline.', fills: 'Headline', example: 'Government opens up the economy' },
    body: { label: 'Body snippet', required: false, minChars: 20, maxChars: 240, minWords: 5, maxWords: 45, maxWordChars: 18, maxLines: 8, fontMax: 22, fontMin: 16, weight: 500, lineHeight: 1.42, hint: 'A short excerpt (paraphrase is fine; mark quotes).', fills: 'Body text in two columns' },
  },
  lists: {},
  options: {
    paper: { label: 'Paper', values: ['aged', 'clean'], default: 'aged', fills: 'Yellowed old paper, or clean white newsprint' },
    tilt: { label: 'Tilt', values: ['left', 'none', 'right'], default: 'left', fills: 'Slight rotation of the clipping' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url (e.g. a desk), or transparent over footage' },
  },
  animations: {
    clipping: { label: 'Clipping', kind: 'card', target: 'the paper', default: 'pop' },
    headline: { label: 'Headline', kind: 'text', target: 'headline', default: 'fade' },
    body: { label: 'Body', kind: 'text', target: 'body text', default: 'fade' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the clipping', default: 'fade' },
  },
  cues: { description: 'clipping → headline → body.', units: ['clipping', 'headline', 'body'] },
  colors: [],
  example: { masthead: 'The Example Herald', date: 'Wednesday, 24 July 1991', headline: 'Government opens up the economy', body: 'Replace with a short excerpt from the real report.', paper: 'aged', tilt: 'left', background: 'theme' },
};

export const SERIF_HEAD = fontStack('playfair_display');
export const SERIF_BODY = fontStack('lora');
export const PAD = 48;
export type ClipLayout = { w: number; h: number; masthead: Line; date?: Line; headline: Line[]; body: [Line[], Line[]]; photoH: number; photoW: number };

export function layoutClip(input: { masthead: string; date: string; headline: string; body: string; photo: boolean }, measure: Measure, spec: TemplateSpec = UI07_SPEC): ClipLayout {
  const T = spec.text;
  // keep the tilted paper inside the safe box: 1.6° of tilt adds ~3% of the other side
  const w = Math.min(1320, SAFE_W - 60);
  const inner = w - PAD * 2;
  const masthead = fitText(input.masthead, T.masthead, inner, measure, false).lines[0];
  const date = input.date ? fitText(input.date, T.date, inner, measure, false).lines[0] : undefined;
  let cap = T.headline.fontMax;
  for (;;) {
    const headline = fitText(input.headline, T.headline, inner, measure, true, cap).lines;
    const photoW = input.photo ? Math.round(inner * 0.42) : 0;
    const photoH = input.photo ? Math.round(photoW * 0.72) : 0;
    const colW = input.photo ? inner - photoW - 32 : (inner - 36) / 2;
    const bl = input.body ? linesAt(input.body, T.body.fontMax, { ...T.body, maxLines: input.photo ? 8 : 16 }, colW, measure, false) : [];
    const half = input.photo ? bl.length : Math.ceil(bl.length / 2);
    const body: [Line[], Line[]] = [bl.slice(0, half), input.photo ? [] : bl.slice(half)];
    const bodyH = Math.max(blockHeight(body[0], T.body.lineHeight), blockHeight(body[1], T.body.lineHeight), photoH);
    const h = Math.round(PAD * 2 + masthead.size * 1.1 + 16 + (date ? date.size * 1.2 + 12 : 0) + 22 + blockHeight(headline, T.headline.lineHeight) + (bodyH ? 28 + bodyH : 0));
    if (h <= SAFE_H - 60 || cap <= T.headline.fontMin) return { w, h: Math.min(h, SAFE_H - 60), masthead, date, headline, body, photoH, photoW };
    cap -= 4;
  }
}
export function planClip(L: ClipLayout, anims: { headline: string; body: string }, duration: number, cueTimes?: number[]): Plan {
  const h = L.headline.map((l) => l.text).join(' ');
  const b = [...L.body[0], ...L.body[1]].map((l) => l.text).join(' ');
  const units: Unit[] = [
    { key: 'clipping', label: 'Clipping', start: 4, dur: 16, cue: 0 },
    { key: 'headline', label: 'Headline', start: 16, dur: textAnimFrames(anims.headline, words(h).length, h.length, 16), cue: 1 },
  ];
  if (b) units.push({ key: 'body', label: 'Body', start: 30, dur: textAnimFrames(anims.body, words(b).length, b.length, 16), cue: 2 });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareUI07(props: Record<string, unknown>, durationInFrames: number) {
  const S = UI07_SPEC.text;
  const A = (k: string) => readAnim(props, UI07_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(UI07_SPEC, props);
  const measure = measureWith(SERIF_HEAD, SERIF_BODY);
  const photo = readFirst(props, ['photo_url']);
  const L = layoutClip({ masthead: normaliseText(readFirst(props, ['masthead', 'publication']), S.masthead), date: normaliseText(readFirst(props, ['date']), S.date), headline: normaliseText(readFirst(props, ['headline', 'title']), S.headline), body: normaliseText(readFirst(props, ['body', 'text']), S.body), photo: Boolean(photo) }, measure, sized.spec);
  const plan = planClip(L, { headline: A('headline'), body: A('body') }, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, L, plan, photo, imageUrl, bg: readBgMode(props, imageUrl), aged: opt(props, 'paper', ['aged', 'clean'] as const, 'aged') === 'aged', tilt: opt(props, 'tilt', ['left', 'none', 'right'] as const, 'left'), debug: props.show_safe_area === true };
}

function UI07NewspaperClippingBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, photo, imageUrl, bg, aged, tilt, debug } = prepareUI07(props, durationInFrames);
  const w = plan.windows;
  const S = UI07_SPEC.text;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const paper = aged ? '#EFE3C4' : '#F7F5EF';
  const ink = '#1E1A14';
  const deg = tilt === 'left' ? -1.6 : tilt === 'right' ? 1.6 : 0;
  const t = (weight: number, size: number, lh: number, family = SERIF_BODY) => ({ fontFamily: family, fontWeight: weight, fontSize: size, lineHeight: lh, color: ink, whiteSpace: 'nowrap' as const });
  const cs = cardStyle(A('clipping'), progress(frame, w.clipping.start, w.clipping.dur));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={style.colors.accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...exit }}>
          <div style={{ position: 'relative', width: L.w, height: L.h, transform: String(cs.transform ?? ''), opacity: cs.opacity }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: aged ? `radial-gradient(120% 90% at 30% 20%, ${paper} 0%, #E4D3AB 100%)` : paper,
                clipPath: 'polygon(0% 1%, 3% 0%, 18% 0.8%, 35% 0%, 52% 0.6%, 70% 0%, 88% 0.9%, 100% 0%, 99.4% 20%, 100% 45%, 99.2% 70%, 100% 100%, 80% 99.3%, 60% 100%, 40% 99.2%, 20% 100%, 0% 99.4%, 0.7% 70%, 0% 40%, 0.6% 15%)',
                transform: `rotate(${deg}deg)`,
              }}
            />
          <div style={{ position: 'relative', width: L.w, height: L.h, boxSizing: 'border-box', padding: PAD, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span {...leaf('masthead', 'masthead')} style={{ ...t(800, L.masthead.size, 1.1, SERIF_HEAD), letterSpacing: '0.02em' }}>{L.masthead.text}</span>
            <div style={{ width: '100%', borderTop: `2px solid ${ink}`, borderBottom: `1px solid ${ink}`, margin: '14px 0 12px', padding: L.date ? '6px 0' : 0, display: 'flex', justifyContent: 'center' }}>
              {L.date && <span {...leaf('date', 'date')} style={{ ...t(600, L.date.size, 1.2), textTransform: 'uppercase', letterSpacing: '0.12em' }}>{L.date.text}</span>}
            </div>
            <AnimatedText lines={L.headline} anim={A('headline')} start={w.headline.start} dur={w.headline.dur} frame={frame} weight={800} lineHeight={S.headline.lineHeight} color={ink} shadow="none" align="center" group="headline" input="headline" fontFamily={SERIF_HEAD} style={{ marginTop: 10 }} />
            {(L.body[0].length > 0 || photo) && (
              <div style={{ display: 'flex', gap: 32, marginTop: 28, width: '100%', alignItems: 'flex-start' }}>
                {photo && L.photoW > 0 && (
                  <div {...leaf('photo', 'photo_url')} style={{ width: L.photoW, height: L.photoH, flexShrink: 0, overflow: 'hidden', border: `1px solid ${ink}` }}>
                    <Img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(1) contrast(1.15) sepia(0.2)' }} />
                  </div>
                )}
                {[0, 1].map((c) =>
                  L.body[c].length > 0 && w.body ? (
                    <div key={c} style={{ flex: 1, minWidth: 0, opacity: progress(frame, w.body.start, w.body.dur) }}>
                      {L.body[c].map((l, k) => (
                        <div key={k} {...leaf(`body-${c}-${k}`, 'body')} style={{ ...t(500, l.size, S.body.lineHeight), fontFamily: SERIF_BODY }}>{l.text}</div>
                      ))}
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>
          </div>
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const UI07NewspaperClipping = withAutoFit(UI07NewspaperClippingBase);
