'use client';

/**
 * FS-20 · Comparison Columns  (animation_type: "fs_comparison_columns")
 * 2–3 options compared on the same 2–6 attributes: a table with column heads (name + optional
 * icon or picture), one row per attribute, optional best-in-row highlight and a highlighted column.
 * Cells take short text, or yes / no / – which render as a tick, a cross or a dash.
 *
 * Inputs (full list, limits and JSON Schema: FS20ComparisonColumns.inputs.json):
 *   title · columns[] { name, icon, image_url } · rows[] { label, a, b, c, best } · image_url
 *   highlight_column · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, row 1, row 2, …]
 * Timing: 3–8s from clock.durationInFrames; rows appear one after another or on their cues.
 */
import type { CSSProperties } from 'react';
import { Img } from './core/remotionSafe';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type Issue, type TemplateSpec, type TextSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, iconStyle, progress, shapeState, textAnimFrames } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { cardColors, mutedFor, readStyle, styleVars, withAlpha, readHex } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

/* ================================================================== */
/* Content spec                                                         */
/* ================================================================== */

const CELL: TextSpec = {
  label: 'Cell',
  required: false,
  minChars: 1,
  maxChars: 25,
  minWords: 1,
  maxWords: 5,
  maxWordChars: 14,
  maxLines: 2,
  fontMax: 36,
  fontMin: 22,
  weight: 600,
  lineHeight: 1.22,
  hint: 'Short value, or yes / no / – for a tick, cross or dash.',
};

