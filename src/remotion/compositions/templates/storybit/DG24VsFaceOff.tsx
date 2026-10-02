'use client';

/**
 * DG-24 · VS Face-Off  (animation_type: "dg_vs_faceoff")
 * Two contenders head to head: picture / icon, name and tag on each side, a big VS in the middle, and
 * 2–5 stat rows ("Price · ₹79,900 | ₹1,29,900") where the better side of each row lights up.
 * Real, sourced figures only.
 *
 * Inputs (full list, limits and JSON Schema: DG24VsFaceOff.inputs.json):
 *   title · a { name, sub, image_url, icon } · b { … } · rows[] { label, a, b, winner } · verdict · image_url · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, sides, row 1…5, verdict]
 * winner: "a", "b" or leave out for a tie / no winner.
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from './core/remotionSafe';
import type { TemplateProps } from '../../../types';
import { readImageUrl } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec, type TextSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText, sharedFont, linesAt, type Line, type Measure } from './core/fit';
import { cardStyle, easeOutBack, exitStyle, progress } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { cardColors, fontFor, mutedFor, readStyle, seriesColor, styleVars, withAlpha, readHex } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

const NAME: TextSpec = { label: 'Name', required: true, minChars: 1, maxChars: 24, minWords: 1, maxWords: 4, maxWordChars: 16, maxLines: 1, fontMax: 48, fontMin: 28, weight: 800, lineHeight: 1.15, fills: 'Contender name' };
const SUB: TextSpec = { label: 'Tag', required: false, minChars: 2, maxChars: 30, minWords: 1, maxWords: 5, maxWordChars: 16, maxLines: 1, fontMax: 26, fontMin: 18, weight: 600, lineHeight: 1.2, fills: 'Small line under the name' };
const ROW_LABEL: TextSpec = { label: 'Row label', required: true, minChars: 2, maxChars: 20, minWords: 1, maxWords: 4, maxWordChars: 14, maxLines: 1, fontMax: 26, fontMin: 18, weight: 700, lineHeight: 1.2, fills: 'What is compared' };
const ROW_VALUE: TextSpec = { label: 'Row value', required: true, minChars: 1, maxChars: 20, minWords: 1, maxWords: 4, maxWordChars: 14, maxLines: 1, fontMax: 40, fontMin: 22, weight: 800, lineHeight: 1.2, fills: 'Value for one side' };

export const DG24_SPEC: TemplateSpec = {
  id: 'DG-24',
  animationType: 'dg_vs_faceoff',
  name: 'VS Face-Off',
  pickWhen: 'Two rivals head to head — phones, companies, players, cities, policies — on a few measures.',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 210, max: 240 },
  text: {
    title: { label: 'Heading', required: false, minChars: 3, maxChars: 44, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 1, fontMax: 52, fontMin: 36, weight: 800, lineHeight: 1.05, fills: 'Heading above the face-off', example: 'Which one wins? (illustrative)' },
    verdict: { label: 'Verdict', required: false, minChars: 5, maxChars: 70, minWords: 2, maxWords: 12, maxWordChars: 18, maxLines: 1, fontMax: 32, fontMin: 22, weight: 700, lineHeight: 1.3, fills: 'One-line verdict at the bottom' },
  },
  lists: {},
  custom: {
    inputs: [
      { path: 'a', type: 'list', required: true, fills: 'Left contender { name, sub, image_url, icon }' },
      { path: 'a.name', type: 'text', required: true, fills: 'Name', limits: '1–24 chars' },
      { path: 'a.sub', type: 'text', required: false, fills: 'Tag line', limits: '2–30 chars' },
      { path: 'a.image_url', type: 'image', required: false, fills: 'Picture (face, product, logo)' },
      { path: 'a.icon', type: 'icon', required: false, fills: 'Icon when there is no picture' },
      { path: 'a.bg_color', type: 'color', required: false, fills: 'Background colour of the left column (to highlight it)', limits: 'hex #RRGGBB' },
      { path: 'b', type: 'list', required: true, fills: 'Right contender — same fields as a (incl. bg_color)' },
      { path: 'rows[]', type: 'list', required: true, fills: 'Measures compared, top to bottom', limits: '2–5 rows' },
      { path: 'rows[].label', type: 'text', required: true, fills: 'What is compared', limits: '2–20 chars' },
      { path: 'rows[].a', type: 'text', required: true, fills: 'Value for the left side', limits: '1–20 chars' },
      { path: 'rows[].b', type: 'text', required: true, fills: 'Value for the right side', limits: '1–20 chars' },
      { path: 'rows[].bg_color', type: 'color', required: false, fills: 'Background colour of this row', limits: 'hex #RRGGBB' },
      { path: 'rows[].winner', type: 'choice', required: false, fills: 'Which side is better on this row', values: ['a', 'b'] },
    ],
    schema: {
      a: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string', minLength: 1, maxLength: 24 }, sub: { type: 'string', minLength: 2, maxLength: 30 }, image_url: { type: 'string', format: 'uri' }, icon: { type: 'string' }, bg_color: { type: 'string', pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$' } } },
      b: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string', minLength: 1, maxLength: 24 }, sub: { type: 'string', minLength: 2, maxLength: 30 }, image_url: { type: 'string', format: 'uri' }, icon: { type: 'string' }, bg_color: { type: 'string', pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$' } } },
      rows: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'object', additionalProperties: false, required: ['label', 'a', 'b'], properties: { label: { type: 'string', minLength: 2, maxLength: 20 }, a: { type: 'string', minLength: 1, maxLength: 20 }, b: { type: 'string', minLength: 1, maxLength: 20 }, winner: { type: 'string', enum: ['a', 'b'] }, bg_color: { type: 'string', pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$' } } } },
    },
    required: ['a', 'b', 'rows'],
  },
  options: { background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' } },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    sides: { label: 'Sides', kind: 'card', target: 'the two contenders', default: 'slide_up' },
    vs: { label: 'VS', kind: 'icon', target: 'VS badge', default: 'pop' },
    rows: { label: 'Rows', kind: 'card', target: 'each stat row', default: 'slide_up' },
    verdict: { label: 'Verdict', kind: 'text', target: 'verdict', default: 'fade_up' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'everything', default: 'fade_up' },
  },
  cues: { description: 'Fixed slots: heading → sides → row 1…5 → verdict.', units: ['heading', 'sides', 'row 1', 'row 2', 'row 3', 'row 4', 'row 5', 'verdict'] },
  colors: ['icon', 'icon_bg', 'card', 'card_border', 'series_2'],
  example: {
    title: 'Which one wins? (illustrative)',
    a: { name: 'Phone A', sub: 'Flagship', icon: 'smartphone' },
    b: { name: 'Phone B', sub: 'Mid-range', icon: 'smartphone' },
    rows: [
      { label: 'Price', a: '₹79,900', b: '₹29,999', winner: 'b' },
      { label: 'Camera', a: '48 MP', b: '50 MP', winner: 'b' },
      { label: 'Battery', a: '3,300 mAh', b: '5,000 mAh', winner: 'b' },
      { label: 'Updates', a: '6 years', b: '3 years', winner: 'a' },
    ],
    verdict: 'Phone B wins on value (illustrative)',
    background: 'theme',
  },
};

type Side = { name: string; sub: string; image?: string; icon?: string; bg?: string };
type Row = { label: string; a: string; b: string; winner?: 'a' | 'b'; bg?: string };
export const SIDE_W = 560;
export const MEDIA = 180;
export type VsLayout = { contentW: number; title: Line[]; titleH: number; names: [Line, Line]; subs: [Line | undefined, Line | undefined]; rowLabel: Line[]; rowA: Line[]; rowB: Line[]; rowH: number; rowsTop: number; headerH: number; media: number; verdict?: Line };

export function layoutVs(input: { title: string; a: Side; b: Side; rows: Row[]; verdict: string }, measure: Measure): VsLayout {
  const title = input.title ? fitText(input.title, DG24_SPEC.text.title, SAFE_W, measure, false).lines : [];
  const titleH = title.length ? title[0].size * 1.05 + 24 : 0;
  const verdict = input.verdict ? fitText(input.verdict, DG24_SPEC.text.verdict, SAFE_W, measure, false).lines[0] : undefined;
  const verdictH = verdict ? verdict.size * 1.3 + 24 : 0;
  const n = Math.max(1, input.rows.length);
  const avail = SAFE_H - titleH - verdictH;
  const rowH = Math.min(84, Math.floor((avail * 0.5) / n));
  const media = Math.round(Math.min(MEDIA, avail - n * rowH - 150));
  const nf = sharedFont([input.a.name, input.b.name], NAME, SIDE_W - 20, measure);
  const names: [Line, Line] = [linesAt(input.a.name, nf, NAME, SIDE_W - 20, measure, false)[0], linesAt(input.b.name, nf, NAME, SIDE_W - 20, measure, false)[0]];
  const sf = sharedFont([input.a.sub || ' ', input.b.sub || ' '], SUB, SIDE_W - 20, measure);
  const subs: [Line | undefined, Line | undefined] = [input.a.sub ? linesAt(input.a.sub, sf, SUB, SIDE_W - 20, measure, false)[0] : undefined, input.b.sub ? linesAt(input.b.sub, sf, SUB, SIDE_W - 20, measure, false)[0] : undefined];
  const headerH = media + 16 + nf * 1.15 + (subs[0] || subs[1] ? sf * 1.2 + 4 : 0);
  const lf = sharedFont(input.rows.map((r) => r.label), ROW_LABEL, 360, measure, Math.min(ROW_LABEL.fontMax, Math.round(rowH * 0.34)));
  const vf = sharedFont(input.rows.flatMap((r) => [r.a, r.b]), ROW_VALUE, 440, measure, Math.min(ROW_VALUE.fontMax, Math.round(rowH * 0.5)));
  const rowLabel = input.rows.map((r) => linesAt(r.label, lf, ROW_LABEL, 360, measure, false)[0]);
  const rowA = input.rows.map((r) => linesAt(r.a, vf, ROW_VALUE, 440, measure, false)[0]);
  const rowB = input.rows.map((r) => linesAt(r.b, vf, ROW_VALUE, 440, measure, false)[0]);
  const rowsTop = titleH + headerH + 30;
  // the face-off is only as wide as it needs to be (no empty gap between short values and the middle)
  const valW = Math.max(0, ...rowA.map((l) => measure(l.text, l.size, 800)), ...rowB.map((l) => measure(l.text, l.size, 800))) + 32;
  const sideNeed = Math.max(...names.map((l) => measure(l.text, l.size, 800)), ...subs.map((l) => (l ? measure(l.text, l.size, 600) : 0)), media) + 20;
  const contentW = Math.min(SAFE_W, Math.ceil(Math.max(2 * Math.max(sideNeed, 300) + 200, 2 * (valW + 24 + 40) + 400)));
  return { contentW, title, titleH, names, subs, rowLabel, rowA, rowB, rowH, rowsTop, headerH, media, verdict };
}

export function planVs(n: number, hasTitle: boolean, hasVerdict: boolean, duration: number, cueTimes?: number[]): Plan {
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const first = hasTitle ? 16 : 6;
  const gap = n > 1 ? Math.max(6, Math.min(26, Math.floor((budget - first - 30 - (hasVerdict ? 24 : 0)) / (n - 1)))) : 0;
  const units: Unit[] = [];
  if (hasTitle) units.push({ key: 'title', label: 'Heading', start: 2, dur: 14, cue: 0 });
  units.push({ key: 'sides', label: 'Sides', start: first, dur: 16, cue: 1 });
  units.push({ key: 'vs', label: 'VS', start: first + 8, dur: 14, follows: { key: 'sides', offset: 8 } });
  for (let i = 0; i < n; i++) units.push({ key: `row${i}`, label: `Row ${i + 1}`, start: first + 24 + i * gap, dur: 14, cue: 2 + i });
  if (hasVerdict) units.push({ key: 'verdict', label: 'Verdict', start: first + 24 + (n - 1) * gap + 24, dur: 16, cue: 7 });
  return planTimeline(duration, units, cueTimes);
}

export function prepareDG24(props: Record<string, unknown>, durationInFrames: number) {
  const A = (k: string) => readAnim(props, DG24_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DG24_SPEC, props);
  const measure = measureFor(style);
  const side = (v: unknown): Side => {
    const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    return { name: normaliseText(typeof o.name === 'string' ? o.name : '', NAME) || '—', sub: normaliseText(typeof o.sub === 'string' ? o.sub : '', SUB), image: typeof o.image_url === 'string' ? o.image_url : undefined, icon: typeof o.icon === 'string' ? o.icon : undefined, bg: readHex(o.bg_color) };
  };
  const a = side(props.a);
  const b = side(props.b);
  const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
  const rows: Row[] = (Array.isArray(props.rows) ? props.rows : [])
    .map((x) => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      return { label: normaliseText(str(o.label), ROW_LABEL), a: normaliseText(str(o.a), ROW_VALUE) || '—', b: normaliseText(str(o.b), ROW_VALUE) || '—', winner: o.winner === 'a' || o.winner === 'b' ? (o.winner as 'a' | 'b') : undefined, bg: readHex(o.bg_color) };
    })
    .filter((r) => r.label)
    .slice(0, 5);
  const L = layoutVs({ title: normaliseText(readFirst(props, ['title']), DG24_SPEC.text.title), a, b, rows, verdict: normaliseText(readFirst(props, ['verdict']), DG24_SPEC.text.verdict) }, measure);
  const plan = planVs(rows.length, L.title.length > 0, Boolean(L.verdict), durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, a, b, rows, L, plan, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

function DG24VsFaceOffBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, a, b, rows, L, plan, imageUrl, bg, debug } = prepareDG24(props, durationInFrames);
  const w = plan.windows;
  const accent = style.colors.accent;
  const colB = seriesColor(style.colors, 1);
  const onFootage = bg !== 'theme';
  const shadow = onFootage ? FOOTAGE_SHADOW : 'none';
  const card = cardColors(style, onFootage);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const sides: [Side, Side] = [a, b];
  const cols = [accent, colB];
  const ox = (SAFE_W - L.contentW) / 2;
  const sideW = Math.min(SIDE_W, L.contentW / 2 - 70);
  const sideX = [ox, ox + L.contentW - sideW];
  const sw = w.sides;
  const vsp = progress(frame, w.vs.start, w.vs.dur);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.title.length > 0 && w.title && <AnimatedText lines={L.title} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={800} lineHeight={1.05} shadow={shadow} align="center" group="title" input="title" style={{ position: 'absolute', left: 0, width: SAFE_W, top: 0 }} />}
          {sides.map((s, i) => (
            <div key={i} style={{ position: 'absolute', left: sideX[i], top: L.titleH, width: sideW, height: L.headerH, display: 'flex', flexDirection: 'column', alignItems: 'center', background: s.bg, borderRadius: s.bg ? 24 : undefined, ...cardStyle(A('sides'), progress(frame, sw.start + i * 4, sw.dur)) }}>
              <div {...leaf(`media-${i}`, i ? 'b.image_url / icon' : 'a.image_url / icon')} style={{ width: L.media, height: L.media, borderRadius: '50%', overflow: 'hidden', border: `6px solid ${cols[i]}`, boxSizing: 'border-box', background: style.colors.icon_bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.image ? <Img src={s.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <LucideIconView name={s.icon ?? 'user'} size={Math.round(L.media * 0.45)} color={cols[i]} />}
              </div>
              <span {...leaf(`name-${i}`, i ? 'b.name' : 'a.name')} style={{ marginTop: 16, fontFamily: fontFor(800), fontWeight: 800, fontSize: L.names[i].size, lineHeight: 1.15, color: style.colors.text, whiteSpace: 'nowrap', textShadow: shadow }}>{L.names[i].text}</span>
              {L.subs[i] && <span {...leaf(`sub-${i}`, i ? 'b.sub' : 'a.sub')} style={{ marginTop: 4, fontFamily: fontFor(600), fontWeight: 600, fontSize: L.subs[i]!.size, lineHeight: 1.2, color: mutedFor(style, onFootage), whiteSpace: 'nowrap' }}>{L.subs[i]!.text}</span>}
            </div>
          ))}
          <div {...leaf('vs', 'VS')} style={{ position: 'absolute', left: SAFE_W / 2 - 64, top: L.titleH + L.media / 2 - 64, width: 128, height: 128, borderRadius: '50%', background: `linear-gradient(135deg, ${accent} 0%, ${colB} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${A('vs') === 'none' ? (vsp > 0 ? 1 : 0) : Math.max(0, easeOutBack(vsp))}) rotate(${(1 - Math.min(1, vsp)) * -30}deg)` }}>
            <span style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: 52, lineHeight: 1, color: '#FFFFFF', letterSpacing: '-0.04em' }}>VS</span>
          </div>
          {rows.map((r, i) => {
            const rw = w[`row${i}`];
            const top = L.rowsTop + i * L.rowH;
            const cellW = (L.contentW - 400) / 2;
            const winStyle = (side: 'a' | 'b') => (r.winner === side ? { background: withAlpha(side === 'a' ? accent : colB, 0.18), border: `2px solid ${side === 'a' ? accent : colB}` } : { background: 'transparent', border: '2px solid transparent' });
            return (
              <div key={i} style={{ position: 'absolute', left: ox, top, width: L.contentW, height: L.rowH - 8, display: 'flex', alignItems: 'center', ...cardStyle(A('rows'), progress(frame, rw.start, rw.dur)) }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: 14, background: r.bg ?? (i % 2 ? 'transparent' : card.fill) }} />
                <div style={{ position: 'relative', width: cellW, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 24, boxSizing: 'border-box', background: a.bg, borderRadius: a.bg ? 14 : undefined }}>
                  <span {...leaf(`row-${i}-a`, `rows[${i}].a`)} style={{ padding: '4px 16px', borderRadius: 10, fontFamily: fontFor(800), fontWeight: 800, fontSize: L.rowA[i].size, lineHeight: 1.2, color: r.winner === 'a' ? accent : style.colors.text, whiteSpace: 'nowrap', ...winStyle('a') }}>{L.rowA[i].text}</span>
                </div>
                <span {...leaf(`row-${i}-label`, `rows[${i}].label`)} style={{ position: 'relative', width: 400, textAlign: 'center', fontFamily: fontFor(700), fontWeight: 700, fontSize: L.rowLabel[i].size, lineHeight: 1.2, color: mutedFor(style, onFootage), whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{L.rowLabel[i].text}</span>
                <div style={{ position: 'relative', width: cellW, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 24, boxSizing: 'border-box', background: b.bg, borderRadius: b.bg ? 14 : undefined }}>
                  <span {...leaf(`row-${i}-b`, `rows[${i}].b`)} style={{ padding: '4px 16px', borderRadius: 10, fontFamily: fontFor(800), fontWeight: 800, fontSize: L.rowB[i].size, lineHeight: 1.2, color: r.winner === 'b' ? colB : style.colors.text, whiteSpace: 'nowrap', ...winStyle('b') }}>{L.rowB[i].text}</span>
                </div>
              </div>
            );
          })}
          {L.verdict && w.verdict && <AnimatedText lines={[L.verdict]} anim={A('verdict')} start={w.verdict.start} dur={w.verdict.dur} frame={frame} weight={700} lineHeight={1.3} shadow={shadow} align="center" group="verdict" input="verdict" style={{ position: 'absolute', left: 0, width: SAFE_W, bottom: 0 }} />}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const DG24VsFaceOff = withAutoFit(DG24VsFaceOffBase);
