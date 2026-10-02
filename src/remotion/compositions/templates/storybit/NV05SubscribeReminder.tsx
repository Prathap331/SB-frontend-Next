'use client';

/**
 * NV-05 · Subscribe Reminder  (animation_type: "nv_subscribe")   — overlay on footage
 * A subscribe button with the channel's avatar and name: a cursor moves in and clicks, the button
 * turns into "Subscribed", and the bell rings. Generic look-alike styling, not YouTube's logo.
 *
 * Inputs (full list, limits and JSON Schema: NV05SubscribeReminder.inputs.json):
 *   channel_name · avatar_url · button_text · done_text · cta · position · button_color
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [card, click]
 * Timing: 1.5–8s from clock.durationInFrames. Use at most twice per video.
 */
import { Img } from './core/remotionSafe';
import type { TemplateProps } from '../../../types';
import { readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText, type Line, type Measure } from './core/fit';
import { cardStyle, easeInOutCubic, exitStyle, progress } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { OVERLAY_DURATION, OVERLAY_POSITIONS, anchorBox, type OverlayPosition } from './core/overlay';
import { SafeArea } from './core/safeArea';
import { fontFor, readStyle, styleVars, withAlpha } from './core/style';
import { FOOTAGE_SHADOW, leaf, readFirst } from './core/shared';

