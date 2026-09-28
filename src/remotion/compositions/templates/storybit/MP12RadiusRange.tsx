'use client';

/**
 * MP-12 · Radius / Range  (animation_type: "mp_radius_range")
 * 1–3 true-distance rings around a place on a map: missile range, delivery radius, how far a
 * city's water travels, an earthquake's reach. Rings grow out from the centre and get labels.
 * Map data: Natural Earth 50m (see core/geo.ts for India's boundary).
 *
 * Inputs (full list, limits and JSON Schema: MP12RadiusRange.inputs.json):
 *   center_label (required) · lat · lon · rings[] { radius_km, label } · title · highlight_country · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [centre, ring 1, ring 2, ring 3]
 * Timing: 3–8s from clock.durationInFrames.
 */
import { geoCircle, geoEquirectangular, geoGraticule10, geoMercator, geoPath } from 'd3-geo';
import type { TemplateProps } from '../../../types';
import { applySizes, normaliseText, readAnim, type Issue, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText, words, type Line, type Measure } from './core/fit';
import { cardStyle, easeInOutCubic, exitStyle, iconStyle, progress, textAnimFrames } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { readNumber } from './core/numbers';
import { SafeArea, SAFE_H, SAFE_W, SAFE_MARGIN, FRAME_W, FRAME_H } from './core/safeArea';
import { KM_PER_DEG, countries, findCountry } from './core/geo';
import { fontFor, readStyle, seriesColor, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, leaf, readFirst } from './core/shared';

export const MP12_SPEC: TemplateSpec = {
  id: 'MP-12',
  animationType: 'mp_radius_range',
  name: 'Radius / Range',
  pickWhen: 'Showing how far something reaches from a place: missile range, delivery radius, flight range, impact zone.',
  placement: 'full',
  duration: { min: 90, default: 180, max: 240 },
  numbers: {
    lat: { label: 'Latitude', required: true, fills: 'Latitude of the centre (north positive)', min: -85, max: 85, example: 28.61 },
    lon: { label: 'Longitude', required: true, fills: 'Longitude of the centre (east positive)', min: -180, max: 180, example: 77.21 },
  },
  text: {
    title: { label: 'Heading', required: false, minChars: 3, maxChars: 44, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 1, fontMax: 52, fontMin: 36, weight: 800, lineHeight: 1.05, fills: 'Heading in the top-left corner', example: 'How far can it reach? (illustrative)' },
    center_label: { label: 'Centre label', required: true, minChars: 2, maxChars: 28, minWords: 1, maxWords: 5, maxWordChars: 18, maxLines: 1, fontMax: 34, fontMin: 22, weight: 800, lineHeight: 1.2, hint: '"New Delhi".', fills: 'Label at the centre point', example: 'New Delhi' },
    highlight_country: { label: 'Highlight country', required: false, minChars: 2, maxChars: 40, minWords: 1, maxWords: 6, maxWordChars: 20, maxLines: 1, fontMax: 20, fontMin: 20, weight: 500, lineHeight: 1, hint: 'Country name in English.', fills: 'Country filled in a soft accent', noSize: true },
  },
  lists: {
    rings: {
      label: 'Ring',
      fills: 'Distance rings, smallest first',
      minItems: 1,
      maxItems: 3,
      fields: { label: { label: 'Label', required: false, minChars: 2, maxChars: 26, minWords: 1, maxWords: 5, maxWordChars: 16, maxLines: 1, fontMax: 26, fontMin: 18, weight: 700, lineHeight: 1.2, hint: 'Default "<radius> km". E.g. "Agni-I · 700 km".', fills: 'Label on the ring' } },
      numbers: { radius_km: { label: 'Radius (km)', required: true, fills: 'Real distance from the centre in kilometres', min: 1, max: 15000 } },
    },
  },
  options: {},
  animations: {
    map: { label: 'Map', kind: 'image_entry', target: 'the map (first frames)', default: 'fade' },
    center: { label: 'Centre pin', kind: 'icon', target: 'centre point and its label', default: 'pop' },
    rings: { label: 'Rings', kind: 'shape', target: 'each ring (grows outwards)', default: 'grow' },
    ring_labels: { label: 'Ring labels', kind: 'card', target: 'label on each ring', default: 'pop' },
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'pins, rings and labels', default: 'fade' },
  },
  cues: { description: 'centre → ring 1 → ring 2 → ring 3 (when each distance is mentioned).', units: ['centre', 'ring 1', 'ring 2', 'ring 3'] },
  colors: ['series_2', 'series_3'],
  validate: (props) => {
    const issues: Issue[] = [];
    const c = typeof props.highlight_country === 'string' ? props.highlight_country : '';
    if (c && !findCountry(c)) issues.push({ field: 'highlight_country', level: 'warning', message: `Country "${c}" not found — use its English name` });
    return issues;
  },
  example: { title: 'How far can it reach? (illustrative)', center_label: 'New Delhi', lat: 28.61, lon: 77.21, rings: [{ radius_km: 700 }, { radius_km: 2000 }, { radius_km: 3500 }], highlight_country: 'India' },
};

