'use client';

/**
 * FS-14 · Structured List  (animation_type: "fs_structured_list")
 * A heading and 2–6 items revealed one after another — bullets, numbers, icons, ticks or image
 * thumbnails in a list, or as cards (with an image, icon or number on top).
 *
 * Inputs (full list, limits and JSON Schema: FS14StructuredList.inputs.json):
 *   title · items[] { text (required), sub, icon, image_url } · image_url
 *   layout · marker · align · focus · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, item 1, item 2, …]
 * Timing: 3–8s from clock.durationInFrames; items are spaced up to 2s apart, or pinned to cues.
 */
import type { CSSProperties } from 'react';
import { Img } from 'remotion';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, iconStyle, progress, textAnimFrames } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { cardColors, fontFor, mutedFor, readStyle, styleVars } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';

/* ================================================================== */
/* Content spec                                                         */
/* ================================================================== */

export const FS14_SPEC: TemplateSpec = {
  id: 'FS-14',
  animationType: 'fs_structured_list',
  name: 'Structured List',
  pickWhen: '"3 reasons why", "the causes are", features, examples, steps without order, or a recap of key points.',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 210, max: 240, perItemFrames: 50 },
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
      fontMax: 72,
      fontMin: 44,
      weight: 800,
      lineHeight: 1.04,
      hint: 'What the list is: "3 reasons UPI won".',
      fills: 'Heading above the list',
      example: '3 reasons UPI took off',
    },
  },
  lists: {
    items: {
      label: 'Item',
      fills: 'List items, revealed in order',
      minItems: 2,
      maxItems: 6,
      icon: { required: false, fallback: 'number' },
      image: { required: false, fills: 'Item picture (thumbnail in list layout, card top in cards layout)' },
      fields: {
        text: {
          label: 'Text',
          required: true,
          minChars: 2,
          maxChars: 50,
          minWords: 1,
          maxWords: 9,
          maxWordChars: 16,
          maxLines: 2,
          fontMax: 48,
          fontMin: 26,
          weight: 600,
          lineHeight: 1.25,
          hint: 'One point per item, parallel wording across items.',
          fills: 'Item text',
        },
        sub: {
          label: 'Sub-text',
          required: false,
          minChars: 5,
          maxChars: 60,
          minWords: 1,
          maxWords: 10,
          maxWordChars: 16,
          maxLines: 2,
          fontMax: 30,
          fontMin: 20,
          weight: 500,
          lineHeight: 1.35,
          hint: 'Optional detail under the item.',
          fills: 'Smaller line under the item text',
        },
      },
    },
  },
  options: {
    layout: { label: 'Layout', values: ['list', 'cards'], default: 'list', fills: 'Rows with a marker on the left, or a grid of cards' },
    marker: {
      label: 'Marker',
      values: ['auto', 'bullet', 'number', 'icon', 'check', 'image'],
      default: 'auto',
      fills: 'What marks each item (auto = image if every item has one, else icon if every item has one, else number)',
    },
    align: { label: 'Align', values: ['left', 'center'], default: 'left', fills: 'List block on the left, or centred on screen (rows stay left-aligned)' },
    focus: { label: 'Focus newest item', values: ['off', 'on'], default: 'off', fills: 'Dim earlier items while a new one appears; the full list brightens again for the hold' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    items: { label: 'Items / cards', kind: 'card', target: 'each row or card', default: 'slide_up' },
    markers: { label: 'Markers', kind: 'icon', target: 'bullet, number, icon, tick or thumbnail of each item', default: 'pop' },
    item_text: { label: 'Item text', kind: 'text', target: 'text of each item', default: 'fade_up' },
    item_sub: { label: 'Sub-text', kind: 'text', target: 'sub-text of each item', default: 'fade' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: {
    description: 'First cue = heading (if present), then one cue per item (when the narrator starts that point).',
    units: ['heading', 'item 1', 'item 2', 'item 3', 'item 4', 'item 5', 'item 6'],
  },
  colors: ['icon', 'icon_bg', 'card', 'card_border', 'on_accent'],
  sizes: { markers: { label: 'Markers', min: 44, max: 96, fills: 'Marker size in the list layout (thumbnails are 1.5× wider)' } },
  example: {
    title: '3 reasons UPI took off',
    items: [
      { icon: 'zap', text: 'Payments land in seconds', sub: 'Bank to bank, any time of day' },
      { icon: 'wallet', text: 'Free for everyday users', sub: 'No fee on regular person-to-person transfers' },
      { icon: 'smartphone', text: 'Works in any UPI app', sub: 'One ID across banks and apps' },
    ],
    layout: 'list',
    marker: 'auto',
    background: 'theme',
    cue_times: [0.1, 0.9, 2.4, 3.9],
  },
};

/* ================================================================== */
/* Layout                                                               */
/* ================================================================== */

export type Marker = 'bullet' | 'number' | 'icon' | 'check' | 'image';
export type ListItem = { text: string; sub?: string; icon?: string; image?: string };

export const HEADING_GAP = 44;
export const LIST_CENTER_W = 1400;
export const MARKER_GAP = 36;
export const CARD_GAP = 32;
export const CARD_PAD = 28;
export const SUB_GAP = 8;

export type ItemBox = { text: Line[]; sub: Line[]; h: number };

export type StructuredLayout = {
  layout: 'list' | 'cards';
  marker: Marker;
  heading: Line[];
  headingH: number;
  width: number;
  // list
  markerSize: number;
  mediaW: number;
  textW: number;
  rowGap: number;
  // cards
  cols: number;
  rows: number;
  cardW: number;
  cardH: number;
  mediaH: number;
  badge: number;
  hasImages: boolean;
  items: ItemBox[];
  blockH: number;
};

export function layoutStructured(
  input: { title: string; items: ListItem[]; layout: 'list' | 'cards'; marker: Marker; align: 'left' | 'center' },
  measure: Measure,
  spec: TemplateSpec = FS14_SPEC,
  markerMax = 96,
): StructuredLayout {
  const F = spec.lists.items.fields;
  const n = Math.max(1, input.items.length);
  const blockW = input.layout === 'list' && input.align === 'center' ? LIST_CENTER_W : SAFE_W;
  const heading = input.title ? fitText(input.title, spec.text.title, blockW, measure, false).lines : [];
  const headingH = heading.length ? blockHeight(heading, spec.text.title.lineHeight) + HEADING_GAP : 0;
  const texts = input.items.map((i) => i.text);
  const subs = input.items.map((i) => i.sub ?? '');
  const hasSub = subs.some(Boolean);

  if (input.layout === 'list') {
    const width = blockW;
    let markerSize = Math.min(markerMax, ({ 1: 88, 2: 88, 3: 88, 4: 80, 5: 72, 6: 64 } as Record<number, number>)[n] ?? 64);
    const rowGap = n <= 4 ? 36 : 24;
    let tCap = F.text.fontMax;
    let sCap = F.sub.fontMax;
    const build = () => {
      const mediaW = input.marker === 'image' ? Math.round(markerSize * 1.5) : markerSize;
      const textW = width - mediaW - MARKER_GAP;
      const tf = sharedFont(texts, F.text, textW, measure, tCap);
      const sf = hasSub ? sharedFont(subs, F.sub, textW, measure, Math.min(sCap, Math.round(tf * 0.75))) : 0;
      const items = input.items.map((it) => {
        const text = linesAt(it.text, tf, F.text, textW, measure);
        const sub = it.sub ? linesAt(it.sub, sf, F.sub, textW, measure) : [];
        const th = blockHeight(text, F.text.lineHeight) + (sub.length ? SUB_GAP + blockHeight(sub, F.sub.lineHeight) : 0);
        return { text, sub, h: Math.max(markerSize, th) };
      });
      const blockH = headingH + items.reduce((a, b) => a + b.h, 0) + rowGap * (n - 1);
      return { mediaW, textW, items, blockH };
    };
    let b = build();
    // shrink order: sub-text → text → marker, until the list fits the 880px safe height
    while (b.blockH > SAFE_H && (sCap > F.sub.fontMin || tCap > F.text.fontMin || markerSize > 44)) {
      if (sCap > F.sub.fontMin) sCap -= 2;
      else if (tCap > F.text.fontMin) tCap -= 2;
      else markerSize -= 4;
      b = build();
    }
    return {
      layout: 'list',
      marker: input.marker,
      heading,
      headingH,
      width,
      markerSize,
      mediaW: b.mediaW,
      textW: b.textW,
      rowGap,
      cols: 1,
      rows: n,
      cardW: 0,
      cardH: 0,
      mediaH: 0,
      badge: 0,
      hasImages: input.marker === 'image',
      items: b.items,
      blockH: b.blockH,
    };
  }

  // cards
  const cols = n <= 4 ? n : 3;
  const rows = Math.ceil(n / cols);
  const cardW = (SAFE_W - (cols - 1) * CARD_GAP) / cols;
  const innerW = cardW - CARD_PAD * 2;
  const hasImages = input.items.some((i) => i.image);
  let mediaH = hasImages ? Math.round(cardW * 0.56) : 0;
  let badge = hasImages ? 0 : Math.min(markerMax, 88);
  let tCap = F.text.fontMax;
  let sCap = F.sub.fontMax;
  const build = () => {
    const tf = sharedFont(texts, F.text, innerW, measure, tCap);
    const sf = hasSub ? sharedFont(subs, F.sub, innerW, measure, Math.min(sCap, Math.round(tf * 0.75))) : 0;
    const items = input.items.map((it) => {
      const text = linesAt(it.text, tf, F.text, innerW, measure);
      const sub = it.sub ? linesAt(it.sub, sf, F.sub, innerW, measure) : [];
      return { text, sub, h: blockHeight(text, F.text.lineHeight) + (sub.length ? SUB_GAP + blockHeight(sub, F.sub.lineHeight) : 0) };
    });
    const textH = Math.max(...items.map((i) => i.h));
    const top = hasImages ? mediaH + CARD_PAD : CARD_PAD + badge + 20;
    const cardH = Math.round(top + textH + CARD_PAD);
    return { items, cardH, blockH: headingH + rows * cardH + (rows - 1) * CARD_GAP };
  };
  let b = build();
  // shrink order: sub-text → picture height → text → badge
  while (b.blockH > SAFE_H && (sCap > F.sub.fontMin || mediaH > 100 || tCap > F.text.fontMin || badge > 48)) {
    if (sCap > F.sub.fontMin) sCap -= 2;
    else if (hasImages && mediaH > 100) mediaH -= 12;
    else if (tCap > F.text.fontMin) tCap -= 2;
    else badge -= 8;
    b = build();
  }
  return {
    layout: 'cards',
    marker: input.marker,
    heading,
    headingH,
    width: SAFE_W,
    markerSize: 0,
    mediaW: 0,
    textW: innerW,
    rowGap: CARD_GAP,
    cols,
    rows,
    cardW,
    cardH: b.cardH,
    mediaH,
    badge,
    hasImages,
    items: b.items,
    blockH: b.blockH,
  };
}

/* ================================================================== */
/* Timing                                                               */
/* ================================================================== */

export function planStructured(
  L: StructuredLayout,
  anims: { title: string; item_text: string; item_sub: string },
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
  const n = L.items.length;
  const first = L.heading.length ? 18 : 6;
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const gap = n > 1 ? Math.max(8, Math.min(60, Math.floor((budget - first - 30) / (n - 1)))) : 0;
  L.items.forEach((_, i) => units.push({ key: `item${i}`, label: `Item ${i + 1}`, start: first + i * gap, dur: 14, cue: cue++ }));
  L.items.forEach((it, i) => {
    const s0 = first + i * gap;
    const t = T(it.text);
    units.push({ key: `item${i}_marker`, label: `Item ${i + 1} marker`, start: s0 + 2, dur: 14, follows: { key: `item${i}`, offset: 2 } });
    units.push({ key: `item${i}_text`, label: `Item ${i + 1} text`, start: s0 + 4, dur: textAnimFrames(anims.item_text, words(t).length, t.length, 16), follows: { key: `item${i}`, offset: 4 } });
    if (it.sub.length) {
      const sb = T(it.sub);
      units.push({ key: `item${i}_sub`, label: `Item ${i + 1} sub-text`, start: s0 + 8, dur: textAnimFrames(anims.item_sub, words(sb).length, sb.length, 16), follows: { key: `item${i}`, offset: 8 } });
    }
  });
  return planTimeline(duration, units, cueTimes);
}

/** Suggested duration: ~1.7s per item plus intro and hold, within 3–8s. */
export function suggestedDurationFS14(n: number, hasHeading: boolean): number {
  return Math.max(90, Math.min(240, (hasHeading ? 18 : 6) + n * 50 + 40));
}

/* ================================================================== */
/* Props → layout → plan (shared by the renderer and the preview)       */
/* ================================================================== */

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

function readItems(props: Record<string, unknown>): ListItem[] {
  const spec = FS14_SPEC.lists.items;
  const raw = props.items ?? props.points ?? props.bullets;
  if (!Array.isArray(raw)) return [];
  const str = (o: Record<string, unknown>, keys: string[]) => {
    for (const k of keys) if (typeof o[k] === 'string' && (o[k] as string).trim()) return o[k] as string;
    return undefined;
  };
  return raw
    .map((it): ListItem | null => {
      if (typeof it === 'string') return { text: it };
      if (!it || typeof it !== 'object') return null;
      const o = it as Record<string, unknown>;
      const text = str(o, ['text', 'title', 'label']);
      return text ? { text, sub: str(o, ['sub', 'desc', 'description']), icon: str(o, ['icon', 'icon_name']), image: str(o, ['image_url', 'image']) } : null;
    })
    .filter((x): x is ListItem => x !== null)
    .slice(0, spec.maxItems)
    .map((it) => ({ ...it, text: normaliseText(it.text, spec.fields.text), sub: normaliseText(it.sub, spec.fields.sub) || undefined }))
    .filter((it) => it.text);
}

export function prepareFS14(props: Record<string, unknown>, durationInFrames: number) {
  const A = (k: string) => readAnim(props, FS14_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(FS14_SPEC, props);
  const measure = measureFor(style);
  const title = normaliseText(readFirst(props, ['title', 'heading']), FS14_SPEC.text.title);
  const items = readItems(props);
  const layout = opt(props, 'layout', ['list', 'cards'] as const, 'list');
  let marker = opt(props, 'marker', ['auto', 'bullet', 'number', 'icon', 'check', 'image'] as const, 'auto') as Marker | 'auto';
  if (marker === 'auto')
    marker = items.length && items.every((i) => i.image) ? 'image' : items.length && items.every((i) => i.icon) ? 'icon' : 'number';
  const align = opt(props, 'align', ['left', 'center'] as const, 'left');
  const focus = opt(props, 'focus', ['off', 'on'] as const, 'off') === 'on';
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const debug = props.show_safe_area === true;
  const L = layoutStructured({ title, items, layout, marker, align }, measure, sized.spec, sized.extra.markers);
  const plan = planStructured(L, { title: A('title'), item_text: A('item_text'), item_sub: A('item_sub') }, durationInFrames, readCues(props));
  return { style, sized, A, items, align, focus, imageUrl, bg, debug, L, plan };
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */

export function FS14StructuredList({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, items, align, focus, imageUrl, bg, debug, L, plan } = prepareFS14(props, durationInFrames);
  const w = plan.windows;
  const F = FS14_SPEC.lists.items.fields;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const muted = mutedFor(style, onFootage);
  const card = cardColors(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));

  let newest = -1;
  items.forEach((_, i) => {
    if (w[`item${i}`] && frame >= w[`item${i}`].start) newest = i;
  });
  // focus: earlier items dim while new ones arrive, then the whole list brightens for the hold
  const lastEnd = Math.max(0, ...plan.list.filter((x) => x.key.startsWith('item')).map((x) => x.start + x.dur));
  const restore = progress(frame, lastEnd + 4, 8);
  const dimmed = (i: number) => (focus && i < newest ? 0.55 + 0.45 * restore : 1);

  /** Marker / badge for item i at a given size. */
  const marker = (i: number, size: number, kind: Marker) => {
    const it = items[i];
    const mw = w[`item${i}_marker`];
    const anim = iconStyle(A('markers'), progress(frame, mw.start, mw.dur));
    const k: Marker = kind === 'image' && !it.image ? (it.icon ? 'icon' : 'number') : kind === 'icon' && !it.icon ? 'number' : kind;
    if (k === 'image') {
      return (
        <div {...leaf(`item-${i}-marker`, `items[${i}].image_url`)} style={{ width: Math.round(size * 1.5), height: size, borderRadius: 16, overflow: 'hidden', flexShrink: 0, ...anim }}>
          <Img src={it.image!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      );
    }
    const box: CSSProperties = { width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
    if (k === 'bullet') {
      return (
        <div style={box}>
          <div {...leaf(`item-${i}-marker`, 'bullet')} style={{ width: size * 0.3, height: size * 0.3, borderRadius: '50%', background: accent, ...anim }} />
        </div>
      );
    }
    if (k === 'icon') {
      return (
        <div {...leaf(`item-${i}-marker`, `items[${i}].icon`)} style={{ ...box, borderRadius: '50%', background: style.colors.icon_bg, ...anim }}>
          <LucideIconView name={it.icon!} size={Math.round(size * 0.5)} color={style.colors.icon} />
        </div>
      );
    }
    if (k === 'check') {
      return (
        <div {...leaf(`item-${i}-marker`, 'tick')} style={{ ...box, borderRadius: '50%', background: accent, ...anim }}>
          <LucideIconView name="check" size={Math.round(size * 0.55)} color={style.colors.on_accent} />
        </div>
      );
    }
    return (
      <div {...leaf(`item-${i}-marker`, 'item number')} style={{ ...box, borderRadius: '50%', background: accent, ...anim }}>
        <span style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: Math.round(size * 0.46), lineHeight: 1, color: style.colors.on_accent }}>{i + 1}</span>
      </div>
    );
  };

  const itemText = (i: number, alignText: 'left' | 'center') => {
    const box = L.items[i];
    const tw = w[`item${i}_text`];
    const sw = w[`item${i}_sub`];
    return (
      <>
        <AnimatedText
          lines={box.text}
          anim={A('item_text')}
          start={tw.start}
          dur={tw.dur}
          frame={frame}
          weight={F.text.weight}
          lineHeight={F.text.lineHeight}
          shadow={shadow}
          align={alignText}
          group={`item-${i}-text`}
          input={`items[${i}].text`}
        />
        {box.sub.length > 0 && sw && (
          <AnimatedText
            lines={box.sub}
            anim={A('item_sub')}
            start={sw.start}
            dur={sw.dur}
            frame={frame}
            weight={F.sub.weight}
            lineHeight={F.sub.lineHeight}
            color={muted}
            shadow={shadow}
            align={alignText}
            group={`item-${i}-sub`}
            input={`items[${i}].sub`}
            style={{ marginTop: SUB_GAP }}
          />
        )}
      </>
    );
  };

  const body =
    L.layout === 'list' ? (
      <div style={{ width: L.width, display: 'flex', flexDirection: 'column', gap: L.rowGap }}>
        {items.map((_, i) => {
          const cs = cardStyle(A('items'), progress(frame, w[`item${i}`].start, w[`item${i}`].dur));
          return (
            <div
              key={i}
              style={{ height: L.items[i].h, display: 'flex', alignItems: 'center', gap: MARKER_GAP, ...cs, opacity: ((cs.opacity as number | undefined) ?? 1) * dimmed(i) }}
            >
              <div style={{ width: L.mediaW, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>{marker(i, L.markerSize, L.marker)}</div>
              <div style={{ width: L.textW, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>{itemText(i, 'left')}</div>
            </div>
          );
        })}
      </div>
    ) : (
      <div style={{ width: SAFE_W, display: 'grid', gridTemplateColumns: `repeat(${L.cols}, ${L.cardW}px)`, gap: CARD_GAP, justifyContent: 'center' }}>
        {items.map((it, i) => {
          const cs = cardStyle(A('items'), progress(frame, w[`item${i}`].start, w[`item${i}`].dur));
          return (
            <div
              key={i}
              style={{
                width: L.cardW,
                height: L.cardH,
                boxSizing: 'border-box',
                borderRadius: 28,
                overflow: 'hidden',
                background: card.fill,
                border: `1.5px solid ${card.border}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                ...cs,
                opacity: ((cs.opacity as number | undefined) ?? 1) * dimmed(i),
              }}
            >
              {L.hasImages ? (
                <div style={{ width: '100%', height: L.mediaH, flexShrink: 0 }}>
                  {it.image ? (
                    <div {...leaf(`item-${i}-marker`, `items[${i}].image_url`)} style={{ width: '100%', height: '100%', ...iconStyle(A('markers'), progress(frame, w[`item${i}_marker`].start, w[`item${i}_marker`].dur)) }}>
                      <Img src={it.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{marker(i, Math.min(88, L.mediaH * 0.6), it.icon ? 'icon' : 'number')}</div>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: CARD_PAD, marginBottom: 20 }}>{marker(i, L.badge, L.marker === 'image' || L.marker === 'bullet' ? 'number' : L.marker)}</div>
              )}
              <div style={{ width: L.textW, marginTop: L.hasImages ? CARD_PAD : 0, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                {itemText(i, 'center')}
              </div>
            </div>
          );
        })}
      </div>
    );

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground
        mode={bg}
        imageUrl={imageUrl}
        align={align === 'center' || L.layout === 'cards' ? 'center' : 'left'}
        accent={accent}
        frame={frame}
        durationInFrames={durationInFrames}
        colors={style.colors}
        motion={A('image_motion')}
        entry={A('image_entry')}
      />

      <SafeArea debug={debug}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: L.layout === 'cards' || align === 'center' ? 'center' : 'flex-start',
            ...exit,
          }}
        >
          <div style={{ width: L.layout === 'cards' ? SAFE_W : L.width, display: 'flex', flexDirection: 'column', alignItems: L.layout === 'cards' ? 'center' : 'flex-start' }}>
            {L.heading.length > 0 && w.title && (
              <AnimatedText
                lines={L.heading}
                anim={A('title')}
                start={w.title.start}
                dur={w.title.dur}
                frame={frame}
                weight={FS14_SPEC.text.title.weight}
                lineHeight={FS14_SPEC.text.title.lineHeight}
                letterSpacing="-0.02em"
                shadow={shadow}
                align={L.layout === 'cards' ? 'center' : 'left'}
                group="title"
                input="title"
                style={{ marginBottom: HEADING_GAP }}
              />
            )}
            {body}
          </div>
        </div>
      </SafeArea>
    </div>
  );
}
