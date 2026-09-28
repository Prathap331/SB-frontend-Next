'use client';

/**
 * VO-12 · Location Tag  (animation_type: "vo_location_tag")   — overlay on footage
 * A small place tag for an establishing shot: pin icon + place name, with an optional region line
 * and date. Transparent background; sits in a corner of the safe box.
 *
 * Inputs (full list, limits and JSON Schema: VO12LocationTag.inputs.json):
 *   location (required) · detail · date · icon · position · style
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [location, detail]
 * Timing: 1.5–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, iconStyle, progress, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { OVERLAY_DURATION, OVERLAY_POSITIONS, anchorBox, type OverlayPosition } from './core/overlay';
import { SafeArea } from './core/safeArea';
import { fontFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, leaf, readFirst } from './core/shared';

export const VO12_SPEC: TemplateSpec = {
  id: 'VO-12',
  animationType: 'vo_location_tag',
  name: 'Location Tag',
  pickWhen: 'An establishing shot of a place: name the city, landmark or region on screen.',
  placement: 'overlay',
  duration: OVERLAY_DURATION,
  text: {
    location: { label: 'Location', required: true, minChars: 2, maxChars: 30, minWords: 1, maxWords: 5, maxWordChars: 18, maxLines: 1, fontMax: 40, fontMin: 26, weight: 800, lineHeight: 1.15, hint: '"Varanasi", "Gateway of India".', fills: 'Place name', example: 'Varanasi' },
    detail: { label: 'Detail', required: false, minChars: 2, maxChars: 30, minWords: 1, maxWords: 5, maxWordChars: 18, maxLines: 1, fontMax: 26, fontMin: 18, weight: 600, lineHeight: 1.2, hint: 'Region or country: "Uttar Pradesh, India".', fills: 'Line under the place name', example: 'Uttar Pradesh, India' },
    date: { label: 'Date', required: false, minChars: 2, maxChars: 20, minWords: 1, maxWords: 4, maxWordChars: 12, maxLines: 1, fontMax: 26, fontMin: 18, weight: 700, lineHeight: 1.2, hint: '"March 2024", "1947".', fills: 'Date after the detail', example: '2024' },
  },
  icons: { icon: { label: 'Icon', required: false, fills: 'Icon in the tag', fallback: 'map-pin', example: 'map-pin' } },
  lists: {},
  options: {
    position: { label: 'Position', values: [...OVERLAY_POSITIONS], default: 'top_left', fills: 'Where the tag sits inside the safe box' },
    look: { label: 'Look', values: ['pill', 'card', 'plain'], default: 'pill', fills: 'Rounded pill, square-cornered card, or text with shadow only' },
  },
  animations: {
    tag: { label: 'Tag', kind: 'card', target: 'the tag background', default: 'slide_left' },
    icon: { label: 'Icon', kind: 'icon', target: 'pin icon', default: 'bounce' },
    location: { label: 'Location', kind: 'text', target: 'place name', default: 'typewriter' },
    detail: { label: 'Detail', kind: 'text', target: 'detail and date line', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the tag', default: 'fade' },
  },
  cues: { description: 'location → detail. Missing elements are skipped.', units: ['location', 'detail'] },
  colors: ['icon', 'icon_bg', 'card'],
  example: { location: 'Varanasi', detail: 'Uttar Pradesh, India', date: '2024', icon: 'map-pin', position: 'top_left', look: 'pill' },
};

export const PAD_Y = 14;
export const PAD_X = 28;
export type TagLayout = { location: Line; second: Line[]; secondText: string; iconBox: number; w: number; h: number };

export function layoutTag(input: { location: string; detail: string; date: string }, measure: Measure, spec: TemplateSpec = VO12_SPEC): TagLayout {
  const T = spec.text;
  const maxW = 900;
  const location = fitText(input.location, T.location, maxW - 120, measure, false).lines[0];
  const secondText = [input.detail, input.date].filter(Boolean).join('  ·  ');
  const second = secondText ? fitText(secondText, T.detail, maxW - 120, measure, false).lines : [];
  const iconBox = Math.round(location.size * 1.5);
  const textW = Math.max(measure(location.text, location.size, T.location.weight), second[0] ? measure(second[0].text, second[0].size, T.detail.weight) : 0);
  const textH = location.size * T.location.lineHeight + (second[0] ? second[0].size * T.detail.lineHeight : 0);
  const h = Math.round(Math.max(iconBox, textH) + PAD_Y * 2);
  const w = Math.ceil(PAD_Y + iconBox + 18 + textW + PAD_X);
  return { location, second, secondText, iconBox, w, h };
}

export function planTag(L: TagLayout, anims: { location: string; detail: string }, duration: number, cueTimes?: number[]): Plan {
  const units: Unit[] = [];
  const t = L.location.text;
  const lDur = textAnimFrames(anims.location, words(t).length, t.length, 14);
  units.push({ key: 'location', label: 'Location', start: 8, dur: lDur, cue: 0 });
  if (L.second.length) units.push({ key: 'detail', label: 'Detail', start: 8 + lDur, dur: textAnimFrames(anims.detail, words(L.secondText).length, L.secondText.length, 12), cue: 1 });
  units.push({ key: 'tag', label: 'Tag', start: 2, dur: 12, follows: { key: 'location', offset: -6 } });
  units.push({ key: 'icon', label: 'Icon', start: 4, dur: 16, follows: { key: 'location', offset: -4 } });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareVO12(props: Record<string, unknown>, durationInFrames: number) {
  const S = VO12_SPEC.text;
  const A = (k: string) => readAnim(props, VO12_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(VO12_SPEC, props);
  const measure = measureFor(style);
  const L = layoutTag({ location: normaliseText(readFirst(props, ['location', 'place', 'title']), S.location), detail: normaliseText(readFirst(props, ['detail', 'region']), S.detail), date: normaliseText(readFirst(props, ['date']), S.date) }, measure, sized.spec);
  const plan = planTag(L, { location: A('location'), detail: A('detail') }, durationInFrames, readCues(props));
  const position = opt(props, 'position', OVERLAY_POSITIONS, 'top_left') as OverlayPosition;
  const look = opt(props, 'look', ['pill', 'card', 'plain'] as const, 'pill');
  const icon = readFirst(props, ['icon', 'icon_name']) ?? 'map-pin';
  return { style, sized, A, L, plan, position, look, icon, debug: props.show_safe_area === true };
}

export function VO12LocationTag({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, position, look, icon, debug } = prepareVO12(props, durationInFrames);
  const w = plan.windows;
  const S = VO12_SPEC.text;
  const { left, top } = anchorBox(position, L.w, L.h);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const fill = look === 'plain' ? 'transparent' : style.custom.has('card') ? style.colors.card : withAlpha(style.colors.scrim, 0.72);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          <div
            style={{
              position: 'absolute',
              left,
              top,
              width: L.w,
              height: L.h,
              boxSizing: 'border-box',
              padding: `${PAD_Y}px ${PAD_X}px ${PAD_Y}px ${PAD_Y}px`,
              borderRadius: look === 'pill' ? 999 : 14,
              background: fill,
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              ...cardStyle(A('tag'), progress(frame, w.tag.start, w.tag.dur)),
            }}
          >
            <div {...leaf('icon', 'icon')} style={{ width: L.iconBox, height: L.iconBox, flexShrink: 0, borderRadius: '50%', background: style.colors.icon_bg, display: 'flex', alignItems: 'center', justifyContent: 'center', ...iconStyle(A('icon'), progress(frame, w.icon.start, w.icon.dur)) }}>
              <LucideIconView name={icon} size={Math.round(L.iconBox * 0.56)} color={style.colors.icon} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <AnimatedText lines={[L.location]} anim={A('location')} start={w.location.start} dur={w.location.dur} frame={frame} weight={S.location.weight} lineHeight={S.location.lineHeight} color={style.colors.text} shadow={FOOTAGE_SHADOW} group="location" input="location" />
              {L.second.length > 0 && w.detail && (
                <span {...leaf('detail', 'detail · date')} style={{ fontFamily: fontFor(S.detail.weight), fontWeight: S.detail.weight, fontSize: L.second[0].size, lineHeight: S.detail.lineHeight, color: style.custom.has('muted') ? style.colors.muted : '#E8EAF6', textShadow: FOOTAGE_SHADOW, whiteSpace: 'nowrap', ...cardStyle(A('detail') === 'none' ? 'none' : 'fade', progress(frame, w.detail.start, w.detail.dur)) }}>
                  {L.second[0].text}
                </span>
              )}
            </div>
          </div>
        </div>
      </SafeArea>
    </div>
  );
}