export const NV05_SPEC: TemplateSpec = {
  id: 'NV-05',
  animationType: 'nv_subscribe',
  name: 'Subscribe Reminder',
  pickWhen: 'Early in the video (30–60 s) and at most once more: ask viewers to subscribe.',
  placement: 'overlay',
  images: { avatar_url: { label: 'Channel avatar', required: false, fills: 'Channel picture in the circle (letter of the name if missing)' } },
  duration: OVERLAY_DURATION,
  text: {
    channel_name: { label: 'Channel name', required: false, minChars: 2, maxChars: 30, minWords: 1, maxWords: 5, maxWordChars: 18, maxLines: 1, fontMax: 34, fontMin: 22, weight: 700, lineHeight: 1.2, hint: 'Your channel name.', fills: 'Name beside the avatar', example: 'Storybit Explains' },
    cta: { label: 'Call to action', required: false, minChars: 3, maxChars: 34, minWords: 1, maxWords: 7, maxWordChars: 16, maxLines: 1, fontMax: 26, fontMin: 18, weight: 500, lineHeight: 1.2, hint: '"New explainers every Friday".', fills: 'Small line under the channel name' },
    button_text: { label: 'Button text', required: false, minChars: 2, maxChars: 16, minWords: 1, maxWords: 2, maxWordChars: 14, maxLines: 1, fontMax: 32, fontMin: 22, weight: 800, lineHeight: 1.2, hint: 'Default "Subscribe".', fills: 'Text on the button before the click', example: 'Subscribe' },
    done_text: { label: 'Done text', required: false, minChars: 2, maxChars: 16, minWords: 1, maxWords: 2, maxWordChars: 14, maxLines: 1, fontMax: 32, fontMin: 22, weight: 800, lineHeight: 1.2, hint: 'Default "Subscribed".', fills: 'Text on the button after the click', example: 'Subscribed', noSize: true },
  },
  lists: {},
  options: {
    position: { label: 'Position', values: [...OVERLAY_POSITIONS], default: 'bottom_center', fills: 'Where the card sits inside the safe box' },
    button_color: { label: 'Button colour', values: ['red', 'accent'], default: 'red', fills: 'Classic red subscribe button, or the accent colour' },
  },
  animations: {
    card: { label: 'Card', kind: 'card', target: 'the card', default: 'slide_up' },
    cursor: { label: 'Cursor', kind: 'icon', target: 'the pointer', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the card', default: 'slide_down' },
  },
  cues: { description: 'card = when it appears; click = the moment the button is pressed (e.g. on "subscribe").', units: ['card', 'click'] },
  colors: ['card', 'on_accent'],
  example: { channel_name: 'Storybit Explains', cta: 'New explainers every Friday', position: 'bottom_center' },
};

export type SubLayout = { name?: Line; cta?: Line; btn: Line; done: Line; avatar: number; btnW: number; btnH: number; w: number; h: number };
export function layoutSub(input: { name: string; cta: string; btn: string; done: string }, measure: Measure, spec: TemplateSpec = NV05_SPEC): SubLayout {
  const T = spec.text;
  const name = input.name ? fitText(input.name, T.channel_name, 520, measure, false).lines[0] : undefined;
  const cta = input.cta ? fitText(input.cta, T.cta, 520, measure, false).lines[0] : undefined;
  const btn = fitText(input.btn, T.button_text, 360, measure, false).lines[0];
  const done = fitText(input.done, { ...T.done_text, fontMax: btn.size }, 360, measure, false).lines[0];
  const avatar = 84;
  const textW = Math.ceil(Math.max(name ? measure(name.text, name.size, T.channel_name.weight) : 0, cta ? measure(cta.text, cta.size, T.cta.weight) : 0));
  const btnW = Math.ceil(Math.max(measure(btn.text, btn.size, 800), measure(done.text, done.size, 800)) + 64 + 44);
  const btnH = Math.round(btn.size * 1.2 + 34);
  const h = Math.max(avatar, btnH) + 36;
  const w = 18 + avatar + 20 + (textW ? textW + 28 : 0) + btnW + 18;
  return { name, cta, btn, done, avatar, btnW, btnH, w, h };
}
export function planSub(duration: number, cueTimes?: number[]): Plan {
  const units: Unit[] = [
    { key: 'card', label: 'Card', start: 2, dur: 14, cue: 0 },
    { key: 'click', label: 'Click', start: 30, dur: 6, cue: 1 },
    { key: 'cursor', label: 'Cursor', start: 16, dur: 14, follows: { key: 'click', offset: -14 } },
    { key: 'bell', label: 'Bell', start: 38, dur: 16, follows: { key: 'click', offset: 8 } },
  ];
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareNV05(props: Record<string, unknown>, durationInFrames: number) {
  const S = NV05_SPEC.text;
  const A = (k: string) => readAnim(props, NV05_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(NV05_SPEC, props);
  const measure = measureFor(style);
  const name = normaliseText(readFirst(props, ['channel_name', 'name']), S.channel_name);
  const L = layoutSub({ name, cta: normaliseText(readFirst(props, ['cta']), S.cta), btn: normaliseText(readFirst(props, ['button_text']), S.button_text) || 'Subscribe', done: normaliseText(readFirst(props, ['done_text']), S.done_text) || 'Subscribed' }, measure, sized.spec);
  const plan = planSub(durationInFrames, readCues(props));
  return { style, sized, A, L, plan, name, avatar: readFirst(props, ['avatar_url', 'avatar']), position: opt(props, 'position', OVERLAY_POSITIONS, 'bottom_center') as OverlayPosition, red: opt(props, 'button_color', ['red', 'accent'] as const, 'red') === 'red', debug: props.show_safe_area === true };
}

export function NV05SubscribeReminder({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, name, avatar, position, red, debug } = prepareNV05(props, durationInFrames);
  const w = plan.windows;
  const S = NV05_SPEC.text;
  const accent = style.colors.accent;
  const { left, top } = anchorBox(position, L.w, L.h);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const clicked = frame >= w.click.start + 3;
  const press = frame >= w.click.start && frame < w.click.start + 6 ? 0.94 : 1;
  const btnColor = clicked ? withAlpha(style.colors.text, 0.2) : red ? '#E62117' : accent;
  const btnInk = clicked ? style.colors.text : red ? '#FFFFFF' : style.colors.on_accent;
  const fill = style.custom.has('card') ? style.colors.card : withAlpha(style.colors.scrim, 0.8);
  const btnX = L.w - 18 - L.btnW / 2;
  const btnY = L.h / 2;
  const cp = easeInOutCubic(progress(frame, w.cursor.start, w.cursor.dur));
  // approaches from the right at button height, so the pointer stays inside the card (and the margin)
  const cx = btnX + 12 + 150 * (1 - cp);
  const cy = btnY - 14;
  const cursorOpacity = A('cursor') === 'none' ? 1 : Math.min(1, progress(frame, w.cursor.start, 6)) * (1 - progress(frame, w.bell.start + 10, 8));
  const ring = frame >= w.bell.start && frame < w.bell.start + w.bell.dur ? Math.sin(progress(frame, w.bell.start, w.bell.dur) * Math.PI * 6) * 18 * (1 - progress(frame, w.bell.start, w.bell.dur)) : 0;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', left, top, width: L.w, height: L.h, ...exit }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 999, background: fill, display: 'flex', alignItems: 'center', padding: '0 18px', gap: 20, boxSizing: 'border-box', ...cardStyle(A('card'), progress(frame, w.card.start, w.card.dur)) }}>
            <div {...leaf('avatar', 'avatar_url')} style={{ width: L.avatar, height: L.avatar, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {avatar ? <Img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: 40, color: style.colors.on_accent }}>{(name || 'S').slice(0, 1).toUpperCase()}</span>}
            </div>
            {(L.name || L.cta) && (
              <div style={{ display: 'flex', flexDirection: 'column', marginRight: 8 }}>
                {L.name && <span {...leaf('name', 'channel_name')} style={{ fontFamily: fontFor(S.channel_name.weight), fontWeight: S.channel_name.weight, fontSize: L.name.size, lineHeight: 1.2, color: style.colors.text, whiteSpace: 'nowrap', textShadow: FOOTAGE_SHADOW }}>{L.name.text}</span>}
                {L.cta && <span {...leaf('cta', 'cta')} style={{ fontFamily: fontFor(S.cta.weight), fontWeight: S.cta.weight, fontSize: L.cta.size, lineHeight: 1.2, color: style.custom.has('muted') ? style.colors.muted : '#E8EAF6', whiteSpace: 'nowrap' }}>{L.cta.text}</span>}
              </div>
            )}
            <div {...leaf('button', clicked ? 'done_text' : 'button_text')} style={{ marginLeft: 'auto', width: L.btnW, height: L.btnH, borderRadius: 999, background: btnColor, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, transform: `scale(${press})` }}>
              <span style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: L.btn.size, lineHeight: 1.2, color: btnInk, whiteSpace: 'nowrap' }}>{clicked ? L.done.text : L.btn.text}</span>
              <div style={{ display: 'flex', transform: `rotate(${ring}deg)`, transformOrigin: '50% 10%' }}>
                <LucideIconView name="bell" size={Math.round(L.btn.size * 1.05)} color={btnInk} />
              </div>
            </div>
          </div>
          {cursorOpacity > 0 && (
            <svg width={44} height={52} viewBox="0 0 22 26" style={{ position: 'absolute', left: cx - 6, top: cy - 4, opacity: cursorOpacity, transform: `scale(${press})`, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
              <path d="M2 2 L2 20 L7 15.5 L10.5 23 L13.5 21.6 L10 14.2 L17 14 Z" fill="#FFFFFF" stroke="#111111" strokeWidth={1.4} strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </SafeArea>
    </div>
  );
}
