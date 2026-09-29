'use client';

/**
 * UI-04 · Chat Conversation  (animation_type: "ui_chat")
 * A messaging-app conversation: header with contact name and avatar, messages appearing one by one,
 * with a typing indicator before incoming ones. Generic look-alike styling (no app logos).
 * Recreated chats are labelled "Recreated conversation" by default — never present them as real screenshots.
 *
 * Inputs (full list, limits and JSON Schema: UI04ChatConversation.inputs.json):
 *   contact_name (required) · status · avatar_url · messages[] { side, text, time } · image_url
 *   theme_style · label · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [message 1, 2, …]
 * side = "in" (left, from the contact) or "out" (right, sent).
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from 'remotion';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type Issue, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, progress } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, readStyle, styleVars, withAlpha } from './core/style';
import { StoryBackground, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

export const UI04_SPEC: TemplateSpec = {
  id: 'UI-04',
  animationType: 'ui_chat',
  name: 'Chat Conversation',
  pickWhen: 'Retelling a conversation, a scam message thread, or a story told through chat.',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  images: { avatar_url: { label: 'Contact avatar', required: false, fills: 'Picture in the chat header (letter of the name if missing)' } },
  duration: { min: 90, default: 210, max: 240 },
  text: {
    contact_name: { label: 'Contact name', required: true, minChars: 1, maxChars: 24, minWords: 1, maxWords: 4, maxWordChars: 16, maxLines: 1, fontMax: 34, fontMin: 24, weight: 700, lineHeight: 1.2, hint: 'Who the chat is with ("Bank Support", "Rahul").', fills: 'Name in the chat header', example: 'Bank Support' },
    status: { label: 'Status', required: false, minChars: 2, maxChars: 20, minWords: 1, maxWords: 3, maxWordChars: 14, maxLines: 1, fontMax: 22, fontMin: 18, weight: 500, lineHeight: 1.2, hint: '"online", "last seen today".', fills: 'Line under the name', example: 'online' },
    label: { label: 'Label', required: false, minChars: 2, maxChars: 28, minWords: 1, maxWords: 4, maxWordChars: 16, maxLines: 1, fontMax: 22, fontMin: 16, weight: 700, lineHeight: 1.2, hint: 'Default "Recreated conversation". Use "" only for a real, sourced screenshot.', fills: 'Small tag above the chat' },
  },
  lists: {
    messages: {
      label: 'Message',
      fills: 'Messages in order',
      minItems: 2,
      maxItems: 8,
      fields: {
        text: { label: 'Text', required: true, minChars: 1, maxChars: 90, minWords: 1, maxWords: 18, maxWordChars: 16, maxLines: 3, fontMax: 34, fontMin: 22, weight: 500, lineHeight: 1.3, hint: 'One message.', fills: 'Message text' },
        time: { label: 'Time', required: false, minChars: 3, maxChars: 8, minWords: 1, maxWords: 2, maxWordChars: 8, maxLines: 1, fontMax: 18, fontMin: 14, weight: 500, lineHeight: 1.2, hint: '"10:42".', fills: 'Time in the bubble corner' },
        side: { label: 'Side', required: true, minChars: 2, maxChars: 3, minWords: 1, maxWords: 1, maxWordChars: 3, maxLines: 1, fontMax: 20, fontMin: 20, weight: 500, lineHeight: 1, hint: '"in" (from the contact, left) or "out" (sent, right).', fills: 'Which side the bubble is on', noSize: true },
      },
    },
  },
  options: {
    theme_style: { label: 'App look', values: ['green', 'blue', 'neutral'], default: 'green', fills: 'green: WhatsApp-like · blue: iMessage-like · neutral: plain (generic look-alikes, no logos)' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    panel: { label: 'Chat window', kind: 'card', target: 'the chat window', default: 'pop' },
    bubbles: { label: 'Bubbles', kind: 'card', target: 'each message bubble', default: 'pop' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the chat', default: 'fade_up' },
  },
  cues: { description: 'One cue per message, when it is read out (incoming messages show "typing…" just before).', units: ['message 1', 'message 2', 'message 3', 'message 4', 'message 5', 'message 6', 'message 7', 'message 8'] },
  colors: [],
  validate: (props) => {
    const issues: Issue[] = [];
    (Array.isArray(props.messages) ? (props.messages as Record<string, unknown>[]) : []).forEach((m, i) => {
      if (m && m.side !== 'in' && m.side !== 'out') issues.push({ field: `messages[${i}].side`, level: 'warning', message: `Message ${i + 1}: side must be "in" or "out" — "in" is used` });
    });
    return issues;
  },
  example: {
    contact_name: 'Bank Support',
    status: 'online',
    messages: [
      { side: 'in', text: 'Your account will be blocked today. Share the OTP to keep it active.', time: '10:41' },
      { side: 'out', text: 'Why would my bank ask for an OTP?', time: '10:42' },
      { side: 'in', text: 'Sir it is urgent, share it within 5 minutes', time: '10:42' },
    ],
    theme_style: 'green',
    background: 'theme',
  },
};

export type Msg = { side: 'in' | 'out'; text: string; time?: string };
export const PANEL_W = 1000;
export const HEADER_H = 110;
export const BUBBLE_PAD_X = 26;
export const BUBBLE_PAD_Y = 16;
export const BUBBLE_GAP = 14;
export const TIME_W = 70;
export type ChatLayout = {
  panelH: number;
  name: Line;
  status?: Line;
  label?: Line;
  bubbles: { lines: Line[]; w: number; h: number; y: number; time?: Line }[];
  /** Scroll offset once message i has appeared (older messages scroll up out of the window, like a real chat). */
  scrollAt: number[];
};

