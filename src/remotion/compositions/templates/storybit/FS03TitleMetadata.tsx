'use client';

/**
 * FS-03 · Title + Metadata  (animation_type: "fs_title_metadata")
 * A title with 2–4 metadata chips (icon + short label).
 *
 * Content limits live in FS03_SPEC (titleMetaLayout.ts):
 *   title          required  3–40 chars · 1–8 words · 2 lines · 150→84px
 *   meta[] 2–4     label 2–20 chars · 1–4 words · 1 line · 34→24px · icon (Lucide name, optional)
 *   — or date / location / category / source sent directly (each becomes a chip)
 * Chip icon, padding and height scale with the chip font. Chips are placed explicitly and wrap
 * to a new row instead of overlapping.
 * Timing: 3–8s. Optional cue_times: [title, chip 1, chip 2, …] in seconds from the template start.
 * Animations: props.animations = { title, rule, chips, chip_icons, chip_labels, image_motion, image_entry, exit }.
 * Options: layout "row" | "stacked", background, align, image_url, accent_color, show_safe_area.
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { normaliseText, readAnim, type TemplateSpec, HERO_TITLE, BACKGROUND_IMAGE, applySizes } from './core/contentSpec';
import { cardStyle, exitStyle, iconStyle, progress, shapeState, textAnimFrames } from './core/motion';
import { readCues, planTimeline, type Plan, type Unit } from './core/timeline';
import { measureFor } from './core/measure';
import { cardColors, readStyle, styleVars } from './core/style';
import { SafeArea, SAFE_W, SAFE_H } from './core/safeArea';
import { FOOTAGE_SHADOW, AnimatedText, StoryBackground, leaf, readAlign, readBgMode, readFirst } from './core/shared';
import { blockHeight, fitText, sharedFont, linesAt, type Line, type Measure, words } from './core/fit';

/* ================================================================== */
/* Content spec, layout and timing                                     */
/* ================================================================== */

