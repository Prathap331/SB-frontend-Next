'use client';

/**
 * DV-14 · Leaderboard / Ranked List  (animation_type: "dv_leaderboard")
 * 3–10 ranked rows: rank badge, optional picture or icon, name (+ sub-line), optional bar and value.
 * Rows build up top-down, or as a countdown (last rank first, #1 revealed last).
 *
 * Inputs (full list, limits and JSON Schema: DV14Leaderboard.inputs.json):
 *   title · items[] { label, sub, value, icon, image_url } · prefix · unit · source · image_url
 *   order · sort · bars · rank_style · highlight · format · decimals · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, row revealed 1st, 2nd, …]
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from './core/remotionSafe';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, iconStyle, progress, shapeState, textAnimFrames } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { FORMAT_HELP, NUMBER_FORMATS, readNumber, type NumberFormat } from './core/numbers';
import { axisFormatter } from './core/chart';
import { numberAnimState } from './core/numberRow';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { cardColors, fontFor, mutedFor, readStyle, styleVars, withAlpha, readHex } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

/* ================================================================== */
/* Content spec                                                         */
/* ================================================================== */

export const DV14_SPEC: TemplateSpec = {
  id: 'DV-14',
  animationType: 'dv_leaderboard',
  name: 'Leaderboard',
  pickWhen: 'A top-N ranking: richest, biggest, most populous, most-watched — with or without values.',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 210, max: 240, perItemFrames: 24 },
  text: {
    title: { label: 'Heading', required: false, minChars: 3, maxChars: 50, minWords: 1, maxWords: 10, maxWordChars: 18, maxLines: 1, fontMax: 60, fontMin: 40, weight: 800, lineHeight: 1.04, hint: '"Top 5 richest Indians (illustrative)".', fills: 'Heading above the list', example: 'Most-used UPI apps (illustrative)' },
    prefix: { label: 'Prefix', required: false, minChars: 1, maxChars: 3, minWords: 1, maxWords: 1, maxWordChars: 3, maxLines: 1, fontMax: 40, fontMin: 16, weight: 800, lineHeight: 1, fills: 'Symbol before every value', noSize: true },
    unit: { label: 'Unit', required: false, minChars: 1, maxChars: 8, minWords: 1, maxWords: 1, maxWordChars: 8, maxLines: 1, fontMax: 40, fontMin: 16, weight: 800, lineHeight: 1, fills: 'Unit after every value', noSize: true },
    source: { label: 'Source', required: false, minChars: 3, maxChars: 60, minWords: 1, maxWords: 10, maxWordChars: 18, maxLines: 1, fontMax: 24, fontMin: 18, weight: 500, lineHeight: 1.25, hint: '"Source: Forbes, 2025".', fills: 'Source line under the list' },
  },
  lists: {
    items: {
      label: 'Row',
      fills: 'Ranked rows, #1 first',
      minItems: 3,
      maxItems: 10,
      icon: { required: false, fallback: 'none' },
      image: { required: false, fills: 'Circle picture next to the rank (logo, face, flag)' },
      bgColor: 'this row',
      fields: {
        label: { label: 'Name', required: true, minChars: 1, maxChars: 28, minWords: 1, maxWords: 5, maxWordChars: 16, maxLines: 1, fontMax: 44, fontMin: 20, weight: 700, lineHeight: 1.2, hint: 'Who / what is ranked.', fills: 'Row name' },
        sub: { label: 'Sub-line', required: false, minChars: 2, maxChars: 40, minWords: 1, maxWords: 7, maxWordChars: 16, maxLines: 1, fontMax: 26, fontMin: 16, weight: 500, lineHeight: 1.25, hint: 'Small detail: company, city, category.', fills: 'Line under the name' },
      },
      numbers: { value: { label: 'Value', required: false, fills: 'Raw value shown on the right (and as a bar)' } },
    },
  },
  options: {
    order: { label: 'Reveal order', values: ['top_down', 'countdown'], default: 'top_down', fills: 'Rows appear #1 first, or as a countdown ending on #1' },
    sort: { label: 'Sort', values: ['as_given', 'desc', 'asc'], default: 'as_given', fills: 'Keep the given ranking, or rank by value (desc = biggest is #1)' },
    bars: { label: 'Bars', values: ['auto', 'on', 'off'], default: 'auto', fills: 'Bar sized by value behind each row (auto = on when every row has a value)' },
    rank_style: { label: 'Rank style', values: ['number', 'medal'], default: 'medal', fills: 'Plain numbers, or gold / silver / bronze badges for the top 3' },
    highlight: { label: 'Highlight', values: ['first', 'none'], default: 'first', fills: 'Accent outline on the #1 row' },
    format: { label: 'Number format', values: [...NUMBER_FORMATS], default: 'indian_compact', fills: FORMAT_HELP },
    decimals: { label: 'Decimals', values: ['auto', '0', '1', '2'], default: 'auto', fills: 'Decimal places shown' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    rows: { label: 'Rows', kind: 'card', target: 'each row', default: 'slide_left' },
    ranks: { label: 'Rank badges', kind: 'icon', target: 'rank badge of each row', default: 'pop' },
    media: { label: 'Pictures / icons', kind: 'icon', target: 'picture or icon of each row', default: 'pop' },
    bars: { label: 'Bars', kind: 'shape', target: 'value bar of each row', default: 'grow' },
    values: { label: 'Values', kind: 'number', target: 'value of each row', default: 'count_up' },
    source: { label: 'Source', kind: 'text', target: 'source line', default: 'fade' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image (whole clip)', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: {
    description: 'First cue = heading (if present), then one cue per row in REVEAL order (countdown: the last rank is revealed first), then source.',
    units: ['heading', 'row revealed 1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', 'source'],
  },
  colors: ['icon', 'icon_bg', 'card', 'card_border', 'on_accent'],
  example: {
    title: 'Most-used UPI apps (illustrative)',
    items: [
      { label: 'PhonePe', sub: 'Walmart-owned', value: 47, icon: 'smartphone' },
      { label: 'Google Pay', sub: 'Alphabet', value: 36, icon: 'smartphone' },
      { label: 'Paytm', sub: 'One97 Communications', value: 7, icon: 'smartphone' },
      { label: 'Others', value: 10, icon: 'smartphone' },
    ],
    unit: '%',
    format: 'plain',
    order: 'countdown',
    source: 'Source: illustrative figures',
    background: 'theme',
  },
};

/* ================================================================== */
/* Layout                                                               */
/* ================================================================== */

export type RankItem = { label: string; sub?: string; value?: number; icon?: string; image?: string; bg?: string };
export const HEADING_GAP = 36;
export const SOURCE_GAP = 22;
export const ROW_GAP = 12;
export const COL_GAP = 24;

export type BoardLayout = {
  heading: Line[];
  source: Line[];
  top: number;
  rowH: number;
  rankW: number;
  media: number;
  labelX: number;
  labelW: number;
  labels: Line[];
  subs: (Line | undefined)[];
  labelFont: number;
  valueTexts: string[];
  fmt: (v: number) => string;
  valueFont: number;
  valueW: number;
  barX: number;
  barMaxW: number;
  barFrac: number[];
  blockH: number;
};

export function layoutBoard(
  input: { title: string; source: string; items: RankItem[]; prefix: string; unit: string; format: NumberFormat; decimals: string; bars: boolean },
  measure: Measure,
  spec: TemplateSpec = DV14_SPEC,
): BoardLayout {
  const T = spec.text;
  const F = spec.lists.items.fields;
  const n = Math.max(1, input.items.length);
  const heading = input.title ? fitText(input.title, T.title, SAFE_W, measure, false).lines : [];
  const headingH = heading.length ? blockHeight(heading, T.title.lineHeight) + HEADING_GAP : 0;
  const source = input.source ? fitText(input.source, T.source, SAFE_W, measure, false).lines : [];
  const sourceH = source.length ? SOURCE_GAP + blockHeight(source, T.source.lineHeight) : 0;
  const avail = SAFE_H - headingH - sourceH;
  const rowH = Math.min(120, Math.floor((avail - ROW_GAP * (n - 1)) / n));
  const rankW = Math.round(rowH * 0.78);
  const hasMedia = input.items.some((i) => i.icon || i.image);
  const media = hasMedia ? Math.round(rowH * 0.66) : 0;
  const hasSub = input.items.some((i) => i.sub);

  const vals = input.items.map((i) => i.value).filter((v): v is number => v !== undefined);
  const f = vals.length ? axisFormatter(vals, input.format, input.decimals, input.prefix, input.unit) : null;
  const valueTexts = input.items.map((i) => (i.value !== undefined && f ? f.fmt(i.value) : ''));
  let valueFont = Math.min(44, Math.round(rowH * 0.4));
  const widest = () => Math.max(0, ...valueTexts.map((t) => measure(t, valueFont, 800, { tabular: true })));
  while (valueFont > 18 && widest() > 360) valueFont -= 2;
  const valueW = vals.length ? Math.ceil(widest()) + 8 : 0;

  const labelX = 20 + rankW + COL_GAP + (media ? media + COL_GAP : 0);
  const rightEdge = SAFE_W - 24 - (valueW ? valueW + COL_GAP : 0);
  const labelCap = Math.min(F.label.fontMax, Math.round(rowH * (hasSub ? 0.36 : 0.44)));
  const maxLabelW = input.bars ? Math.min(560, rightEdge - labelX - 200) : rightEdge - labelX;
  const lf = sharedFont(input.items.map((i) => i.label), F.label, maxLabelW, measure, labelCap);
  const labels = input.items.map((i) => linesAt(i.label, lf, F.label, maxLabelW, measure, false)[0]);
  const sf = hasSub ? sharedFont(input.items.map((i) => i.sub ?? ''), F.sub, maxLabelW, measure, Math.min(F.sub.fontMax, Math.round(lf * 0.62))) : 0;
  const subs = input.items.map((i) => (i.sub ? linesAt(i.sub, sf, F.sub, maxLabelW, measure, false)[0] : undefined));
  const labelW = input.bars ? Math.ceil(Math.max(...labels.map((l) => measure(l.text, l.size, F.label.weight)), ...subs.map((s) => (s ? measure(s.text, s.size, F.sub.weight) : 0)))) + 8 : rightEdge - labelX;
  const barX = labelX + labelW + COL_GAP;
  const barMaxW = input.bars ? Math.max(120, rightEdge - barX) : 0;
  const maxV = Math.max(...vals.map(Math.abs), 1e-9);
  const barFrac = input.items.map((i) => (i.value !== undefined ? Math.max(0.03, Math.abs(i.value) / maxV) : 0));
  const top = headingH + (avail - (rowH * n + ROW_GAP * (n - 1))) / 2;
  return { heading, source, top, rowH, rankW, media, labelX, labelW, labels, subs, labelFont: lf, valueTexts, fmt: f ? f.fmt : String, valueFont, valueW, barX, barMaxW, barFrac, blockH: SAFE_H };
}

/* ================================================================== */
/* Timing                                                               */
/* ================================================================== */

export function planBoard(L: BoardLayout, n: number, countdown: boolean, anims: { title: string; source: string }, duration: number, cueTimes?: number[]): Plan {
  const T = (lines: Line[]) => lines.map((l) => l.text).join(' ');
  const units: Unit[] = [];
  let cue = 0;
  if (L.heading.length) {
    const h = T(L.heading);
    units.push({ key: 'title', label: 'Heading', start: 2, dur: textAnimFrames(anims.title, words(h).length, h.length, 18), cue: cue++ });
  }
  const first = L.heading.length ? 18 : 6;
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const gap = n > 1 ? Math.max(6, Math.min(36, Math.floor((budget - first - 40) / (n - 1)))) : 0;
  const order = Array.from({ length: n }, (_, i) => (countdown ? n - 1 - i : i));
  order.forEach((row, k) => units.push({ key: `row${row}`, label: `Row #${row + 1}`, start: first + k * gap, dur: 14, cue: cue + k }));
  cue += 10;
  const end = first + (n - 1) * gap + 40;
  if (L.source.length) {
    const s = T(L.source);
    units.push({ key: 'source', label: 'Source', start: end, dur: textAnimFrames(anims.source, words(s).length, s.length, 14), cue });
  }
  order.forEach((row, k) => {
    const s0 = first + k * gap;
    units.push({ key: `rank${row}`, label: `Rank #${row + 1}`, start: s0 + 2, dur: 14, follows: { key: `row${row}`, offset: 2 } });
    units.push({ key: `media${row}`, label: `Picture #${row + 1}`, start: s0 + 4, dur: 14, follows: { key: `row${row}`, offset: 4 } });
    units.push({ key: `bar${row}`, label: `Bar #${row + 1}`, start: s0 + 6, dur: 24, follows: { key: `row${row}`, offset: 6 } });
    units.push({ key: `value${row}`, label: `Value #${row + 1}`, start: s0 + 6, dur: 26, follows: { key: `row${row}`, offset: 6 } });
  });
  return planTimeline(duration, units, cueTimes);
}

/* ================================================================== */
/* Props → layout → plan (shared by the renderer and the preview)       */
/* ================================================================== */

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareDV14(props: Record<string, unknown>, durationInFrames: number) {
  const S = DV14_SPEC.text;
  const IS = DV14_SPEC.lists.items;
  const A = (k: string) => readAnim(props, DV14_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DV14_SPEC, props);
  const measure = measureFor(style);
  const s = (o: Record<string, unknown>, k: string[]) => {
    for (const x of k) if (typeof o[x] === 'string' && (o[x] as string).trim()) return o[x] as string;
    return undefined;
  };
  let items: RankItem[] = (Array.isArray(props.items) ? props.items : [])
    .map((it): RankItem | null => {
      const o = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
      const label = s(o, ['label', 'name', 'title']);
      return label ? { label: normaliseText(label, IS.fields.label), sub: normaliseText(s(o, ['sub', 'detail']), IS.fields.sub) || undefined, value: readNumber(o.value), icon: s(o, ['icon', 'icon_name']), image: s(o, ['image_url', 'image']), bg: readHex(o.bg_color) } : null;
    })
    .filter((x): x is RankItem => x !== null && Boolean(x.label))
    .slice(0, IS.maxItems);
  const sort = opt(props, 'sort', ['as_given', 'desc', 'asc'] as const, 'as_given');
  if (sort !== 'as_given') items = [...items].sort((a, b) => (sort === 'desc' ? (b.value ?? -Infinity) - (a.value ?? -Infinity) : (a.value ?? Infinity) - (b.value ?? Infinity)));
  const barsOpt = opt(props, 'bars', ['auto', 'on', 'off'] as const, 'auto');
  const allValues = items.length > 0 && items.every((i) => i.value !== undefined);
  const bars = allValues && barsOpt !== 'off';
  const input = {
    title: normaliseText(readFirst(props, ['title', 'heading']), S.title),
    source: normaliseText(readFirst(props, ['source']), S.source),
    items,
    prefix: normaliseText(readFirst(props, ['prefix']), S.prefix),
    unit: normaliseText(readFirst(props, ['unit']), S.unit),
    format: opt(props, 'format', NUMBER_FORMATS, 'indian_compact'),
    decimals: opt(props, 'decimals', ['auto', '0', '1', '2'] as const, 'auto'),
    bars,
  };
  const countdown = opt(props, 'order', ['top_down', 'countdown'] as const, 'top_down') === 'countdown';
  const medal = opt(props, 'rank_style', ['number', 'medal'] as const, 'medal') === 'medal';
  const highlight = opt(props, 'highlight', ['first', 'none'] as const, 'first') === 'first';
  const imageUrl = readImageUrl(props);
  const bg = readBgMode(props, imageUrl);
  const debug = props.show_safe_area === true;
  const L = layoutBoard(input, measure, sized.spec);
  const plan = planBoard(L, items.length, countdown, { title: A('title'), source: A('source') }, durationInFrames, readCues(props));
  return { style, sized, A, input, medal, highlight, imageUrl, bg, debug, L, plan };
}

/* ================================================================== */
/* Renderer                                                             */
/* ================================================================== */

const MEDALS = ['#F5C542', '#C9D1DB', '#D38B4F'];

function DV14LeaderboardBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, input, medal, highlight, imageUrl, bg, debug, L, plan } = prepareDV14(props, durationInFrames);
  const w = plan.windows;
  const S = DV14_SPEC.text;
  const F = DV14_SPEC.lists.items.fields;
  const accent = style.colors.accent;
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const muted = mutedFor(style, onFootage);
  const card = cardColors(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.heading.length > 0 && w.title && (
            <AnimatedText lines={L.heading} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={S.title.weight} lineHeight={S.title.lineHeight} letterSpacing="-0.02em" shadow={shadow} group="title" input="title" />
          )}
          {input.items.map((it, i) => {
            const rw = w[`row${i}`];
            const top = L.top + i * (L.rowH + ROW_GAP);
            const isTop = highlight && i === 0;
            const badgeColor = medal && i < 3 ? MEDALS[i] : withAlpha(style.colors.text, 0.14);
            const badgeInk = medal && i < 3 ? '#1B1B1B' : style.colors.text;
            const bw = w[`bar${i}`];
            const bar = bw ? shapeState(A('bars'), progress(frame, bw.start, bw.dur)) : null;
            const vw = w[`value${i}`];
            const vp = vw ? progress(frame, vw.start, vw.dur) : 1;
            const vs = numberAnimState(A('values'), vp);
            const valueText = it.value !== undefined && vs.counting && vs.countP < 1 ? L.fmt(it.value * vs.countP) : L.valueTexts[i];
            const labelBlockH = L.labels[i].size * F.label.lineHeight + (L.subs[i] ? L.subs[i]!.size * F.sub.lineHeight : 0);
            return (
              <div key={i} style={{ position: 'absolute', left: 0, top, width: SAFE_W, height: L.rowH, ...cardStyle(A('rows'), progress(frame, rw.start, rw.dur)) }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: 20, background: it.bg ?? card.fill, border: `2px solid ${isTop ? withAlpha(accent, 0.8) : card.border}`, boxSizing: 'border-box' }} />
                {L.barMaxW > 0 && bar && (
                  <div {...leaf(`bar-${i}`, `items[${i}].value (bar)`)} style={{ position: 'absolute', left: L.barX, top: L.rowH * 0.3, height: L.rowH * 0.4, width: L.barMaxW * L.barFrac[i] * bar.length, borderRadius: 8, background: i === 0 && isTop ? accent : withAlpha(accent, 0.55), ...bar.style }} />
                )}
                <div
                  {...leaf(`rank-${i}`, 'rank (row order)')}
                  style={{ position: 'absolute', left: 20, top: (L.rowH - L.rankW * 0.8) / 2, width: L.rankW, height: L.rankW * 0.8, borderRadius: 14, background: badgeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', ...iconStyle(A('ranks'), progress(frame, w[`rank${i}`].start, w[`rank${i}`].dur)) }}
                >
                  <span style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: Math.round(L.rankW * 0.42), lineHeight: 1, color: badgeInk }}>{i + 1}</span>
                </div>
                {L.media > 0 && (it.image || it.icon) && (
                  <div
                    {...leaf(`media-${i}`, it.image ? `items[${i}].image_url` : `items[${i}].icon`)}
                    style={{ position: 'absolute', left: 20 + L.rankW + COL_GAP, top: (L.rowH - L.media) / 2, width: L.media, height: L.media, borderRadius: '50%', overflow: 'hidden', background: style.colors.icon_bg, display: 'flex', alignItems: 'center', justifyContent: 'center', ...iconStyle(A('media'), progress(frame, w[`media${i}`].start, w[`media${i}`].dur)) }}
                  >
                    {it.image ? <Img src={it.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <LucideIconView name={it.icon!} size={Math.round(L.media * 0.52)} color={style.colors.icon} />}
                  </div>
                )}
                <div style={{ position: 'absolute', left: L.labelX, top: (L.rowH - labelBlockH) / 2, display: 'flex', flexDirection: 'column' }}>
                  <span {...leaf(`label-${i}`, `items[${i}].label`)} style={{ fontFamily: fontFor(F.label.weight), fontWeight: F.label.weight, fontSize: L.labels[i].size, lineHeight: F.label.lineHeight, color: style.colors.text, whiteSpace: 'nowrap', textShadow: shadow }}>
                    {L.labels[i].text}
                  </span>
                  {L.subs[i] && (
                    <span {...leaf(`sub-${i}`, `items[${i}].sub`)} style={{ fontFamily: fontFor(F.sub.weight), fontWeight: F.sub.weight, fontSize: L.subs[i]!.size, lineHeight: F.sub.lineHeight, color: muted, whiteSpace: 'nowrap' }}>
                      {L.subs[i]!.text}
                    </span>
                  )}
                </div>
                {L.valueTexts[i] && (
                  <span
                    {...leaf(`value-${i}`, `items[${i}].value`)}
                    style={{ position: 'absolute', right: 24, top: (L.rowH - L.valueFont * 1.2) / 2, fontFamily: fontFor(800), fontWeight: 800, fontSize: L.valueFont, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', color: isTop ? accent : style.colors.text, whiteSpace: 'nowrap', opacity: vs.counting ? Math.min(1, vp * 4) : vp > 0 ? 1 : 0 }}
                  >
                    {valueText}
                  </span>
                )}
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
export const DV14Leaderboard = withAutoFit(DV14LeaderboardBase);