export function layoutChat(input: { name: string; status: string; label: string; messages: Msg[] }, measure: Measure, spec: TemplateSpec = UI04_SPEC): ChatLayout {
  const T = spec.text;
  const F = spec.lists.messages.fields;
  const label = input.label ? fitText(input.label, T.label, 600, measure, false).lines[0] : undefined;
  const labelH = label ? label.size * 1.2 + 26 : 0;
  const name = fitText(input.name, T.contact_name, PANEL_W - 260, measure, false).lines[0];
  const status = input.status ? fitText(input.status, T.status, PANEL_W - 260, measure, false).lines[0] : undefined;
  const maxBubble = Math.round(PANEL_W * 0.72);
  const textW = maxBubble - BUBBLE_PAD_X * 2 - TIME_W;
  const avail = SAFE_H - labelH - HEADER_H - 40;
  let cap = F.text.fontMax;
  for (;;) {
    const f = sharedFont(input.messages.map((m) => m.text), F.text, textW, measure, cap);
    let y = 24;
    const bubbles = input.messages.map((m) => {
      const lines = linesAt(m.text, f, F.text, textW, measure, false);
      const tw = Math.max(...lines.map((l) => measure(l.text, l.size, F.text.weight)));
      const time = m.time ? fitText(m.time, F.time, TIME_W - 8, measure, false).lines[0] : undefined;
      const w = Math.ceil(tw + BUBBLE_PAD_X * 2 + (time ? TIME_W : 0));
      const h = Math.ceil(blockHeight(lines, F.text.lineHeight) + BUBBLE_PAD_Y * 2);
      const b = { lines, w, h, y, time };
      y += h + BUBBLE_GAP;
      return b;
    });
    const contentH = y + 10;
    if (contentH <= avail || cap <= F.text.fontMin) {
      // when everything cannot fit, the list scrolls: after message i appears, the view starts at the
      // first bubble that lets message i end inside the window (so no bubble is ever half cut at rest)
      const scrollAt = bubbles.map((b) => {
        const bottom = b.y + b.h + 10;
        if (bottom <= avail) return 0;
        const first = bubbles.find((c) => bottom - (c.y - 24) <= avail);
        return first ? first.y - 24 : b.y - 24;
      });
      return { panelH: Math.min(SAFE_H - labelH, HEADER_H + Math.min(contentH, avail)), name, status, label, bubbles, scrollAt };
    }
    cap -= 2;
  }
}