export const FS03_SPEC: TemplateSpec = {
  id: 'FS-03',
  animationType: 'fs_title_metadata',
  name: 'Title + Metadata',
  pickWhen: 'Introducing an event, place, person or organisation together with 2–4 key facts (date, place, category, source).',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 150, max: 240 },
  text: { title: HERO_TITLE },
  lists: {
    meta: {
      label: 'Chip',
      fills: 'Row of fact chips under the title',
      minItems: 2,
      maxItems: 4,
      icon: { required: false, fallback: 'circle' },
      fields: {
        label: {
          label: 'Label',
          required: true,
          minChars: 2,
          maxChars: 20,
          minWords: 1,
          maxWords: 4,
          maxWordChars: 16,
          maxLines: 1,
          fontMax: 34,
          fontMin: 24,
          weight: 600,
          lineHeight: 1.2,
          hint: 'A fact: date, place, category, source.',
          fills: 'Chip text',
        },
      },
    },
  },
  options: {
    layout: { label: 'Chip layout', values: ['row', 'stacked'], default: 'row', fills: 'Chips side by side or one per line' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
    align: { label: 'Align', values: ['left', 'center'], default: 'left', fills: 'Horizontal alignment' },
  },
  animations: {
    title: { label: 'Title', kind: 'text', target: 'title (each line)', default: 'rise' },
    rule: { label: 'Accent line', kind: 'shape', target: 'line under the title', default: 'grow' },
    chips: { label: 'Chips', kind: 'card', target: 'each chip (background pill)', default: 'pop' },
    chip_icons: { label: 'Chip icons', kind: 'icon', target: 'icon inside each chip', default: 'pop' },
    chip_labels: { label: 'Chip labels', kind: 'text', target: 'text inside each chip', default: 'fade' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: {
    description: 'First cue = title, then one cue per chip (when the narrator mentions that fact).',
    units: ['title', 'chip 1', 'chip 2', 'chip 3', 'chip 4'],
  },
  colors: ['icon', 'icon_bg', 'card', 'card_border'],
  example: {
    title: 'Chandrayaan-3 lands on the Moon',
    meta: [
      { icon: 'calendar', label: '23 August 2023' },
      { icon: 'map-pin', label: 'Lunar south pole' },
      { icon: 'rocket', label: 'Space mission' },
    ],
    layout: 'row',
    background: 'theme',
    align: 'left',
    cue_times: [0.2, 1.6, 2.5, 3.4],
  },
};

export type MetaItem = { icon: string; label: string };

export const META_KEYS: { key: string; icon: string }[] = [
  { key: 'date', icon: 'calendar' },
  { key: 'location', icon: 'map-pin' },
  { key: 'category', icon: 'folder' },
  { key: 'source', icon: 'file-text' },
];

export const RULE_GAP = 24;
export const RULE_H = 8;
export const CHIPS_GAP = 28;
export const CHIP_GAP = 20;

/** Every chip dimension scales with its font so icons and text stay in proportion. */
export function chipGeometry(font: number) {
  const iconBox = Math.round(font * 1.42);
  return {
    iconBox,
    icon: Math.round(font * 0.76),
    padY: Math.round(font * 0.44),
    padX: Math.round(font * 0.76),
    iconGap: Math.round(font * 0.44),
    height: Math.round(Math.max(iconBox, font * 1.2) + font * 0.44 * 2),
  };
}

export type PlacedChip = { item: MetaItem; label: Line; x: number; y: number; w: number; h: number };

export type TitleMetaLayout = {
  title: Line[];
  titleFont: number;
  chipFont: number;
  geo: ReturnType<typeof chipGeometry>;
  chips: PlacedChip[];
  chipsW: number;
  chipsH: number;
  blockH: number;
};

function placeChips(
  items: MetaItem[],
  font: number,
  stacked: boolean,
  align: 'left' | 'center',
  measure: Measure,
  spec: TemplateSpec = FS03_SPEC,
) {
  const labelSpec = spec.lists.meta.fields.label;
  const geo = chipGeometry(font);
  const fixed = geo.padY + geo.iconBox + geo.iconGap + geo.padX;
  const sized = items.map((item) => {
    const label = linesAt(item.label, font, labelSpec, SAFE_W - fixed, measure, false)[0] ?? { text: '', size: font };
    return { item, label, w: Math.ceil(fixed + measure(label.text, label.size, labelSpec.weight)), h: geo.height };
  });
  const rows: (typeof sized)[] = [];
  for (const c of sized) {
    const row = rows[rows.length - 1];
    const rowW = row ? row.reduce((s, r) => s + r.w, 0) + CHIP_GAP * row.length : 0;
    if (!row || stacked || rowW + c.w > SAFE_W) rows.push([c]);
    else row.push(c);
  }
  const placed: PlacedChip[] = [];
  let widest = 0;
  rows.forEach((row, r) => {
    const rowW = row.reduce((s, c) => s + c.w, 0) + CHIP_GAP * (row.length - 1);
    widest = Math.max(widest, rowW);
    let x = align === 'center' ? (SAFE_W - rowW) / 2 : 0;
    for (const c of row) {
      placed.push({ ...c, x, y: r * (geo.height + CHIP_GAP) });
      x += c.w + CHIP_GAP;
    }
  });
  return { geo, placed, rows: rows.length, w: widest, h: rows.length * geo.height + (rows.length - 1) * CHIP_GAP };
}

export function layoutTitleMeta(
  input: { title: string; meta: MetaItem[]; stacked: boolean; align: 'left' | 'center' },
  measure: Measure,
  spec: TemplateSpec = FS03_SPEC,
): TitleMetaLayout {
  const T = spec.text.title;
  const L = spec.lists.meta.fields.label;
  // chips: largest shared font that keeps them on one row (row layout) — never below fontMin
  let chipFont = input.stacked ? sharedFont(input.meta.map((m) => m.label), L, SAFE_W - 200, measure) : L.fontMin;
  if (!input.stacked) {
    for (let f = L.fontMax; f >= L.fontMin; f -= 2) {
      if (placeChips(input.meta, f, false, input.align, measure, spec).rows === 1) {
        chipFont = f;
        break;
      }
    }
  }
  let chips = placeChips(input.meta, chipFont, input.stacked, input.align, measure, spec);
  const fixed = RULE_GAP + RULE_H + CHIPS_GAP;

  let cap = T.fontMax;
  let t = fitText(input.title, T, SAFE_W, measure, true, cap);
  const total = () => blockHeight(t.lines, T.lineHeight) + fixed + chips.h;
  while (total() > SAFE_H && cap > T.fontMin) {
    cap -= 4;
    t = fitText(input.title, T, SAFE_W, measure, true, cap);
  }
  while (total() > SAFE_H && chipFont > L.fontMin) {
    chipFont -= 2;
    chips = placeChips(input.meta, chipFont, input.stacked, input.align, measure, spec);
  }
  return {
    title: t.lines,
    titleFont: t.font,
    chipFont,
    geo: chips.geo,
    chips: chips.placed,
    chipsW: chips.w,
    chipsH: chips.h,
    blockH: total(),
  };
}

/** Beat-synced plan: title → chips (each chip's icon and label follow the chip). */
export function planTitleMeta(
  L: TitleMetaLayout,
  anims: { title: string; chip_labels: string },
  duration: number,
  cueTimes?: number[],
): Plan {
  const tt = L.title.map((l) => l.text).join(' ');
  const titleDur = textAnimFrames(anims.title, words(tt).length, tt.length, Math.round(18 * (1 + 0.33 * (L.title.length - 1))));
  const units: Unit[] = [{ key: 'title', label: 'Title', start: 4, dur: titleDur, cue: 0 }];
  units.push({ key: 'rule', label: 'Accent line', start: 4 + titleDur - 10, dur: 14, follows: { key: 'title', offset: Math.max(0, titleDur - 10) } });
  const chipStart = 4 + titleDur - 2;
  L.chips.forEach((c, i) => {
    units.push({ key: `chip${i}`, label: `Chip ${i + 1}`, start: chipStart + i * 5, dur: 14, cue: i + 1 });
  });
  L.chips.forEach((c, i) => {
    units.push({ key: `chip${i}_icon`, label: `Chip ${i + 1} icon`, start: chipStart + i * 5 + 3, dur: 14, follows: { key: `chip${i}`, offset: 3 } });
    const lt = c.label.text;
    units.push({
      key: `chip${i}_label`,
      label: `Chip ${i + 1} label`,
      start: chipStart + i * 5 + 4,
      dur: textAnimFrames(anims.chip_labels, words(lt).length, lt.length, 12),
      follows: { key: `chip${i}`, offset: 4 },
    });
  });
  return planTimeline(duration, units, cueTimes);
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */

function readMeta(props: Record<string, unknown>): MetaItem[] {
  const spec = FS03_SPEC.lists.meta;
  const fallback = spec.icon?.fallback ?? 'circle';
  const raw = props.meta ?? props.metadata ?? props.items;
  let items: MetaItem[] = [];
  if (Array.isArray(raw)) {
    items = raw
      .map((m): MetaItem | null => {
        if (typeof m === 'string') return { icon: fallback, label: m };
        if (m && typeof m === 'object') {
          const o = m as Record<string, unknown>;
          const label = typeof o.label === 'string' ? o.label : typeof o.text === 'string' ? o.text : '';
          const icon = typeof o.icon === 'string' ? o.icon : typeof o.icon_name === 'string' ? o.icon_name : fallback;
          return label ? { icon, label } : null;
        }
        return null;
      })
      .filter((m): m is MetaItem => m !== null);
  }
  if (!items.length) {
    for (const { key, icon } of META_KEYS) {
      const v = readNonEmptyString(props, key);
      if (v) items.push({ icon, label: v });
    }
  }
  return items
    .slice(0, spec.maxItems)
    .map((m) => ({ icon: m.icon, label: normaliseText(m.label, spec.fields.label) }))
    .filter((m) => m.label);
}

/** Reads props, fits the layout and plans the timeline — shared by the renderer and the preview. */
export function prepareFS03(props: Record<string, unknown>, durationInFrames: number) {

  const title = normaliseText(readFirst(props, ['title', 'headline', 'text']), FS03_SPEC.text.title);
  const meta = readMeta(props);
  const stacked = readNonEmptyString(props, 'layout') === 'stacked';
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const align = readAlign(props);
  const style = readStyle(props);
  const accent = style.colors.accent;
  const sized = applySizes(FS03_SPEC, props);
  const measure = measureFor(style);
  const debug = props.show_safe_area === true;

  const A = (k: string) => readAnim(props, FS03_SPEC, k);
  const L = layoutTitleMeta({ title, meta, stacked, align }, measure, sized.spec);
  const plan = planTitleMeta(L, { title: A('title'), chip_labels: A('chip_labels') }, durationInFrames, readCues(props));
  return { style, sized, title, meta, stacked, imageUrl, bg, align, accent, debug, A, L, plan };
}

export function FS03TitleMetadata({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, imageUrl, bg, align, accent, debug, A, L, plan } = prepareFS03(props, durationInFrames);
  const w = plan.windows;
  const g = L.geo;
  const labelSpec = FS03_SPEC.lists.meta.fields.label;

  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const rule = shapeState(A('rule'), progress(frame, w.rule.start, w.rule.dur));
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const { fill: chipFill, border: chipBorder } = cardColors(style, onFootage);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align={align} accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />

      <SafeArea debug={debug}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: align === 'center' ? 'center' : 'flex-start',
            ...exit,
          }}
        >
          <AnimatedText
            lines={L.title}
            anim={A('title')}
            start={w.title.start}
            dur={w.title.dur}
            frame={frame}
            weight={FS03_SPEC.text.title.weight}
            lineHeight={FS03_SPEC.text.title.lineHeight}
            letterSpacing="-0.02em"
            shadow={shadow}
            align={align}
            group="title"
            input="title"
          />

          <div
            {...leaf('rule', 'accent line')}
            style={{ width: 120 * rule.length, height: RULE_H, borderRadius: 4, background: accent, marginTop: RULE_GAP, ...rule.style }}
          />

          <div style={{ position: 'relative', marginTop: CHIPS_GAP, width: SAFE_W, height: L.chipsH }}>
            {L.chips.map((c, i) => {
              const cw = w[`chip${i}`];
              const iw = w[`chip${i}_icon`];
              const lw = w[`chip${i}_label`];
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: c.x,
                    top: c.y,
                    width: c.w,
                    height: c.h,
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    gap: g.iconGap,
                    paddingLeft: g.padY,
                    paddingRight: g.padX,
                    borderRadius: 999,
                    background: chipFill,
                    border: `1.5px solid ${chipBorder}`,
                    transformOrigin: 'left center',
                    ...cardStyle(A('chips'), progress(frame, cw.start, cw.dur)),
                  }}
                >
                  <div
                    {...leaf(`chip-${i}-icon`, `meta[${i}].icon`)}
                    style={{
                      width: g.iconBox,
                      height: g.iconBox,
                      borderRadius: '50%',
                      background: style.colors.icon_bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      ...iconStyle(A('chip_icons'), progress(frame, iw.start, iw.dur)),
                    }}
                  >
                    <LucideIconView name={c.item.icon} size={g.icon} color={style.colors.icon} />
                  </div>
                  <AnimatedText
                    lines={[c.label]}
                    anim={A('chip_labels')}
                    start={lw.start}
                    dur={lw.dur}
                    frame={frame}
                    weight={labelSpec.weight}
                    lineHeight={labelSpec.lineHeight}
                    shadow={shadow}
                    group={`chip-${i}-label`}
                    input={`meta[${i}].label`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </SafeArea>
    </div>
  );
}
