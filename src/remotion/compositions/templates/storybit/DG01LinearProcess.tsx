'use client';

/**
 * DG-01 · Linear Process  (animation_type: "dg_linear_process")
 * Step 1 → 2 → … → N with drawn connectors; steps reveal one after another.
 *
 * Content limits live in DG01_SPEC (processLayout.ts):
 *   title (heading)  optional  3–40 chars · 1–8 words · 1 line · 64→44px
 *   steps[] 3–6
 *     title   required  2–25 chars · 1–4 words  · 2 lines (1 in vertical) · 40→26px · longest word 14
 *     desc    optional  10–60 chars · 2–10 words · 3 lines (1 in vertical) · 28→20px
 *     value   optional  1–12 chars · 1–2 words  · 1 line · 40→24px
 *     icon    optional  Lucide name (numbers are used when any step lacks one)
 * Node, icon and connector sizes derive from the column/row size.
 * Timing: 3–8s. Optional cue_times: [heading?, step 1, step 2, …] in seconds from the template start.
 * Animations: props.animations = { heading, nodes, node_icons, connectors, step_titles, step_values,
 *   step_descs, image_motion, image_entry, exit }.
 * Options: orientation, marker "auto" | "icon" | "number", highlight (default on), background,
 *          image_url, accent_color, show_safe_area.
 */
