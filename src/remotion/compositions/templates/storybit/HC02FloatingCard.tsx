'use client';

/**
 * HC-02 · Media + Floating Card  (animation_type: "hc_floating_card")
 * The footage (or a picture) keeps playing while a glass info card floats in on one side: a header with
 * icon + title, then either 1–4 bullet points or one big stat, and an optional source line.
 * For explaining what is on screen without cutting away from it.
 *
 * Inputs (full list, limits and JSON Schema: HC02FloatingCard.inputs.json):
 *   title (required) · points[] { text } · value · value_label · source · icon · image_url · side · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [card, point 1…4 / value, source]
 * Give points OR value (value wins if both). Timing: 3–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec, type TextSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, iconStyle, progress } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, StoryBackground, leaf, readFirst } from './core/shared';

const POINT: TextSpec = { label: 'Point', required: true, minChars: 2, maxChars: 70, minWords: 1, maxWords: 13, maxWordChars: 18, maxLines: 2, fontMax: 32, fontMin: 20, weight: 600, lineHeight: 1.3, fills: 'One bullet point' };

export const HC02_SPEC: TemplateSpec = {
  id: 'HC-02',
  animationType: 'hc_floating_card',
  name: 'Media + Floating Card',
  pickWhen: 'Explaining what is on screen while the footage keeps playing: key facts about a place, product or event.',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 180, max: 240 },
  text: {
    title: { label: 'Title', required: true, minChars: 2, maxChars: 40, minWords: 1, maxWords: 7, maxWordChars: 18, maxLines: 2, fontMax: 44, fontMin: 28, weight: 800, lineHeight: 1.1, fills: 'Card title', example: 'Chenab Rail Bridge' },
    value: { label: 'Value', required: false, minChars: 1, maxChars: 14, minWords: 1, maxWords: 3, maxWordChars: 12, maxLines: 1, fontMax: 110, fontMin: 56, weight: 800, lineHeight: 1, hint: 'One big stat instead of points: "359 m".', fills: 'Big stat', noSize: true },
    value_label: { label: 'Value label', required: false, minChars: 2, maxChars: 50, minWords: 1, maxWords: 9, maxWordChars: 18, maxLines: 2, fontMax: 30, fontMin: 20, weight: 600, lineHeight: 1.25, fills: 'Line under the big stat' },
    source: { label: 'Source', required: false, minChars: 3, maxChars: 50, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 1, fontMax: 20, fontMin: 15, weight: 500, lineHeight: 1.25, fills: 'Source line at the bottom of the card' },
  },
  icons: { icon: { label: 'Icon', required: false, fills: 'Icon next to the title', fallback: 'info', example: 'train' } },
  lists: { points: { label: 'Point', fills: 'Bullet points (when there is no value)', minItems: 1, maxItems: 4, optional: true, fields: { text: POINT } } },
  options: {
    side: { label: 'Side', values: ['right', 'left'], default: 'right', fills: 'Which side the card floats on' },
    background: { label: 'Background', values: ['transparent', 'image', 'theme'], default: 'transparent', fills: 'Over footage (default), image_url, or theme gradient' },
  },
  animations: {
    card: { label: 'Card', kind: 'card', target: 'the floating card', default: 'slide_left' },
    icon: { label: 'Icon', kind: 'icon', target: 'title icon', default: 'pop' },
    points: { label: 'Points', kind: 'card', target: 'each point / the stat', default: 'slide_up' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the card', default: 'fade' },
  },
  cues: { description: 'Fixed slots: card → point 1…4 (or the value in slot 1) → source.', units: ['card', 'point 1', 'point 2', 'point 3', 'point 4', 'source'] },
  colors: ['icon', 'icon_bg', 'card'],
  example: { title: 'Chenab Rail Bridge', icon: 'train', points: [{ text: 'World’s highest railway arch bridge (as reported)' }, { text: 'In Jammu & Kashmir' }, { text: 'Opened in 2025' }], source: 'Source: replace with the real source', side: 'right', background: 'transparent' },
};

export const CARD_W = 680;
export const PAD = 36;
export type FloatLayout = { title: Line[]; points: Line[][]; value?: Line; valueLabel: Line[]; source?: Line; cardH: number; icon: number };

export function layoutFloat(input: { title: string; points: string[]; value: string; valueLabel: string; source: string }, measure: Measure, spec: TemplateSpec = HC02_SPEC): FloatLayout {
  const T = spec.text;
  const inner = CARD_W - PAD * 2;
  const icon = 56;
  const title = fitText(input.title, T.title, inner - icon - 16, measure).lines;
  const source = input.source ? fitText(input.source, T.source, inner, measure, false).lines[0] : undefined;
  const value = input.value ? fitText(input.value, T.value, inner, measure, false).lines[0] : undefined;
  const valueLabel = value && input.valueLabel ? fitText(input.valueLabel, T.value_label, inner, measure).lines : [];
  const headH = Math.max(icon, blockHeight(title, T.title.lineHeight)) + 24;
  const srcH = source ? source.size * 1.25 + 20 : 0;
  let cap = POINT.fontMax;
  for (;;) {
    const f = sharedFont(input.points, POINT, inner - 36, measure, cap);
    const points = value ? [] : input.points.map((p) => linesAt(p, f, POINT, inner - 36, measure));
    const bodyH = value ? value.size + 12 + blockHeight(valueLabel, T.value_label.lineHeight) : points.reduce((a, p) => a + blockHeight(p, POINT.lineHeight) + 18, 0);
    const cardH = Math.ceil(PAD * 2 + headH + bodyH + srcH);
    if (cardH <= SAFE_H || cap <= POINT.fontMin) return { title, points, value, valueLabel, source, cardH: Math.min(cardH, SAFE_H), icon };
    cap -= 2;
  }
}

export function planFloat(L: FloatLayout, duration: number, cueTimes?: number[]): Plan {
  const n = L.value ? 1 : L.points.length;
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const gap = n > 1 ? Math.max(6, Math.min(24, Math.floor((budget - 20 - 30) / n))) : 0;
  const units: Unit[] = [{ key: 'card', label: 'Card', start: 4, dur: 16, cue: 0 }];
  for (let i = 0; i < n; i++) units.push({ key: `pt${i}`, label: L.value ? 'Value' : `Point ${i + 1}`, start: 20 + i * gap, dur: 14, cue: 1 + i });
  if (L.source) units.push({ key: 'source', label: 'Source', start: 22 + n * gap, dur: 12, cue: 5 });
  units.push({ key: 'icon', label: 'Icon', start: 10, dur: 12, follows: { key: 'card', offset: 6 } });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareHC02(props: Record<string, unknown>, durationInFrames: number) {
  const S = HC02_SPEC.text;
  const A = (k: string) => readAnim(props, HC02_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(HC02_SPEC, props);
  const measure = measureFor(style);
  const points = (Array.isArray(props.points) ? props.points : []).map((x) => normaliseText(typeof x === 'string' ? x : x && typeof x === 'object' && typeof (x as Record<string, unknown>).text === 'string' ? ((x as Record<string, unknown>).text as string) : '', POINT)).filter(Boolean).slice(0, 4);
  const valueRaw = typeof props.value === 'number' ? String(props.value) : readFirst(props, ['value']);
  const L = layoutFloat({ title: normaliseText(readFirst(props, ['title']), S.title), points, value: normaliseText(valueRaw, S.value), valueLabel: normaliseText(readFirst(props, ['value_label']), S.value_label), source: normaliseText(readFirst(props, ['source']), S.source) }, measure, sized.spec);
  const plan = planFloat(L, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  const bgRaw = opt(props, 'background', ['transparent', 'image', 'theme'] as const, 'transparent');
  const bg = bgRaw === 'image' && imageUrl ? 'image' : bgRaw === 'theme' ? 'theme' : 'transparent';
  return { style, sized, A, L, plan, icon: readFirst(props, ['icon']) ?? 'info', side: opt(props, 'side', ['right', 'left'] as const, 'right'), imageUrl, bg: bg as 'image' | 'theme' | 'transparent', debug: props.show_safe_area === true };
}

export function HC02FloatingCard({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, icon, side, imageUrl, bg, debug } = prepareHC02(props, durationInFrames);
  const w = plan.windows;
  const S = HC02_SPEC.text;
  const accent = style.colors.accent;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const left = side === 'right' ? SAFE_W - CARD_W : 0;
  const top = (SAFE_H - L.cardH) / 2;
  const fill = style.custom.has('card') ? style.colors.card : withAlpha(style.colors.scrim, 0.78);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      {bg !== 'transparent' && <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />}
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', left, top, width: CARD_W, height: L.cardH, ...exit }}>
          <div style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', padding: PAD, borderRadius: 28, background: fill, border: `1.5px solid ${withAlpha('#FFFFFF', 0.14)}`, borderLeft: `6px solid ${accent}`, display: 'flex', flexDirection: 'column', ...cardStyle(A('card'), progress(frame, w.card.start, w.card.dur)) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div {...leaf('icon', 'icon')} style={{ width: L.icon, height: L.icon, borderRadius: 14, background: style.colors.icon_bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...iconStyle(A('icon'), progress(frame, w.icon.start, w.icon.dur)) }}>
                <LucideIconView name={icon} size={30} color={style.colors.icon} />
              </div>
              <AnimatedText lines={L.title} anim="none" start={w.card.start} dur={1} frame={frame} weight={800} lineHeight={S.title.lineHeight} color="#FFFFFF" shadow="none" group="title" input="title" />
            </div>
            {L.value && w.pt0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', ...cardStyle(A('points'), progress(frame, w.pt0.start, w.pt0.dur)) }}>
                <span {...leaf('value', 'value')} style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: L.value.size, lineHeight: 1, color: accent, whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>{L.value.text}</span>
                {L.valueLabel.length > 0 && <AnimatedText lines={L.valueLabel} anim="none" start={w.pt0.start} dur={1} frame={frame} weight={S.value_label.weight} lineHeight={S.value_label.lineHeight} color="#E8EAF6" shadow="none" group="value-label" input="value_label" style={{ marginTop: 12 }} />}
              </div>
            ) : (
              L.points.map((p, i) => {
                const pw = w[`pt${i}`];
                return (
                  <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 18, ...cardStyle(A('points'), progress(frame, pw.start, pw.dur)) }}>
                    <div style={{ width: 12, height: 12, borderRadius: 6, background: accent, marginTop: p[0].size * 0.45, flexShrink: 0 }} />
                    <AnimatedText lines={p} anim="none" start={pw.start} dur={1} frame={frame} weight={POINT.weight} lineHeight={POINT.lineHeight} color="#F2F3F8" shadow="none" group={`point-${i}`} input={`points[${i}].text`} />
                  </div>
                );
              })
            )}
            {L.source && w.source && <span {...leaf('source', 'source')} style={{ marginTop: 'auto', paddingTop: 8, fontFamily: fontFor(500), fontWeight: 500, fontSize: L.source.size, lineHeight: 1.25, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap', opacity: progress(frame, w.source.start, w.source.dur) }}>{L.source.text}</span>}
          </div>
        </div>
      </SafeArea>
    </div>
  );
}
