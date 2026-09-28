'use client';

/**
 * UI-12 · Notification Pop  (animation_type: "ui_notification")   — overlay on footage
 * 1–3 phone-style notifications sliding in: app name, title, message and time — alerts, bank SMS
 * ("₹50,000 debited"), app pings. Generic look-alike styling. Mark recreated ones in the narration.
 *
 * Inputs (full list, limits and JSON Schema: UI12NotificationPop.inputs.json):
 *   notifications[] { app, title, body, time, icon } · position · look
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [notification 1, 2, 3]
 * Timing: 1.5–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, iconStyle, progress } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { OVERLAY_DURATION } from './core/overlay';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, readStyle, styleVars, withAlpha } from './core/style';
import { leaf } from './core/shared';

export const UI12_SPEC: TemplateSpec = {
  id: 'UI-12',
  animationType: 'ui_notification',
  name: 'Notification Pop',
  pickWhen: 'A phone alert moment: a bank debit SMS, an app ping, a news alert, an OTP message.',
  placement: 'overlay',
  duration: OVERLAY_DURATION,
  text: {},
  lists: {
    notifications: {
      label: 'Notification',
      fills: 'Notifications, first one on top',
      minItems: 1,
      maxItems: 3,
      icon: { required: false, fallback: 'bell' },
      fields: {
        app: { label: 'App', required: true, minChars: 2, maxChars: 20, minWords: 1, maxWords: 3, maxWordChars: 14, maxLines: 1, fontMax: 24, fontMin: 18, weight: 600, lineHeight: 1.2, hint: 'App or sender: "Bank", "Messages".', fills: 'App name' },
        title: { label: 'Title', required: false, minChars: 2, maxChars: 36, minWords: 1, maxWords: 7, maxWordChars: 16, maxLines: 1, fontMax: 30, fontMin: 22, weight: 700, lineHeight: 1.2, hint: 'Bold first line.', fills: 'Notification title' },
        body: { label: 'Body', required: true, minChars: 3, maxChars: 100, minWords: 1, maxWords: 20, maxWordChars: 16, maxLines: 2, fontMax: 28, fontMin: 20, weight: 500, lineHeight: 1.3, hint: '"₹50,000 debited from A/c XX1234".', fills: 'Notification message' },
        time: { label: 'Time', required: false, minChars: 2, maxChars: 10, minWords: 1, maxWords: 2, maxWordChars: 8, maxLines: 1, fontMax: 22, fontMin: 16, weight: 500, lineHeight: 1.2, hint: '"now", "2m ago".', fills: 'Time on the right' },
      },
    },
  },
  options: {
    position: { label: 'Position', values: ['top_center', 'top_right', 'top_left'], default: 'top_center', fills: 'Where the notifications appear' },
    look: { label: 'Look', values: ['dark', 'light'], default: 'dark', fills: 'Dark or light frosted card' },
  },
  animations: {
    cards: { label: 'Cards', kind: 'card', target: 'each notification', default: 'slide_up' },
    icons: { label: 'Icons', kind: 'icon', target: 'app icon', default: 'pop' },
    exit: { label: 'Exit', kind: 'exit', target: 'all notifications', default: 'fade' },
  },
  cues: { description: 'One cue per notification.', units: ['notification 1', 'notification 2', 'notification 3'] },
  colors: [],
  example: { notifications: [{ app: 'Bank', title: 'Debit alert', body: '₹50,000 debited from A/c XX1234. Not you? Call your bank.', time: 'now', icon: 'banknote' }], position: 'top_center', look: 'dark' },
};

export type Note = { app: string; title?: string; body: string; time?: string; icon?: string };
export const CARD_W = 820;
export const PAD = 22;
export const ICON = 56;
export type NoteLayout = { cards: { app: Line; title?: Line; body: Line[]; time?: Line; h: number }[] };

export function layoutNotes(input: { notes: Note[] }, measure: Measure, spec: TemplateSpec = UI12_SPEC): NoteLayout {
  const F = spec.lists.notifications.fields;
  const textW = CARD_W - PAD * 2 - ICON - 18;
  let cap = F.body.fontMax;
  for (;;) {
    const bf = sharedFont(input.notes.map((n) => n.body), F.body, textW, measure, cap);
    const cards = input.notes.map((n) => {
      const time = n.time ? fitText(n.time, F.time, 140, measure, false).lines[0] : undefined;
      const app = fitText(n.app, F.app, textW - (time ? 150 : 0), measure, false).lines[0];
      const title = n.title ? fitText(n.title, F.title, textW, measure, false).lines[0] : undefined;
      const body = linesAt(n.body, bf, F.body, textW, measure);
      const h = Math.ceil(PAD * 2 + app.size * 1.2 + 6 + (title ? title.size * 1.2 : 0) + blockHeight(body, F.body.lineHeight));
      return { app, title, body, time, h };
    });
    const total = cards.reduce((a, c) => a + c.h, 0) + 14 * (cards.length - 1);
    if (total <= SAFE_H || cap <= F.body.fontMin) return { cards };
    cap -= 2;
  }
}
export function planNotes(n: number, duration: number, cueTimes?: number[]): Plan {
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const gap = n > 1 ? Math.max(8, Math.min(30, Math.floor((budget - 6 - 16) / (n - 1)))) : 0;
  const units: Unit[] = [];
  for (let i = 0; i < n; i++) {
    units.push({ key: `note${i}`, label: `Notification ${i + 1}`, start: 6 + i * gap, dur: 14, cue: i });
    units.push({ key: `note${i}_icon`, label: `Notification ${i + 1} icon`, start: 10 + i * gap, dur: 12, follows: { key: `note${i}`, offset: 4 } });
  }
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareUI12(props: Record<string, unknown>, durationInFrames: number) {
  const F = UI12_SPEC.lists.notifications.fields;
  const A = (k: string) => readAnim(props, UI12_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(UI12_SPEC, props);
  const measure = measureFor(style);
  const s = (o: Record<string, unknown>, k: string) => (typeof o[k] === 'string' && (o[k] as string).trim() ? (o[k] as string) : undefined);
  const notes: Note[] = (Array.isArray(props.notifications) ? props.notifications : [])
    .map((x): Note | null => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const app = normaliseText(s(o, 'app'), F.app);
      const body = normaliseText(s(o, 'body'), F.body);
      return app && body ? { app, body, title: normaliseText(s(o, 'title'), F.title) || undefined, time: normaliseText(s(o, 'time'), F.time) || undefined, icon: s(o, 'icon') } : null;
    })
    .filter((x): x is Note => x !== null)
    .slice(0, 3);
  const L = layoutNotes({ notes }, measure, sized.spec);
  const plan = planNotes(notes.length, durationInFrames, readCues(props));
  return { style, sized, A, notes, L, plan, position: opt(props, 'position', ['top_center', 'top_right', 'top_left'] as const, 'top_center'), light: opt(props, 'look', ['dark', 'light'] as const, 'dark') === 'light', debug: props.show_safe_area === true };
}

export function UI12NotificationPop({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, notes, L, plan, position, light, debug } = prepareUI12(props, durationInFrames);
  const w = plan.windows;
  const F = UI12_SPEC.lists.notifications.fields;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const left = position === 'top_left' ? 0 : position === 'top_right' ? SAFE_W - CARD_W : (SAFE_W - CARD_W) / 2;
  const bg = light ? 'rgba(245,245,247,0.92)' : 'rgba(30,32,40,0.9)';
  const ink = light ? '#111111' : '#F4F5F8';
  const meta = light ? '#6B6F7A' : '#A4A9B6';
  let y = 0;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {notes.map((n, i) => {
            const c = L.cards[i];
            const top = y;
            y += c.h + 14;
            const nw = w[`note${i}`];
            const iw = w[`note${i}_icon`];
            // slides down from above (starting inside the safe box so nothing crosses the margin)
            const p = progress(frame, nw.start, nw.dur);
            return (
              <div key={i} style={{ position: 'absolute', left, top, width: CARD_W, height: c.h, boxSizing: 'border-box', padding: PAD, borderRadius: 28, background: bg, display: 'flex', gap: 18, ...cardStyle(A('cards'), p) }}>
                <div {...leaf(`icon-${i}`, `notifications[${i}].icon`)} style={{ width: ICON, height: ICON, borderRadius: 14, background: style.colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...iconStyle(A('icons'), progress(frame, iw.start, iw.dur)) }}>
                  <LucideIconView name={n.icon ?? 'bell'} size={30} color={style.colors.on_accent} />
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span {...leaf(`app-${i}`, `notifications[${i}].app`)} style={{ fontFamily: fontFor(F.app.weight), fontWeight: F.app.weight, fontSize: c.app.size, lineHeight: 1.2, color: meta, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.app.text}</span>
                    {c.time && <span {...leaf(`time-${i}`, `notifications[${i}].time`)} style={{ fontFamily: fontFor(500), fontWeight: 500, fontSize: c.time.size, lineHeight: 1.2, color: meta, whiteSpace: 'nowrap' }}>{c.time.text}</span>}
                  </div>
                  {c.title && <span {...leaf(`title-${i}`, `notifications[${i}].title`)} style={{ fontFamily: fontFor(F.title.weight), fontWeight: F.title.weight, fontSize: c.title.size, lineHeight: 1.2, color: ink, whiteSpace: 'nowrap' }}>{c.title.text}</span>}
                  {c.body.map((l, k) => (
                    <span key={k} {...leaf(`body-${i}-${k}`, `notifications[${i}].body`)} style={{ fontFamily: fontFor(F.body.weight), fontWeight: F.body.weight, fontSize: l.size, lineHeight: F.body.lineHeight, color: withAlpha(ink, 0.92), whiteSpace: 'nowrap', width: 'fit-content' }}>{l.text}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SafeArea>
    </div>
  );
}