import type { CSSProperties } from 'react';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { normaliseText, readAnim, type TemplateSpec, BACKGROUND_IMAGE, applySizes } from './core/contentSpec';
import { exitStyle, iconStyle, progress, shapeState, textAnimFrames } from './core/motion';
import { readCues, MIN_HOLD, exitFrames, planTimeline, type Plan, type Unit } from './core/timeline';
import { measureFor } from './core/measure';
import { cardColors, fontFor, mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { FOOTAGE_SHADOW, AnimatedText, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';
import { blockHeight, fitText, linesAt, sharedFont, type Line, type Measure, words } from './core/fit';

/* ================================================================== */
/* Content spec, layout and timing                                     */
/* ================================================================== */

export const DG01_SPEC: TemplateSpec = {
  id: 'DG-01',
  animationType: 'dg_linear_process',
  name: 'Linear Process',
  pickWhen: 'Explaining how something works step by step: a workflow, a procedure, a pipeline, a supply chain with a value at each stage.',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 210, max: 240, perItemFrames: 45 },
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
      hint: 'What the process is, e.g. "How a UPI payment works".',
      fills: 'Heading above the steps',
    },
  },
  lists: {
    steps: {
      label: 'Step',
      fills: 'Steps, left to right (or top to bottom)',
      minItems: 3,
      maxItems: 6,
      icon: { required: false, fallback: 'number' },
      fields: {
        title: {
          label: 'Title',
          required: true,
          minChars: 2,
          maxChars: 25,
          minWords: 1,
          maxWords: 4,
          maxWordChars: 14,
          maxLines: 2,
          fontMax: 40,
          fontMin: 26,
          weight: 600,
          lineHeight: 1.2,
          hint: 'Verb-first: "Scan the QR code".',
          fills: 'Step title under the circle',
        },
        desc: {
          label: 'Description',
          required: false,
          minChars: 10,
          maxChars: 60,
          minWords: 2,
          maxWords: 10,
          maxWordChars: 14,
          maxLines: 3,
          fontMax: 28,
          fontMin: 20,
          weight: 500,
          lineHeight: 1.35,
          hint: 'One short supporting line.',
          fills: 'Step description under the title',
        },
        value: {
          label: 'Value',
          required: false,
          minChars: 1,
          maxChars: 12,
          minWords: 1,
          maxWords: 2,
          maxWordChars: 10,
          maxLines: 1,
          fontMax: 40,
          fontMin: 24,
          weight: 800,
          lineHeight: 1.1,
          hint: 'A number for the step: "₹40/kg", "2 days".',
          fills: 'Accent-coloured value under the step title',
        },
      },
    },
  },
  options: {
    orientation: { label: 'Orientation', values: ['horizontal', 'vertical'], default: 'horizontal', fills: 'Steps in a row or a column' },
    marker: { label: 'Marker', values: ['auto', 'icon', 'number'], default: 'auto', fills: 'What shows inside each circle (auto = icons when every step has one)' },
    highlight: { label: 'Highlight current step', values: ['on', 'off'], default: 'on', fills: 'Newest step filled, earlier steps outlined' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    heading: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    nodes: { label: 'Step circles', kind: 'icon', target: 'circle of each step', default: 'pop' },
    node_icons: { label: 'Step icons / numbers', kind: 'icon', target: 'icon or number inside each circle', default: 'fade' },
    connectors: { label: 'Connectors', kind: 'shape', target: 'line between steps', default: 'grow' },
    step_titles: { label: 'Step titles', kind: 'text', target: 'title of each step', default: 'fade_up' },
    step_values: { label: 'Step values', kind: 'text', target: 'value of each step', default: 'scale_in' },
    step_descs: { label: 'Step descriptions', kind: 'text', target: 'description of each step', default: 'fade_up' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: {
    description: 'First cue = heading (if present), then one cue per step (when the narrator starts that step).',
    units: ['heading', 'step 1', 'step 2', 'step 3', 'step 4', 'step 5', 'step 6'],
  },
  colors: ['icon', 'card', 'card_border', 'on_accent'],
  example: {
    title: 'How a UPI payment works',
    steps: [
      { icon: 'smartphone', title: 'Scan the QR code', desc: "Open any UPI app and scan the shop's code" },
      { icon: 'banknote', title: 'Enter the amount', desc: 'Type what you owe and add a note' },
      { icon: 'lock', title: 'Confirm with UPI PIN', desc: 'Your PIN approves the transfer' },
      { icon: 'check', title: 'Money reaches the shop', desc: 'Bank to bank in a few seconds' },
    ],
    orientation: 'horizontal',
    marker: 'auto',
    highlight: 'on',
    background: 'theme',
    cue_times: [0.1, 0.9, 2.2, 3.4, 4.8],
  },
};

export const HEADING_GAP = 64;
export const H_GAP = 40;
export const NODE_TO_TEXT = 28;
export const VALUE_GAP = 8;
export const DESC_GAP = 12;
export const VERTICAL_MAX_W = 1280;
export const VERTICAL_ROW_MAX = 130;
export const VERTICAL_TEXT_GAP = 40;
export const VERTICAL_VALUE_W = 260;

export type Orientation = 'horizontal' | 'vertical';
export type Step = { title: string; desc?: string; icon?: string; value?: string };

export type StepLayout = { title: Line[]; desc: Line[]; value?: Line };

export type ProcessLayout = {
  orientation: Orientation;
  n: number;
  heading: Line[];
  headingH: number;
  node: number;
  iconSize: number;
  connector: number;
  colW: number;
  rowH: number;
  width: number;
  textW: number;
  valueW: number;
  titleFont: number;
  descFont: number;
  valueFont: number;
  steps: StepLayout[];
  blockH: number;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function layoutProcess(
  input: { heading?: string; steps: Step[]; orientation: Orientation },
  measure: Measure,
  spec: TemplateSpec = DG01_SPEC,
): ProcessLayout {
  const F = spec.lists.steps.fields;
  const n = Math.max(1, input.steps.length);
  const heading = input.heading ? fitText(input.heading, spec.text.title, SAFE_W, measure, false).lines : [];
  const headingH = heading.length ? blockHeight(heading, spec.text.title.lineHeight) + HEADING_GAP : 0;
  const titles = input.steps.map((s) => s.title);
  const descs = input.steps.map((s) => s.desc ?? '');
  const values = input.steps.map((s) => s.value ?? '');
  const hasDesc = descs.some(Boolean);
  const hasValue = values.some(Boolean);

  if (input.orientation === 'horizontal') {
    const colW = (SAFE_W - (n - 1) * H_GAP) / n;
    let node = clamp(Math.round(colW * 0.4), 72, 132);
    let titleCap = F.title.fontMax;
    let descCap = F.desc.fontMax;
    const build = () => {
      const titleFont = sharedFont(titles, F.title, colW, measure, titleCap);
      const valueFont = hasValue ? sharedFont(values, F.value, colW, measure, titleFont) : 0;
      const descFont = hasDesc ? sharedFont(descs, F.desc, colW, measure, Math.min(descCap, Math.round(titleFont * 0.75))) : 0;
      const steps = input.steps.map((s) => ({
        title: linesAt(s.title, titleFont, F.title, colW, measure),
        desc: s.desc ? linesAt(s.desc, descFont, F.desc, colW, measure, false) : [],
        value: s.value ? linesAt(s.value, valueFont, F.value, colW, measure, false)[0] : undefined,
      }));
      const textH = Math.max(
        ...steps.map(
          (s) =>
            blockHeight(s.title, F.title.lineHeight) +
            (s.value ? VALUE_GAP + s.value.size * F.value.lineHeight : 0) +
            (s.desc.length ? DESC_GAP + blockHeight(s.desc, F.desc.lineHeight) : 0),
        ),
      );
      return { titleFont, valueFont, descFont, steps, blockH: headingH + node + NODE_TO_TEXT + textH };
    };
    let b = build();
    // shrink order: description → title → node, until the block fits the safe height
    while (b.blockH > SAFE_H && (descCap > F.desc.fontMin || titleCap > F.title.fontMin || node > 72)) {
      if (descCap > F.desc.fontMin) descCap -= 2;
      else if (titleCap > F.title.fontMin) titleCap -= 2;
      else node -= 4;
      b = build();
    }
    return {
      orientation: 'horizontal',
      n,
      heading,
      headingH,
      node,
      iconSize: Math.round(node * 0.42),
      connector: Math.max(4, Math.round(node * 0.05)),
      colW,
      rowH: 0,
      width: SAFE_W,
      textW: colW,
      valueW: colW,
      ...b,
    };
  }

  // vertical
  const width = Math.min(SAFE_W, VERTICAL_MAX_W);
  const rowH = Math.min(VERTICAL_ROW_MAX, (SAFE_H - headingH) / n);
  const node = Math.round(Math.min(96, rowH * 0.62));
  const valueW = hasValue ? VERTICAL_VALUE_W : 0;
  const textW = width - node - VERTICAL_TEXT_GAP - (hasValue ? valueW + 24 : 0);
  const t1 = { ...F.title, maxLines: 1 };
  const d1 = { ...F.desc, maxLines: 1 };
  const titleFont = sharedFont(titles, t1, textW, measure, Math.floor(rowH * 0.34));
  const descFont = hasDesc ? sharedFont(descs, d1, textW, measure, Math.min(Math.round(titleFont * 0.75), Math.floor(rowH * 0.24))) : 0;
  const valueFont = hasValue ? sharedFont(values, F.value, valueW, measure, Math.round(titleFont * 1.1)) : 0;
  const steps = input.steps.map((s) => ({
    title: linesAt(s.title, titleFont, t1, textW, measure, false),
    desc: s.desc ? linesAt(s.desc, descFont, d1, textW, measure, false) : [],
    value: s.value ? linesAt(s.value, valueFont, F.value, valueW, measure, false)[0] : undefined,
  }));
  return {
    orientation: 'vertical',
    n,
    heading,
    headingH,
    node,
    iconSize: Math.round(node * 0.42),
    connector: Math.max(4, Math.round(node * 0.06)),
    colW: 0,
    rowH,
    width,
    textW,
    valueW,
    titleFont,
    descFont,
    valueFont,
    steps,
    blockH: headingH + rowH * n,
  };
}

/**
 * Beat-synced plan: heading → steps. Each step's circle, icon, title, value and description
 * follow the step's start; connectors are drawn between consecutive step starts.
 */
export function planProcess(
  L: ProcessLayout,
  anims: { heading: string; step_titles: string; step_values: string; step_descs: string },
  duration: number,
  cueTimes?: number[],
): Plan {
  const units: Unit[] = [];
  const hasHeading = L.heading.length > 0;
  let cue = 0;
  if (hasHeading) {
    const h = L.heading.map((l) => l.text).join(' ');
    units.push({ key: 'heading', label: 'Heading', start: 2, dur: textAnimFrames(anims.heading, words(h).length, h.length, 18), cue: cue++ });
  }
  const n = L.steps.length;
  const first = hasHeading ? 20 : 6;
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const gap = n > 1 ? Math.max(8, Math.min(45, Math.floor((budget - first - 26) / (n - 1)))) : 0;
  L.steps.forEach((st, i) => {
    const s0 = first + i * gap;
    units.push({ key: `step${i}`, label: `Step ${i + 1}`, start: s0, dur: 14, cue: cue++ });
  });
  L.steps.forEach((st, i) => {
    const s0 = first + i * gap;
    const tt = st.title.map((l) => l.text).join(' ');
    units.push({ key: `step${i}_icon`, label: `Step ${i + 1} icon`, start: s0 + 3, dur: 12, follows: { key: `step${i}`, offset: 3 } });
    units.push({ key: `step${i}_title`, label: `Step ${i + 1} title`, start: s0 + 6, dur: textAnimFrames(anims.step_titles, words(tt).length, tt.length, 16), follows: { key: `step${i}`, offset: 6 } });
    if (st.value) units.push({ key: `step${i}_value`, label: `Step ${i + 1} value`, start: s0 + 9, dur: textAnimFrames(anims.step_values, 1, st.value.text.length, 14), follows: { key: `step${i}`, offset: 9 } });
    if (st.desc.length) {
      const d = st.desc.map((l) => l.text).join(' ');
      units.push({ key: `step${i}_desc`, label: `Step ${i + 1} description`, start: s0 + 10, dur: textAnimFrames(anims.step_descs, words(d).length, d.length, 16), follows: { key: `step${i}`, offset: 10 } });
    }
  });
  return planTimeline(duration, units, cueTimes);
}

/** Suggested duration: 1.5s per step plus intro and hold, within 3–8s. */
export function suggestedDuration(n: number, hasHeading: boolean): number {
  return Math.max(90, Math.min(240, (hasHeading ? 20 : 6) + n * 45 + 44));
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */


function readSteps(props: Record<string, unknown>): Step[] {
  const spec = DG01_SPEC.lists.steps;
  const raw = props.steps ?? props.items;
  if (!Array.isArray(raw)) return [];
  const str = (o: Record<string, unknown>, keys: string[]) => {
    for (const k of keys) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) return v;
      if (typeof v === 'number') return String(v);
    }
    return undefined;
  };
  return raw
    .map((s): Step | null => {
      if (typeof s === 'string') return { title: s };
      if (!s || typeof s !== 'object') return null;
      const o = s as Record<string, unknown>;
      const title = str(o, ['title', 'label', 'text', 'name']);
      return title ? { title, desc: str(o, ['desc', 'description', 'detail']), icon: str(o, ['icon', 'icon_name']), value: str(o, ['value']) } : null;
    })
    .filter((s): s is Step => s !== null)
    .slice(0, spec.maxItems)
    .map((s) => ({
      title: normaliseText(s.title, spec.fields.title),
      desc: normaliseText(s.desc, spec.fields.desc) || undefined,
      value: normaliseText(s.value, spec.fields.value) || undefined,
      icon: s.icon?.trim() || undefined,
    }))
    .filter((s) => s.title);
}

/** Reads props, fits the layout and plans the timeline — shared by the renderer and the preview. */
export function prepareDG01(props: Record<string, unknown>, durationInFrames: number) {
  const F = DG01_SPEC.lists.steps.fields;

  const heading = normaliseText(readFirst(props, ['title', 'heading', 'headline']), DG01_SPEC.text.title);
  const steps = readSteps(props);
  const orientation: Orientation = readNonEmptyString(props, 'orientation') === 'vertical' ? 'vertical' : 'horizontal';
  const markerProp = readNonEmptyString(props, 'marker');
  const useIcons = markerProp === 'icon' || markerProp === 'number' ? markerProp === 'icon' : steps.length > 0 && steps.every((s) => s.icon);
  const highlight = props.highlight !== false && props.highlight !== 'off';
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const style = readStyle(props);
  const accent = style.colors.accent;
  const sized = applySizes(DG01_SPEC, props);
  const measure = measureFor(style);
  const debug = props.show_safe_area === true;

  const A = (k: string) => readAnim(props, DG01_SPEC, k);
  const L = layoutProcess({ heading, steps, orientation }, measure, sized.spec);
  const plan = planProcess(
    L,
    { heading: A('heading'), step_titles: A('step_titles'), step_values: A('step_values'), step_descs: A('step_descs') },
    durationInFrames,
    readCues(props),
  );
  return { style, sized, F, heading, steps, orientation, markerProp, useIcons, highlight, imageUrl, bg, accent, debug, A, L, plan };
}

export function DG01LinearProcess({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, F, steps, useIcons, highlight, imageUrl, bg, accent, debug, A, L, plan } = prepareDG01(props, durationInFrames);
  const w = plan.windows;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const descColor = mutedFor(style, onFootage);

  let active = -1;
  steps.forEach((_, i) => {
    if (frame >= w[`step${i}`].start) active = i;
  });
  const dim = (i: number) => (highlight && i < active ? 0.72 : 1);

  const renderNode = (i: number, step: Step) => {
    const nw = w[`step${i}`];
    const iw = w[`step${i}_icon`];
    const isActive = !highlight || i === active;
    const fg = isActive ? style.colors.on_accent : style.colors.icon;
    return (
      <div
        {...leaf(`node-${i}`, `steps[${i}] circle`)}
        style={{
          width: L.node,
          height: L.node,
          boxSizing: 'border-box',
          borderRadius: '50%',
          background: isActive ? accent : cardColors(style, onFootage).fill,
          border: `${Math.max(2, Math.round(L.node * 0.03))}px solid ${accent}`,
          boxShadow: isActive && highlight ? `0 0 0 ${L.node * 0.1}px ${withAlpha(accent, 0.2)}` : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          ...iconStyle(A('nodes'), progress(frame, nw.start, nw.dur)),
        }}
      >
        <div {...leaf(`node-${i}`, useIcons && step.icon ? `steps[${i}].icon` : `step number`)} style={{ display: 'flex', ...iconStyle(A('node_icons'), progress(frame, iw.start, iw.dur)) }}>
          {useIcons && step.icon ? (
            <LucideIconView name={step.icon} size={L.iconSize} color={fg} />
          ) : (
            <span style={{ fontFamily: fontFor(800), fontSize: Math.round(L.node * 0.4), fontWeight: 800, color: fg, lineHeight: 1 }}>{i + 1}</span>
          )}
        </div>
      </div>
    );
  };

  const connector = (i: number, pos: CSSProperties, horizontal: boolean, len: number) => {
    const a = w[`step${i}`].start + Math.round(w[`step${i}`].dur * 0.8);
    const b = w[`step${i + 1}`].start + 2;
    const st = shapeState(A('connectors'), progress(frame, a, Math.max(4, b - a)));
    return (
      <div key={`c${i}`} {...leaf(`conn-${i}`, 'connector')} style={{ position: 'absolute', ...pos }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: L.connector, background: cardColors(style, onFootage).border }} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            borderRadius: L.connector,
            background: accent,
            ...(horizontal ? { bottom: 0, width: len * st.length } : { right: 0, height: len * st.length }),
            ...st.style,
          }}
        />
      </div>
    );
  };

  const text = (i: number, part: 'title' | 'desc' | 'value', align: 'left' | 'center' | 'right') => {
    const S = L.steps[i];
    const win = w[`step${i}_${part}`];
    if (!win) return null;
    const lines = part === 'title' ? S.title : part === 'desc' ? S.desc : S.value ? [S.value] : [];
    const spec = F[part];
    const anim = A(part === 'title' ? 'step_titles' : part === 'desc' ? 'step_descs' : 'step_values');
    return (
      <AnimatedText
        lines={lines}
        anim={anim}
        start={win.start}
        dur={win.dur}
        frame={frame}
        weight={spec.weight}
        lineHeight={spec.lineHeight}
        color={part === 'desc' ? descColor : part === 'value' ? accent : style.colors.text}
        shadow={shadow}
        align={align}
        group={`step-${i}-${part}`}
        input={`steps[${i}].${part}`}
        style={{ opacity: dim(i) }}
      />
    );
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="left" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />

      <SafeArea debug={debug}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: (SAFE_H - L.blockH) / 2,
            width: SAFE_W,
            height: L.blockH,
            ...exit,
          }}
        >
          {L.heading.length > 0 && (
            <div style={{ marginBottom: HEADING_GAP }}>
              <AnimatedText
                lines={L.heading}
                anim={A('heading')}
                start={w.heading.start}
                dur={w.heading.dur}
                frame={frame}
                weight={DG01_SPEC.text.title.weight}
                lineHeight={DG01_SPEC.text.title.lineHeight}
                letterSpacing="-0.02em"
                shadow={shadow}
                group="heading"
                input="title"
              />
            </div>
          )}

          {L.orientation === 'horizontal' ? (
            <div style={{ position: 'relative', display: 'flex', gap: H_GAP }}>
              {steps.slice(0, -1).map((_, i) => {
                const len = L.colW + H_GAP - L.node - 20;
                return connector(
                  i,
                  { left: i * (L.colW + H_GAP) + L.colW / 2 + L.node / 2 + 10, top: L.node / 2 - L.connector / 2, width: len, height: L.connector },
                  true,
                  len,
                );
              })}
              {steps.map((step, i) => {
                return (
                  <div key={i} style={{ width: L.colW, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    {renderNode(i, step)}
                    <div style={{ marginTop: NODE_TO_TEXT }}>{text(i, 'title', 'center')}</div>
                    {L.steps[i].value && <div style={{ marginTop: VALUE_GAP }}>{text(i, 'value', 'center')}</div>}
                    {L.steps[i].desc.length > 0 && <div style={{ marginTop: DESC_GAP }}>{text(i, 'desc', 'center')}</div>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ position: 'relative', width: L.width }}>
              {steps.slice(0, -1).map((_, i) => {
                const len = L.rowH - L.node - 16;
                return connector(
                  i,
                  { left: L.node / 2 - L.connector / 2, top: i * L.rowH + L.rowH / 2 + L.node / 2 + 8, width: L.connector, height: len },
                  false,
                  len,
                );
              })}
              {steps.map((step, i) => {
                return (
                  <div key={i} style={{ height: L.rowH, display: 'flex', alignItems: 'center', gap: VERTICAL_TEXT_GAP }}>
                    {renderNode(i, step)}
                    <div style={{ width: L.textW, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      {text(i, 'title', 'left')}
                      {L.steps[i].desc.length > 0 && text(i, 'desc', 'left')}
                    </div>
                    {L.steps[i].value && <div style={{ width: L.valueW, marginLeft: 24, display: 'flex', justifyContent: 'flex-end' }}>{text(i, 'value', 'right')}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SafeArea>
    </div>
  );
}
