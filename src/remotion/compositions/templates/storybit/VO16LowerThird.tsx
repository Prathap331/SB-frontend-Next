'use client';

/**
 * VO-16 · Lower Third  (animation_type: "vo_lower_third")   — overlay on footage
 * Name and role of the person speaking or shown, in the lower third of the safe box.
 *
 * Inputs (full list, limits and JSON Schema: VO16LowerThird.inputs.json):
 *   name (required) · role · logo_url · position · look
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [name, role]
 * Timing: 1.5–8s from clock.durationInFrames.
 */
import { Img } from './core/remotionSafe';
import type { TemplateProps } from '../../../types';
import { readNonEmptyString } from '../../../props';
import { applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, iconStyle, progress, shapeState, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { OVERLAY_DURATION } from './core/overlay';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, leaf, readFirst } from './core/shared';

export const VO16_SPEC: TemplateSpec = {
  id: 'VO-16',
  animationType: 'vo_lower_third',
  name: 'Lower Third',
  pickWhen: 'A person speaks or appears on screen: put their name and role at the bottom.',
  placement: 'overlay',
  images: { logo_url: { label: 'Logo / photo', required: false, fills: 'Small circle picture beside the name (logo or face)' } },
  duration: OVERLAY_DURATION,
  text: {
    name: { label: 'Name', required: true, minChars: 2, maxChars: 30, minWords: 1, maxWords: 5, maxWordChars: 18, maxLines: 1, fontMax: 52, fontMin: 30, weight: 800, lineHeight: 1.15, hint: 'Full name.', fills: 'Name', example: 'Nandan Nilekani' },
    role: { label: 'Role', required: false, minChars: 2, maxChars: 44, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 1, fontMax: 32, fontMin: 20, weight: 600, lineHeight: 1.2, hint: 'Role at the time of the clip.', fills: 'Role under the name', example: 'Co-founder, Infosys' },
  },
  lists: {},
  options: {
    position: { label: 'Position', values: ['bottom_left', 'bottom_right', 'bottom_center'], default: 'bottom_left', fills: 'Where the lower third sits' },
    look: { label: 'Look', values: ['bar', 'line', 'box'], default: 'bar', fills: 'bar: accent bar + dark panel · line: accent underline, no panel · box: accent name box over a dark role box' },
  },
  animations: {
    bar: { label: 'Accent bar / line', kind: 'shape', target: 'accent bar or underline', default: 'grow' },
    panel: { label: 'Panel', kind: 'card', target: 'panel behind the text', default: 'slide_left' },
    logo: { label: 'Logo / photo', kind: 'icon', target: 'circle picture', default: 'pop' },
    name: { label: 'Name', kind: 'text', target: 'name', default: 'slide_left' },
    role: { label: 'Role', kind: 'text', target: 'role', default: 'fade_up' },
    exit: { label: 'Exit', kind: 'exit', target: 'the lower third', default: 'fade' },
  },
  cues: { description: 'name → role. Missing elements are skipped.', units: ['name', 'role'] },
  colors: ['card', 'on_accent'],
  example: { name: 'Nandan Nilekani', role: 'Co-founder, Infosys', position: 'bottom_left', look: 'bar' },
};

export const PAD = 22;
export type LTLayout = { name: Line; role?: Line; logo: number; w: number; h: number; textW: number };

export function layoutLT(input: { name: string; role: string; hasLogo: boolean }, measure: Measure, spec: TemplateSpec = VO16_SPEC): LTLayout {
  const T = spec.text;
  const maxText = 1000;
  const name = fitText(input.name, T.name, maxText, measure, false).lines[0];
  const role = input.role ? fitText(input.role, T.role, maxText, measure, false).lines[0] : undefined;
  const textW = Math.ceil(Math.max(measure(name.text, name.size, T.name.weight), role ? measure(role.text, role.size, T.role.weight) : 0));
  const textH = name.size * T.name.lineHeight + (role ? 8 + role.size * T.role.lineHeight : 0);
  const logo = input.hasLogo ? Math.round(Math.min(110, textH)) : 0;
  const h = Math.round(Math.max(textH, logo) + PAD * 2);
  const w = Math.min(SAFE_W, Math.ceil(12 + PAD + (logo ? logo + 20 : 0) + textW + PAD * 1.4));
  return { name, role, logo, w, h, textW };
}

