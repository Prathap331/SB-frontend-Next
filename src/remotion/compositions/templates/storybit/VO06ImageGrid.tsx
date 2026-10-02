'use client';

/**
 * VO-06 · Image Grid  (animation_type: "vo_image_grid")
 * 4–9 pictures at once — "many examples", a collage of places / people / products — with an optional
 * label on each tile. Uniform grid (rows picked from the count) or masonry (columns of different heights).
 *
 * Inputs (full list, limits and JSON Schema: VO06ImageGrid.inputs.json):
 *   title · images[] { image_url, label, highlight } · layout · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, image 1…9]
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from './core/remotionSafe';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText, sharedFont, linesAt, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, imageMotionStyle, progress } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, guide, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

export const VO06_SPEC: TemplateSpec = {
  id: 'VO-06',
  animationType: 'vo_image_grid',
  name: 'Image Grid',
  pickWhen: '"Many examples": several pictures at once, a collage.',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 120, max: 240 },
  text: {
    title: { label: 'Heading', required: false, minChars: 3, maxChars: 44, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 1, fontMax: 52, fontMin: 36, weight: 800, lineHeight: 1.05, fills: 'Heading above the grid', example: 'India’s busiest railway stations' },
  },
  lists: {
    images: {
      label: 'Image',
      fills: 'Pictures, in reading order',
      minItems: 4,
      maxItems: 9,
      image: { required: true, fills: 'The picture' },
      fields: {
        label: { label: 'Label', required: false, minChars: 2, maxChars: 32, minWords: 1, maxWords: 6, maxWordChars: 16, maxLines: 1, fontMax: 28, fontMin: 16, weight: 700, lineHeight: 1.2, hint: 'Short name of what is shown.', fills: 'Label on the tile' },
      },
      numbers: { highlight: { label: 'Highlight', required: false, fills: '1 = accent frame around this tile', min: 0, max: 1, integer: true } },
    },
  },
  options: {
    layout: { label: 'Layout', values: ['uniform', 'masonry', 'feature'], default: 'uniform', fills: 'uniform: even grid for the count · masonry: 3–4 columns of tiles with different heights · feature: first image large, the rest beside it' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    tiles: { label: 'Tiles', kind: 'card', target: 'each tile', default: 'pop' },
    image_motion: { label: 'Tile motion', kind: 'image_motion', target: 'slow movement inside every tile', default: 'push_in' },
    captions: { label: 'Labels', kind: 'text', target: 'tile labels', default: 'fade_up' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the grid', default: 'fade' },
  },
  cues: { description: 'Fixed slots: heading → image 1 … image 9 (tiles appear in quick succession).', units: ['heading', 'image 1', 'image 2', 'image 3', 'image 4', 'image 5', 'image 6', 'image 7', 'image 8', 'image 9'] },
  colors: [],
  example: {
    title: 'India’s busiest railway stations',
    images: [
      { image_url: 'https://example.com/1.jpg', label: 'Howrah' },
      { image_url: 'https://example.com/2.jpg', label: 'New Delhi' },
      { image_url: 'https://example.com/3.jpg', label: 'Mumbai CSMT' },
      { image_url: 'https://example.com/4.jpg', label: 'Chennai Central' },
    ],
    layout: 'uniform',
    background: 'theme',
  },
};

type Tile = { image?: string; caption: string; highlight: boolean };
export const GAP = 18;
export type GridLayout = { title: Line[]; titleH: number; boxes: { x: number; y: number; w: number; h: number }[]; captions: (Line | undefined)[] };

/** Rows for an even grid: counts per row. */
const ROWS: Record<number, number[]> = { 1: [1], 2: [2], 3: [3], 4: [2, 2], 5: [3, 2], 6: [3, 3], 7: [4, 3], 8: [4, 4], 9: [3, 3, 3] };

export function layoutGrid(input: { title: string; tiles: Tile[]; layout: 'uniform' | 'masonry' | 'feature' }, measure: Measure, spec: TemplateSpec = VO06_SPEC): GridLayout {
  const F = spec.lists.images.fields.label;
  const n = Math.max(1, input.tiles.length);
  const title = input.title ? fitText(input.title, spec.text.title, SAFE_W, measure, false).lines : [];
  const titleH = title.length ? title[0].size * 1.05 + 28 : 0;
  const top = titleH;
  const H = SAFE_H - top;
  const boxes: GridLayout['boxes'] = [];
  if (input.layout === 'masonry') {
    // 3–4 columns; tiles in a column share its height unevenly (tall / short) so the edges do not line up
    const cols = n >= 7 ? 4 : 3;
    const cw = (SAFE_W - GAP * (cols - 1)) / cols;
    const perCol = Array.from({ length: cols }, (_, c) => Math.floor(n / cols) + (c < n % cols ? 1 : 0));
    const RATIOS = [1.35, 0.8, 1.1, 0.9, 1.25, 0.75];
    let k = 0;
    perCol.forEach((cnt, c) => {
      const weights = Array.from({ length: cnt }, (_, j) => RATIOS[(c * 2 + j) % RATIOS.length]);
      const sum = weights.reduce((a, b) => a + b, 0);
      let y = top;
      weights.forEach((wt) => {
        const h = ((H - GAP * (cnt - 1)) * wt) / sum;
        boxes[k] = { x: c * (cw + GAP), y, w: cw, h };
        y += h + GAP;
        k++;
      });
    });
    // reading order: fill column by column
  } else if (input.layout === 'feature' && n >= 3) {
    // big first image on the left (≈ 60%), the others stacked in 1–2 columns on the right
    const bigW = Math.round((SAFE_W - GAP) * 0.58);
    boxes.push({ x: 0, y: top, w: bigW, h: H });
    const rest = n - 1;
    const cols = rest > 4 ? 2 : 1;
    const rows = Math.ceil(rest / cols);
    const cw = (SAFE_W - bigW - GAP - GAP * (cols - 1)) / cols;
    const ch = (H - GAP * (rows - 1)) / rows;
    for (let i = 0; i < rest; i++) boxes.push({ x: bigW + GAP + (i % cols) * (cw + GAP), y: top + Math.floor(i / cols) * (ch + GAP), w: cw, h: ch });
  } else {
    const rows = ROWS[Math.min(9, n)];
    const rh = (H - GAP * (rows.length - 1)) / rows.length;
    let k = 0;
    rows.forEach((cols, r) => {
      const cw = (SAFE_W - GAP * (cols - 1)) / cols;
      for (let c = 0; c < cols && k < n; c++, k++) boxes.push({ x: c * (cw + GAP), y: top + r * (rh + GAP), w: cw, h: rh });
    });
  }
  const minW = Math.min(...boxes.map((b) => b.w));
  const cf = sharedFont(input.tiles.map((t) => t.caption || ' '), F, minW - 40, measure, Math.min(F.fontMax, Math.round(Math.min(...boxes.map((b) => b.h)) * 0.1)));
  const captions = input.tiles.map((t, i) => (t.caption ? linesAt(t.caption, cf, F, boxes[i].w - 40, measure, false)[0] : undefined));
  return { title, titleH, boxes, captions };
}