export const FS20_SPEC: TemplateSpec = {
  id: 'FS-20',
  animationType: 'fs_comparison_columns',
  name: 'Comparison Columns',
  pickWhen: 'Comparing 2–3 options, products, plans or countries on the same attributes (a comparison table).',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 210, max: 240, perItemFrames: 40 },
  text: {
    title: {
      label: 'Heading',
      required: false,
      minChars: 3,
      maxChars: 40,
      minWords: 1,
      maxWords: 8,
      maxWordChars: 18,
      maxLines: 1,
      fontMax: 64,
      fontMin: 44,
      weight: 800,
      lineHeight: 1.04,
      hint: 'What is compared: "UPI vs cards vs cash".',
      fills: 'Heading above the table',
      example: 'Ways to pay a shopkeeper',
    },
  },
  lists: {
    columns: {
      label: 'Column',
      fills: 'Options being compared (left to right)',
      minItems: 2,
      maxItems: 3,
      icon: { required: false, fallback: 'none' },
      image: { required: false, fills: 'Picture above the column name (circle)' },
      bgColor: 'this column’s background panel',
      fields: {
        name: {
          label: 'Name',
          required: true,
          minChars: 1,
          maxChars: 20,
          minWords: 1,
          maxWords: 4,
          maxWordChars: 14,
          maxLines: 2,
          fontMax: 44,
          fontMin: 28,
          weight: 800,
          lineHeight: 1.12,
          hint: 'Option name.',
          fills: 'Column head',
        },
      },
    },
    rows: {
      label: 'Row',
      fills: 'Attributes compared (top to bottom). a / b / c are the cells for columns 1 / 2 / 3',
      minItems: 2,
      maxItems: 6,
      fields: {
        label: {
          label: 'Label',
          required: true,
          minChars: 2,
          maxChars: 20,
          minWords: 1,
          maxWords: 4,
          maxWordChars: 14,
          maxLines: 2,
          fontMax: 34,
          fontMin: 22,
          weight: 600,
          lineHeight: 1.22,
          hint: 'Attribute name: "Speed", "Fee", "Works offline". Phrase it so "yes" is good — ticks are green, crosses red.',
          fills: 'Row label (left column)',
        },
        a: { ...CELL, label: 'Cell A', required: true, fills: 'Value for column 1' },
        b: { ...CELL, label: 'Cell B', required: true, fills: 'Value for column 2' },
        c: { ...CELL, label: 'Cell C', fills: 'Value for column 3 (only with 3 columns)' },
      },
      numbers: {
        best: { label: 'Best', required: false, fills: 'Column that wins this row (1, 2 or 3) — its cell is highlighted', min: 1, max: 3, integer: true },
      },
    },
  },
  options: {
    highlight_column: { label: 'Highlight column', values: ['none', '1', '2', '3'], default: 'none', fills: 'Tint one whole column (e.g. the recommended option)' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    header: { label: 'Column heads', kind: 'card', target: 'each column head', default: 'slide_up' },
    header_icons: { label: 'Column icons / pictures', kind: 'icon', target: 'icon or picture above each column name', default: 'pop' },
    rows: { label: 'Rows', kind: 'card', target: 'each row (stripe)', default: 'fade' },
    row_labels: { label: 'Row labels', kind: 'text', target: 'label of each row', default: 'slide_left' },
    cells: { label: 'Cells', kind: 'text', target: 'text in each cell', default: 'fade_up' },
    marks: { label: 'Ticks / crosses', kind: 'icon', target: 'yes / no marks in cells', default: 'pop' },
    winner: { label: 'Best-in-row highlight', kind: 'shape', target: 'highlight behind the best cell', default: 'pop' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: {
    description: 'First cue = heading (if present), then one cue per row (when the narrator reaches that attribute). Column heads appear just before the first row.',
    units: ['heading', 'row 1', 'row 2', 'row 3', 'row 4', 'row 5', 'row 6'],
  },
  colors: ['icon', 'icon_bg', 'card', 'card_border', 'positive', 'negative'],
  validate: (props) => {
    const issues: Issue[] = [];
    const cols = Array.isArray(props.columns) ? props.columns.length : 0;
    const rows = Array.isArray(props.rows) ? (props.rows as Record<string, unknown>[]) : [];
    rows.forEach((r, i) => {
      if (cols === 3 && (typeof r?.c !== 'string' || !(r.c as string).trim())) issues.push({ field: `rows[${i}].c`, level: 'warning', message: `Row ${i + 1}: no value for column 3 — a dash is shown` });
      if (typeof r?.best === 'number' && r.best > cols) issues.push({ field: `rows[${i}].best`, level: 'warning', message: `Row ${i + 1}: best = ${r.best} but there are only ${cols} columns` });
    });
    return issues;
  },
  example: {
    title: 'Ways to pay a shopkeeper',
    columns: [
      { name: 'UPI', icon: 'smartphone' },
      { name: 'Debit card', icon: 'credit-card' },
      { name: 'Cash', icon: 'banknote' },
    ],
    rows: [
      { label: 'Speed', a: 'Seconds', b: 'Seconds', c: 'Instant', best: 3 },
      { label: 'No machine needed', a: 'yes', b: 'no', c: 'yes' },
      { label: 'Works offline', a: 'Limited', b: 'no', c: 'yes', best: 3 },
      { label: 'Payment record', a: 'yes', b: 'yes', c: 'no' },
    ],
    highlight_column: '1',
    background: 'theme',
  },
};

/* ================================================================== */
/* Layout                                                               */
/* ================================================================== */

export type Column = { name: string; icon?: string; image?: string; bg?: string };
export type Row = { label: string; cells: string[]; best?: number };
export type CellKind = 'yes' | 'no' | 'dash' | 'text';

const YES = new Set(['yes', 'y', 'true', '✓', '✔', 'tick', 'available']);
const NO = new Set(['no', 'n', 'false', '✗', '✘', 'x', 'cross', 'not available']);
export function cellKind(v: string): CellKind {
  const t = v.trim().toLowerCase();
  if (!t || t === '-' || t === '–' || t === '—' || t === 'n/a') return 'dash';
  if (YES.has(t)) return 'yes';
  if (NO.has(t)) return 'no';
  return 'text';
}

export const HEADING_GAP = 40;
export const HEADER_GAP = 18;
export const ROW_GAP = 8;
export const ROW_PAD_Y = 16;
export const CELL_PAD_X = 24;
export const NAME_GAP = 12;

export type TableLayout = {
  heading: Line[];
  headingH: number;
  labelW: number;
  colW: number;
  headIcon: number;
  names: Line[][];
  headerH: number;
  labels: Line[][];
  cells: Line[][][];
  kinds: CellKind[][];
  mark: number;
  rowH: number[];
  blockH: number;
};

export function layoutTable(
  input: { title: string; columns: Column[]; rows: Row[] },
  measure: Measure,
  spec: TemplateSpec = FS20_SPEC,
  headIconMax = 96,
): TableLayout {
  const C = spec.lists.columns.fields;
  const R = spec.lists.rows.fields;
  const n = Math.max(2, input.columns.length);
  const heading = input.title ? fitText(input.title, spec.text.title, SAFE_W, measure, false).lines : [];
  const headingH = heading.length ? blockHeight(heading, spec.text.title.lineHeight) + HEADING_GAP : 0;
  const labelW = n === 2 ? 440 : 380;
  const colW = (SAFE_W - labelW) / n;
  const cellW = colW - CELL_PAD_X * 2;
  const labelInner = labelW - CELL_PAD_X;
  const hasHeadMedia = input.columns.some((c) => c.icon || c.image);
  const kinds = input.rows.map((r) => r.cells.map(cellKind));
  const cellTexts = input.rows.flatMap((r, i) => r.cells.filter((_, j) => kinds[i][j] === 'text'));

  let nameCap = C.name.fontMax;
  let labelCap = R.label.fontMax;
  let cellCap = R.a.fontMax;
  let headIcon = hasHeadMedia ? Math.min(headIconMax, 88) : 0;
  const build = () => {
    const nf = sharedFont(input.columns.map((c) => c.name), C.name, cellW, measure, nameCap);
    const names = input.columns.map((c) => linesAt(c.name, nf, C.name, cellW, measure));
    const headerH = (headIcon ? headIcon + NAME_GAP : 0) + Math.max(...names.map((l) => blockHeight(l, C.name.lineHeight)));
    const lf = sharedFont(input.rows.map((r) => r.label), R.label, labelInner, measure, labelCap);
    const cf = cellTexts.length ? sharedFont(cellTexts, R.a, cellW, measure, cellCap) : cellCap;
    const mark = Math.round(cf * 1.25);
    const labels = input.rows.map((r) => linesAt(r.label, lf, R.label, labelInner, measure));
    const cells = input.rows.map((r, i) => r.cells.map((v, j) => (kinds[i][j] === 'text' ? linesAt(v, cf, R.a, cellW, measure) : [])));
    const rowH = input.rows.map((_, i) =>
      Math.round(
        ROW_PAD_Y * 2 +
          Math.max(blockHeight(labels[i], R.label.lineHeight), mark, ...cells[i].map((l) => blockHeight(l, R.a.lineHeight))),
      ),
    );
    const blockH = headingH + headerH + HEADER_GAP + rowH.reduce((a, b) => a + b, 0) + ROW_GAP * (input.rows.length - 1);
    return { names, headerH, labels, cells, mark, rowH, blockH };
  };
  let b = build();
  // shrink order: cells → row labels → column icons → column names, until the table fits 880px
  while (b.blockH > SAFE_H && (cellCap > R.a.fontMin || labelCap > R.label.fontMin || headIcon > 48 || nameCap > C.name.fontMin)) {
    if (cellCap > R.a.fontMin) cellCap -= 2;
    else if (labelCap > R.label.fontMin) labelCap -= 2;
    else if (headIcon > 48) headIcon -= 8;
    else nameCap -= 2;
    b = build();
  }
  return { heading, headingH, labelW, colW, headIcon, names: b.names, headerH: b.headerH, labels: b.labels, cells: b.cells, kinds, mark: b.mark, rowH: b.rowH, blockH: b.blockH };
}

/* ================================================================== */
/* Timing                                                               */
/* ================================================================== */

export function planTable(
  L: TableLayout,
  input: { columns: Column[]; rows: Row[] },
  anims: { title: string; row_labels: string; cells: string },
  duration: number,
  cueTimes?: number[],
): Plan {
  const T = (lines: Line[]) => lines.map((l) => l.text).join(' ');
  const units: Unit[] = [];
  let cue = 0;
  if (L.heading.length) {
    const h = T(L.heading);
    units.push({ key: 'title', label: 'Heading', start: 2, dur: textAnimFrames(anims.title, words(h).length, h.length, 18), cue: cue++ });
  }
  const headStart = L.heading.length ? 14 : 4;
  units.push({ key: 'header', label: 'Column heads', start: headStart, dur: 14 });
  const m = input.rows.length;
  const first = headStart + 16;
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const gap = m > 1 ? Math.max(8, Math.min(45, Math.floor((budget - first - 30) / (m - 1)))) : 0;
  input.rows.forEach((_, i) => units.push({ key: `row${i}`, label: `Row ${i + 1}`, start: first + i * gap, dur: 12, cue: cue++ }));
  input.columns.forEach((_, j) => {
    units.push({ key: `head${j}`, label: `Column ${j + 1} head`, start: headStart + j * 4, dur: 14, follows: { key: 'header', offset: j * 4 } });
    units.push({ key: `head${j}_icon`, label: `Column ${j + 1} icon`, start: headStart + j * 4 + 2, dur: 14, follows: { key: 'header', offset: j * 4 + 2 } });
  });
  input.rows.forEach((r, i) => {
    const s0 = first + i * gap;
    const lt = T(L.labels[i]);
    units.push({ key: `row${i}_label`, label: `Row ${i + 1} label`, start: s0 + 2, dur: textAnimFrames(anims.row_labels, words(lt).length, lt.length, 14), follows: { key: `row${i}`, offset: 2 } });
    r.cells.forEach((v, j) => {
      const t = L.cells[i][j].map((l) => l.text).join(' ');
      units.push({
        key: `row${i}_cell${j}`,
        label: `Row ${i + 1} cell ${j + 1}`,
        start: s0 + 5 + j * 3,
        dur: L.kinds[i][j] === 'text' ? textAnimFrames(anims.cells, words(t).length, t.length, 14) : 14,
        follows: { key: `row${i}`, offset: 5 + j * 3 },
      });
    });
    if (r.best) units.push({ key: `row${i}_best`, label: `Row ${i + 1} best`, start: s0 + 14, dur: 12, follows: { key: `row${i}`, offset: 14 } });
  });
  return planTimeline(duration, units, cueTimes);
}

export function suggestedDurationFS20(rows: number, hasHeading: boolean): number {
  return Math.max(90, Math.min(240, (hasHeading ? 30 : 20) + rows * 40 + 40));
}

/* ================================================================== */
/* Props → layout → plan (shared by the renderer and the preview)       */
/* ================================================================== */

const str = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
  }
  return undefined;
};