export type Ring = { km: number; label: string };
export type RangeLayout = { title: Line[]; center: Line; centerW: number; ringLabels: Line[]; ringW: number[] };
export function layoutRange(input: { title: string; center: string; rings: Ring[] }, measure: Measure, spec: TemplateSpec = MP12_SPEC): RangeLayout {
  const T = spec.text;
  const F = spec.lists.rings.fields.label;
  const center = fitText(input.center, T.center_label, 520, measure, false).lines[0];
  const ringLabels = input.rings.map((r) => fitText(r.label, F, 420, measure, false).lines[0]);
  return {
    title: input.title ? fitText(input.title, T.title, 900, measure, false).lines : [],
    center,
    centerW: Math.ceil(measure(center.text, center.size, 800)) + 32,
    ringLabels,
    ringW: ringLabels.map((l) => Math.ceil(measure(l.text, l.size, F.weight)) + 28),
  };
}
export function planRange(L: RangeLayout, n: number, duration: number, cueTimes?: number[]): Plan {
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const gap = n > 1 ? Math.max(10, Math.min(36, Math.floor((budget - 30 - 30) / (n - 1)))) : 0;
  const units: Unit[] = [{ key: 'center', label: 'Centre', start: 10, dur: 14, cue: 0 }];
  for (let i = 0; i < n; i++) {
    units.push({ key: `ring${i}`, label: `Ring ${i + 1}`, start: 30 + i * gap, dur: 24, cue: i + 1 });
    units.push({ key: `ring${i}_label`, label: `Ring ${i + 1} label`, start: 30 + i * gap + 16, dur: 12, follows: { key: `ring${i}`, offset: 16 } });
  }
  if (L.title.length) units.push({ key: 'title', label: 'Heading', start: 4, dur: textAnimFrames('fade', words(L.title[0].text).length, L.title[0].text.length, 14), follows: { key: 'center', offset: -6 } });
  return planTimeline(duration, units, cueTimes);
}

