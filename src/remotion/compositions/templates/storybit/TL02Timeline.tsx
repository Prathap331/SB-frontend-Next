'use client';

/**
 * TL-02 · Timeline  (animation_type: "tl_timeline")
 * 3–8 dated events on a track that draws itself: horizontal (labels alternate above and below the
 * line so long titles fit) or vertical (a column of events). Each event: date, title, optional
 * description, optional icon or picture in its node; milestones get a bigger accent node.
 *
 * Inputs (full list, limits and JSON Schema: TL02Timeline.inputs.json):
 *   title · events[] { date, title, desc, icon, image_url, milestone } · source · image_url
 *   orientation · focus · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, event 1, event 2, …]
 * Timing: 3–8s from clock.durationInFrames; events are spaced along the beat or pinned to cues.
 */
import { Img } from './core/remotionSafe';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, words, type Line, type Measure } from './core/fit';
import { cardStyle, easeInOutCubic, exitStyle, iconStyle, progress, textAnimFrames } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { mutedFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, guide, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

/* ================================================================== */
/* Content spec                                                         */
/* ================================================================== */

export const TL02_SPEC: TemplateSpec = {
  id: 'TL-02',
  animationType: 'tl_timeline',
  name: 'Timeline',
  pickWhen: 'Several dated events in order: a history, a biography, a company\'s journey, how something unfolded.',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 210, max: 240, perItemFrames: 40 },
  text: {
    title: { label: 'Heading', required: false, minChars: 3, maxChars: 50, minWords: 1, maxWords: 10, maxWordChars: 18, maxLines: 1, fontMax: 60, fontMin: 40, weight: 800, lineHeight: 1.04, hint: '"The UPI story".', fills: 'Heading above the timeline', example: 'How UPI grew (illustrative)' },
    source: { label: 'Source', required: false, minChars: 3, maxChars: 60, minWords: 1, maxWords: 10, maxWordChars: 18, maxLines: 1, fontMax: 24, fontMin: 18, weight: 500, lineHeight: 1.25, fills: 'Source line under the timeline' },
  },
  lists: {
    events: {
      label: 'Event',
      fills: 'Events in time order',
      minItems: 3,
      maxItems: 8,
      icon: { required: false, fallback: 'dot' },
      image: { required: false, fills: 'Picture inside the event node (circle)' },
      fields: {
        date: { label: 'Date', required: true, minChars: 1, maxChars: 20, minWords: 1, maxWords: 4, maxWordChars: 12, maxLines: 1, fontMax: 34, fontMin: 20, weight: 800, lineHeight: 1.15, hint: '"2016", "Aug 2016", "15 Aug 1947".', fills: 'Date above the title' },
        title: { label: 'Title', required: true, minChars: 2, maxChars: 35, minWords: 1, maxWords: 6, maxWordChars: 14, maxLines: 2, fontMax: 34, fontMin: 20, weight: 600, lineHeight: 1.2, hint: 'What happened, in a few words.', fills: 'Event title' },
        desc: { label: 'Description', required: false, minChars: 5, maxChars: 70, minWords: 2, maxWords: 12, maxWordChars: 14, maxLines: 3, fontMax: 24, fontMin: 16, weight: 500, lineHeight: 1.3, hint: 'One short line of detail.', fills: 'Detail under the title' },
      },
      numbers: { milestone: { label: 'Milestone', required: false, fills: '1 = bigger filled accent node and accent-coloured title', min: 0, max: 1, integer: true } },
    },
  },
  options: {
    orientation: { label: 'Orientation', values: ['horizontal', 'vertical'], default: 'horizontal', fills: 'Track across the screen (labels alternate above / below), or down the left side' },
    focus: { label: 'Focus newest event', values: ['off', 'on'], default: 'off', fills: 'Dim earlier events while a new one appears; everything brightens for the hold' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    track: { label: 'Track', kind: 'shape', target: 'the timeline line (draws along)', default: 'grow' },
    nodes: { label: 'Nodes', kind: 'icon', target: 'node of each event', default: 'pop' },
    dates: { label: 'Dates', kind: 'text', target: 'date of each event', default: 'fade_up' },
    titles: { label: 'Titles', kind: 'text', target: 'title of each event', default: 'fade_up' },
    descs: { label: 'Descriptions', kind: 'text', target: 'description of each event', default: 'fade' },
    source: { label: 'Source', kind: 'text', target: 'source line', default: 'fade' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: {
    description: 'First cue = heading (if present), then one cue per event (when the narrator reaches that date), then source.',
    units: ['heading', 'event 1', 'event 2', 'event 3', 'event 4', 'event 5', 'event 6', 'event 7', 'event 8', 'source'],
  },
  colors: ['icon', 'icon_bg', 'on_accent'],
  example: {
    title: 'How UPI grew (illustrative)',
    events: [
      { date: '2016', title: 'UPI launches', desc: 'Announced by NPCI with 21 banks', icon: 'rocket', milestone: 1 },
      { date: '2017', title: 'BHIM app arrives', icon: 'smartphone' },
      { date: '2020', title: 'Lockdown boosts QR payments', icon: 'users' },
      { date: '2023', title: 'UPI goes international', icon: 'globe' },
    ],
    orientation: 'horizontal',
    background: 'theme',
  },
};

/* ================================================================== */
/* Layout                                                               */
/* ================================================================== */

export type TEvent = { date: string; title: string; desc?: string; icon?: string; image?: string; milestone: boolean };
export const HEADING_GAP = 40;
export const SOURCE_GAP = 22;
export const NODE_GAP = 22;
export const LINE_GAP = 6;

export type EventBox = { date: Line[]; title: Line[]; desc: Line[]; h: number; x: number; y: number; w: number; above: boolean };

export type TimelineLayout = {
  orientation: 'horizontal' | 'vertical';
  heading: Line[];
  source: Line[];
  area: { top: number; height: number };
  node: number;
  milestoneNode: number;
  trackY: number; // horizontal: y of the line; vertical: x of the line
  nodePos: { x: number; y: number }[];
  boxes: EventBox[];
  blockH: number;
};

export function layoutTimeline(
  input: { title: string; source: string; events: TEvent[]; orientation: 'horizontal' | 'vertical' },
  measure: Measure,
  spec: TemplateSpec = TL02_SPEC,
): TimelineLayout {
  const T = spec.text;
  const F = spec.lists.events.fields;
  const n = Math.max(1, input.events.length);
  const heading = input.title ? fitText(input.title, T.title, SAFE_W, measure, false).lines : [];
  const headingH = heading.length ? blockHeight(heading, T.title.lineHeight) + HEADING_GAP : 0;
  const source = input.source ? fitText(input.source, T.source, SAFE_W, measure, false).lines : [];
  const sourceH = source.length ? SOURCE_GAP + blockHeight(source, T.source.lineHeight) : 0;
  const area = { top: headingH, height: SAFE_H - headingH - sourceH };
  const dates = input.events.map((e) => e.date);
  const titles = input.events.map((e) => e.title);
  const descs = input.events.map((e) => e.desc ?? '');
  const hasDesc = descs.some(Boolean);

  const boxH = (d: Line[], t: Line[], ds: Line[]) =>
    blockHeight(d, F.date.lineHeight) + LINE_GAP + blockHeight(t, F.title.lineHeight) + (ds.length ? LINE_GAP + blockHeight(ds, F.desc.lineHeight) : 0);

  if (input.orientation === 'horizontal') {
    const spacing = SAFE_W / n;
    const node = Math.max(40, Math.min(76, Math.round(spacing * 0.28)));
    const milestoneNode = Math.round(node * 1.3);
    // alternate above/below: each label may use two slots of width
    const boxW = Math.min(1.6 * spacing - 12, 520);
    const half = (area.height - milestoneNode) / 2 - NODE_GAP;
    let tCap = F.title.fontMax;
    let dCap = F.desc.fontMax;
    let dateCap = F.date.fontMax;
    const build = () => {
      const df = sharedFont(dates, F.date, boxW, measure, dateCap);
      const tf = sharedFont(titles, F.title, boxW, measure, tCap);
      const sf = hasDesc ? sharedFont(descs, F.desc, boxW, measure, Math.min(dCap, Math.round(tf * 0.8))) : 0;
      const parts = input.events.map((e) => ({
        d: linesAt(e.date, df, F.date, boxW, measure, false),
        t: linesAt(e.title, tf, F.title, boxW, measure),
        ds: e.desc ? linesAt(e.desc, sf, F.desc, boxW, measure, false) : [],
      }));
      const maxH = Math.max(...parts.map((p) => boxH(p.d, p.t, p.ds)));
      return { parts, maxH };
    };
    let b = build();
    while (b.maxH > half && (dCap > F.desc.fontMin || tCap > F.title.fontMin || dateCap > F.date.fontMin)) {
      if (dCap > F.desc.fontMin) dCap -= 2;
      else if (tCap > F.title.fontMin) tCap -= 2;
      else dateCap -= 2;
      b = build();
    }
    const trackY = area.top + area.height / 2;
    const nodePos = input.events.map((_, i) => ({ x: spacing * i + spacing / 2, y: trackY }));
    const boxes = b.parts.map((p, i) => {
      const above = i % 2 === 0;
      const h = boxH(p.d, p.t, p.ds);
      const nodeR = (input.events[i].milestone ? milestoneNode : node) / 2;
      const x = Math.max(0, Math.min(SAFE_W - boxW, nodePos[i].x - boxW / 2));
      const y = above ? trackY - nodeR - NODE_GAP - h : trackY + nodeR + NODE_GAP;
      return { date: p.d, title: p.t, desc: p.ds, h, x, y, w: boxW, above };
    });
    return { orientation: 'horizontal', heading, source, area, node, milestoneNode, trackY, nodePos, boxes, blockH: SAFE_H };
  }

  // vertical
  const rowH = area.height / n;
  const node = Math.max(36, Math.min(72, Math.round(rowH * 0.5)));
  const milestoneNode = Math.min(Math.round(node * 1.25), Math.round(rowH * 0.9));
  const trackX = milestoneNode / 2;
  const textX = milestoneNode + 36;
  const textW = Math.min(1300, SAFE_W - textX);
  const dateW = Math.min(300, textW * 0.26);
  const bodyW = textW - dateW - 28;
  const d1 = { ...F.date, maxLines: 1 };
  const t1 = { ...F.title, maxLines: 1 };
  const s1 = { ...F.desc, maxLines: 1 };
  const df = sharedFont(dates, d1, dateW, measure, Math.min(F.date.fontMax, Math.round(rowH * 0.36)));
  const tf = sharedFont(titles, t1, bodyW, measure, Math.min(F.title.fontMax, Math.round(rowH * (hasDesc ? 0.32 : 0.4))));
  const sf = hasDesc ? sharedFont(descs, s1, bodyW, measure, Math.min(F.desc.fontMax, Math.round(rowH * 0.22), Math.round(tf * 0.8))) : 0;
  const nodePos = input.events.map((_, i) => ({ x: trackX, y: area.top + rowH * i + rowH / 2 }));
  const boxes = input.events.map((e, i) => {
    const date = linesAt(e.date, df, d1, dateW, measure, false);
    const title = linesAt(e.title, tf, t1, bodyW, measure, false);
    const desc = e.desc ? linesAt(e.desc, sf, s1, bodyW, measure, false) : [];
    const h = Math.max(blockHeight(date, F.date.lineHeight), blockHeight(title, F.title.lineHeight) + (desc.length ? blockHeight(desc, F.desc.lineHeight) : 0));
    return { date, title, desc, h, x: textX, y: nodePos[i].y - h / 2, w: textW, above: false };
  });
  return { orientation: 'vertical', heading, source, area, node, milestoneNode, trackY: trackX, nodePos, boxes, blockH: SAFE_H };
}

/* ================================================================== */
/* Timing                                                               */
/* ================================================================== */

export function planTimelineTL(L: TimelineLayout, anims: { title: string; dates: string; titles: string; descs: string; source: string }, duration: number, cueTimes?: number[]): Plan {
  const T = (lines: Line[]) => lines.map((l) => l.text).join(' ');
  const units: Unit[] = [];
  let cue = 0;
  if (L.heading.length) {
    const h = T(L.heading);
    units.push({ key: 'title', label: 'Heading', start: 2, dur: textAnimFrames(anims.title, words(h).length, h.length, 18), cue: cue++ });
  }
  const n = L.boxes.length;
  const first = L.heading.length ? 18 : 6;
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const gap = n > 1 ? Math.max(8, Math.min(45, Math.floor((budget - first - 30) / (n - 1)))) : 0;
  L.boxes.forEach((_, i) => units.push({ key: `ev${i}`, label: `Event ${i + 1}`, start: first + i * gap, dur: 14, cue: cue + i }));
  cue += 8;
  if (L.source.length) {
    const s = T(L.source);
    units.push({ key: 'source', label: 'Source', start: first + (n - 1) * gap + 30, dur: textAnimFrames(anims.source, words(s).length, s.length, 14), cue });
  }
  L.boxes.forEach((b, i) => {
    const s0 = first + i * gap;
    const d = T(b.date);
    const t = T(b.title);
    units.push({ key: `ev${i}_date`, label: `Event ${i + 1} date`, start: s0 + 3, dur: textAnimFrames(anims.dates, words(d).length, d.length, 14), follows: { key: `ev${i}`, offset: 3 } });
    units.push({ key: `ev${i}_title`, label: `Event ${i + 1} title`, start: s0 + 6, dur: textAnimFrames(anims.titles, words(t).length, t.length, 16), follows: { key: `ev${i}`, offset: 6 } });
    if (b.desc.length) {
      const ds = T(b.desc);
      units.push({ key: `ev${i}_desc`, label: `Event ${i + 1} description`, start: s0 + 10, dur: textAnimFrames(anims.descs, words(ds).length, ds.length, 14), follows: { key: `ev${i}`, offset: 10 } });
    }
  });
  return planTimeline(duration, units, cueTimes);
}

export function suggestedDurationTL02(n: number, hasHeading: boolean): number {
  return Math.max(90, Math.min(240, (hasHeading ? 18 : 6) + n * 40 + 40));
}

/* ================================================================== */
/* Props → layout → plan (shared by the renderer and the preview)       */
/* ================================================================== */

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareTL02(props: Record<string, unknown>, durationInFrames: number) {
  const S = TL02_SPEC.text;
  const ES = TL02_SPEC.lists.events;
  const A = (k: string) => readAnim(props, TL02_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(TL02_SPEC, props);
  const measure = measureFor(style);
  const s = (o: Record<string, unknown>, k: string[]) => {
    for (const x of k) {
      if (typeof o[x] === 'string' && (o[x] as string).trim()) return o[x] as string;
      if (typeof o[x] === 'number') return String(o[x]);
    }
    return undefined;
  };
  const events: TEvent[] = (Array.isArray(props.events) ? props.events : [])
    .map((e): TEvent | null => {
      const o = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
      const date = s(o, ['date', 'year', 'when']);
      const title = s(o, ['title', 'event', 'label']);
      return date && title
        ? { date: normaliseText(date, ES.fields.date), title: normaliseText(title, ES.fields.title), desc: normaliseText(s(o, ['desc', 'description']), ES.fields.desc) || undefined, icon: s(o, ['icon', 'icon_name']), image: s(o, ['image_url', 'image']), milestone: o.milestone === 1 || o.milestone === true }
        : null;
    })
    .filter((x): x is TEvent => x !== null && Boolean(x.date && x.title))
    .slice(0, ES.maxItems);
  const orientation = opt(props, 'orientation', ['horizontal', 'vertical'] as const, 'horizontal');
  const focus = opt(props, 'focus', ['off', 'on'] as const, 'off') === 'on';
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const debug = props.show_safe_area === true;
  const L = layoutTimeline({ title: normaliseText(readFirst(props, ['title', 'heading']), S.title), source: normaliseText(readFirst(props, ['source']), S.source), events, orientation }, measure, sized.spec);
  const plan = planTimelineTL(L, { title: A('title'), dates: A('dates'), titles: A('titles'), descs: A('descs'), source: A('source') }, durationInFrames, readCues(props));
  return { style, sized, A, events, focus, imageUrl, bg, debug, L, plan };
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */

function TL02TimelineBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, events, focus, imageUrl, bg, debug, L, plan } = prepareTL02(props, durationInFrames);
  const w = plan.windows;
  const S = TL02_SPEC.text;
  const F = TL02_SPEC.lists.events.fields;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const muted = mutedFor(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const horiz = L.orientation === 'horizontal';
  const n = events.length;

  let newest = -1;
  events.forEach((_, i) => {
    if (w[`ev${i}`] && frame >= w[`ev${i}`].start) newest = i;
  });
  const lastEnd = Math.max(0, ...plan.list.filter((x) => x.key.startsWith('ev')).map((x) => x.start + x.dur));
  const restore = progress(frame, lastEnd + 4, 8);
  const dim = (i: number) => (focus && i < newest ? 0.55 + 0.45 * restore : 1);

  // track: grows from the first node to the node of the newest event (or fades, per preset)
  const tAnim = A('track');
  const reach = (() => {
    if (tAnim !== 'grow') return 1;
    let r = 0;
    events.forEach((_, i) => {
      const ew = w[`ev${i}`];
      const p = easeInOutCubic(progress(frame, ew.start - 10, 14));
      if (p > 0) r = Math.max(r, (i - 1 + p) / Math.max(1, n - 1));
    });
    return Math.max(0, Math.min(1, r));
  })();
  const trackOpacity = tAnim === 'fade' ? progress(frame, w.ev0?.start ?? 0, 14) : tAnim === 'none' ? 1 : 1;
  const first = L.nodePos[0];
  const last = L.nodePos[n - 1];

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.heading.length > 0 && w.title && (
            <AnimatedText lines={L.heading} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={S.title.weight} lineHeight={S.title.lineHeight} letterSpacing="-0.02em" shadow={shadow} group="title" input="title" />
          )}

          {first && last && (
            <>
              <div
                {...guide('track-bg', 'track')}
                style={horiz ? { position: 'absolute', left: first.x, top: L.trackY - 3, width: last.x - first.x, height: 6, borderRadius: 3, background: withAlpha(style.colors.text, 0.15) } : { position: 'absolute', left: L.trackY - 3, top: first.y, width: 6, height: last.y - first.y, borderRadius: 3, background: withAlpha(style.colors.text, 0.15) }}
              />
              <div
                {...guide('track', 'track')}
                style={
                  horiz
                    ? { position: 'absolute', left: first.x, top: L.trackY - 3, width: (last.x - first.x) * reach, height: 6, borderRadius: 3, background: accent, opacity: trackOpacity }
                    : { position: 'absolute', left: L.trackY - 3, top: first.y, width: 6, height: (last.y - first.y) * reach, borderRadius: 3, background: accent, opacity: trackOpacity }
                }
              />
            </>
          )}

          {events.map((e, i) => {
            const ew = w[`ev${i}`];
            const size = e.milestone ? L.milestoneNode : L.node;
            const p = L.nodePos[i];
            const b = L.boxes[i];
            const dw = w[`ev${i}_date`];
            const tw = w[`ev${i}_title`];
            const sw = w[`ev${i}_desc`];
            const align = horiz ? 'center' : 'left';
            return (
              <div key={i} style={{ opacity: dim(i) }}>
                <div
                  {...leaf(`node-${i}`, e.image ? `events[${i}].image_url` : e.icon ? `events[${i}].icon` : 'event node')}
                  style={{
                    position: 'absolute',
                    left: p.x - size / 2,
                    top: p.y - size / 2,
                    width: size,
                    height: size,
                    boxSizing: 'border-box',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: e.milestone ? accent : style.colors.background,
                    border: `${Math.max(3, Math.round(size * 0.07))}px solid ${accent}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...iconStyle(A('nodes'), progress(frame, ew.start, ew.dur)),
                  }}
                >
                  {e.image ? (
                    <Img src={e.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : e.icon ? (
                    <LucideIconView name={e.icon} size={Math.round(size * 0.5)} color={e.milestone ? style.colors.on_accent : style.colors.icon} />
                  ) : (
                    <div style={{ width: size * 0.3, height: size * 0.3, borderRadius: '50%', background: e.milestone ? style.colors.on_accent : accent }} />
                  )}
                </div>
                {horiz && (
                  <div style={{ position: 'absolute', left: p.x - 1.5, top: b.above ? b.y + b.h + 4 : p.y + size / 2, width: 3, height: b.above ? p.y - size / 2 - (b.y + b.h + 4) : b.y - 4 - (p.y + size / 2), background: withAlpha(accent, 0.4), ...cardStyle('fade', progress(frame, ew.start, ew.dur)) }} />
                )}
                <div
                  style={{
                    position: 'absolute',
                    left: b.x,
                    top: b.y,
                    width: b.w,
                    display: 'flex',
                    flexDirection: horiz ? 'column' : 'row',
                    alignItems: horiz ? 'center' : 'flex-start',
                    gap: horiz ? LINE_GAP : 28,
                    textAlign: align,
                  }}
                >
                  <AnimatedText lines={b.date} anim={A('dates')} start={dw.start} dur={dw.dur} frame={frame} weight={F.date.weight} lineHeight={F.date.lineHeight} color={accent} shadow={shadow} align={align} group={`ev-${i}-date`} input={`events[${i}].date`} style={horiz ? undefined : { width: Math.min(300, b.w * 0.26), flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: horiz ? 'center' : 'flex-start', gap: LINE_GAP }}>
                    <AnimatedText lines={b.title} anim={A('titles')} start={tw.start} dur={tw.dur} frame={frame} weight={F.title.weight} lineHeight={F.title.lineHeight} color={e.milestone ? accent : undefined} shadow={shadow} align={align} group={`ev-${i}-title`} input={`events[${i}].title`} />
                    {b.desc.length > 0 && sw && (
                      <AnimatedText lines={b.desc} anim={A('descs')} start={sw.start} dur={sw.dur} frame={frame} weight={F.desc.weight} lineHeight={F.desc.lineHeight} color={muted} shadow={shadow} align={align} group={`ev-${i}-desc`} input={`events[${i}].desc`} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {L.source.length > 0 && w.source && (
            <AnimatedText lines={L.source} anim={A('source')} start={w.source.start} dur={w.source.dur} frame={frame} weight={S.source.weight} lineHeight={S.source.lineHeight} color={withAlpha(style.colors.muted, 0.85)} shadow={shadow} group="source" input="source" style={{ position: 'absolute', left: 0, bottom: 0 }} />
          )}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const TL02Timeline = withAutoFit(TL02TimelineBase);
