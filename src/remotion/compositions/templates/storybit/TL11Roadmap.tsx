'use client';

/**
 * TL-11 · Roadmap / Gantt  (animation_type: "tl_roadmap")
 * 2–8 tasks or phases as bars along a time axis (a Gantt chart / project roadmap), with optional
 * milestones (diamonds), a "today" marker, and custom axis labels (years, quarters, months).
 *
 * Inputs (full list, limits and JSON Schema: TL11Roadmap.inputs.json):
 *   title · tasks[] { label, start, end, highlight } · axis_labels[] · today · image_url · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, task 1, task 2, …, today]
 * start / end are numbers on one scale (e.g. 2024, 2024.5 or month numbers). end = start → milestone.
 * Timing: 3–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type Issue, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, words, type Line, type Measure } from './core/fit';
import { exitStyle, iconStyle, lineStyle, progress, shapeState, textAnimFrames } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { readNumber } from './core/numbers';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, mutedFor, readStyle, seriesColor, styleVars, withAlpha, readHex } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, guide, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

export const TL11_SPEC: TemplateSpec = {
  id: 'TL-11',
  animationType: 'tl_roadmap',
  name: 'Roadmap / Gantt',
  pickWhen: 'Phases or projects over time: a roadmap, a construction schedule, overlapping eras, "what happens when".',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 180, max: 240, perItemFrames: 20 },
  numbers: { today: { label: 'Today marker', required: false, fills: 'Vertical "today" line at this value on the axis' } },
  text: {
    title: { label: 'Heading', required: false, minChars: 3, maxChars: 50, minWords: 1, maxWords: 10, maxWordChars: 18, maxLines: 1, fontMax: 56, fontMin: 40, weight: 800, lineHeight: 1.05, fills: 'Heading above the chart', example: 'Bullet train roadmap (illustrative)' },
    today_label: { label: 'Today label', required: false, minChars: 2, maxChars: 14, minWords: 1, maxWords: 2, maxWordChars: 12, maxLines: 1, fontMax: 24, fontMin: 18, weight: 700, lineHeight: 1.2, hint: 'Default "Today".', fills: 'Label on the today marker' },
  },
  lists: {
    tasks: {
      label: 'Task',
      fills: 'Rows top to bottom',
      minItems: 2,
      maxItems: 8,
      bgColor: 'this task’s row band',
      fields: {
        label: { label: 'Label', required: true, minChars: 2, maxChars: 28, minWords: 1, maxWords: 5, maxWordChars: 16, maxLines: 2, fontMax: 32, fontMin: 20, weight: 600, lineHeight: 1.2, hint: 'Phase or task name.', fills: 'Row label' },
      },
      numbers: {
        start: { label: 'Start', required: true, fills: 'Where the bar starts on the axis' },
        end: { label: 'End', required: true, fills: 'Where it ends (same as start = milestone diamond)' },
        highlight: { label: 'Highlight', required: false, fills: '1 = accent colour (others muted)', min: 0, max: 1, integer: true },
      },
    },
  },
  custom: {
    inputs: [{ path: 'axis_labels[]', type: 'array', required: false, fills: 'Labels spread evenly along the axis from the earliest start to the latest end (e.g. ["2024","2025","2026"]). Default: whole numbers.', limits: '2–12 labels · 1–10 chars' }],
    schema: { axis_labels: { type: 'array', minItems: 2, maxItems: 12, items: { type: 'string', minLength: 1, maxLength: 10 }, description: 'Axis labels, evenly spaced from the earliest start to the latest end.' } },
  },
  options: { background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' } },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    axis: { label: 'Axis and grid', kind: 'shape', target: 'axis labels and grid lines', default: 'fade' },
    labels: { label: 'Row labels', kind: 'text', target: 'task labels', default: 'slide_left' },
    bars: { label: 'Bars', kind: 'shape', target: 'each bar (grows from its start)', default: 'grow' },
    milestones: { label: 'Milestones', kind: 'icon', target: 'milestone diamonds', default: 'pop' },
    today: { label: 'Today marker', kind: 'shape', target: 'today line', default: 'grow' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: { description: 'heading (skipped if absent) → one cue per task → today marker.', units: ['heading', 'task 1', 'task 2', 'task 3', 'task 4', 'task 5', 'task 6', 'task 7', 'task 8', 'today'] },
  colors: ['series_2', 'series_3', 'series_4'],
  validate: (props) => {
    const issues: Issue[] = [];
    (Array.isArray(props.tasks) ? (props.tasks as Record<string, unknown>[]) : []).forEach((t, i) => {
      const s = readNumber(t?.start);
      const e = readNumber(t?.end);
      if (s !== undefined && e !== undefined && e < s) issues.push({ field: `tasks[${i}].end`, level: 'warning', message: `Task ${i + 1}: end is before start — they are swapped` });
    });
    return issues;
  },
  example: {
    title: 'Bullet train roadmap (illustrative)',
    tasks: [
      { label: 'Land acquisition', start: 2017, end: 2021 },
      { label: 'Viaduct construction', start: 2020, end: 2026 },
      { label: 'Stations', start: 2022, end: 2027 },
      { label: 'First trial run', start: 2027, end: 2027, highlight: 1 },
    ],
    axis_labels: ['2017', '2019', '2021', '2023', '2025', '2027'],
    today: 2025,
    background: 'theme',
  },
};

export type Task = { label: string; start: number; end: number; highlight: boolean; bg?: string };
export const LABEL_GAP = 28;
export const AXIS_GAP = 14;
export type RoadLayout = { title: Line[]; titleH: number; labelW: number; labels: Line[][]; rowH: number; barH: number; plotX: number; plotW: number; top: number; min: number; max: number; ticks: { x: number; text: string; left: number; w: number }[]; axisFont: number; todayLabel?: Line; todayW: number };

export function layoutRoad(input: { title: string; tasks: Task[]; axis: string[]; todayLabel: string; hasToday: boolean }, measure: Measure, spec: TemplateSpec = TL11_SPEC): RoadLayout {
  const F = spec.lists.tasks.fields.label;
  const n = Math.max(1, input.tasks.length);
  const title = input.title ? fitText(input.title, spec.text.title, SAFE_W, measure, false).lines : [];
  const titleH = title.length ? blockHeight(title, spec.text.title.lineHeight) + 32 : 0;
  const todayLabel = input.hasToday ? fitText(input.todayLabel, spec.text.today_label, 240, measure, false).lines[0] : undefined;
  const topPad = todayLabel ? todayLabel.size * 1.2 + 16 : 0;
  const axisFont = 24;
  const axisH = axisFont * 1.3 + AXIS_GAP;
  const rowsH = SAFE_H - titleH - topPad - axisH;
  const rowH = Math.min(120, Math.floor(rowsH / n));
  const barH = Math.max(18, Math.round(rowH * 0.46));
  const lf = sharedFont(input.tasks.map((t) => t.label), { ...F, fontMax: Math.min(F.fontMax, Math.round(rowH * 0.34)) }, 440, measure);
  const labels = input.tasks.map((t) => linesAt(t.label, lf, F, 440, measure));
  const labelW = Math.ceil(Math.max(...labels.flat().map((l) => measure(l.text, l.size, F.weight)))) + 8;
  // milestone diamonds are centred on their date: keep half a diamond of room at both ends
  const inset = Math.ceil(barH * 0.7);
  const plotX = labelW + LABEL_GAP + inset;
  const plotW = SAFE_W - plotX - inset - 4;
  const mn = Math.min(...input.tasks.map((t) => t.start));
  const mx = Math.max(...input.tasks.map((t) => t.end));
  const min = mn === mx ? mn - 1 : mn;
  const max = mn === mx ? mx + 1 : mx;
  const x = (v: number) => plotX + ((v - min) / (max - min)) * plotW;
  let ticks: { x: number; text: string }[];
  if (input.axis.length >= 2) ticks = input.axis.map((t, i) => ({ x: plotX + (i / (input.axis.length - 1)) * plotW, text: t }));
  else {
    const step = Math.max(1, Math.ceil((max - min) / 8));
    ticks = [];
    for (let v = Math.ceil(min); v <= max; v += step) ticks.push({ x: x(v), text: String(v) });
  }
  // place each label centred under its tick (kept inside the safe box); drop any that would touch the previous one
  const kept: { x: number; text: string; left: number; w: number }[] = [];
  for (const t of ticks) {
    const w = Math.ceil(measure(t.text, axisFont, 500));
    const left = Math.max(0, Math.min(SAFE_W - w, t.x - w / 2));
    const prev = kept[kept.length - 1];
    if (!prev || left >= prev.left + prev.w + 16) kept.push({ ...t, left, w });
  }
  const top = titleH + topPad + (rowsH - rowH * n) / 2;
  return { title, titleH, labelW, labels, rowH, barH, plotX, plotW, top, min, max, ticks: kept, axisFont, todayLabel, todayW: todayLabel ? Math.ceil(measure(todayLabel.text, todayLabel.size, 700)) + 24 : 0 };
}

export function planRoad(L: RoadLayout, anims: { title: string }, n: number, hasToday: boolean, duration: number, cueTimes?: number[]): Plan {
  const units: Unit[] = [];
  let cue = 0;
  if (L.title.length) units.push({ key: 'title', label: 'Heading', start: 2, dur: textAnimFrames(anims.title, words(L.title[0].text).length, L.title[0].text.length, 18), cue: cue++ });
  const first = L.title.length ? 20 : 8;
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const gap = n > 1 ? Math.max(6, Math.min(24, Math.floor((budget - first - 40) / (n - 1)))) : 0;
  for (let i = 0; i < n; i++) units.push({ key: `task${i}`, label: `Task ${i + 1}`, start: first + i * gap, dur: 22, cue: cue + i });
  cue += n;
  if (hasToday) units.push({ key: 'today', label: 'Today marker', start: first + (n - 1) * gap + 24, dur: 16, cue });
  units.push({ key: 'axis', label: 'Axis', start: first - 8, dur: 14, follows: { key: 'task0', offset: -8 } });
  for (let i = 0; i < n; i++) units.push({ key: `label${i}`, label: `Label ${i + 1}`, start: first + i * gap - 4, dur: 14, follows: { key: `task${i}`, offset: -4 } });
  return planTimeline(duration, units, cueTimes);
}

export function prepareTL11(props: Record<string, unknown>, durationInFrames: number) {
  const F = TL11_SPEC.lists.tasks.fields.label;
  const A = (k: string) => readAnim(props, TL11_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(TL11_SPEC, props);
  const measure = measureFor(style);
  const tasks: Task[] = (Array.isArray(props.tasks) ? props.tasks : [])
    .map((t): Task | null => {
      const o = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>;
      const label = typeof o.label === 'string' ? normaliseText(o.label, F) : '';
      let s = readNumber(o.start);
      let e = readNumber(o.end);
      if (!label || s === undefined) return null;
      if (e === undefined) e = s;
      if (e < s) [s, e] = [e, s];
      return { label, start: s, end: e, highlight: o.highlight === 1, bg: readHex(o.bg_color) };
    })
    .filter((t): t is Task => t !== null)
    .slice(0, 8);
  const axis = (Array.isArray(props.axis_labels) ? props.axis_labels : []).map((x) => String(x).slice(0, 10)).slice(0, 12);
  const today = readNumber(props.today);
  const L = layoutRoad({ title: normaliseText(readFirst(props, ['title']), TL11_SPEC.text.title), tasks, axis, todayLabel: normaliseText(readFirst(props, ['today_label']), TL11_SPEC.text.today_label) || 'Today', hasToday: today !== undefined }, measure, sized.spec);
  const plan = planRoad(L, { title: A('title') }, tasks.length, today !== undefined, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, tasks, today, L, plan, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

function TL11RoadmapBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, tasks, today, L, plan, imageUrl, bg, debug } = prepareTL11(props, durationInFrames);
  const w = plan.windows;
  const F = TL11_SPEC.lists.tasks.fields.label;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const muted = mutedFor(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const x = (v: number) => L.plotX + ((v - L.min) / (L.max - L.min)) * L.plotW;
  const ax = shapeState(A('axis'), progress(frame, w.axis.start, w.axis.dur));
  const axOpacity = (ax.style.opacity as number | undefined) ?? (ax.length > 0 ? 1 : 0);
  const n = tasks.length;
  const rowsBottom = L.top + L.rowH * n;
  const anyHi = tasks.some((t) => t.highlight);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="left" accent={style.colors.accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.title.length > 0 && w.title && <AnimatedText lines={L.title} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={800} lineHeight={TL11_SPEC.text.title.lineHeight} shadow={shadow} group="title" input="title" />}
          {L.ticks.map((t, i) => (
            <div key={i}>
              <div {...guide(`grid-${i}`, 'grid')} style={{ position: 'absolute', left: t.x - 1, top: L.top, width: 2, height: L.rowH * n, background: withAlpha(style.colors.text, 0.1), opacity: axOpacity }} />
              <span {...leaf(`tick-${i}`, 'axis_labels')} style={{ position: 'absolute', top: rowsBottom + AXIS_GAP, left: t.left, fontFamily: fontFor(500), fontWeight: 500, fontSize: L.axisFont, lineHeight: 1.3, color: muted, opacity: axOpacity, whiteSpace: 'nowrap' }}>
                {t.text}
              </span>
            </div>
          ))}
          {tasks.map((t, i) => {
            const cy = L.top + i * L.rowH + L.rowH / 2;
            const tw = w[`task${i}`];
            const lw = w[`label${i}`];
            const st = shapeState(A('bars'), progress(frame, tw.start, tw.dur));
            const color = anyHi ? (t.highlight ? style.colors.accent : withAlpha(style.colors.text, 0.35)) : seriesColor(style.colors, i % 4);
            const lh = L.labels[i].length * L.labels[i][0].size * F.lineHeight;
            const milestone = t.end === t.start;
            return (
              <div key={i}>
                {(t.bg || i % 2 === 0) && <div style={{ position: 'absolute', left: 0, top: cy - L.rowH / 2, width: SAFE_W, height: L.rowH, background: t.bg ?? withAlpha(style.colors.text, 0.035), borderRadius: 10 }} />}
                <AnimatedText lines={L.labels[i]} anim={A('labels')} start={lw.start} dur={lw.dur} frame={frame} weight={F.weight} lineHeight={F.lineHeight} color={t.highlight ? style.colors.text : anyHi ? muted : style.colors.text} shadow={shadow} align="right" group={`label-${i}`} input={`tasks[${i}].label`} style={{ position: 'absolute', left: 0, width: L.labelW, top: cy - lh / 2 }} />
                {milestone ? (
                  <div {...leaf(`milestone-${i}`, `tasks[${i}].start`)} style={{ position: 'absolute', left: x(t.start) - L.barH * 0.62, top: cy - L.barH * 0.62, width: L.barH * 1.24, height: L.barH * 1.24, display: 'flex', alignItems: 'center', justifyContent: 'center', ...iconStyle(A('milestones'), progress(frame, tw.start, tw.dur)) }}>
                    <div style={{ width: L.barH * 0.88, height: L.barH * 0.88, transform: 'rotate(45deg)', background: color, borderRadius: 4 }} />
                  </div>
                ) : (
                  <div {...leaf(`bar-${i}`, `tasks[${i}].start–end`)} style={{ position: 'absolute', left: x(t.start), top: cy - L.barH / 2, height: L.barH, width: Math.max(0, (x(t.end) - x(t.start)) * st.length), borderRadius: L.barH / 2, background: color, ...st.style }} />
                )}
              </div>
            );
          })}
          {today !== undefined && w.today && today >= L.min && today <= L.max && (() => {
            const st = shapeState(A('today'), progress(frame, w.today.start, w.today.dur));
            const tx = Math.max(L.plotX, Math.min(SAFE_W - 3, x(today) - 1.5));
            const lw = L.todayW;
            return (
              <>
                <div {...guide('today', 'today')} style={{ position: 'absolute', left: tx, top: L.top, width: 3, height: L.rowH * n * st.length, background: style.colors.negative, ...st.style }} />
                {L.todayLabel && (
                  <span {...leaf('today-label', 'today_label')} style={{ position: 'absolute', left: Math.max(0, Math.min(SAFE_W - lw, tx - lw / 2)), top: L.top - L.todayLabel.size * 1.2 - 12, fontFamily: fontFor(700), fontWeight: 700, fontSize: L.todayLabel.size, lineHeight: 1.2, color: '#FFFFFF', background: style.colors.negative, padding: '2px 12px', borderRadius: 999, whiteSpace: 'nowrap', ...lineStyle('fade', progress(frame, w.today.start, w.today.dur)) }}>
                    {L.todayLabel.text}
                  </span>
                )}
              </>
            );
          })()}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const TL11Roadmap = withAutoFit(TL11RoadmapBase);
