'use client';

/**
 * EM-04 · Scribble Annotation  (animation_type: "em_scribble")   — overlay on footage
 * Hand-drawn marks over the video: a rough circle, underline, box, arrow, cross or tick drawn around a
 * spot, with a handwritten note beside it ("this guy!", "₹40 here"). 1–3 marks, drawn one after another.
 *
 * Inputs (full list, limits and JSON Schema: EM04ScribbleAnnotation.inputs.json):
 *   marks[] { shape, x, y, w, h, label } · color · stroke
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [mark 1, mark 2, mark 3]
 * x / y / w / h: the spot to mark, in % of the frame (0–100, from the top-left). Handwriting: Kalam.
 * Timing: 1.5–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readNonEmptyString } from '../../../props';
import { readAnim, normaliseText, applySizes, type Issue, type TemplateSpec, type TextSpec } from './core/contentSpec';
import { measureWith } from './core/measure';
import { fitText, type Line, type Measure } from './core/fit';
import { exitStyle, progress } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { readNumber } from './core/numbers';
import { OVERLAY_DURATION } from './core/overlay';
import { SafeArea, SAFE_H, SAFE_W, SAFE_MARGIN, FRAME_W, FRAME_H } from './core/safeArea';
import { placeNear, type Box } from './core/placement';
import { fontStack, readStyle, styleVars } from './core/style';
import { guide, leaf } from './core/shared';

export const HAND = fontStack('kalam');
const LABEL: TextSpec = { label: 'Note', required: false, minChars: 1, maxChars: 30, minWords: 1, maxWords: 6, maxWordChars: 16, maxLines: 2, fontMax: 56, fontMin: 30, weight: 700, lineHeight: 1.1, fills: 'Handwritten note beside the mark' };
const SHAPES = ['circle', 'underline', 'box', 'arrow', 'cross', 'tick'] as const;
type Shape = (typeof SHAPES)[number];

export const EM04_SPEC: TemplateSpec = {
  id: 'EM-04',
  animationType: 'em_scribble',
  name: 'Scribble Annotation',
  pickWhen: 'Pointing at something inside the footage: circle a face, underline a line in a document, cross out a claim.',
  placement: 'overlay',
  duration: OVERLAY_DURATION,
  text: {},
  lists: {},
  custom: {
    inputs: [
      { path: 'marks[]', type: 'list', required: true, fills: 'Marks, drawn in order', limits: '1–3' },
      { path: 'marks[].shape', type: 'choice', required: true, fills: 'circle · underline · box · arrow (points at the spot) · cross · tick', values: [...SHAPES] },
      { path: 'marks[].x', type: 'number', required: true, fills: 'Left edge of the spot, % of frame width', limits: '0–100' },
      { path: 'marks[].y', type: 'number', required: true, fills: 'Top edge of the spot, % of frame height', limits: '0–100' },
      { path: 'marks[].w', type: 'number', required: true, fills: 'Width of the spot, % of frame width', limits: '1–100' },
      { path: 'marks[].h', type: 'number', required: true, fills: 'Height of the spot, % of frame height', limits: '1–100' },
      { path: 'marks[].label', type: 'text', required: false, fills: 'Handwritten note beside the mark', limits: '1–30 chars · up to 2 lines' },
    ],
    schema: {
      marks: {
        type: 'array',
        minItems: 1,
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['shape', 'x', 'y', 'w', 'h'],
          properties: {
            shape: { type: 'string', enum: [...SHAPES] },
            x: { type: 'number', minimum: 0, maximum: 100 },
            y: { type: 'number', minimum: 0, maximum: 100 },
            w: { type: 'number', minimum: 1, maximum: 100 },
            h: { type: 'number', minimum: 1, maximum: 100 },
            label: { type: 'string', minLength: 1, maxLength: 30 },
          },
        },
      },
    },
    required: ['marks'],
  },
  options: {
    color: { label: 'Marker colour', values: ['red', 'yellow', 'white', 'accent'], default: 'red', fills: 'Colour of the marks and notes' },
    stroke: { label: 'Stroke', values: ['thin', 'medium', 'thick'], default: 'medium', fills: 'Marker thickness' },
  },
  animations: {
    marks: { label: 'Marks', kind: 'shape', target: 'each mark (drawn like a pen stroke)', default: 'grow' },
    labels: { label: 'Notes', kind: 'text', target: 'each handwritten note', default: 'typewriter' },
    exit: { label: 'Exit', kind: 'exit', target: 'all marks', default: 'fade' },
  },
  cues: { description: 'One cue per mark: when the narrator points at it.', units: ['mark 1', 'mark 2', 'mark 3'] },
  colors: [],
  validate: (props) => {
    const issues: Issue[] = [];
    (Array.isArray(props.marks) ? (props.marks as Record<string, unknown>[]) : []).forEach((m, i) => {
      const x = readNumber(m?.x) ?? 0;
      const w = readNumber(m?.w) ?? 0;
      const y = readNumber(m?.y) ?? 0;
      const h = readNumber(m?.h) ?? 0;
      if (x + w > 100 || y + h > 100) issues.push({ field: `marks[${i}]`, level: 'warning', message: `Mark ${i + 1} runs off the frame — it is clipped to the safe area` });
    });
    return issues;
  },
  example: { marks: [{ shape: 'circle', x: 40, y: 25, w: 18, h: 30, label: 'this one!' }], color: 'red', stroke: 'medium' },
};

type Mark = { shape: Shape; box: Box; label: string };
export type ScribbleLayout = { marks: { shape: Shape; box: Box; pts: [number, number][]; len: number; label?: Line; labelBox: Box | null }[] };

/** A deterministic wobble so the "hand" is the same in every render. */
const jit = (i: number, k: number) => Math.sin(i * 12.9898 + k * 78.233) * 0.5;

