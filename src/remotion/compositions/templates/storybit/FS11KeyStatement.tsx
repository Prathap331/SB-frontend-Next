'use client';

/**
 * FS-11 · Key Statement  (animation_type: "fs_key_statement")
 * One emphasised statement — a thesis, warning, takeaway or "here's the thing" line — with an
 * optional emphasised phrase (colour, marker sweep or underline), an optional label pill and an
 * optional explanation line.
 *
 * Inputs (full list, limits and JSON Schema: FS11KeyStatement.inputs.json):
 *   statement (required) · highlight · explanation · label · icon · image_url
 *   emphasis · align · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [statement, highlight, explanation]
 * Timing: 3–8s from clock.durationInFrames. Everything stays inside the 100px safe margin.
 */
import type { CSSProperties } from 'react';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type Issue, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, words, type Line, type Measure } from './core/fit';
import { cardStyle, easeInOutCubic, exitStyle, progress, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { cardColors, fontFor, mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, highlightWords, leaf, readBgMode, readFirst, type HighlightStyle } from './core/shared';
import { withAutoFit } from './core/autofit';

/* ================================================================== */
/* Content spec                                                         */
/* ================================================================== */

export const FS11_SPEC: TemplateSpec = {
  id: 'FS-11',
  animationType: 'fs_key_statement',
  name: 'Key Statement',
  pickWhen: 'A thesis, warning, takeaway or "here\'s the thing" moment the viewer must remember.',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 120, max: 240 },
  text: {
    statement: {
      label: 'Statement',
      required: true,
      minChars: 5,
      maxChars: 80,
      minWords: 2,
      maxWords: 14,
      maxWordChars: 18,
      maxLines: 3,
      fontMax: 110,
      fontMin: 56,
      weight: 800,
      lineHeight: 1.12,
      hint: 'One clear sentence, no more than 14 words.',
      fills: 'The big statement',
      example: 'Your salary is not your wealth.',
    },
    highlight: {
      label: 'Highlight',
      required: false,
      minChars: 2,
      maxChars: 40,
      minWords: 1,
      maxWords: 6,
      maxWordChars: 18,
      maxLines: 1,
      fontMax: 110,
      fontMin: 56,
      weight: 800,
      lineHeight: 1.12,
      hint: 'Exact words from the statement to emphasise.',
      fills: 'Words of the statement that get the emphasis',
      example: 'not your wealth',
      noSize: true,
    },
    explanation: {
      label: 'Explanation',
      required: false,
      minChars: 10,
      maxChars: 140,
      minWords: 3,
      maxWords: 24,
      maxWordChars: 18,
      maxLines: 3,
      fontMax: 40,
      fontMin: 28,
      weight: 500,
      lineHeight: 1.4,
      hint: 'One or two short sentences that explain the statement.',
      fills: 'Supporting line under the statement',
      example: 'What you keep and invest decides how rich you become.',
    },
    label: {
      label: 'Label',
      required: false,
      minChars: 2,
      maxChars: 20,
      minWords: 1,
      maxWords: 3,
      maxWordChars: 16,
      maxLines: 1,
      fontMax: 30,
      fontMin: 22,
      weight: 700,
      lineHeight: 1.2,
      hint: 'Small tag above: "Key takeaway", "Warning", "Remember".',
      fills: 'Pill above the statement',
      example: 'Key takeaway',
    },
  },
  icons: {
    icon: { label: 'Label icon', required: false, fills: 'Icon inside the label pill', fallback: 'none (text only)', example: 'lightbulb' },
  },
  lists: {},
  options: {
    emphasis: {
      label: 'Emphasis',
      values: ['marker', 'underline', 'color'],
      default: 'marker',
      fills: 'How the highlight is drawn: marker sweep behind the words · underline sweep · accent-coloured words',
    },
    align: { label: 'Align', values: ['center', 'left'], default: 'center', fills: 'Horizontal alignment' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    label: { label: 'Label pill', kind: 'card', target: 'label pill above the statement', default: 'slide_up' },
    statement: { label: 'Statement', kind: 'text', target: 'the statement (each line, or word by word)', default: 'rise' },
    highlight: { label: 'Emphasis', kind: 'shape', target: 'marker / underline sweep over the highlighted words', default: 'grow' },
    explanation: { label: 'Explanation', kind: 'text', target: 'explanation line', default: 'fade_up' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: {
    description: 'statement = when the line starts; highlight = when the emphasised words are spoken; explanation = when it starts. Missing elements are skipped.',
    units: ['statement', 'highlight', 'explanation'],
  },
  colors: ['icon', 'card', 'card_border', 'on_accent'],
  validate: (props) => {
    const issues: Issue[] = [];
    const st = typeof props.statement === 'string' ? props.statement.trim().replace(/\s+/g, ' ') : '';
    const h = typeof props.highlight === 'string' ? props.highlight.trim() : '';
    if (h && st && highlightWords([{ text: st, size: 0 }], h).size === 0)
      issues.push({ field: 'highlight', level: 'warning', message: 'Highlight phrase is not in the statement — nothing is emphasised' });
    return issues;
  },
  example: {
    label: 'Key takeaway',
    icon: 'lightbulb',
    statement: 'Your salary is not your wealth.',
    highlight: 'not your wealth',
    explanation: 'What you keep and invest decides how rich you become.',
    emphasis: 'marker',
    align: 'center',
    background: 'theme',
    cue_times: [0.2, 1.1, 1.9],
  },
};

/* ================================================================== */
/* Layout                                                               */
/* ================================================================== */

export const CENTER_MAX_W = 1600;
export const LABEL_GAP = 36;
export const EXPLAIN_GAP = 40;

export type StatementLayout = {
  width: number;
  label: Line[];
  labelFont: number;
  pillH: number;
  iconSize: number;
  statement: Line[];
  explanation: Line[];
  blockH: number;
};

export function layoutStatement(
  input: { statement: string; explanation: string; label: string; hasIcon: boolean; align: 'center' | 'left' },
  measure: Measure,
  spec: TemplateSpec = FS11_SPEC,
): StatementLayout {
  const T = spec.text;
  const width = input.align === 'center' ? CENTER_MAX_W : SAFE_W;
  const lab = input.label ? fitText(input.label, T.label, width * 0.6, measure, false) : null;
  const labelFont = lab ? lab.font : 0;
  const iconSize = lab && input.hasIcon ? Math.round(labelFont * 1.05) : 0;
  const pillH = lab ? Math.round(labelFont * 1.2 + labelFont * 0.9) : 0;
  let stCap = T.statement.fontMax;
  let exCap = T.explanation.fontMax;
  const build = () => {
    const st = fitText(input.statement, T.statement, width, measure, true, stCap).lines;
    const ex = input.explanation ? fitText(input.explanation, T.explanation, width, measure, true, exCap).lines : [];
    const h = (pillH ? pillH + LABEL_GAP : 0) + blockHeight(st, T.statement.lineHeight) + (ex.length ? EXPLAIN_GAP + blockHeight(ex, T.explanation.lineHeight) : 0);
    return { st, ex, h };
  };
  let b = build();
  // shrink order: explanation → statement, until the stack fits the 880px safe height
  while (b.h > SAFE_H && (exCap > T.explanation.fontMin || stCap > T.statement.fontMin)) {
    if (exCap > T.explanation.fontMin) exCap -= 2;
    else stCap -= 4;
    b = build();
  }
  return { width, label: lab ? lab.lines : [], labelFont, pillH, iconSize, statement: b.st, explanation: b.ex, blockH: b.h };
}

/* ================================================================== */
/* Timing                                                               */
/* ================================================================== */

export function planStatement(
  L: StatementLayout,
  anims: { statement: string; explanation: string },
  hasHighlight: boolean,
  duration: number,
  cueTimes?: number[],
): Plan {
  const T = (lines: Line[]) => lines.map((l) => l.text).join(' ');
  const st = T(L.statement);
  const sDur = textAnimFrames(anims.statement, words(st).length, st.length, Math.round(18 * (1 + 0.33 * (L.statement.length - 1))));
  const sStart = L.label.length ? 10 : 4;
  const units: Unit[] = [];
  let cue = 0;
  units.push({ key: 'statement', label: 'Statement', start: sStart, dur: sDur, cue: cue++ });
  let next = sStart + sDur + 2;
  if (hasHighlight) {
    units.push({ key: 'highlight', label: 'Emphasis', start: next, dur: 16, cue: cue++ });
    next += 10;
  }
  if (L.explanation.length) {
    const ex = T(L.explanation);
    units.push({ key: 'explanation', label: 'Explanation', start: next, dur: textAnimFrames(anims.explanation, words(ex).length, ex.length, 18), cue: cue++ });
  }
  if (L.label.length) units.push({ key: 'label', label: 'Label pill', start: 2, dur: 14, follows: { key: 'statement', offset: -8 } });
  return planTimeline(duration, units, cueTimes);
}

/* ================================================================== */
/* Props → layout → plan (shared by the renderer and the preview)       */
/* ================================================================== */

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareFS11(props: Record<string, unknown>, durationInFrames: number) {
  const S = FS11_SPEC.text;
  const A = (k: string) => readAnim(props, FS11_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(FS11_SPEC, props);
  const measure = measureFor(style);
  const statement = normaliseText(readFirst(props, ['statement', 'text', 'title']), S.statement);
  const explanation = normaliseText(readFirst(props, ['explanation', 'subtitle', 'description']), S.explanation);
  const label = normaliseText(readFirst(props, ['label', 'kicker']), S.label);
  const highlightRaw = normaliseText(readFirst(props, ['highlight']), S.highlight);
  const icon = readFirst(props, ['icon', 'icon_name']);
  const align = opt(props, 'align', ['center', 'left'] as const, 'center');
  const emphasis = opt(props, 'emphasis', ['marker', 'underline', 'color'] as const, 'marker');
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const debug = props.show_safe_area === true;
  const L = layoutStatement({ statement, explanation, label, hasIcon: Boolean(icon), align }, measure, sized.spec);
  const highlight = highlightWords(L.statement, highlightRaw).size ? highlightRaw : '';
  const plan = planStatement(L, { statement: A('statement'), explanation: A('explanation') }, Boolean(highlight), durationInFrames, readCues(props));
  return { style, sized, S, A, icon, align, emphasis, highlight, imageUrl, bg, debug, L, plan };
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */

function FS11KeyStatementBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, S, A, icon, align, emphasis, highlight, imageUrl, bg, debug, L, plan } = prepareFS11(props, durationInFrames);
  const w = plan.windows;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const muted = mutedFor(style, onFootage);
  const card = cardColors(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const items = align === 'center' ? 'center' : 'flex-start';

  // emphasis: words sweep one after another inside the highlight window
  const hw = w.highlight;
  const hAnim = A('highlight');
  const hp = hw ? progress(frame, hw.start, hw.dur) : 0;
  const wordP = (order: number, count: number) => {
    if (hAnim === 'none') return hp > 0 ? 1 : 0;
    if (hAnim === 'fade' || hAnim === 'pop') return hp;
    return easeInOutCubic(Math.min(1, Math.max(0, hp * count - order)));
  };
  const markerStyle: HighlightStyle = (order, count) => {
    const q = wordP(order, count);
    if (emphasis === 'color') return { color: q > 0 ? accent : undefined, transition: 'none' };
    const bar = emphasis === 'marker' ? '82%' : '0.11em';
    const pos = emphasis === 'marker' ? 'left 55%' : 'left 94%';
    const fadeA = hAnim === 'fade' || hAnim === 'pop' ? q : 1;
    const sweep = hAnim === 'fade' || hAnim === 'pop' ? 1 : q;
    const ink: CSSProperties = emphasis === 'marker' && q > 0.55 ? { color: style.colors.on_accent, textShadow: 'none' } : {};
    return {
      backgroundImage: `linear-gradient(${withAlpha(accent, fadeA)}, ${withAlpha(accent, fadeA)})`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: pos,
      backgroundSize: `${sweep * 100}% ${bar}`,
      borderRadius: emphasis === 'marker' ? '0.08em' : 0,
      ...ink,
    };
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground
        mode={bg}
        imageUrl={imageUrl}
        align={align}
        accent={accent}
        frame={frame}
        durationInFrames={durationInFrames}
        colors={style.colors}
        motion={A('image_motion')}
        entry={A('image_entry')}
      />

      <SafeArea debug={debug}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: items,
            ...exit,
          }}
        >
          <div style={{ width: L.width, display: 'flex', flexDirection: 'column', alignItems: items, textAlign: align }}>
            {L.label.length > 0 && w.label && (
              <div
                style={{
                  height: L.pillH,
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  gap: Math.round(L.labelFont * 0.4),
                  padding: `0 ${Math.round(L.labelFont * 0.8)}px`,
                  marginBottom: LABEL_GAP,
                  borderRadius: 999,
                  background: style.custom.has('card') ? card.fill : withAlpha(accent, 0.16),
                  border: `1.5px solid ${style.custom.has('card_border') ? card.border : withAlpha(accent, 0.45)}`,
                  ...cardStyle(A('label'), progress(frame, w.label.start, w.label.dur)),
                }}
              >
                {icon && L.iconSize > 0 && (
                  <div {...leaf('label-icon', 'icon')} style={{ display: 'flex' }}>
                    <LucideIconView name={icon} size={L.iconSize} color={style.custom.has('icon') ? style.colors.icon : accent} />
                  </div>
                )}
                <span
                  {...leaf('label', 'label')}
                  style={{ fontFamily: fontFor(S.label.weight), fontSize: L.label[0].size, fontWeight: S.label.weight, lineHeight: S.label.lineHeight, color: accent, whiteSpace: 'nowrap' }}
                >
                  {L.label[0].text}
                </span>
              </div>
            )}

            <AnimatedText
              lines={L.statement}
              anim={A('statement')}
              start={w.statement.start}
              dur={w.statement.dur}
              frame={frame}
              weight={S.statement.weight}
              lineHeight={S.statement.lineHeight}
              letterSpacing="-0.02em"
              shadow={shadow}
              align={align}
              group="statement"
              input="statement"
              highlight={highlight}
              highlightStyle={markerStyle}
            />

            {L.explanation.length > 0 && w.explanation && (
              <AnimatedText
                lines={L.explanation}
                anim={A('explanation')}
                start={w.explanation.start}
                dur={w.explanation.dur}
                frame={frame}
                weight={S.explanation.weight}
                lineHeight={S.explanation.lineHeight}
                color={muted}
                shadow={shadow}
                align={align}
                group="explanation"
                input="explanation"
                style={{ marginTop: EXPLAIN_GAP }}
              />
            )}
          </div>
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const FS11KeyStatement = withAutoFit(FS11KeyStatementBase);