function readTable(props: Record<string, unknown>): { columns: Column[]; rows: Row[] } {
  const CS = FS20_SPEC.lists.columns;
  const RS = FS20_SPEC.lists.rows;
  const rawC = Array.isArray(props.columns) ? props.columns : [];
  const columns = rawC
    .map((c): Column | null => {
      if (typeof c === 'string') return { name: c };
      if (!c || typeof c !== 'object') return null;
      const o = c as Record<string, unknown>;
      const name = str(o, ['name', 'title', 'label']);
      return name ? { name, icon: str(o, ['icon', 'icon_name']), image: str(o, ['image_url', 'image']), bg: readHex(o.bg_color) } : null;
    })
    .filter((c): c is Column => c !== null)
    .slice(0, CS.maxItems)
    .map((c) => ({ ...c, name: normaliseText(c.name, CS.fields.name) }));
  const n = columns.length;
  const rawR = Array.isArray(props.rows) ? props.rows : [];
  const rows = rawR
    .map((r): Row | null => {
      if (!r || typeof r !== 'object') return null;
      const o = r as Record<string, unknown>;
      const label = str(o, ['label', 'name', 'attribute']);
      if (!label) return null;
      const arr = Array.isArray(o.cells) ? (o.cells as unknown[]).map((x) => (typeof x === 'string' ? x : typeof x === 'number' ? String(x) : typeof x === 'boolean' ? (x ? 'yes' : 'no') : '')) : null;
      const cells = ['a', 'b', 'c'].slice(0, n).map((k, j) => normaliseText(arr ? arr[j] ?? '' : str(o, [k]) ?? '', RS.fields.a) || '–');
      const best = typeof o.best === 'number' && Number.isInteger(o.best) && o.best >= 1 && o.best <= n ? o.best : undefined;
      return { label: normaliseText(label, RS.fields.label), cells, best };
    })
    .filter((r): r is Row => r !== null)
    .slice(0, RS.maxItems);
  return { columns, rows };
}