function strokePoints(shape: Shape, b: Box, arrowFrom?: { x: number; y: number }): [number, number][] {
  const pts: [number, number][] = [];
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (shape === 'circle') {
    const rx = b.w / 2 + 18;
    const ry = b.h / 2 + 18;
    const turns = 1.12;
    for (let i = 0; i <= 90; i++) {
      const a = -Math.PI * 0.6 + (i / 90) * Math.PI * 2 * turns;
      const wob = 1 + jit(i, 1) * 0.05 + (i / 90) * 0.06;
      pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob]);
    }
  } else if (shape === 'underline') {
    const y = b.y + b.h + 10;
    for (let i = 0; i <= 30; i++) pts.push([b.x - 6 + (i / 30) * (b.w + 12), y + Math.sin(i / 3) * 3 + jit(i, 2) * 4 + (i / 30) * 6]);
  } else if (shape === 'box') {
    const c: [number, number][] = [[b.x - 12, b.y - 10], [b.x + b.w + 14, b.y - 14], [b.x + b.w + 10, b.y + b.h + 12], [b.x - 14, b.y + b.h + 8], [b.x - 10, b.y - 16]];
    c.forEach((p, k) => {
      if (k === 0) return;
      const q = c[k - 1];
      for (let i = 0; i <= 12; i++) pts.push([q[0] + ((p[0] - q[0]) * i) / 12 + jit(i + k * 13, 3) * 3, q[1] + ((p[1] - q[1]) * i) / 12 + jit(i + k * 13, 4) * 3]);
    });
  } else if (shape === 'cross') {
    for (let i = 0; i <= 14; i++) pts.push([b.x + (i / 14) * b.w + jit(i, 5) * 3, b.y + (i / 14) * b.h + jit(i, 6) * 3]);
    pts.push([NaN, NaN]);
    for (let i = 0; i <= 14; i++) pts.push([b.x + b.w - (i / 14) * b.w + jit(i, 7) * 3, b.y + (i / 14) * b.h + jit(i, 8) * 3]);
  } else if (shape === 'tick') {
    const a: [number, number] = [b.x + b.w * 0.1, b.y + b.h * 0.55];
    const m: [number, number] = [b.x + b.w * 0.4, b.y + b.h * 0.9];
    const e: [number, number] = [b.x + b.w * 0.95, b.y + b.h * 0.05];
    for (let i = 0; i <= 8; i++) pts.push([a[0] + ((m[0] - a[0]) * i) / 8, a[1] + ((m[1] - a[1]) * i) / 8 + jit(i, 9) * 2]);
    for (let i = 1; i <= 14; i++) pts.push([m[0] + ((e[0] - m[0]) * i) / 14 + jit(i, 10) * 2, m[1] + ((e[1] - m[1]) * i) / 14]);
  } else {
    // arrow from the note towards the spot (or from the upper-left), stopping short of it, with a head
    const from = arrowFrom ?? { x: b.x - 160, y: b.y - 120 };
    const dx = cx - from.x;
    const dy = cy - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const end: [number, number] = [cx - (dx / len) * (Math.min(b.w, b.h) / 2 + 12), cy - (dy / len) * (Math.min(b.w, b.h) / 2 + 12)];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push([from.x + (end[0] - from.x) * t + Math.sin(t * Math.PI) * -dy * 0.08, from.y + (end[1] - from.y) * t + Math.sin(t * Math.PI) * dx * 0.08]);
    }
    const ang = Math.atan2(end[1] - pts[pts.length - 3][1], end[0] - pts[pts.length - 3][0]);
    pts.push([NaN, NaN]);
    for (const s of [1, -1]) {
      const a2 = ang + Math.PI + s * 0.5;
      pts.push([end[0] + Math.cos(a2) * 36, end[1] + Math.sin(a2) * 36], [end[0], end[1]]);
      if (s === 1) pts.push([NaN, NaN]);
    }
  }
  return pts;
}
const polyLen = (pts: [number, number][]) => {
  let L = 0;
  for (let i = 1; i < pts.length; i++) if (!Number.isNaN(pts[i][0]) && !Number.isNaN(pts[i - 1][0])) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
};
const toPath = (pts: [number, number][]) => pts.map((p, i) => (Number.isNaN(p[0]) ? '' : `${i === 0 || Number.isNaN(pts[i - 1][0]) ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)).join(' ');

export function layoutScribble(input: { marks: Mark[] }, measure: Measure): ScribbleLayout {
  const placed: Box[] = input.marks.map((m) => ({ x: m.box.x - 24, y: m.box.y - 24, w: m.box.w + 48, h: m.box.h + 48 }));
  const bounds = { x: 0, y: 0, w: SAFE_W, h: SAFE_H };
  return {
    marks: input.marks.map((m) => {
      const label = m.label ? fitText(m.label, LABEL, 520, measure).lines : [];
      let labelBox: Box | null = null;
      if (label.length) {
        const w = Math.ceil(Math.max(...label.map((l) => measure(l.text, l.size, 700)))) + 8;
        const h = Math.ceil(label.reduce((a, l) => a + l.size * LABEL.lineHeight, 0));
        labelBox = placeNear({ x: m.box.x + m.box.w / 2, y: m.box.y + m.box.h / 2 }, w, h, placed, bounds, [m.box.w / 2 + 40, m.box.w / 2 + 110, m.box.w / 2 + 200]);
        if (labelBox) placed.push(labelBox);
      }
      const from = labelBox ? { x: labelBox.x + labelBox.w / 2, y: labelBox.y + labelBox.h + 6 } : undefined;
      const pts = strokePoints(m.shape, m.box, m.shape === 'arrow' ? from : undefined).map((p) => (Number.isNaN(p[0]) ? p : ([Math.max(4, Math.min(SAFE_W - 4, p[0])), Math.max(4, Math.min(SAFE_H - 4, p[1]))] as [number, number])));
      return { shape: m.shape, box: m.box, pts, len: polyLen(pts), label: label.length ? label[0] : undefined, labelLines: label, labelBox };
    }) as ScribbleLayout['marks'],
  };
}

export function planScribble(n: number, duration: number, cueTimes?: number[]): Plan {
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const gap = n > 1 ? Math.max(8, Math.min(30, Math.floor((budget - 30) / n))) : 0;
  const units: Unit[] = [];
  for (let i = 0; i < n; i++) {
    units.push({ key: `mark${i}`, label: `Mark ${i + 1}`, start: 4 + i * gap, dur: 16, cue: i });
    units.push({ key: `note${i}`, label: `Note ${i + 1}`, start: 4 + i * gap + 12, dur: 14, follows: { key: `mark${i}`, offset: 12 } });
  }
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareEM04(props: Record<string, unknown>, durationInFrames: number) {
  const A = (k: string) => readAnim(props, EM04_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(EM04_SPEC, props);
  const measure = measureWith(HAND, HAND);
  const marks: Mark[] = (Array.isArray(props.marks) ? props.marks : [])
    .map((item) => {
      const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const shape = (SHAPES as readonly string[]).includes(o.shape as string) ? (o.shape as Shape) : 'circle';
      const px = (v: unknown, d: number) => Math.max(0, Math.min(100, readNumber(v) ?? d));
      // % of the frame → safe-box pixels, kept inside the safe box (with room for the stroke around it)
      let x = (px(o.x, 40) / 100) * FRAME_W - SAFE_MARGIN;
      let y = (px(o.y, 30) / 100) * FRAME_H - SAFE_MARGIN;
      let w = Math.max(20, (px(o.w, 15) / 100) * FRAME_W);
      let h = Math.max(20, (px(o.h, 20) / 100) * FRAME_H);
      const m = 30;
      w = Math.min(w, SAFE_W - 2 * m);
      h = Math.min(h, SAFE_H - 2 * m);
      x = Math.max(m, Math.min(SAFE_W - m - w, x));
      y = Math.max(m, Math.min(SAFE_H - m - h, y));
      return { shape, box: { x, y, w, h }, label: normaliseText(typeof o.label === 'string' ? o.label : '', LABEL) };
    })
    .slice(0, 3);
  const L = layoutScribble({ marks }, measure);
  const plan = planScribble(marks.length, durationInFrames, readCues(props));
  const col = opt(props, 'color', ['red', 'yellow', 'white', 'accent'] as const, 'red');
  const color = col === 'red' ? '#FF3B30' : col === 'yellow' ? '#FFD60A' : col === 'white' ? '#FFFFFF' : style.colors.accent;
  const stroke = { thin: 5, medium: 8, thick: 12 }[opt(props, 'stroke', ['thin', 'medium', 'thick'] as const, 'medium')];
  return { style, sized, A, L, plan, color, stroke, debug: props.show_safe_area === true };
}

export function EM04ScribbleAnnotation({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, color, stroke, debug } = prepareEM04(props, durationInFrames);
  const w = plan.windows;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          <svg {...guide('marks', 'marks[]')} width={SAFE_W} height={SAFE_H} style={{ position: 'absolute', left: 0, top: 0, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.55))' }}>
            {L.marks.map((m, i) => {
              const mw = w[`mark${i}`];
              const p = A('marks') === 'none' ? (frame >= mw.start ? 1 : 0) : progress(frame, mw.start, mw.dur);
              const draw = A('marks') === 'fade' ? 1 : p;
              return <path key={i} d={toPath(m.pts)} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={m.len + 2} strokeDashoffset={(m.len + 2) * (1 - draw)} opacity={A('marks') === 'fade' ? p : p > 0 ? 1 : 0} />;
            })}
          </svg>
          {L.marks.map((m, i) => {
            const mm = m as ScribbleLayout['marks'][number] & { labelLines: Line[] };
            if (!m.labelBox || !mm.labelLines.length) return null;
            const nw = w[`note${i}`];
            const np = progress(frame, nw.start, nw.dur);
            const typeT = A('labels') === 'typewriter';
            const full = mm.labelLines.map((l) => l.text).join('\n');
            const shownChars = typeT ? Math.round(np * full.length) : full.length;
            let used = 0;
            return (
              <div key={`n${i}`} {...leaf(`note-${i}`, `marks[${i}].label`)} style={{ position: 'absolute', left: m.labelBox.x, top: m.labelBox.y, width: m.labelBox.w, height: m.labelBox.h, opacity: typeT ? (np > 0 ? 1 : 0) : np }}>
                {mm.labelLines.map((l, k) => {
                  const part = l.text.slice(0, Math.max(0, shownChars - used));
                  used += l.text.length + 1;
                  return (
                    <div key={k} style={{ fontFamily: HAND, fontWeight: 700, fontSize: l.size, lineHeight: 1.1, color, whiteSpace: 'nowrap', textShadow: '0 2px 6px rgba(0,0,0,0.7)' }}>
                      {part || '\u00a0'}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </SafeArea>
    </div>
  );
}