export function planChat(n: number, sides: ('in' | 'out')[], duration: number, cueTimes?: number[]): Plan {
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const gap = n > 1 ? Math.max(8, Math.min(40, Math.floor((budget - 16 - 16) / (n - 1)))) : 0;
  const units: Unit[] = [];
  for (let i = 0; i < n; i++) units.push({ key: `msg${i}`, label: `Message ${i + 1}`, start: 16 + i * gap, dur: 12, cue: i });
  units.push({ key: 'panel', label: 'Chat window', start: 2, dur: 14, follows: { key: 'msg0', offset: -14 } });
  sides.forEach((s, i) => {
    if (s === 'in') units.push({ key: `typing${i}`, label: `Typing before ${i + 1}`, start: 16 + i * gap - Math.min(14, gap), dur: Math.min(14, Math.max(6, gap)), follows: { key: `msg${i}`, offset: -Math.min(14, Math.max(6, gap)) } });
  });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareUI04(props: Record<string, unknown>, durationInFrames: number) {
  const S = UI04_SPEC.text;
  const F = UI04_SPEC.lists.messages.fields;
  const A = (k: string) => readAnim(props, UI04_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(UI04_SPEC, props);
  const measure = measureFor(style);
  const messages: Msg[] = (Array.isArray(props.messages) ? props.messages : [])
    .map((m): Msg | null => {
      const o = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
      const text = typeof o.text === 'string' ? normaliseText(o.text, F.text) : '';
      return text ? { side: o.side === 'out' ? 'out' : 'in', text, time: typeof o.time === 'string' ? normaliseText(o.time, F.time) || undefined : undefined } : null;
    })
    .filter((m): m is Msg => m !== null)
    .slice(0, 8);
  const labelRaw = props.label === '' ? '' : normaliseText(readFirst(props, ['label']), S.label) || 'Recreated conversation';
  const L = layoutChat({ name: normaliseText(readFirst(props, ['contact_name', 'name']), S.contact_name) || 'Contact', status: normaliseText(readFirst(props, ['status']), S.status), label: labelRaw, messages }, measure, sized.spec);
  const plan = planChat(messages.length, messages.map((m) => m.side), durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, messages, L, plan, avatar: readFirst(props, ['avatar_url']), look: opt(props, 'theme_style', ['green', 'blue', 'neutral'] as const, 'green'), imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

const LOOKS = {
  green: { header: '#1F2C34', chat: '#0B141A', inBg: '#202C33', outBg: '#005C4B', inInk: '#E9EDEF', outInk: '#E9EDEF', meta: '#8696A0' },
  blue: { header: '#F2F2F7', chat: '#FFFFFF', inBg: '#E9E9EB', outBg: '#0A84FF', inInk: '#111111', outInk: '#FFFFFF', meta: '#8E8E93' },
  neutral: { header: '#1B1E27', chat: '#12141B', inBg: '#262A36', outBg: '#3A4152', inInk: '#F1F2F6', outInk: '#F1F2F6', meta: '#9AA0AE' },
} as const;

function UI04ChatConversationBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, messages, L, plan, avatar, look, imageUrl, bg, debug } = prepareUI04(props, durationInFrames);
  const w = plan.windows;
  const S = UI04_SPEC.text;
  const F = UI04_SPEC.lists.messages.fields;
  const C = LOOKS[look];
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const labelH = L.label ? L.label.size * 1.2 + 26 : 0;
  const panelTop = labelH + (SAFE_H - labelH - L.panelH) / 2;
  const left = (SAFE_W - PANEL_W) / 2;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={style.colors.accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.label && (
            <span {...leaf('label', 'label')} style={{ position: 'absolute', left, top: panelTop - labelH, fontFamily: fontFor(700), fontWeight: 700, fontSize: L.label.size, lineHeight: 1.2, color: style.colors.text, background: withAlpha(style.colors.scrim, 0.6), padding: '4px 14px', borderRadius: 8, whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {L.label.text}
            </span>
          )}
          <div style={{ position: 'absolute', left, top: panelTop, width: PANEL_W, height: L.panelH, borderRadius: 28, overflow: 'hidden', background: C.chat, ...cardStyle(A('panel'), progress(frame, w.panel.start, w.panel.dur)) }}>
            <div style={{ height: HEADER_H, background: C.header, display: 'flex', alignItems: 'center', gap: 22, padding: '0 28px' }}>
              <div {...leaf('avatar', 'avatar_url')} style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: style.colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {avatar ? <Img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: 30, color: style.colors.on_accent }}>{L.name.text.slice(0, 1).toUpperCase()}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span {...leaf('name', 'contact_name')} style={{ fontFamily: fontFor(S.contact_name.weight), fontWeight: S.contact_name.weight, fontSize: L.name.size, lineHeight: 1.2, color: C.inInk === '#111111' ? '#111111' : '#E9EDEF', whiteSpace: 'nowrap' }}>{L.name.text}</span>
                {L.status && <span {...leaf('status', 'status')} style={{ fontFamily: fontFor(500), fontWeight: 500, fontSize: L.status.size, lineHeight: 1.2, color: C.meta, whiteSpace: 'nowrap' }}>{L.status.text}</span>}
              </div>
            </div>
            <div style={{ position: 'relative', height: L.panelH - HEADER_H, overflow: 'hidden' }}>
              {messages.map((m, i) => {
                const b0 = L.bubbles[i];
                // scroll: move towards the offset of the newest message that has appeared
                let offset = 0;
                messages.forEach((_, k) => {
                  const kw = w[`msg${k}`];
                  if (kw && frame >= kw.start) {
                    const prev = k > 0 ? L.scrollAt[k - 1] : 0;
                    offset = prev + (L.scrollAt[k] - prev) * Math.min(1, progress(frame, kw.start, kw.dur));
                  }
                });
                if (b0.y < offset + 23.5) return null; // above the first visible bubble: scrolled out of view
                const b = { ...b0, y: b0.y - offset };
                const mw = w[`msg${i}`];
                const tw = w[`typing${i}`];
                const out = m.side === 'out';
                const x = out ? PANEL_W - 28 - b.w : 28;
                const typingOn = tw && frame >= tw.start && frame < mw.start;
                return (
                  <div key={i}>
                    {typingOn && (
                      <div style={{ position: 'absolute', left: 28, top: b.y, height: 56, width: 110, borderRadius: 22, background: C.inBg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        {[0, 1, 2].map((d) => (
                          <div key={d} style={{ width: 12, height: 12, borderRadius: 6, background: C.meta, opacity: 0.4 + 0.6 * Math.abs(Math.sin((frame - tw.start) / 4 + d)) }} />
                        ))}
                      </div>
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        left: x,
                        top: b.y,
                        width: b.w,
                        height: b.h,
                        boxSizing: 'border-box',
                        padding: `${BUBBLE_PAD_Y}px ${BUBBLE_PAD_X}px`,
                        borderRadius: out ? '22px 22px 6px 22px' : '22px 22px 22px 6px',
                        background: out ? C.outBg : C.inBg,
                        transformOrigin: out ? 'right bottom' : 'left bottom',
                        ...cardStyle(A('bubbles'), progress(frame, mw.start, mw.dur)),
                      }}
                    >
                      {b.lines.map((l, k) => (
                        <div key={k} {...leaf(`msg-${i}-${k}`, `messages[${i}].text`)} style={{ fontFamily: fontFor(F.text.weight), fontWeight: F.text.weight, fontSize: l.size, lineHeight: F.text.lineHeight, color: out ? C.outInk : C.inInk, whiteSpace: 'nowrap', width: 'fit-content' }}>
                          {l.text}
                        </div>
                      ))}
                      {b.time && <span {...leaf(`time-${i}`, `messages[${i}].time`)} style={{ position: 'absolute', right: BUBBLE_PAD_X - 8, bottom: 10, fontFamily: fontFor(500), fontWeight: 500, fontSize: b.time.size, lineHeight: 1.2, color: out && look === 'blue' ? '#DDEBFF' : C.meta, whiteSpace: 'nowrap' }}>{b.time.text}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const UI04ChatConversation = withAutoFit(UI04ChatConversationBase);