export function planGrid(n: number, hasTitle: boolean, duration: number, cueTimes?: number[]): Plan {
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const first = hasTitle ? 14 : 4;
  const gap = n > 1 ? Math.max(3, Math.min(14, Math.floor((budget - first - 24) / (n - 1)))) : 0;
  const units: Unit[] = [];
  if (hasTitle) units.push({ key: 'title', label: 'Heading', start: 2, dur: 14, cue: 0 });
  for (let i = 0; i < n; i++) {
    units.push({ key: `tile${i}`, label: `Image ${i + 1}`, start: first + i * gap, dur: 14, cue: 1 + i });
    units.push({ key: `cap${i}`, label: `Caption ${i + 1}`, start: first + i * gap + 8, dur: 12, follows: { key: `tile${i}`, offset: 8 } });
  }
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareVO06(props: Record<string, unknown>, durationInFrames: number) {
  const F = VO06_SPEC.lists.images.fields.label;
  const A = (k: string) => readAnim(props, VO06_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(VO06_SPEC, props);
  const measure = measureFor(style);
  const tiles: Tile[] = (Array.isArray(props.images) ? props.images : [])
    .map((x) => {
      const o = (x && typeof x === 'object' ? x : typeof x === 'string' ? { image_url: x } : {}) as Record<string, unknown>;
      const lab = typeof o.label === 'string' ? o.label : typeof o.caption === 'string' ? o.caption : '';
      return { image: typeof o.image_url === 'string' ? o.image_url : undefined, caption: normaliseText(lab, F), highlight: o.highlight === 1 };
    })
    .slice(0, 9);
  const layout = opt(props, 'layout', ['uniform', 'masonry', 'feature', 'auto'] as const, 'uniform');
  const L = layoutGrid({ title: normaliseText(readFirst(props, ['title']), VO06_SPEC.text.title), tiles, layout: layout === 'auto' ? 'uniform' : layout }, measure, sized.spec);
  const plan = planGrid(tiles.length, L.title.length > 0, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, tiles, L, plan, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

function VO06ImageGridBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, tiles, L, plan, imageUrl, bg, debug } = prepareVO06(props, durationInFrames);
  const w = plan.windows;
  const F = VO06_SPEC.lists.images.fields.label;
  const accent = style.colors.accent;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const t = frame / Math.max(1, durationInFrames);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion="static" entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.title.length > 0 && w.title && <AnimatedText lines={L.title} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={800} lineHeight={1.05} shadow={bg === 'theme' ? 'none' : FOOTAGE_SHADOW} group="title" input="title" />}
          {tiles.map((tl, i) => {
            const b = L.boxes[i];
            const tw = w[`tile${i}`];
            const cw = w[`cap${i}`];
            const cap = L.captions[i];
            return (
              <div key={i} {...guide(`tile-${i}`, `images[${i}].image_url`)} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, borderRadius: 18, overflow: 'hidden', background: withAlpha(style.colors.text, 0.08), boxShadow: tl.highlight ? `inset 0 0 0 6px ${accent}` : 'none', ...cardStyle(A('tiles'), progress(frame, tw.start, tw.dur)) }}>
                {tl.image && <Img src={tl.image} style={{ width: '100%', height: '100%', objectFit: 'cover', ...imageMotionStyle(A('image_motion'), t) }} />}
                {tl.highlight && <div style={{ position: 'absolute', inset: 0, borderRadius: 18, boxShadow: `inset 0 0 0 6px ${accent}` }} />}
                {cap && (
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '28px 20px 14px', background: `linear-gradient(0deg, ${withAlpha(style.colors.scrim, 0.85)} 0%, ${withAlpha(style.colors.scrim, 0)} 100%)` }}>
                    <AnimatedText lines={[cap]} anim={A('captions')} start={cw.start} dur={cw.dur} frame={frame} weight={F.weight} lineHeight={F.lineHeight} color="#FFFFFF" shadow={FOOTAGE_SHADOW} group={`caption-${i}`} input={`images[${i}].label`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const VO06ImageGrid = withAutoFit(VO06ImageGridBase);
