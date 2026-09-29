'use client';

/**
 * DG-17 · Architecture Diagram  (animation_type: "dg_architecture")
 * How a system is built: 2–4 layers (columns, e.g. "Your phone → NPCI switch → Banks"), each with 1–4
 * components (icon + name), and arrows showing what talks to what, with optional labels.
 * Layers slide in left to right, then the arrows draw one by one.
 *
 * Inputs (full list, limits and JSON Schema: DG17Architecture.inputs.json):
 *   title · layers[] { name, nodes[] { label, sub, icon } } · links[] { from, to, label } · image_url · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, layer 1…4, link 1…8]
 * links refer to components by their label (exact text).
 * Timing: 3–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type Issue, type TemplateSpec, type TextSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText, linesAt, sharedFont, type Line, type Measure } from './core/fit';
import { cardStyle, easeInOutCubic, exitStyle, progress } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { overlaps, type Box } from './core/placement';
import { cardColors, fontFor, mutedFor, readStyle, seriesColor, styleVars, withAlpha, readHex } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, guide, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

const LAYER: TextSpec = { label: 'Layer name', required: true, minChars: 2, maxChars: 22, minWords: 1, maxWords: 4, maxWordChars: 16, maxLines: 1, fontMax: 26, fontMin: 16, weight: 800, lineHeight: 1.2, fills: 'Layer heading' };
const NODE: TextSpec = { label: 'Component', required: true, minChars: 2, maxChars: 24, minWords: 1, maxWords: 4, maxWordChars: 16, maxLines: 2, fontMax: 28, fontMin: 16, weight: 700, lineHeight: 1.15, fills: 'Component name' };
const NODE_SUB: TextSpec = { label: 'Component detail', required: false, minChars: 2, maxChars: 28, minWords: 1, maxWords: 5, maxWordChars: 16, maxLines: 1, fontMax: 20, fontMin: 13, weight: 500, lineHeight: 1.2, fills: 'Small line under the component' };
const LINK: TextSpec = { label: 'Link label', required: false, minChars: 2, maxChars: 16, minWords: 1, maxWords: 3, maxWordChars: 14, maxLines: 1, fontMax: 20, fontMin: 14, weight: 700, lineHeight: 1.2, fills: 'Words on an arrow' };

export const DG17_SPEC: TemplateSpec = {
  id: 'DG-17',
  animationType: 'dg_architecture',
  name: 'Architecture Diagram',
  pickWhen: 'How a system works inside: what connects to what (UPI, a data centre, an app, the power grid).',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 210, max: 240 },
  text: {
    title: { label: 'Heading', required: false, minChars: 3, maxChars: 44, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 1, fontMax: 52, fontMin: 36, weight: 800, lineHeight: 1.05, fills: 'Heading above the diagram', example: 'How a UPI payment flows' },
  },
  lists: {},
  custom: {
    inputs: [
      { path: 'layers[]', type: 'list', required: true, fills: 'Columns left to right', limits: '2–4 layers' },
      { path: 'layers[].name', type: 'text', required: true, fills: 'Layer heading ("Your phone", "Switch", "Banks")', limits: '2–22 chars' },
      { path: 'layers[].bg_color', type: 'color', required: false, fills: 'Background colour of this layer column (to highlight it)', limits: 'hex #RRGGBB' },
      { path: 'layers[].nodes[]', type: 'list', required: true, fills: 'Components in this layer, top to bottom', limits: '1–4 per layer' },
      { path: 'layers[].nodes[].label', type: 'text', required: true, fills: 'Component name (links refer to it)', limits: '2–24 chars · unique' },
      { path: 'layers[].nodes[].sub', type: 'text', required: false, fills: 'Small detail line', limits: '2–28 chars' },
      { path: 'layers[].nodes[].icon', type: 'icon', required: false, fills: 'Lucide icon name' },
      { path: 'links[]', type: 'list', required: false, fills: 'Arrows, in reveal order', limits: 'up to 8' },
      { path: 'links[].from', type: 'text', required: true, fills: 'Label of the component the arrow starts at' },
      { path: 'links[].to', type: 'text', required: true, fills: 'Label of the component the arrow points to' },
      { path: 'links[].label', type: 'text', required: false, fills: 'Words on the arrow', limits: '2–16 chars' },
    ],
    schema: {
      layers: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'nodes'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 22 },
            bg_color: { type: 'string', pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$' },
            nodes: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'object', additionalProperties: false, required: ['label'], properties: { label: { type: 'string', minLength: 2, maxLength: 24 }, sub: { type: 'string', minLength: 2, maxLength: 28 }, icon: { type: 'string' } } } },
          },
        },
      },
      links: { type: 'array', maxItems: 8, items: { type: 'object', additionalProperties: false, required: ['from', 'to'], properties: { from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string', minLength: 2, maxLength: 16 } } } },
    },
    required: ['layers'],
  },
  options: { background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' } },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    layers: { label: 'Layers', kind: 'card', target: 'each layer column', default: 'slide_left' },
    arrows: { label: 'Arrows', kind: 'shape', target: 'each arrow', default: 'grow' },
    link_labels: { label: 'Arrow labels', kind: 'card', target: 'words on each arrow', default: 'pop' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the diagram', default: 'fade_up' },
  },
  cues: { description: 'Fixed slots: heading → layer 1…4 → arrow 1…8.', units: ['heading', 'layer 1', 'layer 2', 'layer 3', 'layer 4', 'arrow 1', 'arrow 2', 'arrow 3', 'arrow 4', 'arrow 5', 'arrow 6', 'arrow 7', 'arrow 8'] },
  colors: ['icon', 'icon_bg', 'card', 'card_border', 'series_2', 'series_3', 'series_4'],
  validate: (props) => {
    const issues: Issue[] = [];
    const labels = (Array.isArray(props.layers) ? (props.layers as Record<string, unknown>[]) : []).flatMap((l) => (Array.isArray(l?.nodes) ? (l.nodes as Record<string, unknown>[]) : []).map((n) => String(n?.label ?? '').trim().toLowerCase()));
    (Array.isArray(props.links) ? (props.links as Record<string, unknown>[]) : []).forEach((k, i) => {
      for (const end of ['from', 'to']) if (!labels.includes(String(k?.[end] ?? '').trim().toLowerCase())) issues.push({ field: `links[${i}].${end}`, level: 'warning', message: `Arrow ${i + 1}: no component called "${String(k?.[end] ?? '')}"` });
    });
    return issues;
  },
  example: {
    title: 'How a UPI payment flows',
    layers: [
      { name: 'Your phone', nodes: [{ label: 'UPI app', icon: 'smartphone' }] },
      { name: 'Network', nodes: [{ label: 'NPCI switch', sub: 'Routes every payment', icon: 'route' }] },
      { name: 'Banks', nodes: [{ label: 'Your bank', icon: 'landmark' }, { label: "Shop's bank", icon: 'store' }] },
    ],
    links: [
      { from: 'UPI app', to: 'NPCI switch', label: 'request' },
      { from: 'NPCI switch', to: 'Your bank', label: 'debit' },
      { from: 'NPCI switch', to: "Shop's bank", label: 'credit' },
    ],
    background: 'theme',
  },
};

type Node = { label: string; sub: string; icon?: string; layer: number };
type Link = { from: number; to: number; label: string };
export const COL_GAP = 120;
export const HEAD_H = 56;
export const NODE_GAP = 22;
export const PADX = 20;

export type ArchLayout = { title: Line[]; titleH: number; colW: number; cols: { x: number; name: Line; y: number; h: number }[]; boxes: { x: number; y: number; w: number; h: number; label: Line[]; sub?: Line }[]; icon: number; linkLabels: (Line | undefined)[]; linkBoxes: (Box | null)[] };

export function layoutArch(input: { title: string; layers: { name: string; nodes: Node[] }[]; nodes: Node[]; links: Link[] }, measure: Measure): ArchLayout {
  const title = input.title ? fitText(input.title, DG17_SPEC.text.title, SAFE_W, measure, false).lines : [];
  const titleH = title.length ? title[0].size * 1.05 + 32 : 0;
  const L = Math.max(1, input.layers.length);
  const colW = (SAFE_W - COL_GAP * (L - 1)) / L;
  const maxNodes = Math.max(1, ...input.layers.map((l) => l.nodes.length));
  const colH = SAFE_H - titleH;
  const nodeH = Math.min(150, (colH - HEAD_H - 20 - NODE_GAP * (maxNodes - 1) - 20) / maxNodes);
  const icon = Math.round(Math.min(56, nodeH * 0.42));
  const inner = colW - PADX * 2 - 24 - icon - 14;
  const nf = sharedFont(input.nodes.map((n) => n.label), NODE, inner, measure, Math.min(NODE.fontMax, Math.round(nodeH * 0.24)));
  const sf = sharedFont(input.nodes.map((n) => n.sub || ' '), NODE_SUB, inner, measure, Math.min(NODE_SUB.fontMax, Math.round(nf * 0.75)));
  const hf = sharedFont(input.layers.map((l) => l.name), LAYER, colW - 32, measure);
  // layer boxes are as tall as their tallest stack of components (no empty band above / below)
  const usedH = Math.min(colH, HEAD_H + 20 + maxNodes * nodeH + (maxNodes - 1) * NODE_GAP + 20);
  const top0 = titleH + (colH - usedH) / 2;
  const cols = input.layers.map((l, i) => ({ x: i * (colW + COL_GAP), name: linesAt(l.name, hf, LAYER, colW - 32, measure, false)[0], y: top0, h: usedH }));
  const boxes = input.nodes.map((n) => {
    const idx = input.layers[n.layer].nodes.indexOf(n);
    const cnt = input.layers[n.layer].nodes.length;
    const blockH = cnt * nodeH + (cnt - 1) * NODE_GAP;
    const top = top0 + HEAD_H + 10 + (usedH - HEAD_H - 20 - blockH) / 2;
    return { x: cols[n.layer].x + PADX, y: top + idx * (nodeH + NODE_GAP), w: colW - PADX * 2, h: nodeH, label: linesAt(n.label, nf, NODE, inner, measure), sub: n.sub ? linesAt(n.sub, sf, NODE_SUB, inner, measure, false)[0] : undefined };
  });
  // arrow labels at the middle of each arrow, where they do not cover a component or another label
  const placed: Box[] = boxes.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
  const linkLabels = input.links.map((k) => (k.label ? fitText(k.label, LINK, COL_GAP + 80, measure, false).lines[0] : undefined));
  const linkBoxes = input.links.map((k, i) => {
    const lab = linkLabels[i];
    if (!lab) return null;
    const a = boxes[k.from];
    const b = boxes[k.to];
    const w = Math.ceil(measure(lab.text, lab.size, 700)) + 20;
    const h = Math.round(lab.size * 1.2 + 8);
    const ax = a.x + a.w;
    const ay = a.y + a.h / 2;
    const bx = b.x;
    const by = b.y + b.h / 2;
    for (const t of [0.5, 0.35, 0.65]) {
      for (const dy of [0, -h - 4, h + 4]) {
        const box = { x: ax + (bx - ax) * t - w / 2, y: ay + (by - ay) * t - h / 2 + dy, w, h };
        if (box.x < 0 || box.y < 0 || box.x + w > SAFE_W || box.y + h > SAFE_H) continue;
        if (placed.some((q) => overlaps(box, q, 4))) continue;
        placed.push(box);
        return box;
      }
    }
    return null;
  });
  return { title, titleH, colW, cols, boxes, icon, linkLabels, linkBoxes };
}

export function planArch(nLayers: number, nLinks: number, hasTitle: boolean, duration: number, cueTimes?: number[]): Plan {
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const first = hasTitle ? 16 : 6;
  const total = nLayers + nLinks;
  const gap = total > 1 ? Math.max(5, Math.min(22, Math.floor((budget - first - 24) / (total - 1)))) : 0;
  const units: Unit[] = [];
  if (hasTitle) units.push({ key: 'title', label: 'Heading', start: 2, dur: 14, cue: 0 });
  for (let i = 0; i < nLayers; i++) units.push({ key: `layer${i}`, label: `Layer ${i + 1}`, start: first + i * gap, dur: 14, cue: 1 + i });
  for (let i = 0; i < nLinks; i++) {
    const s0 = first + (nLayers + i) * gap;
    units.push({ key: `link${i}`, label: `Arrow ${i + 1}`, start: s0, dur: 16, cue: 5 + i });
    units.push({ key: `link${i}_label`, label: `Arrow ${i + 1} label`, start: s0 + 10, dur: 12, follows: { key: `link${i}`, offset: 10 } });
  }
  return planTimeline(duration, units, cueTimes);
}

export function prepareDG17(props: Record<string, unknown>, durationInFrames: number) {
  const A = (k: string) => readAnim(props, DG17_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DG17_SPEC, props);
  const measure = measureFor(style);
  const s = (o: Record<string, unknown>, k: string) => (typeof o[k] === 'string' && (o[k] as string).trim() ? (o[k] as string) : undefined);
  const layers: { name: string; nodes: Node[]; bg?: string }[] = (Array.isArray(props.layers) ? props.layers : [])
    .slice(0, 4)
    .map((x, li) => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const nodes = (Array.isArray(o.nodes) ? o.nodes : [])
        .slice(0, 4)
        .map((y) => {
          const q = (y && typeof y === 'object' ? y : {}) as Record<string, unknown>;
          return { label: normaliseText(s(q, 'label'), NODE), sub: normaliseText(s(q, 'sub'), NODE_SUB), icon: s(q, 'icon'), layer: li };
        })
        .filter((n) => n.label);
      return { name: normaliseText(s(o, 'name'), LAYER) || `Layer ${li + 1}`, nodes, bg: readHex(o.bg_color) };
    })
    .filter((l) => l.nodes.length);
  layers.forEach((l, li) => l.nodes.forEach((n) => (n.layer = li)));
  const nodes = layers.flatMap((l) => l.nodes);
  const find = (v: unknown) => nodes.findIndex((n) => n.label.trim().toLowerCase() === String(v ?? '').trim().toLowerCase());
  const links: Link[] = (Array.isArray(props.links) ? props.links : [])
    .map((x) => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const f = find(o.from);
      const t = find(o.to);
      return f >= 0 && t >= 0 && f !== t ? { from: f, to: t, label: normaliseText(s(o, 'label'), LINK) } : null;
    })
    .filter((x): x is Link => x !== null)
    .slice(0, 8);
  const L = layoutArch({ title: normaliseText(readFirst(props, ['title']), DG17_SPEC.text.title), layers, nodes, links }, measure);
  const plan = planArch(layers.length, links.length, L.title.length > 0, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, layers, nodes, links, L, plan, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

function DG17ArchitectureBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, layers, nodes, links, L, plan, imageUrl, bg, debug } = prepareDG17(props, durationInFrames);
  const w = plan.windows;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const card = cardColors(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  // arrow geometry: right edge → left edge (or bottom → top inside one layer)
  const ends = (k: Link) => {
    const a = L.boxes[k.from];
    const b = L.boxes[k.to];
    const la = nodes[k.from].layer;
    const lb = nodes[k.to].layer;
    if (la === lb) {
      const down = b.y > a.y;
      return { x1: a.x + a.w / 2, y1: down ? a.y + a.h : a.y, x2: b.x + b.w / 2, y2: down ? b.y : b.y + b.h, vertical: true };
    }
    const right = lb > la;
    return { x1: right ? a.x + a.w : a.x, y1: a.y + a.h / 2, x2: right ? b.x : b.x + b.w, y2: b.y + b.h / 2, vertical: false };
  };
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.title.length > 0 && w.title && <AnimatedText lines={L.title} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={800} lineHeight={1.05} shadow={shadow} group="title" input="title" />}
          {layers.map((l, li) => {
            const c = L.cols[li];
            const lw = w[`layer${li}`];
            const col = seriesColor(style.colors, li % 4);
            return (
              <div key={li} style={{ position: 'absolute', left: c.x, top: c.y, width: L.colW, height: c.h, ...cardStyle(A('layers'), progress(frame, lw.start, lw.dur)) }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: 22, border: `2px dashed ${withAlpha(col, 0.55)}`, background: l.bg ?? withAlpha(col, 0.06) }} />
                <div style={{ position: 'absolute', left: 16, top: 12, height: HEAD_H - 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: col }} />
                  <span {...leaf(`layer-${li}`, `layers[${li}].name`)} style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: c.name.size, lineHeight: 1.2, color: col, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{c.name.text}</span>
                </div>
              </div>
            );
          })}
          {nodes.map((n, i) => {
            const b = L.boxes[i];
            const lw = w[`layer${n.layer}`];
            return (
              <div key={i} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, boxSizing: 'border-box', padding: '10px 12px', borderRadius: 16, background: card.fill, border: `2px solid ${card.border}`, display: 'flex', alignItems: 'center', gap: 14, ...cardStyle(A('layers'), progress(frame, lw.start + 4, lw.dur)) }}>
                <div {...leaf(`node-${i}-icon`, `layers[].nodes[].icon`)} style={{ width: L.icon, height: L.icon, borderRadius: 12, background: style.colors.icon_bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <LucideIconView name={n.icon ?? 'box'} size={Math.round(L.icon * 0.56)} color={style.colors.icon} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <AnimatedText lines={b.label} anim="none" start={lw.start} dur={1} frame={frame} weight={NODE.weight} lineHeight={NODE.lineHeight} shadow={shadow} group={`node-${i}`} input="layers[].nodes[].label" />
                  {b.sub && <span {...leaf(`node-${i}-sub`, 'layers[].nodes[].sub')} style={{ fontFamily: fontFor(500), fontWeight: 500, fontSize: b.sub.size, lineHeight: NODE_SUB.lineHeight, color: mutedFor(style, onFootage), whiteSpace: 'nowrap' }}>{b.sub.text}</span>}
                </div>
              </div>
            );
          })}
          <svg {...guide('arrows', 'links[]')} width={SAFE_W} height={SAFE_H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
            <defs>
              <marker id="dg17-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={accent} />
              </marker>
            </defs>
            {links.map((k, i) => {
              const lw = w[`link${i}`];
              const p = A('arrows') === 'grow' ? easeInOutCubic(progress(frame, lw.start, lw.dur)) : frame >= lw.start ? 1 : 0;
              if (p <= 0) return null;
              const e = ends(k);
              const d = e.vertical
                ? `M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`
                : `M ${e.x1} ${e.y1} C ${(e.x1 + e.x2) / 2} ${e.y1}, ${(e.x1 + e.x2) / 2} ${e.y2}, ${e.x2} ${e.y2}`;
              const len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) * 1.25;
              return <path key={i} d={d} fill="none" stroke={accent} strokeWidth={4} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} markerEnd={p > 0.95 ? 'url(#dg17-head)' : undefined} opacity={A('arrows') === 'fade' ? progress(frame, lw.start, lw.dur) : 1} />;
            })}
          </svg>
          {links.map((k, i) => {
            const b = L.linkBoxes[i];
            const lab = L.linkLabels[i];
            if (!b || !lab) return null;
            const lw = w[`link${i}_label`];
            return (
              <div key={`l${i}`} {...leaf(`link-${i}`, `links[${i}].label`)} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, boxSizing: 'border-box', borderRadius: 999, background: withAlpha(style.colors.background_2, 0.9), border: `1.5px solid ${withAlpha(accent, 0.7)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', ...cardStyle(A('link_labels'), progress(frame, lw.start, lw.dur)) }}>
                <span style={{ fontFamily: fontFor(700), fontWeight: 700, fontSize: lab.size, lineHeight: 1.2, color: style.colors.text, whiteSpace: 'nowrap' }}>{lab.text}</span>
              </div>
            );
          })}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const DG17Architecture = withAutoFit(DG17ArchitectureBase);
