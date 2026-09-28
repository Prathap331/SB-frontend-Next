'use client';

/**
 * VO-21 · Callout / Annotation  (animation_type: "vo_callout")   — overlay on footage or an image
 * 1–5 callouts pointing at spots in the frame: a marker on the spot, a leader line, and a label.
 * Labels are placed automatically around their spot so they stay inside the safe box and never
 * overlap each other or another callout's marker.
 *
 * Inputs (full list, limits and JSON Schema: VO21Callout.inputs.json):
 *   callouts[] { label, x, y, icon } · image_url · marker · look
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [callout 1, callout 2, …]
 * x / y are percentages of the full frame (0 = left / top, 100 = right / bottom).
 * Timing: 1.5–8s from clock.durationInFrames.
 */
import { Img } from 'remotion';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, sharedFont, linesAt, words, type Line, type Measure } from './core/fit';
import { cardStyle, easeOutCubic, exitStyle, iconStyle, imageMotionStyle, progress, shapeState, textAnimFrames } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { OVERLAY_DURATION } from './core/overlay';
import { SafeArea, SAFE_H, SAFE_W, SAFE_MARGIN, FRAME_W, FRAME_H } from './core/safeArea';
import { fontFor, readStyle, styleVars, withAlpha } from './core/style';
import { FOOTAGE_SHADOW, guide, leaf } from './core/shared';

export const VO21_SPEC: TemplateSpec = {
  id: 'VO-21',
  animationType: 'vo_callout',
  name: 'Callout / Annotation',
  pickWhen: 'Pointing out specific things in the footage or a photo: "this is the control room", "note the crack here".',
  placement: 'overlay',
  image: { label: 'Image', required: false, fills: 'Photo to annotate (omit to annotate the footage underneath)' },
  duration: OVERLAY_DURATION,
  text: {},
  lists: {
    callouts: {
      label: 'Callout',
      fills: 'Spots to point at, in the order they are mentioned',
      minItems: 1,
      maxItems: 5,
      icon: { required: false, fallback: 'none' },
      fields: {
        label: { label: 'Label', required: true, minChars: 2, maxChars: 40, minWords: 1, maxWords: 7, maxWordChars: 16, maxLines: 2, fontMax: 32, fontMin: 20, weight: 700, lineHeight: 1.2, hint: 'What the spot is.', fills: 'Callout label' },
      },
      numbers: {
        x: { label: 'X', required: true, fills: 'Horizontal position of the spot, % of the frame width (0 = left, 100 = right)', min: 0, max: 100 },
        y: { label: 'Y', required: true, fills: 'Vertical position of the spot, % of the frame height (0 = top, 100 = bottom)', min: 0, max: 100 },
      },
    },
  },
  options: {
    marker: { label: 'Marker', values: ['dot', 'ring'], default: 'ring', fills: 'Filled dot, or a ring with a pulse' },
    look: { label: 'Label look', values: ['pill', 'box', 'accent'], default: 'pill', fills: 'Dark pill, dark box, or accent-filled pill' },
  },
  animations: {
    image_motion: { label: 'Image motion', kind: 'image_motion', target: 'the image (when image_url is set)', default: 'static' },
    markers: { label: 'Markers', kind: 'icon', target: 'marker on each spot', default: 'pop' },
    lines: { label: 'Leader lines', kind: 'shape', target: 'line from spot to label', default: 'grow' },
    labels: { label: 'Labels', kind: 'card', target: 'each label', default: 'pop' },
    exit: { label: 'Exit', kind: 'exit', target: 'all callouts', default: 'fade' },
  },
  cues: { description: 'One cue per callout, when the narrator mentions it.', units: ['callout 1', 'callout 2', 'callout 3', 'callout 4', 'callout 5'] },
  colors: ['card', 'on_accent'],
  example: {
    callouts: [
      { label: 'Main control room', x: 32, y: 40 },
      { label: 'Cooling towers', x: 70, y: 55, icon: 'wind' },
    ],
    marker: 'ring',
    look: 'pill',
  },
};

export type Callout = { label: string; x: number; y: number; icon?: string };
export type Box = { x: number; y: number; w: number; h: number };
export type PlacedCallout = Callout & { tx: number; ty: number; box: Box; lines: Line[]; iconSize: number; anchor: { x: number; y: number } };
export const MARK = 34;
export const PAD_X = 22;
export const PAD_Y = 12;

const overlaps = (a: Box, b: Box, m = 10) => a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y;

