'use client';

/**
 * DG-09 · Decision Tree  (animation_type: "dg_decision_tree")
 * Questions branch into answers ("Yes" / "No" / "Under 25"…) until they reach outcomes — eligibility,
 * "should you…", how a rule applies. Top-down, revealed branch by branch; outcomes can be marked
 * good (green) or bad (red).
 *
 * Inputs (full list, limits and JSON Schema: DG09DecisionTree.inputs.json):
 *   title · nodes[] { text, parent, branch, outcome } · image_url · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, node 1…9]
 * parent = number of the node this one branches from (1 = first); branch = words on that branch.
 * outcome: 1 = good result, 2 = bad result, leave out for a question / neutral step.
 * Timing: 3–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type Issue, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, progress, shapeState } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { readNumber } from './core/numbers';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { overlaps, type Box } from './core/placement';
import { flattenDepth, treeLayout } from './core/tree';
import { cardColors, fontFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, guide, leaf, readBgMode, readFirst } from './core/shared';

const BRANCH = { label: 'Branch', required: false, minChars: 1, maxChars: 14, minWords: 1, maxWords: 3, maxWordChars: 12, maxLines: 1, fontMax: 22, fontMin: 15, weight: 800, lineHeight: 1.2, fills: 'Words on the branch into this node' };

export const DG09_SPEC: TemplateSpec = {
  id: 'DG-09',
  animationType: 'dg_decision_tree',
  name: 'Decision Tree',
  pickWhen: 'Explaining a choice or eligibility step by step: "If X, then… otherwise…".',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 210, max: 240 },
  text: {
    title: { label: 'Heading', required: false, minChars: 3, maxChars: 44, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 1, fontMax: 52, fontMin: 36, weight: 800, lineHeight: 1.05, fills: 'Heading above the tree', example: 'Do you need to file ITR? (illustrative)' },
  },
  lists: {
    nodes: {
      label: 'Node',
      fills: 'Questions and outcomes (the first node is the starting question)',
      minItems: 3,
      maxItems: 9,
      fields: {
        text: { label: 'Text', required: true, minChars: 2, maxChars: 50, minWords: 1, maxWords: 9, maxWordChars: 16, maxLines: 3, fontMax: 30, fontMin: 16, weight: 700, lineHeight: 1.2, hint: 'A question ("Income over ₹3 lakh?") or an outcome ("You must file").', fills: 'Node text' },
        branch: { ...BRANCH, hint: '"Yes", "No", "Under 25"…' },
      },
      numbers: {
        parent: { label: 'Parent', required: false, fills: 'Number of the node this one branches from (1 = first). Leave out for the first question.', min: 1, max: 9, integer: true },
        outcome: { label: 'Outcome', required: false, fills: '1 = good result (green) · 2 = bad result (red) · leave out for a question', min: 1, max: 2, integer: true },
      },
    },
  },
  options: { background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' } },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    nodes: { label: 'Nodes', kind: 'card', target: 'each question / outcome', default: 'pop' },
    branches: { label: 'Branches', kind: 'shape', target: 'line into each node', default: 'grow' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the tree', default: 'fade_up' },
  },
  cues: { description: 'Fixed slots: heading → node 1 … node 9 (in the order given; send null for unused slots).', units: ['heading', 'node 1', 'node 2', 'node 3', 'node 4', 'node 5', 'node 6', 'node 7', 'node 8', 'node 9'] },
  colors: ['card', 'card_border', 'positive', 'negative'],
  validate: (props) => {
    const issues: Issue[] = [];
    const nodes = Array.isArray(props.nodes) ? (props.nodes as Record<string, unknown>[]) : [];
    nodes.forEach((x, i) => {
      const p = readNumber(x?.parent);
      if (i > 0 && p === undefined) issues.push({ field: `nodes[${i}].parent`, level: 'warning', message: `Node ${i + 1} has no parent — it is hung under node 1` });
      if (p !== undefined && (p < 1 || p > nodes.length || p === i + 1)) issues.push({ field: `nodes[${i}].parent`, level: 'warning', message: `Node ${i + 1}: parent must be another node number` });
    });
    return issues;
  },
  example: {
    title: 'Do you need to file ITR? (illustrative)',
    nodes: [
      { text: 'Income above the basic exemption?' },
      { text: 'You must file', parent: 1, branch: 'Yes', outcome: 2 },
      { text: 'Any foreign assets or big deposits?', parent: 1, branch: 'No' },
      { text: 'You must file', parent: 3, branch: 'Yes', outcome: 2 },
      { text: 'Filing is optional', parent: 3, branch: 'No', outcome: 1 },
    ],
    background: 'theme',
  },
};

type DNode = { text: string; parent: number; branch: string; outcome: 0 | 1 | 2 };
export const V_GAP = 96;
export const PAD = 18;
export type DecisionLayout = { title: Line[]; titleH: number; boxW: number; boxH: number; nodes: { x: number; y: number; lines: Line[]; level: number; branch?: Line; branchW: number; chip: Box | null }[]; children: number[][]; levels: number };

export function layoutDecision(input: { title: string; nodes: DNode[] }, measure: Measure, spec: TemplateSpec = DG09_SPEC): DecisionLayout {
  const F = spec.lists.nodes.fields;
  const title = input.title ? fitText(input.title, spec.text.title, SAFE_W, measure, false).lines : [];
  const titleH = title.length ? title[0].size * 1.05 + 32 : 0;
  const t = treeLayout(input.nodes.map((n) => ({ parent: n.parent })), SAFE_W);
  const minSlot = Math.min(...t.pos.map((p) => p.slotW));
  const boxW = Math.floor(Math.max(120, Math.min(380, minSlot - 24)));
  const rowH = (SAFE_H - titleH - V_GAP * (t.levels - 1)) / t.levels;
  const inner = boxW - PAD * 2 - 40; // room for the ✓ / ✕ on outcomes
  const branches = input.nodes.map((n) => (n.branch ? fitText(n.branch, BRANCH, Math.min(200, minSlot * 0.6), measure, false).lines[0] : undefined));
  let cap = Math.min(F.text.fontMax, Math.round(rowH * 0.2));
  for (;;) {
    const f = sharedFont(input.nodes.map((n) => n.text), F.text, inner, measure, cap);
    const lines = input.nodes.map((n) => linesAt(n.text, f, F.text, inner, measure));
    const boxH = Math.ceil(PAD * 2 + Math.max(...lines.map((l) => blockHeight(l, F.text.lineHeight))));
    if (boxH <= rowH || cap <= F.text.fontMin) {
      const h = Math.min(boxH, rowH);
      const rowY = Array.from({ length: t.levels }, (_, l) => titleH + l * (rowH + V_GAP) + (rowH - h) / 2);
      const out = input.nodes.map((_, i) => ({ x: Math.max(0, Math.min(SAFE_W - boxW, t.pos[i].cx - boxW / 2)), y: rowY[t.pos[i].level], lines: lines[i], level: t.pos[i].level, branch: branches[i], branchW: branches[i] ? Math.ceil(measure(branches[i]!.text, branches[i]!.size, 800)) + 24 : 0, chip: null as Box | null }));
      // branch chips sit on their line, nearer the child; one that would touch a node or another chip is left out
      const placed: Box[] = out.map((o) => ({ x: o.x, y: o.y, w: boxW, h }));
      out.forEach((o, i) => {
        const par = input.nodes[i].parent;
        if (!o.branch || par < 0) return;
        const pn = out[par];
        const chH = Math.round(o.branch.size * 1.2 + 12);
        for (const tt of [0.6, 0.72, 0.48]) {
          const mx = pn.x + boxW / 2 + (o.x - pn.x) * tt;
          const my = pn.y + h + (o.y - pn.y - h) * tt;
          const box = { x: Math.max(0, Math.min(SAFE_W - o.branchW, mx - o.branchW / 2)), y: my - chH / 2, w: o.branchW, h: chH };
          if (!placed.some((q) => overlaps(box, q, 4))) {
            placed.push(box);
            o.chip = box;
            return;
          }
        }
      });
      return { title, titleH, boxW, boxH: h, levels: t.levels, children: t.children, nodes: out };
    }
    cap -= 2;
  }
}

export function planDecision(n: number, hasTitle: boolean, duration: number, cueTimes?: number[]): Plan {
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const first = hasTitle ? 16 : 6;
  const gap = n > 1 ? Math.max(6, Math.min(24, Math.floor((budget - first - 20) / (n - 1)))) : 0;
  const units: Unit[] = [];
  if (hasTitle) units.push({ key: 'title', label: 'Heading', start: 2, dur: 14, cue: 0 });
  for (let i = 0; i < n; i++) {
    units.push({ key: `node${i}`, label: `Node ${i + 1}`, start: first + i * gap, dur: 14, cue: 1 + i });
    if (i > 0) units.push({ key: `branch${i}`, label: `Branch into ${i + 1}`, start: first + i * gap - 8, dur: 10, follows: { key: `node${i}`, offset: -8 } });
  }
  return planTimeline(duration, units, cueTimes);
}

export function prepareDG09(props: Record<string, unknown>, durationInFrames: number) {
  const F = DG09_SPEC.lists.nodes.fields;
  const A = (k: string) => readAnim(props, DG09_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DG09_SPEC, props);
  const measure = measureFor(style);
  const raw = (Array.isArray(props.nodes) ? props.nodes : []).slice(0, 9).map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}));
  const nodes: DNode[] = raw
    .map((o) => {
      const oc = readNumber(o.outcome);
      return { text: normaliseText(typeof o.text === 'string' ? o.text : '', F.text), parent: (readNumber(o.parent) ?? 0) - 1, branch: normaliseText(typeof o.branch === 'string' ? o.branch : '', BRANCH), outcome: (oc === 1 || oc === 2 ? oc : 0) as 0 | 1 | 2 };
    })
    .filter((n) => n.text);
  nodes.forEach((n, i) => {
    if (i === 0) n.parent = -1;
    else if (n.parent < 0 || n.parent >= nodes.length || n.parent === i) n.parent = 0;
  });
  const flat = flattenDepth(nodes, 4);
  const L = layoutDecision({ title: normaliseText(readFirst(props, ['title']), DG09_SPEC.text.title), nodes: flat }, measure, sized.spec);
  const plan = planDecision(nodes.length, L.title.length > 0, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, nodes: flat, L, plan, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

export function DG09DecisionTree({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, nodes, L, plan, imageUrl, bg, debug } = prepareDG09(props, durationInFrames);
  const w = plan.windows;
  const F = DG09_SPEC.lists.nodes.fields;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const card = cardColors(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const colorOf = (n: DNode) => (n.outcome === 1 ? style.colors.positive : n.outcome === 2 ? style.colors.negative : accent);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.title.length > 0 && w.title && <AnimatedText lines={L.title} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={800} lineHeight={1.05} shadow={onFootage ? FOOTAGE_SHADOW : 'none'} align="center" group="title" input="title" style={{ position: 'absolute', left: 0, width: SAFE_W, top: 0 }} />}
          <svg {...guide('branches', 'nodes[].parent')} width={SAFE_W} height={SAFE_H} style={{ position: 'absolute', left: 0, top: 0 }}>
            {nodes.map((n, i) => {
              if (i === 0 || n.parent < 0) return null;
              const bw = w[`branch${i}`];
              const st = shapeState(A('branches'), bw ? progress(frame, bw.start, bw.dur) : 1);
              const p = L.nodes[n.parent];
              const c = L.nodes[i];
              const x1 = p.x + L.boxW / 2;
              const y1 = p.y + L.boxH;
              const x2 = c.x + L.boxW / 2;
              const y2 = c.y;
              const len = Math.hypot(x2 - x1, y2 - y1);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={withAlpha(colorOf(n), 0.8)} strokeWidth={4} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - st.length)} opacity={(st.style.opacity as number | undefined) ?? 1} />;
            })}
          </svg>
          {nodes.map((n, i) => {
            const b = L.nodes[i];
            const nw = w[`node${i}`];
            const col = colorOf(n);
            const isOutcome = n.outcome > 0;
            const tlh = blockHeight(b.lines, F.text.lineHeight);
            return (
              <div key={i}>
                {b.branch && b.chip && i > 0 && (
                  <div {...leaf(`branch-${i}`, `nodes[${i}].branch`)} style={{ position: 'absolute', left: b.chip.x, top: b.chip.y, width: b.chip.w, height: b.chip.h, boxSizing: 'border-box', borderRadius: 999, background: withAlpha(col, 0.95), display: 'flex', alignItems: 'center', justifyContent: 'center', ...cardStyle('pop', progress(frame, w[`branch${i}`]?.start ?? 0, 10)) }}>
                    <span style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: b.branch.size, lineHeight: 1.2, color: style.colors.on_accent, whiteSpace: 'nowrap' }}>{b.branch.text}</span>
                  </div>
                )}
                <div style={{ position: 'absolute', left: b.x, top: b.y, width: L.boxW, height: L.boxH, boxSizing: 'border-box', padding: `${PAD}px ${PAD}px`, borderRadius: isOutcome ? 999 : 18, background: isOutcome ? withAlpha(col, 0.2) : card.fill, border: `3px solid ${isOutcome ? col : withAlpha(accent, 0.6)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...cardStyle(A('nodes'), progress(frame, nw.start, nw.dur)) }}>
                  {isOutcome && L.boxH > 60 && <LucideIconView name={n.outcome === 1 ? 'check' : 'x'} size={Math.min(30, Math.round(tlh))} color={col} />}
                  <AnimatedText lines={b.lines} anim="none" start={nw.start} dur={1} frame={frame} weight={F.text.weight} lineHeight={F.text.lineHeight} shadow={onFootage ? FOOTAGE_SHADOW : 'none'} align="center" group={`node-${i}`} input={`nodes[${i}].text`} />
                </div>
              </div>
            );
          })}
        </div>
      </SafeArea>
    </div>
  );
}
