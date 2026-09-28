'use client';

/**
 * DG-05 · A → B Relationship  (animation_type: "dg_relationship")
 * Two or three cards linked by labelled arrows: cause → effect, problem → solution,
 * trigger → response, or a chain of three. Each card: tag, optional icon / picture, label, sub-line.
 *
 * Inputs (full list, limits and JSON Schema: DG05Relationship.inputs.json):
 *   title · nodes[] { label, sub, tag, arrow, icon, image_url } · image_url
 *   kind · orientation · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, card 1, arrow 1, card 2, arrow 2, card 3]
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from 'remotion';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, iconStyle, progress, shapeState, textAnimFrames } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { cardColors, fontFor, mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';

/* ================================================================== */
/* Content spec                                                         */
/* ================================================================== */

export const DG05_SPEC: TemplateSpec = {
  id: 'DG-05',
  animationType: 'dg_relationship',
  name: 'A → B Relationship',
  pickWhen: 'One thing leads to another: cause → effect, problem → solution, trigger → response, or a short chain of three.',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 150, max: 240 },
  text: {
    title: { label: 'Heading', required: false, minChars: 3, maxChars: 50, minWords: 1, maxWords: 10, maxWordChars: 18, maxLines: 1, fontMax: 60, fontMin: 40, weight: 800, lineHeight: 1.04, hint: '"Why onion prices spike".', fills: 'Heading above the cards', example: 'Why onion prices spike' },
  },
  lists: {
    nodes: {
      label: 'Card',
      fills: 'Cards left to right (or top to bottom)',
      minItems: 2,
      maxItems: 3,
      icon: { required: false, fallback: 'none' },
      image: { required: false, fills: 'Circle picture at the top of the card' },
      fields: {
        label: { label: 'Label', required: true, minChars: 2, maxChars: 30, minWords: 1, maxWords: 6, maxWordChars: 16, maxLines: 2, fontMax: 48, fontMin: 26, weight: 700, lineHeight: 1.18, hint: 'The thing itself: "Heavy rain in Nashik".', fills: 'Card label' },
        sub: { label: 'Sub-line', required: false, minChars: 5, maxChars: 60, minWords: 1, maxWords: 11, maxWordChars: 16, maxLines: 3, fontMax: 28, fontMin: 18, weight: 500, lineHeight: 1.32, hint: 'One line of detail.', fills: 'Detail under the label' },
        tag: { label: 'Tag', required: false, minChars: 2, maxChars: 16, minWords: 1, maxWords: 2, maxWordChars: 14, maxLines: 1, fontMax: 24, fontMin: 16, weight: 700, lineHeight: 1.2, hint: 'Small label on the card; defaults from `kind` (Cause / Effect…).', fills: 'Small tag at the top of the card' },
        arrow: { label: 'Arrow label', required: false, minChars: 2, maxChars: 20, minWords: 1, maxWords: 4, maxWordChars: 12, maxLines: 2, fontMax: 26, fontMin: 16, weight: 600, lineHeight: 1.2, hint: 'Words on the arrow AFTER this card: "leads to", "causes". Ignored on the last card.', fills: 'Label on the arrow to the next card' },
      },
    },
  },
  options: {
    kind: {
      label: 'Kind',
      values: ['cause_effect', 'problem_solution', 'trigger_response', 'custom'],
      default: 'cause_effect',
      fills: 'Sets default tags (Cause → Effect, Problem → Solution, Trigger → Response) and colours the last card (solution / response in accent)',
    },
    orientation: { label: 'Orientation', values: ['horizontal', 'vertical'], default: 'horizontal', fills: 'Cards in a row, or stacked top to bottom (better for long sub-lines)' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    cards: { label: 'Cards', kind: 'card', target: 'each card', default: 'pop' },
    media: { label: 'Icons / pictures', kind: 'icon', target: 'icon or picture of each card', default: 'pop' },
    labels: { label: 'Labels', kind: 'text', target: 'label of each card', default: 'fade_up' },
    subs: { label: 'Sub-lines', kind: 'text', target: 'sub-line of each card', default: 'fade' },
    arrows: { label: 'Arrows', kind: 'shape', target: 'each arrow (draws towards the next card)', default: 'grow' },
    arrow_labels: { label: 'Arrow labels', kind: 'text', target: 'words on each arrow', default: 'fade' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: {
    description: 'heading (skipped if absent) → card 1 → arrow 1 → card 2 → arrow 2 → card 3. Slots are fixed: send null for ones you do not need.',
    units: ['heading', 'card 1', 'arrow 1', 'card 2', 'arrow 2', 'card 3'],
  },
  colors: ['icon', 'icon_bg', 'card', 'card_border', 'positive', 'negative'],
  example: {
    title: 'Why onion prices spike',
    nodes: [
      { label: 'Heavy rain in Nashik', sub: 'Crops damaged before harvest', icon: 'umbrella', arrow: 'cuts supply' },
      { label: 'Onion prices double', sub: 'Within a few weeks in city markets', icon: 'trending-up' },
    ],
    kind: 'cause_effect',
    background: 'theme',
  },
};

/* ================================================================== */
/* Layout                                                               */
/* ================================================================== */

export type RelNode = { label: string; sub?: string; tag?: string; arrow?: string; icon?: string; image?: string };
export const HEADING_GAP = 44;
export const CARD_PAD = 36;
export const MEDIA_GAP = 20;
export const TAG_GAP = 18;
export const SUB_GAP = 12;

export type RelLayout = {
  orientation: 'horizontal' | 'vertical';
  heading: Line[];
  top: number;
  cardW: number;
  cardH: number;
  arrowLen: number;
  media: number;
  tagFont: number;
  labels: Line[][];
  subs: Line[][];
  tags: (Line | undefined)[];
  arrows: Line[][];
  cards: { x: number; y: number }[];
  blockH: number;
};

export function layoutRel(input: { title: string; nodes: RelNode[]; orientation: 'horizontal' | 'vertical' }, measure: Measure, spec: TemplateSpec = DG05_SPEC): RelLayout {
  const F = spec.lists.nodes.fields;
  const n = Math.max(2, input.nodes.length);
  const heading = input.title ? fitText(input.title, spec.text.title, SAFE_W, measure, false).lines : [];
  const headingH = heading.length ? blockHeight(heading, spec.text.title.lineHeight) + HEADING_GAP : 0;
  const avail = SAFE_H - headingH;
  const hasMedia = input.nodes.some((x) => x.icon || x.image);
  const hasSub = input.nodes.some((x) => x.sub);
  const horiz = input.orientation === 'horizontal';
  const arrowLen = horiz ? (n === 3 ? 200 : 260) : 110;
  const cardW = horiz ? (SAFE_W - arrowLen * (n - 1)) / n : Math.min(1300, SAFE_W);
  const innerW = cardW - CARD_PAD * 2;
  const arrowTextW = horiz ? arrowLen - 20 : 600;
  const tags = input.nodes.map((x) => (x.tag ? fitText(x.tag, F.tag, innerW, measure, false).lines[0] : undefined));
  const tagFont = tags.find(Boolean)?.size ?? 0;
  const af = sharedFont(input.nodes.slice(0, -1).map((x) => x.arrow ?? ''), F.arrow, arrowTextW, measure);
  const arrows = input.nodes.slice(0, -1).map((x) => (x.arrow ? linesAt(x.arrow, af, F.arrow, arrowTextW, measure) : []));

  let media = hasMedia ? (horiz ? 104 : 80) : 0;
  let lCap = F.label.fontMax;
  let sCap = F.sub.fontMax;
  const build = () => {
    const lf = sharedFont(input.nodes.map((x) => x.label), F.label, horiz ? innerW : innerW - (media ? media + 28 : 0), measure, lCap);
    const tw = horiz ? innerW : innerW - (media ? media + 28 : 0);
    const sf = hasSub ? sharedFont(input.nodes.map((x) => x.sub ?? ''), F.sub, tw, measure, Math.min(sCap, Math.round(lf * 0.7))) : 0;
    const labels = input.nodes.map((x) => linesAt(x.label, lf, F.label, tw, measure));
    const subs = input.nodes.map((x) => (x.sub ? linesAt(x.sub, sf, F.sub, tw, measure) : []));
    const textH = Math.max(...labels.map((l, i) => blockHeight(l, F.label.lineHeight) + (subs[i].length ? SUB_GAP + blockHeight(subs[i], F.sub.lineHeight) : 0)));
    const tagH = tagFont ? tagFont * 1.2 + 16 + TAG_GAP : 0;
    const cardH = Math.round(horiz ? CARD_PAD * 2 + tagH + (media ? media + MEDIA_GAP : 0) + textH : CARD_PAD * 2 + Math.max(tagH + textH, media));
    const blockH = headingH + (horiz ? cardH : cardH * n + arrowLen * (n - 1));
    return { labels, subs, cardH, blockH };
  };
  let b = build();
  while (b.blockH > SAFE_H && (sCap > F.sub.fontMin || lCap > F.label.fontMin || media > 56)) {
    if (sCap > F.sub.fontMin) sCap -= 2;
    else if (lCap > F.label.fontMin) lCap -= 2;
    else media -= 8;
    b = build();
  }
  const top = headingH + (avail - (horiz ? b.cardH : b.cardH * n + arrowLen * (n - 1))) / 2;
  const cards = input.nodes.map((_, i) => (horiz ? { x: i * (cardW + arrowLen), y: top } : { x: (SAFE_W - cardW) / 2, y: top + i * (b.cardH + arrowLen) }));
  return { orientation: input.orientation, heading, top, cardW, cardH: b.cardH, arrowLen, media, tagFont, labels: b.labels, subs: b.subs, tags, arrows, cards, blockH: SAFE_H };
}

/* ================================================================== */
/* Timing                                                               */
/* ================================================================== */

export function planRel(L: RelLayout, anims: { title: string; labels: string; subs: string; arrow_labels: string }, duration: number, cueTimes?: number[]): Plan {
  const T = (lines: Line[]) => lines.map((l) => l.text).join(' ');
  const units: Unit[] = [];
  let cue = 0;
  if (L.heading.length) {
    const h = T(L.heading);
    units.push({ key: 'title', label: 'Heading', start: 2, dur: textAnimFrames(anims.title, words(h).length, h.length, 18), cue: cue++ });
  }
  const n = L.labels.length;
  let t = L.heading.length ? 18 : 6;
  for (let i = 0; i < n; i++) {
    units.push({ key: `card${i}`, label: `Card ${i + 1}`, start: t, dur: 16, cue: cue + i * 2 });
    const l = T(L.labels[i]);
    units.push({ key: `card${i}_media`, label: `Card ${i + 1} icon`, start: t + 4, dur: 14, follows: { key: `card${i}`, offset: 4 } });
    units.push({ key: `card${i}_label`, label: `Card ${i + 1} label`, start: t + 6, dur: textAnimFrames(anims.labels, words(l).length, l.length, 16), follows: { key: `card${i}`, offset: 6 } });
    if (L.subs[i].length) {
      const s = T(L.subs[i]);
      units.push({ key: `card${i}_sub`, label: `Card ${i + 1} sub-line`, start: t + 10, dur: textAnimFrames(anims.subs, words(s).length, s.length, 14), follows: { key: `card${i}`, offset: 10 } });
    }
    t += 24;
    if (i < n - 1) {
      units.push({ key: `arrow${i}`, label: `Arrow ${i + 1}`, start: t, dur: 18, cue: cue + i * 2 + 1 });
      if (L.arrows[i].length) {
        const a = T(L.arrows[i]);
        units.push({ key: `arrow${i}_label`, label: `Arrow ${i + 1} label`, start: t + 6, dur: textAnimFrames(anims.arrow_labels, words(a).length, a.length, 12), follows: { key: `arrow${i}`, offset: 6 } });
      }
      t += 20;
    }
  }
  return planTimeline(duration, units, cueTimes);
}

/* ================================================================== */
/* Props → layout → plan (shared by the renderer and the preview)       */
/* ================================================================== */

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

const DEFAULT_TAGS: Record<string, string[]> = {
  cause_effect: ['Cause', 'Effect', 'Result'],
  problem_solution: ['Problem', 'Solution', 'Result'],
  trigger_response: ['Trigger', 'Response', 'Outcome'],
  custom: [],
};

export function prepareDG05(props: Record<string, unknown>, durationInFrames: number) {
  const NS = DG05_SPEC.lists.nodes;
  const A = (k: string) => readAnim(props, DG05_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DG05_SPEC, props);
  const measure = measureFor(style);
  const kind = opt(props, 'kind', ['cause_effect', 'problem_solution', 'trigger_response', 'custom'] as const, 'cause_effect');
  const s = (o: Record<string, unknown>, k: string[]) => {
    for (const x of k) if (typeof o[x] === 'string' && (o[x] as string).trim()) return o[x] as string;
    return undefined;
  };
  const raw = (Array.isArray(props.nodes) ? props.nodes : []).slice(0, NS.maxItems);
  const nodes: RelNode[] = raw
    .map((x, i): RelNode | null => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const label = s(o, ['label', 'title', 'text']);
      if (!label) return null;
      const tag = s(o, ['tag']) ?? DEFAULT_TAGS[kind][i];
      return {
        label: normaliseText(label, NS.fields.label),
        sub: normaliseText(s(o, ['sub', 'desc', 'description']), NS.fields.sub) || undefined,
        tag: tag ? normaliseText(tag, NS.fields.tag) : undefined,
        arrow: normaliseText(s(o, ['arrow', 'relation']), NS.fields.arrow) || undefined,
        icon: s(o, ['icon', 'icon_name']),
        image: s(o, ['image_url', 'image']),
      };
    })
    .filter((x): x is RelNode => x !== null);
  const orientation = opt(props, 'orientation', ['horizontal', 'vertical'] as const, 'horizontal');
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const debug = props.show_safe_area === true;
  const L = layoutRel({ title: normaliseText(readFirst(props, ['title', 'heading']), DG05_SPEC.text.title), nodes, orientation }, measure, sized.spec);
  const plan = planRel(L, { title: A('title'), labels: A('labels'), subs: A('subs'), arrow_labels: A('arrow_labels') }, durationInFrames, readCues(props));
  return { style, sized, A, nodes, kind, imageUrl, bg, debug, L, plan };
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */

export function DG05Relationship({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, nodes, kind, imageUrl, bg, debug, L, plan } = prepareDG05(props, durationInFrames);
  const w = plan.windows;
  const F = DG05_SPEC.lists.nodes.fields;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const muted = mutedFor(style, onFootage);
  const card = cardColors(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const horiz = L.orientation === 'horizontal';
  const n = nodes.length;
  // the first card of a problem/cause reads as the "negative" side; the last as the answer
  const tagColor = (i: number) => (kind !== 'custom' && i === 0 ? style.colors.negative : i === n - 1 && kind !== 'custom' ? accent : muted);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.heading.length > 0 && w.title && (
            <AnimatedText lines={L.heading} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={DG05_SPEC.text.title.weight} lineHeight={DG05_SPEC.text.title.lineHeight} letterSpacing="-0.02em" shadow={shadow} align="center" group="title" input="title" style={{ position: 'absolute', left: 0, width: SAFE_W, top: 0 }} />
          )}
          {nodes.map((nd, i) => {
            const c = L.cards[i];
            const cw = w[`card${i}`];
            const mw = w[`card${i}_media`];
            const lw = w[`card${i}_label`];
            const sw = w[`card${i}_sub`];
            const last = i === n - 1 && kind !== 'custom';
            const tag = L.tags[i];
            const tc = tagColor(i);
            const textBlock = (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: horiz ? 'center' : 'flex-start', textAlign: horiz ? 'center' : 'left' }}>
                {tag && (
                  <span {...leaf(`card-${i}-tag`, `nodes[${i}].tag`)} style={{ fontFamily: fontFor(700), fontWeight: 700, fontSize: tag.size, lineHeight: 1.2, color: tc, padding: '8px 16px', borderRadius: 999, background: withAlpha(tc, 0.14), whiteSpace: 'nowrap', marginBottom: TAG_GAP, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {tag.text}
                  </span>
                )}
                <AnimatedText lines={L.labels[i]} anim={A('labels')} start={lw.start} dur={lw.dur} frame={frame} weight={F.label.weight} lineHeight={F.label.lineHeight} shadow={shadow} align={horiz ? 'center' : 'left'} group={`card-${i}-label`} input={`nodes[${i}].label`} />
                {L.subs[i].length > 0 && sw && (
                  <AnimatedText lines={L.subs[i]} anim={A('subs')} start={sw.start} dur={sw.dur} frame={frame} weight={F.sub.weight} lineHeight={F.sub.lineHeight} color={muted} shadow={shadow} align={horiz ? 'center' : 'left'} group={`card-${i}-sub`} input={`nodes[${i}].sub`} style={{ marginTop: SUB_GAP }} />
                )}
              </div>
            );
            const mediaEl = L.media > 0 && (nd.image || nd.icon) && (
              <div
                {...leaf(`card-${i}-media`, nd.image ? `nodes[${i}].image_url` : `nodes[${i}].icon`)}
                style={{ width: L.media, height: L.media, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', background: style.colors.icon_bg, display: 'flex', alignItems: 'center', justifyContent: 'center', ...iconStyle(A('media'), progress(frame, mw.start, mw.dur)) }}
              >
                {nd.image ? <Img src={nd.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <LucideIconView name={nd.icon!} size={Math.round(L.media * 0.5)} color={style.colors.icon} />}
              </div>
            );
            return (
              <div key={i}>
                <div
                  style={{
                    position: 'absolute',
                    left: c.x,
                    top: c.y,
                    width: L.cardW,
                    height: L.cardH,
                    boxSizing: 'border-box',
                    padding: CARD_PAD,
                    borderRadius: 28,
                    background: card.fill,
                    border: `2px solid ${last ? withAlpha(accent, 0.75) : card.border}`,
                    display: 'flex',
                    flexDirection: horiz ? 'column' : 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: horiz ? MEDIA_GAP : 28,
                    ...cardStyle(A('cards'), progress(frame, cw.start, cw.dur)),
                  }}
                >
                  {horiz ? (
                    <>
                      {mediaEl}
                      {textBlock}
                    </>
                  ) : (
                    <>
                      {mediaEl}
                      <div style={{ flex: 1 }}>{textBlock}</div>
                    </>
                  )}
                </div>
                {i < n - 1 && w[`arrow${i}`] && (() => {
                  const aw = w[`arrow${i}`];
                  const st = shapeState(A('arrows'), progress(frame, aw.start, aw.dur));
                  const alw = w[`arrow${i}_label`];
                  const len = L.arrowLen - 48;
                  const ax = horiz ? c.x + L.cardW + 24 : c.x + L.cardW / 2;
                  const ay = horiz ? c.y + L.cardH / 2 : c.y + L.cardH + 24;
                  return (
                    <>
                      <div {...leaf(`arrow-${i}`, 'arrow')} style={{ position: 'absolute', left: horiz ? ax : ax - 3, top: horiz ? ay - 3 : ay, width: horiz ? (len - 18) * st.length : 6, height: horiz ? 6 : (len - 18) * st.length, borderRadius: 3, background: accent, ...st.style }} />
                      <div
                        style={{
                          position: 'absolute',
                          left: horiz ? ax + (len - 20) * st.length : ax - 14,
                          top: horiz ? ay - 14 : ay + (len - 20) * st.length,
                          width: 0,
                          height: 0,
                          ...(horiz ? { borderTop: '14px solid transparent', borderBottom: '14px solid transparent', borderLeft: `22px solid ${accent}` } : { borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: `22px solid ${accent}` }),
                          opacity: st.length > 0.05 ? 1 : 0,
                        }}
                      />
                      {L.arrows[i].length > 0 && alw && (
                        <AnimatedText
                          lines={L.arrows[i]}
                          anim={A('arrow_labels')}
                          start={alw.start}
                          dur={alw.dur}
                          frame={frame}
                          weight={F.arrow.weight}
                          lineHeight={F.arrow.lineHeight}
                          color={style.colors.text}
                          shadow={shadow}
                          align={horiz ? 'center' : 'left'}
                          group={`arrow-${i}-label`}
                          input={`nodes[${i}].arrow`}
                          style={horiz ? { position: 'absolute', left: c.x + L.cardW + 10, width: L.arrowLen - 20, bottom: SAFE_H - (ay - 22) } : { position: 'absolute', left: ax + 36, top: ay + (L.arrowLen - 48) / 2 - L.arrows[i][0].size * 0.6 }}
                        />
                      )}
                    </>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </SafeArea>
    </div>
  );
}