/** Place every label around its spot: try 8 directions at growing distances, keep the first free spot. */
export function layoutCallouts(input: { callouts: Callout[] }, measure: Measure, spec: TemplateSpec = VO21_SPEC): { placed: PlacedCallout[]; font: number } {
  const F = spec.lists.callouts.fields.label;
  const clampX = (v: number) => Math.max(MARK, Math.min(SAFE_W - MARK, v));
  const clampY = (v: number) => Math.max(MARK, Math.min(SAFE_H - MARK, v));
  const targets = input.callouts.map((c) => ({ tx: clampX((c.x / 100) * FRAME_W - SAFE_MARGIN), ty: clampY((c.y / 100) * FRAME_H - SAFE_MARGIN) }));
  let cap = F.fontMax;
  for (;;) {
    const font = sharedFont(input.callouts.map((c) => c.label), F, 440, measure, cap);
    const placed: PlacedCallout[] = [];
    let ok = true;
    // markers are obstacles for every label
    const marks: Box[] = targets.map((t) => ({ x: t.tx - MARK, y: t.ty - MARK, w: MARK * 2, h: MARK * 2 }));
    for (let i = 0; i < input.callouts.length; i++) {
      const c = input.callouts[i];
      const t = targets[i];
      const lines = linesAt(c.label, font, F, 440, measure);
      const iconSize = c.icon ? Math.round(font * 1.1) : 0;
      const w = Math.ceil(Math.max(...lines.map((l) => measure(l.text, l.size, F.weight))) + PAD_X * 2 + (iconSize ? iconSize + 12 : 0));
      const h = Math.ceil(blockHeight(lines, F.lineHeight) + PAD_Y * 2);
      // prefer pointing towards the frame centre
      const cx = t.tx < SAFE_W / 2 ? 1 : -1;
      const cy = t.ty < SAFE_H / 2 ? 1 : -1;
      const dirs = [
        [cx, -cy], [cx, cy], [-cx, -cy], [-cx, cy], [cx, 0], [-cx, 0], [0, -cy], [0, cy],
      ].map(([a, b]) => [a * 1, b * 1]);
      let found: { box: Box; anchor: { x: number; y: number } } | null = null;
      for (const d of [110, 170, 240, 320]) {
        for (const [dx, dy] of dirs) {
          const ax = t.tx + dx * d * (dy === 0 ? 1 : 0.8);
          const ay = t.ty + dy * d * (dx === 0 ? 1 : 0.6);
          const bx = dx > 0 ? ax : dx < 0 ? ax - w : ax - w / 2;
          const by = dy > 0 ? ay : dy < 0 ? ay - h : ay - h / 2;
          const box = { x: bx, y: by, w, h };
          if (box.x < 0 || box.y < 0 || box.x + w > SAFE_W || box.y + h > SAFE_H) continue;
          if (marks.some((m) => overlaps(box, m, 4)) || placed.some((p) => overlaps(box, p.box))) continue;
          found = { box, anchor: { x: Math.max(box.x, Math.min(box.x + w, t.tx)), y: Math.max(box.y, Math.min(box.y + h, t.ty)) } };
          break;
        }
        if (found) break;
      }
      if (!found) {
        ok = false;
        break;
      }
      placed.push({ ...c, tx: t.tx, ty: t.ty, box: found.box, lines, iconSize, anchor: found.anchor });
    }
    if (ok || cap <= F.fontMin) {
      // anything that still did not fit is left out rather than overlapping
      return { placed, font };
    }
    cap -= 2;
  }
}

