'use client';

/**
 * DG-14 · Hierarchy / Tree  (animation_type: "dg_hierarchy")
 * An org chart / family tree / taxonomy: 2–12 nodes, each pointing at its parent, laid out top-down with
 * elbow connectors. Nodes can carry a picture or icon. Revealed level by level.
 *
 * Inputs (full list, limits and JSON Schema: DG14Hierarchy.inputs.json):
 *   title · nodes[] { label, sub, parent, icon, image_url } · image_url · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, level 1, level 2, level 3, level 4]
 * parent = number of the parent node (1 = first node); leave it out for the top node.
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from 'remotion';
import type { TemplateProps } from '../../../types';
import { readImageUrl } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type Issue, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, iconStyle, progress, shapeState } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { readNumber } from './core/numbers';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { flattenDepth, treeLayout } from './core/tree';
import { cardColors, fontFor, mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, guide, leaf, readBgMode, readFirst } from './core/shared';

export const DG14_SPEC: TemplateSpec = {
  id: 'DG-14',
  animationType: 'dg_hierarchy',
  name: 'Hierarchy / Tree',
  pickWhen: 'Who reports to whom, a family tree, a group of companies, a classification (up to 4 levels).',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 180, max: 240 },
  text: {
    title: { label: 'Heading', required: false, minChars: 3, maxChars: 44, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 1, fontMax: 52, fontMin: 36, weight: 800, lineHeight: 1.05, fills: 'Heading above the tree', example: 'The group behind the brand (illustrative)' },
  },
  lists: {
    nodes: {
      label: 'Node',
      fills: 'Nodes of the tree (first one is usually the top)',
      minItems: 2,
      maxItems: 12,
      icon: { required: false, fallback: 'none' },
      image: { required: false, fills: 'Picture in the node (face, logo)' },
      fields: {
        label: { label: 'Label', required: true, minChars: 1, maxChars: 28, minWords: 1, maxWords: 5, maxWordChars: 16, maxLines: 2, fontMax: 30, fontMin: 16, weight: 800, lineHeight: 1.15, fills: 'Node name' },
        sub: { label: 'Sub-line', required: false, minChars: 2, maxChars: 30, minWords: 1, maxWords: 5, maxWordChars: 16, maxLines: 1, fontMax: 22, fontMin: 13, weight: 600, lineHeight: 1.2, fills: 'Role / detail under the name' },
      },
      numbers: { parent: { label: 'Parent', required: false, fills: 'Number of the parent node (1 = first). Leave out for the top node.', min: 1, max: 12, integer: true } },
    },
  },
  options: { background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' } },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    nodes: { label: 'Nodes', kind: 'card', target: 'each node', default: 'pop' },
    media: { label: 'Pictures / icons', kind: 'icon', target: 'node picture or icon', default: 'pop' },
    lines: { label: 'Connectors', kind: 'shape', target: 'lines from parent to children', default: 'grow' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the tree', default: 'fade_up' },
  },
  cues: { description: 'Fixed slots: heading → level 1 (top) → level 2 → level 3 → level 4.', units: ['heading', 'level 1', 'level 2', 'level 3', 'level 4'] },
  colors: ['icon', 'icon_bg', 'card', 'card_border'],
  validate: (props) => {
    const issues: Issue[] = [];
    const nodes = Array.isArray(props.nodes) ? (props.nodes as Record<string, unknown>[]) : [];
    const roots = nodes.filter((x) => readNumber(x?.parent) === undefined).length;
    if (roots !== 1) issues.push({ field: 'nodes', level: 'warning', message: `${roots} nodes have no parent — exactly one top node is expected (others are hung under the first)` });
    nodes.forEach((x, i) => {
      const p = readNumber(x?.parent);
      if (p !== undefined && (p < 1 || p > nodes.length || p === i + 1)) issues.push({ field: `nodes[${i}].parent`, level: 'warning', message: `Node ${i + 1}: parent must be another node number 1–${nodes.length}` });
    });
    return issues;
  },
  example: {
    title: 'The group behind the brand (illustrative)',
    nodes: [
      { label: 'Holding Co.', sub: 'Parent company', icon: 'landmark' },
      { label: 'Retail Ltd', sub: 'Stores', parent: 1, icon: 'store' },
      { label: 'Telecom Ltd', sub: 'Mobile network', parent: 1, icon: 'smartphone' },
      { label: 'Energy Ltd', sub: 'Refining', parent: 1, icon: 'zap' },
      { label: 'Online store', parent: 2 },
      { label: 'Fashion', parent: 2 },
    ],
    background: 'theme',
  },
};

type Node = { label: string; sub: string; parent: number; icon?: string; image?: string };
export const V_GAP = 64;
export const PAD = 16;
export type HierLayout = { title: Line[]; titleH: number; levels: number; boxW: number; boxH: number; rowY: number[]; nodes: { x: number; y: number; label: Line[]; sub?: Line; level: number }[]; children: number[][]; media: number };

export function layoutHier(input: { title: string; nodes: Node[] }, measure: Measure, spec: TemplateSpec = DG14_SPEC): HierLayout {
  const F = spec.lists.nodes.fields;
  const title = input.title ? fitText(input.title, spec.text.title, SAFE_W, measure, false).lines : [];
  const titleH = title.length ? title[0].size * 1.05 + 32 : 0;
  const t = treeLayout(input.nodes.map((n) => ({ parent: n.parent })), SAFE_W);
  const minSlot = Math.min(...t.pos.map((p) => p.slotW));
  const boxW = Math.floor(Math.max(110, Math.min(360, minSlot - 16)));
  const rowH = (SAFE_H - titleH - V_GAP * (t.levels - 1)) / t.levels;
  const hasMedia = input.nodes.some((n) => n.icon || n.image);
  const media = hasMedia ? Math.round(Math.min(64, rowH * 0.32)) : 0;
  const inner = boxW - PAD * 2;
  let cap = Math.min(F.label.fontMax, Math.round(rowH * 0.22));
  for (;;) {
    const lf = sharedFont(input.nodes.map((n) => n.label), F.label, inner, measure, cap);
    const sf = sharedFont(input.nodes.map((n) => n.sub || ' '), F.sub, inner, measure, Math.min(F.sub.fontMax, Math.round(lf * 0.75)));
    const labels = input.nodes.map((n) => linesAt(n.label, lf, F.label, inner, measure));
    const subs = input.nodes.map((n) => (n.sub ? linesAt(n.sub, sf, F.sub, inner, measure, false)[0] : undefined));
    const contentH = Math.max(...labels.map((l, i) => blockHeight(l, F.label.lineHeight) + (subs[i] ? subs[i]!.size * F.sub.lineHeight + 4 : 0)));
    const boxH = Math.ceil(PAD * 2 + (media ? media + 10 : 0) + contentH);
    if (boxH <= rowH || cap <= F.label.fontMin) {
      const h = Math.min(boxH, rowH);
      const rowY = Array.from({ length: t.levels }, (_, l) => titleH + l * (rowH + V_GAP) + (rowH - h) / 2);
      return {
        title,
        titleH,
        levels: t.levels,
        boxW,
        boxH: h,
        rowY,
        nodes: input.nodes.map((_, i) => ({ x: Math.max(0, Math.min(SAFE_W - boxW, t.pos[i].cx - boxW / 2)), y: rowY[t.pos[i].level], label: labels[i], sub: subs[i], level: t.pos[i].level })),
        children: t.children,
        media,
      };
    }
    cap -= 2;
  }
}

export function planHier(L: HierLayout, hasTitle: boolean, duration: number, cueTimes?: number[]): Plan {
  const units: Unit[] = [];
  if (hasTitle) units.push({ key: 'title', label: 'Heading', start: 2, dur: 14, cue: 0 });
  const first = hasTitle ? 14 : 4;
  for (let l = 0; l < L.levels; l++) units.push({ key: `level${l}`, label: `Level ${l + 1}`, start: first + l * 22, dur: 16, cue: 1 + l });
  for (let l = 1; l < L.levels; l++) units.push({ key: `lines${l}`, label: `Connectors to level ${l + 1}`, start: first + l * 22 - 10, dur: 12, follows: { key: `level${l}`, offset: -10 } });
  return planTimeline(duration, units, cueTimes);
}

export function prepareDG14(props: Record<string, unknown>, durationInFrames: number) {
  const F = DG14_SPEC.lists.nodes.fields;
  const A = (k: string) => readAnim(props, DG14_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DG14_SPEC, props);
  const measure = measureFor(style);
  const raw = (Array.isArray(props.nodes) ? props.nodes : []).slice(0, 12).map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}));
  const nodes: Node[] = raw
    .map((o) => ({ label: normaliseText(typeof o.label === 'string' ? o.label : '', F.label), sub: normaliseText(typeof o.sub === 'string' ? o.sub : '', F.sub), parent: (readNumber(o.parent) ?? 0) - 1, icon: typeof o.icon === 'string' ? o.icon : undefined, image: typeof o.image_url === 'string' ? o.image_url : undefined }))
    .filter((n) => n.label);
  // keep only the first top node as the root (others hang under it)
  const firstRoot = nodes.findIndex((n) => n.parent < 0 || n.parent >= nodes.length);
  nodes.forEach((n, i) => {
    if ((n.parent < 0 || n.parent >= nodes.length || n.parent === i) && i !== firstRoot) n.parent = Math.max(0, firstRoot);
  });
  const L = layoutHier({ title: normaliseText(readFirst(props, ['title']), DG14_SPEC.text.title), nodes: flattenDepth(nodes, 4) }, measure, sized.spec);
  const plan = planHier(L, L.title.length > 0, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, nodes: flattenDepth(nodes, 4), L, plan, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

export function DG14Hierarchy({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, nodes, L, plan, imageUrl, bg, debug } = prepareDG14(props, durationInFrames);
  const w = plan.windows;
  const F = DG14_SPEC.lists.nodes.fields;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const card = cardColors(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.title.length > 0 && w.title && <AnimatedText lines={L.title} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={800} lineHeight={1.05} shadow={onFootage ? FOOTAGE_SHADOW : 'none'} align="center" group="title" input="title" style={{ position: 'absolute', left: 0, width: SAFE_W, top: 0 }} />}
          <svg {...guide('lines', 'nodes[].parent')} width={SAFE_W} height={SAFE_H} style={{ position: 'absolute', left: 0, top: 0 }}>
            {nodes.map((_, p) =>
              L.children[p].map((c) => {
                const lw = w[`lines${L.nodes[c].level}`];
                const st = shapeState(A('lines'), lw ? progress(frame, lw.start, lw.dur) : 1);
                const x1 = L.nodes[p].x + L.boxW / 2;
                const y1 = L.nodes[p].y + L.boxH;
                const x2 = L.nodes[c].x + L.boxW / 2;
                const y2 = L.nodes[c].y;
                const ym = (y1 + y2) / 2;
                const len = (ym - y1) + Math.abs(x2 - x1) + (y2 - ym);
                return <path key={`${p}-${c}`} d={`M ${x1} ${y1} V ${ym} H ${x2} V ${y2}`} fill="none" stroke={withAlpha(style.colors.text, 0.45)} strokeWidth={3} strokeDasharray={len} strokeDashoffset={len * (1 - st.length)} opacity={(st.style.opacity as number | undefined) ?? 1} />;
              }),
            )}
          </svg>
          {nodes.map((n, i) => {
            const b = L.nodes[i];
            const lw = w[`level${b.level}`];
            const root = b.level === 0;
            return (
              <div key={i} style={{ position: 'absolute', left: b.x, top: b.y, width: L.boxW, height: L.boxH, boxSizing: 'border-box', padding: PAD, borderRadius: 16, background: root ? withAlpha(accent, 0.18) : card.fill, border: `2px solid ${root ? accent : card.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 4, ...cardStyle(A('nodes'), progress(frame, lw.start, lw.dur)) }}>
                {L.media > 0 && (n.image || n.icon) && (
                  <div {...leaf(`node-${i}-media`, n.image ? `nodes[${i}].image_url` : `nodes[${i}].icon`)} style={{ width: L.media, height: L.media, borderRadius: '50%', overflow: 'hidden', background: style.colors.icon_bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6, flexShrink: 0, ...iconStyle(A('media'), progress(frame, lw.start + 4, lw.dur)) }}>
                    {n.image ? <Img src={n.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <LucideIconView name={n.icon!} size={Math.round(L.media * 0.52)} color={style.colors.icon} />}
                  </div>
                )}
                <AnimatedText lines={b.label} anim="none" start={lw.start} dur={1} frame={frame} weight={F.label.weight} lineHeight={F.label.lineHeight} shadow={onFootage ? FOOTAGE_SHADOW : 'none'} align="center" group={`node-${i}-label`} input={`nodes[${i}].label`} />
                {b.sub && <span {...leaf(`node-${i}-sub`, `nodes[${i}].sub`)} style={{ fontFamily: fontFor(600), fontWeight: 600, fontSize: b.sub.size, lineHeight: F.sub.lineHeight, color: mutedFor(style, onFootage), whiteSpace: 'nowrap' }}>{b.sub.text}</span>}
              </div>
            );
          })}
        </div>
      </SafeArea>
    </div>
  );
}