export function prepareMP12(props: Record<string, unknown>, durationInFrames: number) {
  const S = MP12_SPEC.text;
  const RS = MP12_SPEC.lists.rings;
  const A = (k: string) => readAnim(props, MP12_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(MP12_SPEC, props);
  const lat = Math.max(-85, Math.min(85, readNumber(props.lat) ?? 20));
  const lon = readNumber(props.lon) ?? 78;
  const rings: Ring[] = (Array.isArray(props.rings) ? props.rings : [])
    .map((r) => {
      const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
      const km = readNumber(o.radius_km);
      if (km === undefined || km <= 0) return null;
      const k = Math.min(15000, km);
      return { km: k, label: normaliseText(typeof o.label === 'string' ? o.label : '', RS.fields.label) || `${k.toLocaleString('en-IN')} km` };
    })
    .filter((r): r is Ring => r !== null)
    .sort((a, b) => a.km - b.km)
    .slice(0, 3);
  const L = layoutRange({ title: normaliseText(readFirst(props, ['title']), S.title), center: normaliseText(readFirst(props, ['center_label', 'location']), S.center_label) || '•', rings }, measureFor(style), sized.spec);
  const plan = planRange(L, rings.length, durationInFrames, readCues(props));
  return { style, sized, A, L, plan, lat, lon, rings, country: findCountry(readFirst(props, ['highlight_country'])), debug: props.show_safe_area === true };
}

const graticule = geoGraticule10();
type Box = { x: number; y: number; w: number; h: number };
const hit = (a: Box, b: Box) => a.x < b.x + b.w + 8 && a.x + a.w + 8 > b.x && a.y < b.y + b.h + 8 && a.y + a.h + 8 > b.y;

export function MP12RadiusRange({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, lat, lon, rings, country, debug } = prepareMP12(props, durationInFrames);
  const w = plan.windows;
  const S = MP12_SPEC.text;
  const RF = MP12_SPEC.lists.rings.fields.label;
  const accent = style.colors.accent;
  const maxKm = rings.length ? rings[rings.length - 1].km : 500;
  // fit the biggest ring inside the safe box (with room for its label), in frame coordinates
  const outer = geoCircle().center([lon, lat]).radius(maxKm / KM_PER_DEG)();
  const titleH = L.title.length ? L.title[0].size * 1.05 + 30 : 0;
  // Mercator breaks near the poles: rings that reach past 75° use an equirectangular map instead
  const maxDeg = maxKm / KM_PER_DEG;
  const nearPole = Math.abs(lat) + maxDeg > 75;
  const projection = (nearPole ? geoEquirectangular() : geoMercator()).fitExtent([[SAFE_MARGIN + 60, SAFE_MARGIN + 60 + titleH], [FRAME_W - SAFE_MARGIN - 60, FRAME_H - SAFE_MARGIN - 60]], outer);
  const path = geoPath(projection);
  const [pxF, pyF] = projection([lon, lat]) ?? [FRAME_W / 2, FRAME_H / 2];
  const px = pxF - SAFE_MARGIN;
  const py = pyF - SAFE_MARGIN;
  const mapIn = progress(frame, 0, 14);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));

  // label boxes: centre label to the right of the pin; ring labels at the ring's north point (or south / east / west if taken)
  const placed: Box[] = [{ x: px - 16, y: py - 16, w: 32, h: 32 }];
  const cw = L.centerW;
  const ch = L.center.size * 1.2 + 16;
  // right of the pin, else left, else below, else above — never on top of the pin
  const cy0 = Math.max(titleH, Math.min(SAFE_H - ch, py - ch / 2));
  const cx0 = Math.max(0, Math.min(SAFE_W - cw, px - cw / 2));
  const centerBox =
    [
      { x: px + 26, y: cy0, w: cw, h: ch },
      { x: px - 26 - cw, y: cy0, w: cw, h: ch },
      { x: cx0, y: py + 26, w: cw, h: ch },
      { x: cx0, y: py - 26 - ch, w: cw, h: ch },
    ].find((b) => b.x >= 0 && b.x + b.w <= SAFE_W && b.y >= titleH && b.y + b.h <= SAFE_H) ?? { x: cx0, y: py + 26, w: cw, h: ch };
  placed.push(centerBox);
  const ringBoxes = rings.map((r, i) => {
    const l = L.ringLabels[i];
    const bw = L.ringW[i];
    const bh = l.size * 1.2 + 12;
    const deg = r.km / KM_PER_DEG;
    const cands: [number, number][] = [
      [lon, Math.min(89, lat + deg)],
      [lon, Math.max(-89, lat - deg)],
      [lon + deg / Math.cos((lat * Math.PI) / 180), lat],
      [lon - deg / Math.cos((lat * Math.PI) / 180), lat],
    ];
    for (const c of cands) {
      const p = projection(c);
      if (!p) continue;
      const b = { x: p[0] - SAFE_MARGIN - bw / 2, y: p[1] - SAFE_MARGIN - bh / 2, w: bw, h: bh };
      b.x = Math.max(0, Math.min(SAFE_W - bw, b.x));
      b.y = Math.max(titleH, Math.min(SAFE_H - bh, b.y));
      if (!placed.some((q) => hit(b, q))) {
        placed.push(b);
        return b;
      }
    }
    return null; // no free spot: the ring is drawn without its label rather than overlapping
  });

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: `radial-gradient(120% 90% at 30% 25%, ${style.colors.background} 0%, ${style.colors.background_2} 100%)`, ...styleVars(style) }}>
      <svg width={FRAME_W} height={FRAME_H} style={{ position: 'absolute', inset: 0, opacity: A('map') === 'cut' ? 1 : mapIn }}>
        <path d={path(graticule) ?? ''} fill="none" stroke={withAlpha(style.colors.text, 0.06)} strokeWidth={1} />
        {countries().map((f, i) => (
          <path key={i} d={path(f) ?? ''} fill={country && f === country ? withAlpha(accent, 0.28) : withAlpha(style.colors.text, 0.14)} stroke={withAlpha(style.colors.background_2, 0.95)} strokeWidth={1} />
        ))}
        {rings.map((r, i) => {
          const rw = w[`ring${i}`];
          const p = easeInOutCubic(progress(frame, rw.start, rw.dur));
          if (p <= 0) return null;
          const c = seriesColor(style.colors, i);
          const circle = geoCircle().center([lon, lat]).radius(Math.max(0.01, (r.km / KM_PER_DEG) * (A('rings') === 'grow' ? p : 1)))();
          return <path key={i} d={path(circle) ?? ''} fill={withAlpha(c, 0.1)} stroke={c} strokeWidth={4} strokeDasharray={i === rings.length - 1 ? undefined : '14 10'} opacity={A('rings') === 'grow' ? 1 : p} />;
        })}
      </svg>
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.title.length > 0 && w.title && <AnimatedText lines={L.title} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={800} lineHeight={S.title.lineHeight} shadow={FOOTAGE_SHADOW} group="title" input="title" />}
          <div {...leaf('pin', 'lat / lon')} style={{ position: 'absolute', left: px - 12, top: py - 12, width: 24, height: 24, borderRadius: '50%', background: accent, border: `4px solid ${style.colors.text}`, boxSizing: 'border-box', ...iconStyle(A('center'), progress(frame, w.center.start, w.center.dur)) }} />
          <div {...leaf('center-label', 'center_label')} style={{ position: 'absolute', left: centerBox.x, top: centerBox.y, width: centerBox.w, height: centerBox.h, boxSizing: 'border-box', borderRadius: 12, background: withAlpha(style.colors.scrim, 0.8), display: 'flex', alignItems: 'center', justifyContent: 'center', ...cardStyle(A('center') === 'none' ? 'none' : 'fade', progress(frame, w.center.start + 4, 12)) }}>
            <span style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: L.center.size, lineHeight: 1.2, color: style.colors.text, whiteSpace: 'nowrap' }}>{L.center.text}</span>
          </div>
          {rings.map((r, i) => {
            const b = ringBoxes[i];
            if (!b) return null;
            const lw = w[`ring${i}_label`];
            const l = L.ringLabels[i];
            return (
              <div key={i} {...leaf(`ring-${i}-label`, `rings[${i}].label`)} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, boxSizing: 'border-box', borderRadius: 999, background: seriesColor(style.colors, i), display: 'flex', alignItems: 'center', justifyContent: 'center', ...cardStyle(A('ring_labels'), progress(frame, lw.start, lw.dur)) }}>
                <span style={{ fontFamily: fontFor(RF.weight), fontWeight: RF.weight, fontSize: l.size, lineHeight: 1.2, color: style.colors.on_accent, whiteSpace: 'nowrap' }}>{l.text}</span>
              </div>
            );
          })}
        </div>
      </SafeArea>
    </div>
  );
}