export function prepareFS20(props: Record<string, unknown>, durationInFrames: number) {
  const A = (k: string) => readAnim(props, FS20_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(FS20_SPEC, props);
  const measure = measureFor(style);
  const title = normaliseText(readFirst(props, ['title', 'heading']), FS20_SPEC.text.title);
  const table = readTable(props);
  const hc = readNonEmptyString(props, 'highlight_column');
  const highlightCol = hc && ['1', '2', '3'].includes(hc) && Number(hc) <= table.columns.length ? Number(hc) - 1 : -1;
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const debug = props.show_safe_area === true;
  const L = layoutTable({ title, ...table }, measure, sized.spec);
  const plan = planTable(L, table, { title: A('title'), row_labels: A('row_labels'), cells: A('cells') }, durationInFrames, readCues(props));
  return { style, sized, A, table, highlightCol, imageUrl, bg, debug, L, plan };
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */

function FS20ComparisonColumnsBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, table, highlightCol, imageUrl, bg, debug, L, plan } = prepareFS20(props, durationInFrames);
  const w = plan.windows;
  const C = FS20_SPEC.lists.columns.fields;
  const R = FS20_SPEC.lists.rows.fields;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const muted = mutedFor(style, onFootage);
  const card = cardColors(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const tableH = L.headerH + HEADER_GAP + L.rowH.reduce((a, b) => a + b, 0) + ROW_GAP * (table.rows.length - 1);

  const mark = (kind: CellKind, i: number, j: number) => {
    const win = w[`row${i}_cell${j}`];
    const st = iconStyle(A('marks'), progress(frame, win.start, win.dur));
    if (kind === 'dash') return <div {...leaf(`cell-${i}-${j}`, `rows[${i}].${'abc'[j]}`)} style={{ width: L.mark * 0.5, height: 5, borderRadius: 3, background: withAlpha(style.colors.muted, 0.6), ...st }} />;
    const yes = kind === 'yes';
    return (
      <div
        {...leaf(`cell-${i}-${j}`, `rows[${i}].${'abc'[j]}`)}
        style={{ width: L.mark, height: L.mark, borderRadius: '50%', background: withAlpha(yes ? style.colors.positive : style.colors.negative, 0.18), display: 'flex', alignItems: 'center', justifyContent: 'center', ...st }}
      >
        <LucideIconView name={yes ? 'check' : 'x'} size={Math.round(L.mark * 0.62)} color={yes ? style.colors.positive : style.colors.negative} />
      </div>
    );
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />

      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', ...exit }}>
          {L.heading.length > 0 && w.title && (
            <AnimatedText
              lines={L.heading}
              anim={A('title')}
              start={w.title.start}
              dur={w.title.dur}
              frame={frame}
              weight={FS20_SPEC.text.title.weight}
              lineHeight={FS20_SPEC.text.title.lineHeight}
              letterSpacing="-0.02em"
              shadow={shadow}
              align="center"
              group="title"
              input="title"
              style={{ marginBottom: HEADING_GAP }}
            />
          )}

          <div style={{ position: 'relative', width: SAFE_W, height: tableH }}>
            {/* a background panel behind every column: bg_color when given, otherwise a soft card tint;
                the highlighted column also gets the accent outline */}
            {table.columns.map((c, j) => {
              const hl = j === highlightCol;
              const fillC = c.bg ?? (hl ? withAlpha(accent, 0.1) : withAlpha(style.colors.text, 0.04));
              return (
                <div
                  key={`band${j}`}
                  style={{
                    position: 'absolute',
                    left: L.labelW + j * L.colW + 6,
                    top: 0,
                    width: L.colW - 12,
                    height: tableH,
                    borderRadius: 24,
                    background: fillC,
                    border: hl ? `2px solid ${withAlpha(accent, 0.5)}` : `1px solid ${withAlpha(style.colors.text, 0.06)}`,
                    boxSizing: 'border-box',
                    ...cardStyle('fade', progress(frame, w.header.start, w.header.dur)),
                  }}
                />
              );
            })}

            {/* column heads */}
            <div style={{ position: 'absolute', left: L.labelW, top: 0, width: SAFE_W - L.labelW, height: L.headerH, display: 'flex' }}>
              {table.columns.map((c, j) => {
                const hw = w[`head${j}`];
                const iw = w[`head${j}_icon`];
                return (
                  <div key={j} style={{ width: L.colW, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', ...cardStyle(A('header'), progress(frame, hw.start, hw.dur)) }}>
                    {L.headIcon > 0 && (
                      <div style={{ height: L.headIcon, marginBottom: NAME_GAP, display: 'flex', alignItems: 'center' }}>
                        {c.image ? (
                          <div {...leaf(`head-${j}-media`, `columns[${j}].image_url`)} style={{ width: L.headIcon, height: L.headIcon, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${accent}`, boxSizing: 'border-box', ...iconStyle(A('header_icons'), progress(frame, iw.start, iw.dur)) }}>
                            <Img src={c.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : c.icon ? (
                          <div {...leaf(`head-${j}-media`, `columns[${j}].icon`)} style={{ width: L.headIcon, height: L.headIcon, borderRadius: '50%', background: style.colors.icon_bg, display: 'flex', alignItems: 'center', justifyContent: 'center', ...iconStyle(A('header_icons'), progress(frame, iw.start, iw.dur)) }}>
                            <LucideIconView name={c.icon} size={Math.round(L.headIcon * 0.5)} color={style.colors.icon} />
                          </div>
                        ) : null}
                      </div>
                    )}
                    <AnimatedText
                      lines={L.names[j]}
                      anim="none"
                      start={hw.start}
                      dur={hw.dur}
                      frame={frame}
                      weight={C.name.weight}
                      lineHeight={C.name.lineHeight}
                      color={j === highlightCol ? accent : style.colors.text}
                      shadow={shadow}
                      align="center"
                      group={`head-${j}-name`}
                      input={`columns[${j}].name`}
                    />
                  </div>
                );
              })}
            </div>

            {/* rows */}
            {table.rows.map((r, i) => {
              const top = L.headerH + HEADER_GAP + L.rowH.slice(0, i).reduce((a, b) => a + b, 0) + ROW_GAP * i;
              const rw = w[`row${i}`];
              const lw = w[`row${i}_label`];
              const bw = w[`row${i}_best`];
              const best = r.best !== undefined ? r.best - 1 : -1;
              const bestState = bw ? shapeState(A('winner'), progress(frame, bw.start, bw.dur)) : null;
              return (
                <div key={i} style={{ position: 'absolute', left: 0, top, width: SAFE_W, height: L.rowH[i] }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: i % 2 === 0 ? card.fill : 'transparent', border: i % 2 === 0 ? `1px solid ${card.border}` : 'none', boxSizing: 'border-box', ...cardStyle(A('rows'), progress(frame, rw.start, rw.dur)) }} />
                  <div style={{ position: 'absolute', left: CELL_PAD_X, top: 0, width: L.labelW - CELL_PAD_X, height: L.rowH[i], display: 'flex', alignItems: 'center' }}>
                    <AnimatedText
                      lines={L.labels[i]}
                      anim={A('row_labels')}
                      start={lw.start}
                      dur={lw.dur}
                      frame={frame}
                      weight={R.label.weight}
                      lineHeight={R.label.lineHeight}
                      color={muted}
                      shadow={shadow}
                      group={`row-${i}-label`}
                      input={`rows[${i}].label`}
                    />
                  </div>
                  {r.cells.map((v, j) => {
                    const cw = w[`row${i}_cell${j}`];
                    const isBest = j === best && bestState;
                    const cellStyle: CSSProperties = { position: 'absolute', left: L.labelW + j * L.colW, top: 0, width: L.colW, height: L.rowH[i], display: 'flex', alignItems: 'center', justifyContent: 'center' };
                    return (
                      <div key={j} style={cellStyle}>
                        {isBest && (
                          <div
                            style={{
                              position: 'absolute',
                              left: 14,
                              right: 14,
                              top: 6,
                              bottom: 6,
                              borderRadius: 14,
                              background: withAlpha(accent, 0.2),
                              border: `2px solid ${withAlpha(accent, 0.8)}`,
                              ...bestState.style,
                              transform: `${bestState.style.transform ?? ''} scaleX(${bestState.length})`.trim(),
                            }}
                          />
                        )}
                        {L.kinds[i][j] === 'text' ? (
                          <AnimatedText
                            lines={L.cells[i][j]}
                            anim={A('cells')}
                            start={cw.start}
                            dur={cw.dur}
                            frame={frame}
                            weight={R.a.weight}
                            lineHeight={R.a.lineHeight}
                            color={isBest ? accent : style.colors.text}
                            shadow={shadow}
                            align="center"
                            group={`cell-${i}-${j}`}
                            input={`rows[${i}].${'abc'[j]}`}
                            style={{ position: 'relative' }}
                          />
                        ) : (
                          <div style={{ position: 'relative' }}>{mark(L.kinds[i][j], i, j)}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const FS20ComparisonColumns = withAutoFit(FS20ComparisonColumnsBase);
