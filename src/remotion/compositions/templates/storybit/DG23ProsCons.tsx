'use client';

/**
 * DG-23 · Pros & Cons  (animation_type: "dg_pros_cons")
 * Two columns — good points (✓, green) and bad points (✕, red) — about one subject, with an optional
 * one-line verdict underneath. Points appear alternately (pro, con, pro…) or column by column.
 *
 * Inputs (full list, limits and JSON Schema: DG23ProsCons.inputs.json):
 *   title · pros[] { text } · cons[] { text } · verdict · pros_label · cons_label · order · image_url · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, point 1…10, verdict]
 * Timing: 3–8s from clock.durationInFrames.
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
import { cardColors, fontFor, readStyle, styleVars, withAlpha, readHex } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

const POINT: TextSpec = { label: 'Point', required: true, minChars: 2, maxChars: 60, minWords: 1, maxWords: 11, maxWordChars: 16, maxLines: 2, fontMax: 34, fontMin: 20, weight: 600, lineHeight: 1.25, fills: 'One point' };

export const DG23_SPEC: TemplateSpec = {
  id: 'DG-23',
  animationType: 'dg_pros_cons',
  name: 'Pros & Cons',
  pickWhen: 'Weighing the good and the bad of one thing: a policy, a product, a decision.',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 210, max: 240 },
  text: {
    title: { label: 'Heading', required: false, minChars: 3, maxChars: 44, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 1, fontMax: 56, fontMin: 38, weight: 800, lineHeight: 1.05, fills: 'Subject above the columns', example: 'The new tax regime' },
    pros_label: { label: 'Pros heading', required: false, minChars: 2, maxChars: 16, minWords: 1, maxWords: 3, maxWordChars: 14, maxLines: 1, fontMax: 34, fontMin: 22, weight: 800, lineHeight: 1.2, hint: 'Default "Pros" (e.g. "फ़ायदे").', fills: 'Heading of the good column' },
    cons_label: { label: 'Cons heading', required: false, minChars: 2, maxChars: 16, minWords: 1, maxWords: 3, maxWordChars: 14, maxLines: 1, fontMax: 34, fontMin: 22, weight: 800, lineHeight: 1.2, hint: 'Default "Cons" (e.g. "नुक़सान").', fills: 'Heading of the bad column' },
    verdict: { label: 'Verdict', required: false, minChars: 5, maxChars: 80, minWords: 2, maxWords: 14, maxWordChars: 18, maxLines: 2, fontMax: 34, fontMin: 22, weight: 700, lineHeight: 1.3, hint: 'One-line conclusion.', fills: 'Verdict under the columns' },
  },
  lists: {
    pros: { label: 'Pro', fills: 'Good points', minItems: 1, maxItems: 5, fields: { text: POINT } },
    cons: { label: 'Con', fills: 'Bad points', minItems: 1, maxItems: 5, fields: { text: POINT } },
  },
  custom: {
    inputs: [
      { path: 'pros_bg_color', type: 'color', required: false, fills: 'Background colour of the Pros column panel (to highlight it)', limits: 'hex #RRGGBB (or #RRGGBBAA)', default: 'theme card colour' },
      { path: 'cons_bg_color', type: 'color', required: false, fills: 'Background colour of the Cons column panel', limits: 'hex #RRGGBB (or #RRGGBBAA)', default: 'theme card colour' },
    ],
    schema: {
      pros_bg_color: { type: 'string', pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$', description: 'Background colour of the Pros column panel, hex e.g. #0F3D2E' },
      cons_bg_color: { type: 'string', pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$', description: 'Background colour of the Cons column panel, hex e.g. #3D0F14' },
    },
  },
  options: {
    order: { label: 'Reveal order', values: ['alternate', 'columns'], default: 'alternate', fills: 'pro, con, pro, con… or all pros then all cons' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    columns: { label: 'Columns', kind: 'card', target: 'the two column panels', default: 'fade' },
    points: { label: 'Points', kind: 'card', target: 'each point', default: 'slide_up' },
    marks: { label: 'Ticks / crosses', kind: 'icon', target: '✓ / ✕ of each point', default: 'pop' },
    verdict: { label: 'Verdict', kind: 'text', target: 'verdict line', default: 'fade_up' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'everything', default: 'fade_up' },
  },
  cues: { description: 'Fixed slots: heading → point 1…10 (in reveal order) → verdict.', units: ['heading', 'point 1', 'point 2', 'point 3', 'point 4', 'point 5', 'point 6', 'point 7', 'point 8', 'point 9', 'point 10', 'verdict'] },
  colors: ['card', 'card_border', 'positive', 'negative'],
  example: {
    title: 'The new tax regime (illustrative)',
    pros: [{ text: 'Lower tax rates' }, { text: 'Less paperwork' }, { text: 'No proof of investments needed' }],
    cons: [{ text: 'Most deductions are gone' }, { text: 'Less push to save' }],
    verdict: 'Better for people with few deductions',
    order: 'alternate',
    background: 'theme',
  },
};

export const COL_GAP = 40;
export const PAD = 32;
export const HEAD_H = 64;
export const ROW_GAP = 16;
export type ProsLayout = { title: Line[]; titleH: number; colW: number; colTop: number; colH: number; heads: [Line, Line]; points: [Line[][], Line[][]]; rowH: [number[], number[]]; mark: number; verdict: Line[] };

export function layoutPros(input: { title: string; pros: string[]; cons: string[]; verdict: string; pl: string; cl: string }, measure: Measure, spec: TemplateSpec = DG23_SPEC): ProsLayout {
  const T = spec.text;
  const title = input.title ? fitText(input.title, T.title, SAFE_W, measure, false).lines : [];
  const titleH = title.length ? title[0].size * 1.05 + 30 : 0;
  const verdict = input.verdict ? fitText(input.verdict, T.verdict, SAFE_W - 80, measure).lines : [];
  const verdictH = verdict.length ? blockHeight(verdict, T.verdict.lineHeight) + 28 + 28 : 0;
  const colW = (SAFE_W - COL_GAP) / 2;
  const heads: [Line, Line] = [fitText(input.pl, T.pros_label, colW - 120, measure, false).lines[0], fitText(input.cl, T.cons_label, colW - 120, measure, false).lines[0]];
  const colTop = titleH;
  const colH = SAFE_H - titleH - verdictH;
  let cap = POINT.fontMax;
  for (;;) {
    const mark = Math.round(cap * 1.05);
    const textW = colW - PAD * 2 - mark - 16;
    const f = sharedFont([...input.pros, ...input.cons], POINT, textW, measure, cap);
    const pts: [Line[][], Line[][]] = [input.pros.map((t) => linesAt(t, f, POINT, textW, measure)), input.cons.map((t) => linesAt(t, f, POINT, textW, measure))];
    const rowH: [number[], number[]] = [pts[0].map((l) => Math.max(mark, blockHeight(l, POINT.lineHeight))), pts[1].map((l) => Math.max(mark, blockHeight(l, POINT.lineHeight)))];
    const need = Math.max(...rowH.map((r) => r.reduce((a, b) => a + b, 0) + ROW_GAP * (r.length - 1))) + HEAD_H + PAD * 2;
    if (need <= colH || cap <= POINT.fontMin) {
      // columns hug their content (no empty band on the right of short points, no empty space below them)
      const pw = (l: Line) => measure(l.text, l.size, POINT.weight);
      const contentW = Math.max(...pts.flat(2).map(pw), 0) + mark + 16;
      const headW = Math.max(...heads.map((h) => measure(h.text, h.size, 800) * 1.1)) + 52;
      const cw = Math.min(colW, Math.ceil(Math.max(contentW, headW, 360)) + PAD * 2);
      return { title, titleH, colW: cw, colTop, colH: Math.min(colH, need), heads, points: pts, rowH, mark, verdict };
    }
    cap -= 2;
  }
}

export function planPros(nP: number, nC: number, alternate: boolean, hasTitle: boolean, hasVerdict: boolean, duration: number, cueTimes?: number[]): Plan {
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const first = hasTitle ? 18 : 8;
  const order: [0 | 1, number][] = [];
  if (alternate) for (let i = 0; i < Math.max(nP, nC); i++) {
    if (i < nP) order.push([0, i]);
    if (i < nC) order.push([1, i]);
  }
  else {
    for (let i = 0; i < nP; i++) order.push([0, i]);
    for (let i = 0; i < nC; i++) order.push([1, i]);
  }
  const n = order.length;
  const gap = n > 1 ? Math.max(6, Math.min(24, Math.floor((budget - first - (hasVerdict ? 40 : 16)) / (n - 1)))) : 0;
  const units: Unit[] = [];
  if (hasTitle) units.push({ key: 'title', label: 'Heading', start: 2, dur: 14, cue: 0 });
  units.push({ key: 'columns', label: 'Columns', start: first - 8, dur: 12 });
  order.forEach(([c, i], k) => units.push({ key: `p${c}_${i}`, label: `${c ? 'Con' : 'Pro'} ${i + 1}`, start: first + k * gap, dur: 14, cue: 1 + k }));
  if (hasVerdict) units.push({ key: 'verdict', label: 'Verdict', start: first + (n - 1) * gap + 24, dur: 18, cue: 11 });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareDG23(props: Record<string, unknown>, durationInFrames: number) {
  const S = DG23_SPEC.text;
  const A = (k: string) => readAnim(props, DG23_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DG23_SPEC, props);
  const measure = measureFor(style);
  const list = (k: string) => (Array.isArray(props[k]) ? (props[k] as unknown[]) : []).map((x) => normaliseText(typeof x === 'string' ? x : x && typeof x === 'object' && typeof (x as Record<string, unknown>).text === 'string' ? ((x as Record<string, unknown>).text as string) : '', POINT)).filter(Boolean).slice(0, 5);
  const pros = list('pros');
  const cons = list('cons');
  const L = layoutPros({ title: normaliseText(readFirst(props, ['title']), S.title), pros, cons, verdict: normaliseText(readFirst(props, ['verdict']), S.verdict), pl: normaliseText(readFirst(props, ['pros_label']), S.pros_label) || 'Pros', cl: normaliseText(readFirst(props, ['cons_label']), S.cons_label) || 'Cons' }, measure, sized.spec);
  const plan = planPros(pros.length, cons.length, opt(props, 'order', ['alternate', 'columns'] as const, 'alternate') === 'alternate', L.title.length > 0, L.verdict.length > 0, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, pros, cons, colBg: [readHex(props.pros_bg_color), readHex(props.cons_bg_color)] as (string | undefined)[], L, plan, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

function DG23ProsConsBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, pros, cons, colBg, L, plan, imageUrl, bg, debug } = prepareDG23(props, durationInFrames);
  const w = plan.windows;
  const S = DG23_SPEC.text;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const card = cardColors(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const cols: [string[], string[]] = [pros, cons];
  const colColor = [style.colors.positive, style.colors.negative];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={style.colors.accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.title.length > 0 && w.title && <AnimatedText lines={L.title} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={800} lineHeight={1.05} shadow={shadow} align="center" group="title" input="title" style={{ position: 'absolute', left: 0, width: SAFE_W, top: 0 }} />}
          {[0, 1].map((c) => {
            const x = (SAFE_W - (L.colW * 2 + COL_GAP)) / 2 + c * (L.colW + COL_GAP);
            const col = colColor[c];
            let y = L.colTop + PAD + HEAD_H;
            return (
              <div key={c}>
                <div style={{ position: 'absolute', left: x, top: L.colTop, width: L.colW, height: L.colH, borderRadius: 26, background: colBg[c] ?? card.fill, border: `2px solid ${withAlpha(col, 0.5)}`, ...cardStyle(A('columns'), progress(frame, w.columns.start, w.columns.dur)) }} />
                <div style={{ position: 'absolute', left: x + PAD, top: L.colTop + PAD, height: HEAD_H - 16, display: 'flex', alignItems: 'center', gap: 12, opacity: progress(frame, w.columns.start, w.columns.dur) }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: col, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LucideIconView name={c ? 'thumbs-down' : 'thumbs-up'} size={24} color="#FFFFFF" />
                  </div>
                  <span {...leaf(`head-${c}`, c ? 'cons_label' : 'pros_label')} style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: L.heads[c].size, lineHeight: 1.2, color: col, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{L.heads[c].text}</span>
                </div>
                {cols[c].map((_, i) => {
                  const pw = w[`p${c}_${i}`];
                  const top = y;
                  y += L.rowH[c][i] + ROW_GAP;
                  return (
                    <div key={i} style={{ position: 'absolute', left: x + PAD, top, width: L.colW - PAD * 2, height: L.rowH[c][i], display: 'flex', alignItems: 'flex-start', gap: 16, ...cardStyle(A('points'), progress(frame, pw.start, pw.dur)) }}>
                      <div {...leaf(`mark-${c}-${i}`, c ? 'cons[] mark' : 'pros[] mark')} style={{ width: L.mark, height: L.mark, borderRadius: '50%', background: withAlpha(col, 0.2), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...iconStyle(A('marks'), progress(frame, pw.start + 2, pw.dur)) }}>
                        <LucideIconView name={c ? 'x' : 'check'} size={Math.round(L.mark * 0.6)} color={col} />
                      </div>
                      <AnimatedText lines={L.points[c][i]} anim="none" start={pw.start} dur={1} frame={frame} weight={POINT.weight} lineHeight={POINT.lineHeight} shadow={shadow} group={`point-${c}-${i}`} input={c ? `cons[${i}].text` : `pros[${i}].text`} />
                    </div>
                  );
                })}
              </div>
            );
          })}
          {L.verdict.length > 0 && w.verdict && (
            <AnimatedText lines={L.verdict} anim={A('verdict')} start={w.verdict.start} dur={w.verdict.dur} frame={frame} weight={S.verdict.weight} lineHeight={S.verdict.lineHeight} shadow={shadow} align="center" group="verdict" input="verdict" style={{ position: 'absolute', left: 0, width: SAFE_W, top: L.colTop + L.colH + 28 }} />
          )}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const DG23ProsCons = withAutoFit(DG23ProsConsBase);
