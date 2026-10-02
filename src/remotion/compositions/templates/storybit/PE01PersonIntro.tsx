'use client';

/**
 * PE-01 · Person Intro Card  (animation_type: "pe_person_intro")
 * First mention of an important person: name, role and an optional tagline, with a portrait on the
 * left or right, a full-bleed portrait on one half of the frame, or text only.
 *
 * Inputs (full list, limits and JSON Schema: PE01PersonIntro.inputs.json):
 *   name (required) · role · tagline · kicker · portrait_url · image_url
 *   layout · portrait_shape · align · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [name, role, tagline]
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from './core/remotionSafe';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type Issue, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, imageMotionStyle, progress, shapeState, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W, SAFE_MARGIN, FRAME_W, FRAME_H } from './core/safeArea';
import { mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

/* ================================================================== */
/* Content spec                                                         */
/* ================================================================== */

export const PE01_SPEC: TemplateSpec = {
  id: 'PE-01',
  animationType: 'pe_person_intro',
  name: 'Person Intro Card',
  pickWhen: 'The first time an important person is named: who they are, in one card.',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  images: { portrait_url: { label: 'Portrait', required: false, fills: 'Photo of the person — required for the portrait_left / portrait_right / full_bleed layouts' } },
  duration: { min: 90, default: 120, max: 240 },
  text: {
    kicker: { label: 'Kicker', required: false, minChars: 2, maxChars: 24, minWords: 1, maxWords: 4, maxWordChars: 16, maxLines: 1, fontMax: 30, fontMin: 22, weight: 700, lineHeight: 1.2, hint: 'Small label above the name: "Meet", "The founder".', fills: 'Small label above the name', example: 'Meet' },
    name: { label: 'Name', required: true, minChars: 2, maxChars: 30, minWords: 1, maxWords: 5, maxWordChars: 18, maxLines: 2, fontMax: 120, fontMin: 60, weight: 800, lineHeight: 1.05, hint: 'Full name as it should appear.', fills: 'The name', example: 'Dr. A. P. J. Abdul Kalam' },
    role: { label: 'Role', required: false, minChars: 2, maxChars: 40, minWords: 1, maxWords: 7, maxWordChars: 18, maxLines: 2, fontMax: 44, fontMin: 28, weight: 600, lineHeight: 1.2, hint: 'Who they are: "11th President of India".', fills: 'Role line under the name', example: '11th President of India' },
    tagline: { label: 'Tagline', required: false, minChars: 5, maxChars: 70, minWords: 2, maxWords: 12, maxWordChars: 18, maxLines: 2, fontMax: 34, fontMin: 24, weight: 500, lineHeight: 1.35, hint: 'Why they matter, in one line.', fills: 'Line under the role', example: 'Led India’s missile programme before becoming President' },
  },
  lists: {},
  options: {
    layout: { label: 'Layout', values: ['auto', 'portrait_left', 'portrait_right', 'full_bleed', 'text_only'], default: 'auto', fills: 'auto = portrait_left when a portrait is given, else text_only · full_bleed puts the portrait over one half of the frame' },
    portrait_shape: { label: 'Portrait shape', values: ['circle', 'rounded'], default: 'circle', fills: 'Shape of the portrait (left / right layouts)' },
    align: { label: 'Align', values: ['left', 'center'], default: 'left', fills: 'Text alignment in text_only' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    portrait: { label: 'Portrait', kind: 'card', target: 'the portrait', default: 'pop' },
    portrait_motion: { label: 'Portrait motion', kind: 'image_motion', target: 'slow movement inside the portrait', default: 'push_in' },
    kicker: { label: 'Kicker', kind: 'text', target: 'kicker', default: 'slide_left' },
    name: { label: 'Name', kind: 'text', target: 'the name', default: 'rise' },
    rule: { label: 'Accent line', kind: 'shape', target: 'line under the name', default: 'grow' },
    role: { label: 'Role', kind: 'text', target: 'role line', default: 'fade_up' },
    tagline: { label: 'Tagline', kind: 'text', target: 'tagline', default: 'fade' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: { description: 'name → role → tagline. Missing elements are skipped.', units: ['name', 'role', 'tagline'] },
  colors: [],
  // the portrait is mandatory whenever the chosen layout shows one
  validate: (props) => {
    const issues: Issue[] = [];
    const layout = typeof props.layout === 'string' ? props.layout : 'auto';
    const hasPortrait = typeof props.portrait_url === 'string' && props.portrait_url.trim() !== '';
    if (['portrait_left', 'portrait_right', 'full_bleed'].includes(layout) && !hasPortrait) issues.push({ field: 'portrait_url', level: 'error', message: `portrait_url is required for the ${layout} layout (or use text_only)` });
    return issues;
  },
  example: { kicker: 'Meet', name: 'Dr. A. P. J. Abdul Kalam', role: '11th President of India', tagline: 'Led India’s missile programme before becoming President', layout: 'auto', background: 'theme' },
};

/* ================================================================== */
/* Layout                                                               */
/* ================================================================== */

export type PersonMode = 'portrait_left' | 'portrait_right' | 'full_bleed' | 'text_only';
export const PORTRAIT = 440;
export const PORTRAIT_GAP = 90;
export const KICKER_GAP = 20;
export const RULE_GAP = 26;
export const ROLE_GAP = 22;
export const TAG_GAP = 16;

export type PersonLayout = { mode: PersonMode; textX: number; textW: number; kicker: Line[]; name: Line[]; role: Line[]; tagline: Line[]; blockH: number };

export function layoutPerson(input: { name: string; role: string; tagline: string; kicker: string; mode: PersonMode; align: 'left' | 'center' }, measure: Measure, spec: TemplateSpec = PE01_SPEC): PersonLayout {
  const T = spec.text;
  const mode = input.mode;
  const textX = mode === 'portrait_left' ? PORTRAIT + PORTRAIT_GAP : 0;
  // full bleed: the portrait covers the right half of the frame, text stays in the left half of the safe box
  const textW = mode === 'text_only' ? SAFE_W : mode === 'full_bleed' ? FRAME_W / 2 - SAFE_MARGIN - 40 : SAFE_W - PORTRAIT - PORTRAIT_GAP;
  const kicker = input.kicker ? fitText(input.kicker, T.kicker, textW, measure, false).lines : [];
  const role = input.role ? fitText(input.role, T.role, textW, measure).lines : [];
  const tagline = input.tagline ? fitText(input.tagline, T.tagline, textW, measure).lines : [];
  const rest = (kicker.length ? blockHeight(kicker, T.kicker.lineHeight) + KICKER_GAP : 0) + RULE_GAP + 8 + (role.length ? ROLE_GAP + blockHeight(role, T.role.lineHeight) : 0) + (tagline.length ? TAG_GAP + blockHeight(tagline, T.tagline.lineHeight) : 0);
  let cap = T.name.fontMax;
  let name = fitText(input.name, T.name, textW, measure, true, cap).lines;
  while (blockHeight(name, T.name.lineHeight) + rest > SAFE_H && cap > T.name.fontMin) {
    cap -= 4;
    name = fitText(input.name, T.name, textW, measure, true, cap).lines;
  }
  return { mode, textX, textW, kicker, name, role, tagline, blockH: blockHeight(name, T.name.lineHeight) + rest };
}

/* ================================================================== */
/* Timing                                                               */
/* ================================================================== */

export function planPerson(L: PersonLayout, anims: { kicker: string; name: string; role: string; tagline: string }, duration: number, cueTimes?: number[]): Plan {
  const T = (lines: Line[]) => lines.map((l) => l.text).join(' ');
  const hasPortrait = L.mode !== 'text_only';
  const nm = T(L.name);
  const nStart = hasPortrait ? 12 : L.kicker.length ? 10 : 4;
  const nDur = textAnimFrames(anims.name, words(nm).length, nm.length, Math.round(18 * (1 + 0.33 * (L.name.length - 1))));
  const units: Unit[] = [{ key: 'name', label: 'Name', start: nStart, dur: nDur, cue: 0 }];
  let t = nStart + nDur;
  if (L.role.length) {
    const r = T(L.role);
    units.push({ key: 'role', label: 'Role', start: t - 4, dur: textAnimFrames(anims.role, words(r).length, r.length, 16), cue: 1 });
    t += 10;
  }
  if (L.tagline.length) {
    const g = T(L.tagline);
    units.push({ key: 'tagline', label: 'Tagline', start: t, dur: textAnimFrames(anims.tagline, words(g).length, g.length, 16), cue: 2 });
  }
  if (hasPortrait) units.push({ key: 'portrait', label: 'Portrait', start: 2, dur: 18, follows: { key: 'name', offset: -10 } });
  if (L.kicker.length) {
    const k = T(L.kicker);
    units.push({ key: 'kicker', label: 'Kicker', start: nStart - 6, dur: textAnimFrames(anims.kicker, words(k).length, k.length, 14), follows: { key: 'name', offset: -6 } });
  }
  units.push({ key: 'rule', label: 'Accent line', start: nStart + nDur - 8, dur: 14, follows: { key: 'name', offset: Math.max(0, nDur - 8) } });
  return planTimeline(duration, units, cueTimes);
}

/* ================================================================== */
/* Props → layout → plan (shared by the renderer and the preview)       */
/* ================================================================== */

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function preparePE01(props: Record<string, unknown>, durationInFrames: number) {
  const S = PE01_SPEC.text;
  const A = (k: string) => readAnim(props, PE01_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(PE01_SPEC, props);
  const measure = measureFor(style);
  const portrait = readFirst(props, ['portrait_url', 'portrait']);
  let mode = opt(props, 'layout', ['auto', 'portrait_left', 'portrait_right', 'full_bleed', 'text_only'] as const, 'auto') as PersonMode | 'auto';
  if (mode === 'auto') mode = portrait ? 'portrait_left' : 'text_only';
  if (!portrait) mode = 'text_only';
  const align = mode === 'text_only' ? opt(props, 'align', ['left', 'center'] as const, 'left') : 'left';
  const shape = opt(props, 'portrait_shape', ['circle', 'rounded'] as const, 'circle');
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const debug = props.show_safe_area === true;
  const L = layoutPerson(
    { name: normaliseText(readFirst(props, ['name', 'title']), S.name), role: normaliseText(readFirst(props, ['role', 'subtitle']), S.role), tagline: normaliseText(readFirst(props, ['tagline', 'description']), S.tagline), kicker: normaliseText(readFirst(props, ['kicker', 'label']), S.kicker), mode, align },
    measure,
    sized.spec,
  );
  const plan = planPerson(L, { kicker: A('kicker'), name: A('name'), role: A('role'), tagline: A('tagline') }, durationInFrames, readCues(props));
  return { style, sized, A, portrait, align, shape, imageUrl, bg, debug, L, plan };
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */

function PE01PersonIntroBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, portrait, align, shape, imageUrl, bg, debug, L, plan } = preparePE01(props, durationInFrames);
  const w = plan.windows;
  const S = PE01_SPEC.text;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme' || L.mode === 'full_bleed';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const muted = mutedFor(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const rule = shapeState(A('rule'), progress(frame, w.rule.start, w.rule.dur));
  const items = align === 'center' ? 'center' : 'flex-start';
  const pMotion = imageMotionStyle(A('portrait_motion'), frame / Math.max(1, durationInFrames));
  const pw = w.portrait;
  const pStyle = pw ? cardStyle(A('portrait'), progress(frame, pw.start, pw.dur)) : {};

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align={align} accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />

      {/* full-bleed portrait: a background layer on the right half, fading into the left */}
      {L.mode === 'full_bleed' && portrait && (
        <div
          style={{
            position: 'absolute',
            left: FRAME_W / 2 - 120,
            top: 0,
            width: FRAME_W / 2 + 120,
            height: FRAME_H,
            overflow: 'hidden',
            // fade the photo into whatever background is behind it (no hard edge)
            maskImage: 'linear-gradient(90deg, transparent 0%, black 38%)',
            WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 38%)',
            ...pStyle,
          }}
        >
          <Img src={portrait} style={{ width: '100%', height: '100%', objectFit: 'cover', ...pMotion }} />
        </div>
      )}

      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {(L.mode === 'portrait_left' || L.mode === 'portrait_right') && portrait && (
            <div
              {...leaf('portrait', 'portrait_url')}
              style={{
                position: 'absolute',
                left: L.mode === 'portrait_left' ? 0 : SAFE_W - PORTRAIT,
                top: (SAFE_H - PORTRAIT) / 2,
                width: PORTRAIT,
                height: PORTRAIT,
                boxSizing: 'border-box',
                padding: 16,
                borderRadius: shape === 'circle' ? '50%' : 40,
                background: withAlpha(accent, 0.16),
                ...pStyle,
              }}
            >
              <div style={{ width: '100%', height: '100%', borderRadius: shape === 'circle' ? '50%' : 28, overflow: 'hidden', border: `6px solid ${accent}`, boxSizing: 'border-box' }}>
                <Img src={portrait} style={{ width: '100%', height: '100%', objectFit: 'cover', ...pMotion }} />
              </div>
            </div>
          )}

          <div style={{ position: 'absolute', left: L.textX, top: 0, width: L.textW, height: SAFE_H, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: items, textAlign: align }}>
            {L.kicker.length > 0 && w.kicker && (
              <AnimatedText lines={L.kicker} anim={A('kicker')} start={w.kicker.start} dur={w.kicker.dur} frame={frame} weight={S.kicker.weight} lineHeight={S.kicker.lineHeight} color={accent} shadow={shadow} align={align} group="kicker" input="kicker" style={{ marginBottom: KICKER_GAP }} />
            )}
            <AnimatedText lines={L.name} anim={A('name')} start={w.name.start} dur={w.name.dur} frame={frame} weight={S.name.weight} lineHeight={S.name.lineHeight} letterSpacing="-0.02em" shadow={shadow} align={align} group="name" input="name" />
            <div {...leaf('rule', 'accent line')} style={{ width: 120 * rule.length, height: 8, borderRadius: 4, background: accent, marginTop: RULE_GAP, ...rule.style }} />
            {L.role.length > 0 && w.role && (
              <AnimatedText lines={L.role} anim={A('role')} start={w.role.start} dur={w.role.dur} frame={frame} weight={S.role.weight} lineHeight={S.role.lineHeight} shadow={shadow} align={align} group="role" input="role" style={{ marginTop: ROLE_GAP }} />
            )}
            {L.tagline.length > 0 && w.tagline && (
              <AnimatedText lines={L.tagline} anim={A('tagline')} start={w.tagline.start} dur={w.tagline.dur} frame={frame} weight={S.tagline.weight} lineHeight={S.tagline.lineHeight} color={muted} shadow={shadow} align={align} group="tagline" input="tagline" style={{ marginTop: TAG_GAP }} />
            )}
          </div>
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const PE01PersonIntro = withAutoFit(PE01PersonIntroBase);
