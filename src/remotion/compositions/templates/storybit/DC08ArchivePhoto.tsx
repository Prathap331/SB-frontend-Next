'use client';

/**
 * DC-08 · Archive Photo  (animation_type: "dc_archive_photo")
 * A historical photo with an aged look — black & white or sepia, film grain, vignette, dust — either as a
 * printed photo with a white border lying on the background, or full frame. A typed caption gives the
 * place and year, with an optional archive credit. Use real archive photos with their credit.
 *
 * Inputs (full list, limits and JSON Schema: DC08ArchivePhoto.inputs.json):
 *   image_url (required) · caption · date · credit · treatment · look · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [photo, caption, credit]
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from './core/remotionSafe';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureWith } from './core/measure';
import { fitText, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, imageEntryStyle, imageMotionStyle, progress, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontStack, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

export const TYPE_FONT = fontStack('roboto_slab');

export const DC08_SPEC: TemplateSpec = {
  id: 'DC-08',
  animationType: 'dc_archive_photo',
  name: 'Archive Photo',
  pickWhen: 'Showing a historical photograph: "This is Bombay in 1947…".',
  placement: 'full',
  image: { label: 'Archive photo', required: true, fills: 'The historical photo' },
  duration: { min: 90, default: 150, max: 240 },
  text: {
    caption: { label: 'Caption', required: true, minChars: 3, maxChars: 70, minWords: 1, maxWords: 12, maxWordChars: 18, maxLines: 2, fontMax: 34, fontMin: 22, weight: 600, lineHeight: 1.3, hint: 'What / where: "Victoria Terminus, Bombay".', fills: 'Typed caption', example: 'Victoria Terminus, Bombay' },
    date: { label: 'Date', required: false, minChars: 2, maxChars: 20, minWords: 1, maxWords: 4, maxWordChars: 12, maxLines: 1, fontMax: 34, fontMin: 22, weight: 800, lineHeight: 1.2, hint: '"1947", "August 1947".', fills: 'Year / date before the caption', example: '1947' },
    credit: { label: 'Credit', required: false, minChars: 3, maxChars: 44, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 1, fontMax: 20, fontMin: 16, weight: 500, lineHeight: 1.25, hint: '"Photo: National Archives of India".', fills: 'Small credit line', example: 'Photo: replace with the real archive credit' },
  },
  lists: {},
  options: {
    treatment: { label: 'Treatment', values: ['sepia', 'bw', 'none'], default: 'sepia', fills: 'Sepia, black & white, or the photo\'s own colours (grain and vignette stay)' },
    look: { label: 'Look', values: ['print', 'full'], default: 'print', fills: 'print: photo with a white border on the background · full: photo fills the frame' },
    background: { label: 'Background', values: ['theme', 'transparent'], default: 'theme', fills: 'Behind the print (print look only)' },
  },
  animations: {
    photo: { label: 'Photo', kind: 'card', target: 'the print', default: 'pop' },
    image_motion: { label: 'Photo motion', kind: 'image_motion', target: 'slow movement inside the photo', default: 'push_in' },
    image_entry: { label: 'Photo entry', kind: 'image_entry', target: 'full-frame photo (first 12 frames)', default: 'fade' },
    caption: { label: 'Caption', kind: 'text', target: 'date and caption', default: 'typewriter' },
    credit: { label: 'Credit', kind: 'text', target: 'credit line', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'photo and captions', default: 'fade' },
  },
  cues: { description: 'photo → caption → credit.', units: ['photo', 'caption', 'credit'] },
  colors: [],
  example: { image_url: 'https://example.com/archive-photo.jpg', date: '1947', caption: 'Victoria Terminus, Bombay', credit: 'Photo: replace with the real archive credit', treatment: 'sepia', look: 'print' },
};

export type ArchiveLayout = { look: 'print' | 'full'; print: { x: number; y: number; w: number; h: number }; pad: number; captionLine: Line[]; credit?: Line; captionText: string };

export function layoutArchive(input: { caption: string; date: string; credit: string; look: 'print' | 'full' }, measure: Measure, spec: TemplateSpec = DC08_SPEC): ArchiveLayout {
  const T = spec.text;
  const captionText = [input.date, input.caption].filter(Boolean).join(' — ');
  const capW = input.look === 'print' ? 1100 : 1300;
  const captionLine = captionText ? fitText(captionText, T.caption, capW - 40, measure).lines : [];
  const credit = input.credit ? fitText(input.credit, T.credit, 700, measure, false).lines[0] : undefined;
  const capH = captionLine.reduce((a, l) => a + l.size * T.caption.lineHeight, 0);
  const pad = 26;
  // print: the photo keeps a 4:3 frame; the caption sits in the wide bottom border like an old print
  const bottom = captionLine.length ? capH + 34 : pad;
  const maxH = SAFE_H - (credit ? credit.size * 1.25 + 16 : 0);
  // leave room for the 1.2° tilt of the paper so its corners stay inside the safe box
  let h = Math.min(maxH - 44, 820);
  let w = Math.round((h - pad - bottom) * (4 / 3)) + pad * 2;
  if (w > SAFE_W - 60) {
    w = SAFE_W - 60;
    h = Math.round((w - pad * 2) * (3 / 4)) + pad + bottom;
  }
  return { look: input.look, print: { x: (SAFE_W - w) / 2, y: Math.max(22, (maxH - h) / 2), w, h }, pad, captionLine, credit, captionText };
}

export function planArchive(L: ArchiveLayout, anims: { caption: string; credit: string }, duration: number, cueTimes?: number[]): Plan {
  const units: Unit[] = [{ key: 'photo', label: 'Photo', start: 4, dur: 16, cue: 0 }];
  if (L.captionText) units.push({ key: 'caption', label: 'Caption', start: 24, dur: textAnimFrames(anims.caption, words(L.captionText).length, L.captionText.length, 20), cue: 1 });
  if (L.credit) units.push({ key: 'credit', label: 'Credit', start: 40, dur: textAnimFrames(anims.credit, words(L.credit.text).length, L.credit.text.length, 12), cue: 2 });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareDC08(props: Record<string, unknown>, durationInFrames: number) {
  const S = DC08_SPEC.text;
  const A = (k: string) => readAnim(props, DC08_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DC08_SPEC, props);
  const look = opt(props, 'look', ['print', 'full'] as const, 'print');
  const L = layoutArchive({ caption: normaliseText(readFirst(props, ['caption']), S.caption), date: normaliseText(readFirst(props, ['date', 'year']), S.date), credit: normaliseText(readFirst(props, ['credit', 'source']), S.credit), look }, measureWith(TYPE_FONT, TYPE_FONT), sized.spec);
  const plan = planArchive(L, { caption: A('caption'), credit: A('credit') }, durationInFrames, readCues(props));
  return { style, sized, A, L, plan, imageUrl: readImageUrl(props), treatment: opt(props, 'treatment', ['sepia', 'bw', 'none'] as const, 'sepia'), bg: opt(props, 'background', ['theme', 'transparent'] as const, 'theme'), debug: props.show_safe_area === true };
}

const FILTER = { sepia: 'grayscale(1) sepia(0.75) contrast(1.08) brightness(0.96)', bw: 'grayscale(1) contrast(1.12)', none: 'saturate(0.8) contrast(1.05)' } as const;

/** Film grain + vignette + a few dust specks, re-seeded every other frame. */
function Aging({ frame, id }: { frame: number; id: string }) {
  const seed = Math.floor(frame / 2) % 97;
  return (
    <>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.35 }}>
        <filter id={`${id}-grain`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id}-grain)`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)' }} />
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
        {Array.from({ length: 6 }, (_, i) => {
          const r = ((seed * 37 + i * 53) % 100) / 100;
          const q = ((seed * 91 + i * 17) % 100) / 100;
          return <circle key={i} cx={r * 100} cy={q * 100} r={0.15 + ((i * 7) % 3) * 0.1} fill={i % 2 ? '#FFFFFF' : '#000000'} />;
        })}
        <line x1={((seed * 13) % 100)} y1={0} x2={((seed * 13) % 100) + 0.3} y2={100} stroke="#FFFFFF" strokeWidth={0.08} opacity={seed % 3 === 0 ? 0.5 : 0} />
      </svg>
    </>
  );
}

function DC08ArchivePhotoBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, imageUrl, treatment, bg, debug } = prepareDC08(props, durationInFrames);
  const w = plan.windows;
  const S = DC08_SPEC.text;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const motion = imageMotionStyle(A('image_motion'), frame / Math.max(1, durationInFrames));
  const full = L.look === 'full';
  const photoEl = imageUrl ? <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: FILTER[treatment], ...motion }} /> : <div style={{ width: '100%', height: '100%', background: '#6F6557' }} />;
  const paper = treatment === 'sepia' ? '#F1E6CF' : '#F2F0EA';
  const captionEl = L.captionLine.length > 0 && w.caption && (
    <AnimatedText lines={L.captionLine} anim={A('caption')} start={w.caption.start} dur={w.caption.dur} frame={frame} weight={S.caption.weight} lineHeight={S.caption.lineHeight} color={full ? '#FFFFFF' : '#2B241A'} shadow={full ? FOOTAGE_SHADOW : 'none'} align="center" group="caption" input="date — caption" fontFamily={TYPE_FONT} />
  );
  const creditEl = L.credit && w.credit && (
    <span {...leaf('credit', 'credit')} style={{ fontFamily: TYPE_FONT, fontWeight: 500, fontSize: L.credit.size, lineHeight: 1.25, color: full ? 'rgba(255,255,255,0.8)' : withAlpha(style.colors.text, 0.75), whiteSpace: 'nowrap', textShadow: FOOTAGE_SHADOW, opacity: progress(frame, w.credit.start, w.credit.dur) }}>{L.credit.text}</span>
  );
  if (full) {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000', ...styleVars(style) }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...imageEntryStyle(A('image_entry'), progress(frame, 0, 12)) }}>
          {photoEl}
          <Aging frame={frame} id="full" />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 35%)' }} />
        </div>
        <SafeArea debug={debug}>
          <div style={{ position: 'absolute', left: 0, bottom: 0, width: SAFE_W, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, ...exit }}>
            {captionEl}
            {creditEl}
          </div>
        </SafeArea>
      </div>
    );
  }
  const P = L.print;
  const cs = cardStyle(A('photo'), progress(frame, w.photo.start, w.photo.dur));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      {bg === 'theme' && <StoryBackground mode="theme" align="center" accent={style.colors.accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} />}
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          <div style={{ position: 'absolute', left: P.x, top: P.y, width: P.w, height: P.h, ...cs }}>
            {/* the paper tilts a touch; photo and caption stay straight so they read cleanly */}
            <div style={{ position: 'absolute', inset: 0, background: paper, transform: 'rotate(-1.2deg)', boxShadow: '0 16px 30px rgba(0,0,0,0.35)' }} />
            <div {...leaf('photo', 'image_url')} style={{ position: 'absolute', left: L.pad, top: L.pad, width: P.w - L.pad * 2, height: P.h - L.pad - (L.captionLine.length ? L.captionLine.reduce((a, l) => a + l.size * S.caption.lineHeight, 0) + 34 : L.pad), overflow: 'hidden', background: '#000' }}>
              {photoEl}
              <Aging frame={frame} id="print" />
            </div>
            <div style={{ position: 'absolute', left: 20, right: 20, bottom: 14, display: 'flex', justifyContent: 'center' }}>{captionEl}</div>
          </div>
          {creditEl && <div style={{ position: 'absolute', left: 0, width: SAFE_W, top: P.y + P.h + 16, display: 'flex', justifyContent: 'center' }}>{creditEl}</div>}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const DC08ArchivePhoto = withAutoFit(DC08ArchivePhotoBase);
