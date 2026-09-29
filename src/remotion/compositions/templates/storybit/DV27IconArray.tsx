'use client';

/**
 * DV-27 · Icon Array  (animation_type: "dv_icon_array")
 * "1 in 5 Indians…": a grid of 10 / 20 / 50 / 100 identical icons where some light up, next to the big
 * figure and a one-line statement. Makes a share easy to feel. Real, sourced shares only.
 *
 * Inputs (full list, limits and JSON Schema: DV27IconArray.inputs.json):
 *   highlighted (required) · total · statement (required) · figure · icon · highlight_label · rest_label · source
 *   figure_style · image_url · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [grid, fill, statement, source]
 * Timing: 3–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type Issue, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, words, type Line, type Measure } from './core/fit';
import { exitStyle, iconStyle, progress, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { readNumber } from './core/numbers';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, guide, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

export const DV27_SPEC: TemplateSpec = {
  id: 'DV-27',
  animationType: 'dv_icon_array',
  name: 'Icon Array',
  pickWhen: '"1 in 5…", "3 out of 10…", "40% of…": a share of people or things that should be felt, not just read.',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 150, max: 240 },
  numbers: {
    highlighted: { label: 'Highlighted', required: true, fills: 'How many icons light up (out of total)', min: 0, max: 100, integer: true, example: 1 },
  },
  text: {
    statement: { label: 'Statement', required: true, minChars: 5, maxChars: 80, minWords: 2, maxWords: 14, maxWordChars: 18, maxLines: 3, fontMax: 48, fontMin: 28, weight: 700, lineHeight: 1.2, hint: 'What the share means: "Indians over 50 have diabetes".', fills: 'Line under the big figure', example: 'Indian adults have high blood pressure (illustrative)' },
    figure: { label: 'Figure', required: false, minChars: 1, maxChars: 12, minWords: 1, maxWords: 4, maxWordChars: 10, maxLines: 1, fontMax: 160, fontMin: 72, weight: 800, lineHeight: 1, hint: 'Default from the numbers: "1 in 5" or "20%".', fills: 'Big figure', noSize: true },
    highlight_label: { label: 'Highlight label', required: false, minChars: 2, maxChars: 24, minWords: 1, maxWords: 4, maxWordChars: 16, maxLines: 1, fontMax: 26, fontMin: 18, weight: 700, lineHeight: 1.2, hint: 'Legend for the lit icons: "have it".', fills: 'Legend for highlighted icons' },
    rest_label: { label: 'Rest label', required: false, minChars: 2, maxChars: 24, minWords: 1, maxWords: 4, maxWordChars: 16, maxLines: 1, fontMax: 26, fontMin: 18, weight: 600, lineHeight: 1.2, hint: 'Legend for the others: "don’t".', fills: 'Legend for the other icons' },
    source: { label: 'Source', required: false, minChars: 3, maxChars: 60, minWords: 1, maxWords: 10, maxWordChars: 18, maxLines: 1, fontMax: 22, fontMin: 16, weight: 500, lineHeight: 1.25, fills: 'Source line' },
  },
  icons: { icon: { label: 'Icon', required: false, fills: 'Icon repeated in the grid', fallback: 'user', example: 'user' } },
  lists: {},
  options: {
    total: { label: 'Total icons', values: ['10', '20', '50', '100'], default: '10', fills: 'Size of the grid (use 10 for "x in 10", 100 for percentages)' },
    figure_style: { label: 'Figure style', values: ['ratio', 'percent'], default: 'ratio', fills: 'Default figure: "1 in 5" (reduced ratio) or "20%"' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    grid: { label: 'Grid', kind: 'icon', target: 'all icons appearing', default: 'fade' },
    fill: { label: 'Fill', kind: 'shape', target: 'highlighted icons lighting up one by one', default: 'grow' },
    figure: { label: 'Figure', kind: 'text', target: 'big figure', default: 'slam' },
    statement: { label: 'Statement', kind: 'text', target: 'statement', default: 'fade_up' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'everything', default: 'fade_up' },
  },
  cues: { description: 'grid → fill (the share is said) → statement → source.', units: ['grid', 'fill', 'statement', 'source'] },
  colors: [],
  validate: (props) => {
    const issues: Issue[] = [];
    const t = Number(readNonEmptyString(props, 'total') ?? props.total ?? 10);
    const h = readNumber(props.highlighted);
    if (h !== undefined && (h < 0 || h > t)) issues.push({ field: 'highlighted', level: 'warning', message: `highlighted must be 0–${t} (the total)` });
    return issues;
  },
  example: { highlighted: 3, total: '10', statement: 'Indian adults have high blood pressure (illustrative)', icon: 'user', highlight_label: 'high BP', rest_label: 'normal', background: 'theme' },
};

const GRID: Record<number, [number, number]> = { 10: [5, 2], 20: [5, 4], 50: [10, 5], 100: [10, 10] };
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
export const GRID_W = 820;
export type ArrayLayout = { cols: number; rows: number; cell: number; gridTop: number; figure: Line; statement: Line[]; legends: (Line | undefined)[]; source?: Line; textX: number; textW: number; textTop: number };

export function layoutArray(input: { total: number; figure: string; statement: string; hl: string; rl: string; source: string }, measure: Measure, spec: TemplateSpec = DV27_SPEC): ArrayLayout {
  const T = spec.text;
  const [cols, rows] = GRID[input.total];
  const source = input.source ? fitText(input.source, T.source, SAFE_W, measure, false).lines[0] : undefined;
  const sourceH = source ? source.size * 1.25 + 16 : 0;
  const availH = SAFE_H - sourceH;
  const cell = Math.floor(Math.min(GRID_W / cols, availH / rows, 150));
  const gridTop = (availH - cell * rows) / 2;
  const textX = cols * cell + 80;
  const textW = SAFE_W - textX;
  const figure = fitText(input.figure, T.figure, textW, measure, false).lines[0];
  const statement = fitText(input.statement, T.statement, textW, measure).lines;
  const legends = [input.hl ? fitText(input.hl, T.highlight_label, textW / 2 - 60, measure, false).lines[0] : undefined, input.rl ? fitText(input.rl, T.rest_label, textW / 2 - 60, measure, false).lines[0] : undefined];
  const textH = figure.size + 20 + blockHeight(statement, T.statement.lineHeight) + (legends[0] || legends[1] ? 60 : 0);
  return { cols, rows, cell, gridTop, figure, statement, legends, source, textX, textW, textTop: Math.max(0, (availH - textH) / 2) };
}

export function planArray(L: ArrayLayout, anims: { statement: string }, hasSource: boolean, duration: number, cueTimes?: number[]): Plan {
  const s = L.statement.map((l) => l.text).join(' ');
  const units: Unit[] = [
    { key: 'grid', label: 'Grid', start: 4, dur: 16, cue: 0 },
    { key: 'fill', label: 'Fill', start: 22, dur: 30, cue: 1 },
    { key: 'statement', label: 'Statement', start: 52, dur: textAnimFrames(anims.statement, words(s).length, s.length, 18), cue: 2 },
    { key: 'figure', label: 'Figure', start: 24, dur: 12, follows: { key: 'fill', offset: 2 } },
  ];
  if (hasSource) units.push({ key: 'source', label: 'Source', start: 70, dur: 12, cue: 3 });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key) ?? (typeof props[key] === 'number' ? String(props[key]) : undefined);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareDV27(props: Record<string, unknown>, durationInFrames: number) {
  const S = DV27_SPEC.text;
  const A = (k: string) => readAnim(props, DV27_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DV27_SPEC, props);
  const measure = measureFor(style);
  const total = Number(opt(props, 'total', ['10', '20', '50', '100'] as const, '10'));
  const hi = Math.max(0, Math.min(total, Math.round(readNumber(props.highlighted) ?? 0)));
  const g = gcd(hi, total) || 1;
  const auto = opt(props, 'figure_style', ['ratio', 'percent'] as const, 'ratio') === 'percent' ? `${Math.round((hi / total) * 100)}%` : hi === 0 ? `0 in ${total}` : `${hi / g} in ${total / g}`;
  const L = layoutArray({ total, figure: normaliseText(readFirst(props, ['figure']), S.figure) || auto, statement: normaliseText(readFirst(props, ['statement', 'text']), S.statement), hl: normaliseText(readFirst(props, ['highlight_label']), S.highlight_label), rl: normaliseText(readFirst(props, ['rest_label']), S.rest_label), source: normaliseText(readFirst(props, ['source']), S.source) }, measure, sized.spec);
  const plan = planArray(L, { statement: A('statement') }, Boolean(L.source), durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, total, hi, L, plan, icon: readFirst(props, ['icon']) ?? 'user', imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

function DV27IconArrayBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, total, hi, L, plan, icon, imageUrl, bg, debug } = prepareDV27(props, durationInFrames);
  const w = plan.windows;
  const S = DV27_SPEC.text;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const dim = withAlpha(style.colors.text, 0.22);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const fw = w.fill;
  const fp = A('fill') === 'none' ? (frame >= fw.start ? 1 : 0) : progress(frame, fw.start, fw.dur);
  const lit = A('fill') === 'fade' ? (fp > 0 ? hi : 0) : Math.floor(fp * hi + 0.0001);
  const size = Math.round(L.cell * 0.72);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="left" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          <div {...guide('grid', 'total / highlighted')} style={{ position: 'absolute', left: 0, top: L.gridTop, width: L.cols * L.cell, height: L.rows * L.cell, display: 'grid', gridTemplateColumns: `repeat(${L.cols}, ${L.cell}px)`, gridAutoRows: `${L.cell}px` }}>
            {Array.from({ length: total }, (_, i) => {
              const on = i < lit;
              const gp = progress(frame, w.grid.start + (i % L.cols) * 0.6 + Math.floor(i / L.cols) * 0.8, 10);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...iconStyle(A('grid'), gp) }}>
                  <div style={{ transform: on && i === lit - 1 && fp < 1 ? 'scale(1.15)' : 'scale(1)', display: 'flex' }}>
                    <LucideIconView name={icon} size={size} color={on ? accent : dim} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ position: 'absolute', left: L.textX, top: L.textTop, width: L.textW, display: 'flex', flexDirection: 'column' }}>
            <AnimatedText lines={[L.figure]} anim={A('figure')} start={w.figure.start} dur={w.figure.dur} frame={frame} weight={800} lineHeight={1} letterSpacing="-0.03em" color={accent} shadow={shadow} group="figure" input="figure / highlighted" />
            <AnimatedText lines={L.statement} anim={A('statement')} start={w.statement.start} dur={w.statement.dur} frame={frame} weight={S.statement.weight} lineHeight={S.statement.lineHeight} shadow={shadow} group="statement" input="statement" style={{ marginTop: 20 }} />
            {(L.legends[0] || L.legends[1]) && (
              <div style={{ display: 'flex', gap: 36, marginTop: 28, opacity: progress(frame, w.statement.start, 12) }}>
                {L.legends.map((lg, k) =>
                  lg ? (
                    <div key={k} {...leaf(`legend-${k}`, k ? 'rest_label' : 'highlight_label')} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <LucideIconView name={icon} size={28} color={k ? dim : accent} />
                      <span style={{ fontFamily: fontFor(k ? 600 : 700), fontWeight: k ? 600 : 700, fontSize: lg.size, lineHeight: 1.2, color: k ? mutedFor(style, onFootage) : style.colors.text, whiteSpace: 'nowrap' }}>{lg.text}</span>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>
          {L.source && w.source && <span {...leaf('source', 'source')} style={{ position: 'absolute', left: 0, bottom: 0, fontFamily: fontFor(500), fontWeight: 500, fontSize: L.source.size, lineHeight: 1.25, color: withAlpha(style.colors.muted, 0.85), whiteSpace: 'nowrap', opacity: progress(frame, w.source.start, w.source.dur) }}>{L.source.text}</span>}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const DV27IconArray = withAutoFit(DV27IconArrayBase);
