'use client';

/**
 * DC-04 · Investigation Board  (animation_type: "dc_investigation_board")
 * A detective / conspiracy board: 3–6 pinned photo cards (people, places, companies, documents)
 * joined by red strings with optional labels ("paid", "brother-in-law"). Cards pin up one by one,
 * then the strings are pulled tight. Only real, sourced links between real people / companies.
 *
 * Inputs (full list, limits and JSON Schema: DC04InvestigationBoard.inputs.json):
 *   title · items[] { label, sub, image_url, icon, focus } · links[] { from, to, label } · image_url · board · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, item 1…6, link 1…6]
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from 'remotion';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type Issue, type TemplateSpec, type TextSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText, sharedFont, linesAt, type Line, type Measure } from './core/fit';
import { cardStyle, easeInOutCubic, exitStyle, progress } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { readNumber } from './core/numbers';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { overlaps, type Box } from './core/placement';
import { fontFor, readStyle, styleVars } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, guide, leaf, readBgMode, readFirst } from './core/shared';

const LINK_LABEL: TextSpec = { label: 'Link label', required: false, minChars: 2, maxChars: 18, minWords: 1, maxWords: 3, maxWordChars: 14, maxLines: 1, fontMax: 22, fontMin: 16, weight: 700, lineHeight: 1.2, fills: 'Words on the string' };

export const DC04_SPEC: TemplateSpec = {
  id: 'DC-04',
  animationType: 'dc_investigation_board',
  name: 'Investigation Board',
  pickWhen: 'Showing how people, companies, places or events are connected in a scam, crime or scandal.',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 210, max: 240 },
  text: {
    title: { label: 'Heading', required: false, minChars: 3, maxChars: 40, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 1, fontMax: 52, fontMin: 36, weight: 800, lineHeight: 1.05, fills: 'Heading above the board', example: 'Follow the money' },
  },
  lists: {
    items: {
      label: 'Card',
      fills: 'Pinned cards, in reveal order',
      minItems: 3,
      maxItems: 6,
      icon: { required: false, fallback: 'user (when there is no picture)' },
      image: { required: false, fills: 'Photo on the card (face, building, logo, document)' },
      fields: {
        label: { label: 'Label', required: true, minChars: 2, maxChars: 24, minWords: 1, maxWords: 4, maxWordChars: 16, maxLines: 1, fontMax: 30, fontMin: 18, weight: 800, lineHeight: 1.15, hint: 'Name of the person / company / place.', fills: 'Name under the photo' },
        sub: { label: 'Sub-line', required: false, minChars: 2, maxChars: 30, minWords: 1, maxWords: 5, maxWordChars: 16, maxLines: 1, fontMax: 20, fontMin: 14, weight: 600, lineHeight: 1.2, hint: 'Role: "Promoter", "Shell company".', fills: 'Line under the name' },
      },
      numbers: { focus: { label: 'Focus', required: false, fills: '1 = the key card (red frame)', min: 0, max: 1, integer: true } },
    },
  },
  custom: {
    inputs: [
      { path: 'links[]', type: 'list', required: false, fills: 'Red strings between cards, in reveal order', limits: 'up to 6' },
      { path: 'links[].from', type: 'number', required: true, fills: 'Card number the string starts at (1 = first card)', limits: '1–6' },
      { path: 'links[].to', type: 'number', required: true, fills: 'Card number the string ends at', limits: '1–6' },
      { path: 'links[].label', type: 'text', required: false, fills: 'Words on the string ("paid ₹40 Cr", "brother")', limits: '2–18 chars · 1–3 words' },
    ],
    schema: {
      links: {
        type: 'array',
        maxItems: 6,
        description: 'Strings between cards (1-based card numbers).',
        items: { type: 'object', additionalProperties: false, required: ['from', 'to'], properties: { from: { type: 'integer', minimum: 1, maximum: 6 }, to: { type: 'integer', minimum: 1, maximum: 6 }, label: { type: 'string', minLength: 2, maxLength: 18 } } },
      },
    },
  },
  options: {
    board: { label: 'Board', values: ['cork', 'dark'], default: 'cork', fills: 'Cork board or dark board' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'Behind the board' },
  },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    cards: { label: 'Cards', kind: 'card', target: 'each pinned card', default: 'pop' },
    strings: { label: 'Strings', kind: 'shape', target: 'each red string', default: 'grow' },
    link_labels: { label: 'String labels', kind: 'card', target: 'words on each string', default: 'pop' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the board', default: 'fade' },
  },
  cues: { description: 'Fixed slots: heading → card 1…6 → string 1…6. Send null for slots you do not use.', units: ['heading', 'card 1', 'card 2', 'card 3', 'card 4', 'card 5', 'card 6', 'string 1', 'string 2', 'string 3', 'string 4', 'string 5', 'string 6'] },
  colors: ['negative'],
  validate: (props) => {
    const issues: Issue[] = [];
    const n = Array.isArray(props.items) ? props.items.length : 0;
    (Array.isArray(props.links) ? (props.links as Record<string, unknown>[]) : []).forEach((l, i) => {
      const f = readNumber(l?.from);
      const t = readNumber(l?.to);
      if (!f || !t || f < 1 || t < 1 || f > n || t > n || f === t) issues.push({ field: `links[${i}]`, level: 'warning', message: `String ${i + 1}: from / to must be two different card numbers 1–${n}` });
    });
    return issues;
  },
  example: {
    title: 'Follow the money (illustrative)',
    items: [
      { label: 'Company A', sub: 'Listed firm', icon: 'building', focus: 1 },
      { label: 'Shell firm B', sub: 'Registered abroad', icon: 'briefcase' },
      { label: 'Promoter C', sub: 'Director', icon: 'user' },
      { label: 'Bank D', sub: 'Lender', icon: 'landmark' },
    ],
    links: [
      { from: 1, to: 2, label: 'paid' },
      { from: 2, to: 3, label: 'owned by' },
      { from: 4, to: 1, label: 'loan' },
    ],
    board: 'cork',
    background: 'theme',
  },
};

type Item = { label: string; sub: string; image?: string; icon?: string; focus: boolean };
type Link = { from: number; to: number; label: string };
// rows of cards (top → bottom) for 3–6 cards; rows are staggered a little so the board looks pinned by hand
const ROWS: Record<number, number[]> = { 3: [3], 4: [2, 2], 5: [3, 2], 6: [3, 3] };
const STAGGER = [-18, 22, -8, 16, -22, 10];
const TILT = [-3, 2.5, -1.5, 3, -2.5, 1.5];
export const BOARD_PAD = 24;

export type BoardLayout = { title: Line[]; titleH: number; board: Box; cardW: number; photo: number; cardH: number; cards: { box: Box; label: Line; sub?: Line }[]; linkLabels: (Line | undefined)[]; linkBoxes: (Box | null)[] };

export function layoutBoard(input: { title: string; items: Item[]; links: Link[] }, measure: Measure, spec: TemplateSpec = DC04_SPEC): BoardLayout {
  const F = spec.lists.items.fields;
  const n = Math.max(3, Math.min(6, input.items.length));
  const title = input.title ? fitText(input.title, spec.text.title, SAFE_W, measure, false).lines : [];
  const titleH = title.length ? title[0].size * 1.05 + 24 : 0;
  const board = { x: 0, y: titleH, w: SAFE_W, h: SAFE_H - titleH };
  const rows = ROWS[n];
  const maxCols = Math.max(...rows);
  const availH = (board.h - 2 * BOARD_PAD - 40 * (rows.length - 1)) / rows.length - 40;
  // card = square photo + caption; sized to fit both the widest row and the rows' height
  const cardW = Math.floor(Math.min(300, (board.w - 2 * BOARD_PAD - 80 * (maxCols - 1)) / maxCols - 20, availH - 70));
  const photo = cardW - 28;
  const cardH = Math.round(photo + 14 + 44 + 26);
  const inner = cardW - 24;
  const lf = sharedFont(input.items.map((i) => i.label), F.label, inner, measure);
  const sf = sharedFont(input.items.map((i) => i.sub || ' '), F.sub, inner, measure);
  let k = 0;
  const slots: { x: number; y: number }[] = [];
  rows.forEach((cols, r) => {
    const rowH = (board.h - 2 * BOARD_PAD) / rows.length;
    const cy = board.y + BOARD_PAD + rowH * (r + 0.5);
    for (let c = 0; c < cols; c++) {
      const colW = (board.w - 2 * BOARD_PAD) / cols;
      const cx = board.x + BOARD_PAD + colW * (c + 0.5);
      slots.push({ x: cx, y: cy + (rows.length > 1 ? STAGGER[k % 6] * 0.6 : STAGGER[k % 6] * 2) });
      k++;
    }
  });
  const cards = input.items.slice(0, 6).map((it, i) => {
    const sl = slots[Math.min(i, slots.length - 1)];
    // keep the (slightly tilted) card inside the board
    const x = Math.max(board.x + BOARD_PAD + 12, Math.min(board.x + board.w - BOARD_PAD - 12 - cardW, sl.x - cardW / 2));
    const y = Math.max(board.y + BOARD_PAD + 12, Math.min(board.y + board.h - BOARD_PAD - 12 - cardH, sl.y - cardH / 2));
    return { box: { x, y, w: cardW, h: cardH }, label: linesAt(it.label, lf, F.label, inner, measure, false)[0], sub: it.sub ? linesAt(it.sub, sf, F.sub, inner, measure, false)[0] : undefined };
  });
  // string labels at the middle of the string (or a third along it) where they do not cover a card
  const placed: Box[] = cards.map((c) => ({ x: c.box.x - 10, y: c.box.y - 10, w: c.box.w + 20, h: c.box.h + 20 }));
  const linkLabels = input.links.map((l) => (l.label ? fitText(l.label, LINK_LABEL, 260, measure, false).lines[0] : undefined));
  const linkBoxes = input.links.map((l, i) => {
    const lab = linkLabels[i];
    if (!lab) return null;
    const a = cards[l.from];
    const b = cards[l.to];
    const w = Math.ceil(measure(lab.text, lab.size, 700)) + 24;
    const h = Math.round(lab.size * 1.2 + 10);
    for (const t of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      const px = a.box.x + a.box.w / 2 + (b.box.x - a.box.x) * t;
      const py = a.box.y + 14 + (b.box.y - a.box.y) * t;
      const box = { x: px - w / 2, y: py - h / 2, w, h };
      if (box.x < 0 || box.y < 0 || box.x + w > SAFE_W || box.y + h > SAFE_H) continue;
      if (placed.some((q) => overlaps(box, q, 4))) continue;
      placed.push(box);
      return box;
    }
    return null;
  });
  return { title, titleH, board, cardW, photo, cardH, cards, linkLabels, linkBoxes };
}

export function planBoard(nItems: number, nLinks: number, hasTitle: boolean, duration: number, cueTimes?: number[]): Plan {
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const first = hasTitle ? 16 : 6;
  const total = nItems + nLinks;
  const gap = total > 1 ? Math.max(5, Math.min(22, Math.floor((budget - first - 20) / (total - 1)))) : 0;
  const units: Unit[] = [];
  if (hasTitle) units.push({ key: 'title', label: 'Heading', start: 2, dur: 14, cue: 0 });
  for (let i = 0; i < nItems; i++) units.push({ key: `card${i}`, label: `Card ${i + 1}`, start: first + i * gap, dur: 14, cue: 1 + i });
  for (let i = 0; i < nLinks; i++) {
    const s0 = first + (nItems + i) * gap;
    units.push({ key: `link${i}`, label: `String ${i + 1}`, start: s0, dur: 16, cue: 7 + i });
    units.push({ key: `link${i}_label`, label: `String ${i + 1} label`, start: s0 + 10, dur: 12, follows: { key: `link${i}`, offset: 10 } });
  }
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareDC04(props: Record<string, unknown>, durationInFrames: number) {
  const F = DC04_SPEC.lists.items.fields;
  const A = (k: string) => readAnim(props, DC04_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DC04_SPEC, props);
  const measure = measureFor(style);
  const s = (o: Record<string, unknown>, k: string) => (typeof o[k] === 'string' && (o[k] as string).trim() ? (o[k] as string) : undefined);
  const items: Item[] = (Array.isArray(props.items) ? props.items : [])
    .map((x): Item | null => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const label = normaliseText(s(o, 'label'), F.label);
      return label ? { label, sub: normaliseText(s(o, 'sub'), F.sub), image: s(o, 'image_url'), icon: s(o, 'icon'), focus: o.focus === 1 } : null;
    })
    .filter((x): x is Item => x !== null)
    .slice(0, 6);
  const links: Link[] = (Array.isArray(props.links) ? props.links : [])
    .map((x) => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const f = Math.round(readNumber(o.from) ?? 0) - 1;
      const t = Math.round(readNumber(o.to) ?? 0) - 1;
      return f >= 0 && t >= 0 && f < items.length && t < items.length && f !== t ? { from: f, to: t, label: normaliseText(s(o, 'label'), LINK_LABEL) } : null;
    })
    .filter((x): x is Link => x !== null)
    .slice(0, 6);
  const L = layoutBoard({ title: normaliseText(readFirst(props, ['title']), DC04_SPEC.text.title), items, links }, measure, sized.spec);
  const plan = planBoard(items.length, links.length, L.title.length > 0, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, items, links, L, plan, imageUrl, bg: readBgMode(props, imageUrl), board: opt(props, 'board', ['cork', 'dark'] as const, 'cork'), debug: props.show_safe_area === true };
}

export function DC04InvestigationBoard({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, items, links, L, plan, imageUrl, bg, board, debug } = prepareDC04(props, durationInFrames);
  const w = plan.windows;
  const F = DC04_SPEC.lists.items.fields;
  const red = style.custom.has('negative') ? style.colors.negative : '#D42A2A';
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const pin = (i: number) => ({ x: L.cards[i].box.x + L.cardW / 2, y: L.cards[i].box.y + 14 });
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={style.colors.accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.title.length > 0 && w.title && <AnimatedText lines={L.title} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={800} lineHeight={1.05} shadow={bg === 'theme' ? 'none' : FOOTAGE_SHADOW} group="title" input="title" />}
          <div style={{ position: 'absolute', left: L.board.x, top: L.board.y, width: L.board.w, height: L.board.h, borderRadius: 16, background: board === 'cork' ? 'radial-gradient(circle at 30% 30%, #C9975F 0%, #A8763F 60%, #8E6232 100%)' : '#1E222B', boxShadow: `inset 0 0 0 10px ${board === 'cork' ? '#6E4A24' : '#2E333F'}` }} />
          {items.map((it, i) => {
            const c = L.cards[i];
            const cw = w[`card${i}`];
            const cs = cardStyle(A('cards'), progress(frame, cw.start, cw.dur));
            return (
              <div key={i} style={{ position: 'absolute', left: c.box.x, top: c.box.y, width: c.box.w, height: c.box.h, transform: `rotate(${TILT[i]}deg) ${String(cs.transform ?? '')}`, opacity: cs.opacity }}>
                {/* one leaf per card: the tilt must not make its own parts "overlap" */}
                <div {...leaf(`card-${i}`, `items[${i}]`)} style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', padding: 14, background: '#F4F1EA', boxShadow: '0 10px 20px rgba(0,0,0,0.35)', border: it.focus ? `5px solid ${red}` : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: L.photo - (it.focus ? 10 : 0), height: L.photo - (it.focus ? 10 : 0), background: '#2A2E38', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {it.image ? <Img src={it.image} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(0.3) contrast(1.05)' }} /> : <LucideIconView name={it.icon ?? 'user'} size={Math.round(L.photo * 0.42)} color="#9AA0AE" />}
                  </div>
                  <span style={{ marginTop: 10, fontFamily: fontFor(800), fontWeight: 800, fontSize: c.label.size, lineHeight: F.label.lineHeight, color: '#1B1B1B', whiteSpace: 'nowrap' }}>{c.label.text}</span>
                  {c.sub && <span style={{ fontFamily: fontFor(600), fontWeight: 600, fontSize: c.sub.size, lineHeight: F.sub.lineHeight, color: '#5A5A5A', whiteSpace: 'nowrap' }}>{c.sub.text}</span>}
                </div>
                <div style={{ position: 'absolute', left: '50%', top: 2, width: 24, height: 24, marginLeft: -12, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #FF7A7A, #B81515)', boxShadow: '0 3px 4px rgba(0,0,0,0.4)' }} />
              </div>
            );
          })}
          <svg {...guide('strings', 'links[]')} width={SAFE_W} height={SAFE_H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
            {links.map((l, i) => {
              const lw = w[`link${i}`];
              const p = A('strings') === 'grow' ? easeInOutCubic(progress(frame, lw.start, lw.dur)) : frame >= lw.start ? 1 : 0;
              if (p <= 0) return null;
              const a = pin(l.from);
              const b = pin(l.to);
              // a little slack in the string: a shallow curve that tightens as it is drawn
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2 + 30 * (1 - p) + 10;
              const x2 = a.x + (b.x - a.x) * p;
              const y2 = a.y + (b.y - a.y) * p;
              return <path key={i} d={`M ${a.x} ${a.y} Q ${a.x + (mx - a.x) * p} ${a.y + (my - a.y) * p} ${x2} ${y2}`} fill="none" stroke={red} strokeWidth={4} strokeLinecap="round" opacity={A('strings') === 'fade' ? progress(frame, lw.start, lw.dur) : 1} />;
            })}
          </svg>
          {links.map((l, i) => {
            const b = L.linkBoxes[i];
            const lab = L.linkLabels[i];
            if (!b || !lab) return null;
            const lw = w[`link${i}_label`];
            return (
              <div key={`ll${i}`} {...leaf(`link-${i}`, `links[${i}].label`)} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, boxSizing: 'border-box', borderRadius: 6, background: red, display: 'flex', alignItems: 'center', justifyContent: 'center', ...cardStyle(A('link_labels'), progress(frame, lw.start, lw.dur)) }}>
                <span style={{ fontFamily: fontFor(700), fontWeight: 700, fontSize: lab.size, lineHeight: 1.2, color: '#FFFFFF', whiteSpace: 'nowrap' }}>{lab.text}</span>
              </div>
            );
          })}
        </div>
      </SafeArea>
    </div>
  );
}