export function planCallouts(placed: PlacedCallout[], duration: number, cueTimes?: number[]): Plan {
  const units: Unit[] = [];
  const n = placed.length;
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const gap = n > 1 ? Math.max(6, Math.min(30, Math.floor((budget - 6 - 30) / (n - 1)))) : 0;
  placed.forEach((c, i) => {
    const s0 = 6 + i * gap;
    units.push({ key: `c${i}`, label: `Callout ${i + 1} marker`, start: s0, dur: 12, cue: i });
    units.push({ key: `c${i}_line`, label: `Callout ${i + 1} line`, start: s0 + 6, dur: 12, follows: { key: `c${i}`, offset: 6 } });
    units.push({ key: `c${i}_label`, label: `Callout ${i + 1} label`, start: s0 + 12, dur: Math.max(12, textAnimFrames('fade', words(c.label).length, c.label.length, 12)), follows: { key: `c${i}`, offset: 12 } });
  });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareVO21(props: Record<string, unknown>, durationInFrames: number) {
  const CS = VO21_SPEC.lists.callouts;
  const A = (k: string) => readAnim(props, VO21_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(VO21_SPEC, props);
  const measure = measureFor(style);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : undefined);
  const callouts: Callout[] = (Array.isArray(props.callouts) ? props.callouts : [])
    .map((c): Callout | null => {
      const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
      const x = num(o.x);
      const y = num(o.y);
      const label = typeof o.label === 'string' ? normaliseText(o.label, CS.fields.label) : '';
      return label && x !== undefined && y !== undefined ? { label, x, y, icon: typeof o.icon === 'string' ? o.icon : undefined } : null;
    })
    .filter((c): c is Callout => c !== null)
    .slice(0, CS.maxItems);
  const { placed, font } = layoutCallouts({ callouts }, measure, sized.spec);
  const plan = planCallouts(placed, durationInFrames, readCues(props));
  return { style, sized, A, placed, font, plan, imageUrl: readImageUrl(props), marker: opt(props, 'marker', ['dot', 'ring'] as const, 'ring'), look: opt(props, 'look', ['pill', 'box', 'accent'] as const, 'pill'), debug: props.show_safe_area === true };
}

export function VO21Callout({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, placed, plan, imageUrl, marker, look, debug } = prepareVO21(props, durationInFrames);
  const w = plan.windows;
  const F = VO21_SPEC.lists.callouts.fields.label;
  const accent = style.colors.accent;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const fill = look === 'accent' ? accent : style.custom.has('card') ? style.colors.card : withAlpha(style.colors.scrim, 0.8);
  const ink = look === 'accent' ? style.colors.on_accent : style.colors.text;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      {imageUrl && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', ...imageMotionStyle(A('image_motion'), frame / Math.max(1, durationInFrames)) }} />
        </div>
      )}
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          <svg {...guide('lines', 'leader lines')} width={SAFE_W} height={SAFE_H} style={{ position: 'absolute', left: 0, top: 0 }}>
            {placed.map((c, i) => {
              const lw = w[`c${i}_line`];
              const st = shapeState(A('lines'), progress(frame, lw.start, lw.dur));
              const x2 = c.tx + (c.anchor.x - c.tx) * st.length;
              const y2 = c.ty + (c.anchor.y - c.ty) * st.length;
              return <line key={i} x1={c.tx} y1={c.ty} x2={x2} y2={y2} stroke={accent} strokeWidth={4} strokeLinecap="round" opacity={(st.style.opacity as number | undefined) ?? 1} />;
            })}
          </svg>
          {placed.map((c, i) => {
            const mw = w[`c${i}`];
            const lab = w[`c${i}_label`];
            const pulse = marker === 'ring' ? 1 + 0.35 * easeOutCubic(((frame - mw.start - 12) % 30) / 30) * (frame > mw.start + 12 ? 1 : 0) : 1;
            return (
              <div key={i}>
                <div {...guide(`mark-${i}`, `callouts[${i}].x / y`)} style={{ position: 'absolute', left: c.tx - 14, top: c.ty - 14, width: 28, height: 28, borderRadius: '50%', boxSizing: 'border-box', background: marker === 'dot' ? accent : 'transparent', border: `5px solid ${accent}`, boxShadow: `0 0 0 4px ${withAlpha(style.colors.scrim, 0.45)}`, ...iconStyle(A('markers'), progress(frame, mw.start, mw.dur)) }}>
                  {marker === 'ring' && <div style={{ position: 'absolute', inset: -5, borderRadius: '50%', border: `3px solid ${withAlpha(accent, Math.max(0, 1.35 - pulse))}`, transform: `scale(${pulse})` }} />}
                </div>
                <div
                  {...leaf(`label-${i}`, `callouts[${i}].label`)}
                  style={{ position: 'absolute', left: c.box.x, top: c.box.y, width: c.box.w, height: c.box.h, boxSizing: 'border-box', padding: `${PAD_Y}px ${PAD_X}px`, borderRadius: look === 'box' ? 12 : 999, background: fill, display: 'flex', alignItems: 'center', gap: 12, ...cardStyle(A('labels'), progress(frame, lab.start, lab.dur)) }}
                >
                  {c.iconSize > 0 && c.icon && <LucideIconView name={c.icon} size={c.iconSize} color={look === 'accent' ? ink : accent} />}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {c.lines.map((l, k) => (
                      <span key={k} style={{ fontFamily: fontFor(F.weight), fontWeight: F.weight, fontSize: l.size, lineHeight: F.lineHeight, color: ink, whiteSpace: 'nowrap', textShadow: look === 'accent' ? 'none' : FOOTAGE_SHADOW }}>
                        {l.text}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SafeArea>
    </div>
  );
}
