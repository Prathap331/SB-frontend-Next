'use client';

/**
 * VO-29 · Source Citation  (animation_type: "vo_source_citation")   — overlay on footage
 * A small, quiet source tag shown whenever a stat or claim comes from a source.
 *
 * Inputs (full list, limits and JSON Schema: VO29SourceCitation.inputs.json):
 *   source (required) · date · prefix_label · icon · position · look
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [source]
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

export const VO29_SPEC: TemplateSpec = {
  id: 'VO-29',
  animationType: 'vo_source_citation',
  name: 'Source Citation',
  pickWhen: 'Whenever a number, quote or claim on screen comes from a source — attach it for credibility.',
  placement: 'overlay',
  duration: OVERLAY_DURATION,
  text: {
    source: { label: 'Source', required: true, minChars: 3, maxChars: 48, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 1, fontMax: 26, fontMin: 18, weight: 600, lineHeight: 1.2, hint: '"RBI Annual Report", "The Hindu".', fills: 'Source name', example: 'RBI Annual Report' },
    date: { label: 'Date', required: false, minChars: 2, maxChars: 20, minWords: 1, maxWords: 4, maxWordChars: 12, maxLines: 1, fontMax: 26, fontMin: 18, weight: 500, lineHeight: 1.2, hint: '"2024–25", "12 March 2025".', fills: 'Date after the source', example: '2024–25' },
    prefix_label: { label: 'Prefix label', required: false, minChars: 2, maxChars: 12, minWords: 1, maxWords: 2, maxWordChars: 12, maxLines: 1, fontMax: 26, fontMin: 18, weight: 700, lineHeight: 1.2, hint: 'Word before the source (default "Source").', fills: 'Word before the source', example: 'Source' },
  },
  icons: { icon: { label: 'Icon', required: false, fills: 'Small icon at the start', fallback: 'file-text', example: 'file-text' } },
  lists: {},
  options: {
    position: { label: 'Position', values: [...OVERLAY_POSITIONS], default: 'bottom_right', fills: 'Where the tag sits inside the safe box' },
    look: { label: 'Look', values: ['tag', 'plain'], default: 'tag', fills: 'Small dark tag, or text with shadow only' },
  },
  animations: {
    tag: { label: 'Tag', kind: 'card', target: 'the tag', default: 'fade' },
    icon: { label: 'Icon', kind: 'icon', target: 'icon', default: 'fade' },
    text: { label: 'Text', kind: 'text', target: 'source text', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the tag', default: 'fade' },
  },
  cues: { description: 'When the sourced claim is spoken.', units: ['source'] },
  colors: ['icon', 'card'],
  example: { source: 'RBI Annual Report', date: '2024–25', position: 'bottom_right' },
};

export type CiteLayout = { prefix: Line; body: Line; icon: number; w: number; h: number };
export function layoutCite(input: { source: string; date: string; prefix: string }, measure: Measure, spec: TemplateSpec = VO29_SPEC): CiteLayout {
  const T = spec.text;
  const prefix = fitText(`${input.prefix}:`, T.prefix_label, 200, measure, false).lines[0];
  const bodyText = [input.source, input.date].filter(Boolean).join(', ');
  const body = fitText(bodyText, { ...T.source, fontMax: prefix.size }, 900, measure, false).lines[0];
  const icon = Math.round(body.size * 1.05);
  const w = Math.ceil(16 + icon + 10 + measure(prefix.text, prefix.size, T.prefix_label.weight) + 8 + measure(body.text, body.size, T.source.weight) + 18);
  const h = Math.round(body.size * 1.2 + 20);
  return { prefix, body, icon, w, h };
}
export function planCite(L: CiteLayout, anims: { text: string }, duration: number, cueTimes?: number[]): Plan {
  const units: Unit[] = [
    { key: 'text', label: 'Source', start: 8, dur: textAnimFrames(anims.text, words(L.body.text).length, L.body.text.length, 12), cue: 0 },
    { key: 'tag', label: 'Tag', start: 4, dur: 12, follows: { key: 'text', offset: -4 } },
    { key: 'icon', label: 'Icon', start: 6, dur: 12, follows: { key: 'text', offset: -2 } },
  ];
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareVO29(props: Record<string, unknown>, durationInFrames: number) {
  const S = VO29_SPEC.text;
  const A = (k: string) => readAnim(props, VO29_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(VO29_SPEC, props);
  const measure = measureFor(style);
  const L = layoutCite({ source: normaliseText(readFirst(props, ['source', 'text']), S.source), date: normaliseText(readFirst(props, ['date']), S.date), prefix: normaliseText(readFirst(props, ['prefix_label']), S.prefix_label) || 'Source' }, measure, sized.spec);
  const plan = planCite(L, { text: A('text') }, durationInFrames, readCues(props));
  return { style, sized, A, L, plan, icon: readFirst(props, ['icon']) ?? 'file-text', position: opt(props, 'position', OVERLAY_POSITIONS, 'bottom_right') as OverlayPosition, look: opt(props, 'look', ['tag', 'plain'] as const, 'tag'), debug: props.show_safe_area === true };
}

export function VO29SourceCitation({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, icon, position, look, debug } = prepareVO29(props, durationInFrames);
  const w = plan.windows;
  const S = VO29_SPEC.text;
  const { left, top } = anchorBox(position, L.w, L.h);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const fill = look === 'plain' ? 'transparent' : style.custom.has('card') ? style.colors.card : withAlpha(style.colors.scrim, 0.62);
  const text = style.custom.has('muted') ? style.colors.muted : '#E8EAF6';
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          <div style={{ position: 'absolute', left, top, width: L.w, height: L.h, boxSizing: 'border-box', padding: '0 18px 0 16px', borderRadius: 10, background: fill, display: 'flex', alignItems: 'center', gap: 10, ...cardStyle(A('tag'), progress(frame, w.tag.start, w.tag.dur)) }}>
            <div {...leaf('icon', 'icon')} style={{ display: 'flex', ...iconStyle(A('icon'), progress(frame, w.icon.start, w.icon.dur)) }}>
              <LucideIconView name={icon} size={L.icon} color={style.custom.has('icon') ? style.colors.icon : style.colors.accent} />
            </div>
            <span {...leaf('prefix', 'prefix_label')} style={{ fontFamily: fontFor(S.prefix_label.weight), fontWeight: S.prefix_label.weight, fontSize: L.prefix.size, lineHeight: 1.2, color: style.colors.accent, whiteSpace: 'nowrap', textShadow: FOOTAGE_SHADOW, opacity: progress(frame, w.text.start, 8) }}>
              {L.prefix.text}
            </span>
            <AnimatedText lines={[L.body]} anim={A('text')} start={w.text.start} dur={w.text.dur} frame={frame} weight={S.source.weight} lineHeight={1.2} color={text} shadow={FOOTAGE_SHADOW} group="source" input="source, date" />
          </div>
        </div>
      </SafeArea>
    </div>
  );
}