export function planLT(L: LTLayout, anims: { name: string; role: string }, duration: number, cueTimes?: number[]): Plan {
  const units: Unit[] = [];
  const nDur = textAnimFrames(anims.name, words(L.name.text).length, L.name.text.length, 14);
  units.push({ key: 'name', label: 'Name', start: 8, dur: nDur, cue: 0 });
  if (L.role) units.push({ key: 'role', label: 'Role', start: 8 + Math.min(nDur, 10), dur: textAnimFrames(anims.role, words(L.role.text).length, L.role.text.length, 14), cue: 1 });
  units.push({ key: 'bar', label: 'Accent bar', start: 2, dur: 12, follows: { key: 'name', offset: -6 } });
  units.push({ key: 'panel', label: 'Panel', start: 4, dur: 12, follows: { key: 'name', offset: -4 } });
  if (L.logo) units.push({ key: 'logo', label: 'Logo', start: 6, dur: 14, follows: { key: 'name', offset: -2 } });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareVO16(props: Record<string, unknown>, durationInFrames: number) {
  const S = VO16_SPEC.text;
  const A = (k: string) => readAnim(props, VO16_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(VO16_SPEC, props);
  const measure = measureFor(style);
  const logo = readFirst(props, ['logo_url', 'photo_url', 'image_url']);
  const L = layoutLT({ name: normaliseText(readFirst(props, ['name', 'title']), S.name), role: normaliseText(readFirst(props, ['role', 'subtitle']), S.role), hasLogo: Boolean(logo) }, measure, sized.spec);
  const plan = planLT(L, { name: A('name'), role: A('role') }, durationInFrames, readCues(props));
  return { style, sized, A, L, plan, logo, position: opt(props, 'position', ['bottom_left', 'bottom_right', 'bottom_center'] as const, 'bottom_left'), look: opt(props, 'look', ['bar', 'line', 'box'] as const, 'bar'), debug: props.show_safe_area === true };
}

export function VO16LowerThird({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, logo, position, look, debug } = prepareVO16(props, durationInFrames);
  const w = plan.windows;
  const S = VO16_SPEC.text;
  const accent = style.colors.accent;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const left = position === 'bottom_left' ? 0 : position === 'bottom_right' ? SAFE_W - L.w : (SAFE_W - L.w) / 2;
  const top = SAFE_H - L.h;
  const bar = shapeState(A('bar'), progress(frame, w.bar.start, w.bar.dur));
  const panel = cardStyle(A('panel'), progress(frame, w.panel.start, w.panel.dur));
  const fill = style.custom.has('card') ? style.colors.card : withAlpha(style.colors.scrim, 0.78);
  const nameOnAccent = look === 'box';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {look !== 'line' && <div style={{ position: 'absolute', left, top, width: L.w, height: L.h, borderRadius: look === 'box' ? 12 : '0 18px 18px 0', background: fill, ...panel }} />}
          {look === 'bar' && <div {...leaf('bar', 'accent bar')} style={{ position: 'absolute', left, top: top + L.h * (1 - bar.length) / 2, width: 12, height: L.h * bar.length, background: accent, ...bar.style }} />}
          {look === 'box' && (
            <div style={{ position: 'absolute', left, top, width: (L.w) * bar.length, height: PAD + L.name.size * S.name.lineHeight + 6, borderRadius: '12px 12px 0 0', background: accent, ...bar.style }} />
          )}
          <div style={{ position: 'absolute', left: left + 12 + PAD, top, height: L.h, display: 'flex', alignItems: 'center', gap: 20 }}>
            {L.logo > 0 && logo && w.logo && (
              <div {...leaf('logo', 'logo_url')} style={{ width: L.logo, height: L.logo, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${accent}`, boxSizing: 'border-box', flexShrink: 0, ...iconStyle(A('logo'), progress(frame, w.logo.start, w.logo.dur)) }}>
                <Img src={logo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AnimatedText lines={[L.name]} anim={A('name')} start={w.name.start} dur={w.name.dur} frame={frame} weight={S.name.weight} lineHeight={S.name.lineHeight} color={nameOnAccent ? style.colors.on_accent : style.colors.text} shadow={nameOnAccent ? 'none' : FOOTAGE_SHADOW} group="name" input="name" />
              {L.role && w.role && (
                <AnimatedText lines={[L.role]} anim={A('role')} start={w.role.start} dur={w.role.dur} frame={frame} weight={S.role.weight} lineHeight={S.role.lineHeight} color={look === 'line' ? '#E8EAF6' : style.custom.has('muted') ? style.colors.muted : '#E8EAF6'} shadow={FOOTAGE_SHADOW} group="role" input="role" />
              )}
            </div>
          </div>
          {look === 'line' && (
            <div {...leaf('bar', 'accent line')} style={{ position: 'absolute', left: left + 12 + PAD + (L.logo ? L.logo + 20 : 0), top: top + PAD + L.name.size * S.name.lineHeight + 1, width: Math.min(L.textW, 220) * bar.length, height: 5, borderRadius: 3, background: accent, ...bar.style }} />
          )}
        </div>
      </SafeArea>
    </div>
  );
}
