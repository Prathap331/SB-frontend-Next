'use client';

/**
 * MP-11 · Globe Zoom to Location  (animation_type: "mp_globe_zoom")
 * A 3D-style globe spins and zooms to one place — or frames several places and regions at once.
 * Places get pins and labels, regions (countries) are filled; any place or region can carry a
 * picture card. Borders follow India's official view (see core/geo.ts).
 *
 * Inputs (full list, limits and JSON Schema: MP11GlobeZoom.inputs.json):
 *   one place:   location · detail · lat · lon · image_url · highlight_country · zoom
 *   several:     locations[] { label, detail, lat, lon, image_url } · regions[] { name, label, image_url }
 *   start_lon · start_lat · style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [fly, item 1, item 2, …]
 * Items are revealed regions first, then places, in the order given.
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from 'remotion';
import { geoCentroid, geoDistance, geoBounds, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from 'd3-geo';
import type { TemplateProps } from '../../../types';
import { readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { applySizes, normaliseText, readAnim, type Issue, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText, type Line, type Measure } from './core/fit';
import { cardStyle, easeInOutCubic, exitStyle, iconStyle, progress } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { readNumber } from './core/numbers';
import { SafeArea, SAFE_H, SAFE_W, SAFE_MARGIN, FRAME_W, FRAME_H } from './core/safeArea';
import { countries, findCountry, type CountryFeature } from './core/geo';
import { awayFrom, placeNear, type Box } from './core/placement';
import { fontFor, readStyle, seriesColor, styleVars, withAlpha } from './core/style';
import { guide, leaf, readFirst } from './core/shared';

export const MP11_SPEC: TemplateSpec = {
  id: 'MP-11',
  animationType: 'mp_globe_zoom',
  name: 'Globe Zoom to Location',
  pickWhen: 'Introducing where a story happens: fly from the globe into a place — or show several places / countries at once.',
  placement: 'full',
  image: { label: 'Picture (one place)', required: false, fills: 'Picture on the label card of the single place' },
  duration: { min: 90, default: 180, max: 240 },
  numbers: {
    lat: { label: 'Latitude', required: false, fills: 'One place: latitude (north positive). Use locations[] for several.', min: -90, max: 90, example: 25.32 },
    lon: { label: 'Longitude', required: false, fills: 'One place: longitude (east positive)', min: -180, max: 180, example: 82.97 },
    start_lat: { label: 'Start latitude', required: false, fills: 'Where the globe starts facing (default 20° N)', min: -90, max: 90 },
    start_lon: { label: 'Start longitude', required: false, fills: 'Where the globe starts facing (default 100° west of the target)', min: -180, max: 180 },
  },
  text: {
    location: { label: 'Location', required: false, minChars: 2, maxChars: 30, minWords: 1, maxWords: 5, maxWordChars: 18, maxLines: 1, fontMax: 44, fontMin: 26, weight: 800, lineHeight: 1.15, hint: 'One place: its name.', fills: 'Name on the label card', example: 'Varanasi' },
    detail: { label: 'Detail', required: false, minChars: 2, maxChars: 40, minWords: 1, maxWords: 7, maxWordChars: 18, maxLines: 1, fontMax: 26, fontMin: 18, weight: 600, lineHeight: 1.2, hint: '"Uttar Pradesh, India".', fills: 'Line under the name', example: 'Uttar Pradesh, India' },
    highlight_country: { label: 'Highlight country', required: false, minChars: 2, maxChars: 40, minWords: 1, maxWords: 6, maxWordChars: 20, maxLines: 1, fontMax: 20, fontMin: 20, weight: 500, lineHeight: 1, hint: 'Country name in English or ISO code.', fills: 'Country filled in the accent colour (no label)', example: 'India', noSize: true },
  },
  lists: {
    locations: {
      optional: true,
      label: 'Place',
      fills: 'Several places at once (pins + labels), in reveal order',
      minItems: 1,
      maxItems: 5,
      image: { required: false, fills: 'Picture on this place\'s label card' },
      fields: {
        label: { label: 'Label', required: true, minChars: 2, maxChars: 30, minWords: 1, maxWords: 5, maxWordChars: 18, maxLines: 1, fontMax: 34, fontMin: 22, weight: 800, lineHeight: 1.15, fills: 'Place name' },
        detail: { label: 'Detail', required: false, minChars: 2, maxChars: 40, minWords: 1, maxWords: 7, maxWordChars: 18, maxLines: 1, fontMax: 22, fontMin: 16, weight: 600, lineHeight: 1.2, fills: 'Line under the name' },
      },
      numbers: {
        lat: { label: 'Latitude', required: true, fills: 'Latitude (north positive)', min: -90, max: 90 },
        lon: { label: 'Longitude', required: true, fills: 'Longitude (east positive)', min: -180, max: 180 },
      },
    },
    regions: {
      optional: true,
      label: 'Region',
      fills: 'Countries to fill (and label), in reveal order',
      minItems: 1,
      maxItems: 5,
      image: { required: false, fills: 'Picture on this region\'s label card' },
      fields: {
        name: { label: 'Country', required: true, minChars: 2, maxChars: 40, minWords: 1, maxWords: 6, maxWordChars: 20, maxLines: 1, fontMax: 20, fontMin: 20, weight: 500, lineHeight: 1, hint: 'English name or ISO code ("India", "JPN").', fills: 'Which country is filled', noSize: true },
        label: { label: 'Label', required: false, minChars: 2, maxChars: 30, minWords: 1, maxWords: 5, maxWordChars: 18, maxLines: 1, fontMax: 30, fontMin: 20, weight: 800, lineHeight: 1.15, hint: 'Text on the region (omit for no label unless there is a picture).', fills: 'Region label' },
      },
    },
  },
  options: { zoom: { label: 'Zoom', values: ['country', 'region', 'city'], default: 'region', fills: 'One place only: how far it zooms in. With several items the view frames them all.' } },
  animations: {
    regions: { label: 'Regions', kind: 'shape', target: 'country fills', default: 'fade' },
    pins: { label: 'Pins', kind: 'icon', target: 'map pins', default: 'bounce' },
    labels: { label: 'Labels', kind: 'card', target: 'label cards', default: 'pop' },
    exit: { label: 'Exit', kind: 'exit', target: 'pins and labels', default: 'fade' },
  },
  cues: { description: 'fly = globe starts turning; then one cue per item (regions first, then places).', units: ['fly', 'item 1', 'item 2', 'item 3', 'item 4', 'item 5', 'item 6', 'item 7', 'item 8', 'item 9', 'item 10'] },
  colors: ['icon', 'series_2', 'series_3', 'series_4'],
  validate: (props) => {
    const issues: Issue[] = [];
    const names = [props.highlight_country, ...(Array.isArray(props.regions) ? (props.regions as Record<string, unknown>[]).map((r) => r?.name) : [])].filter((x): x is string => typeof x === 'string' && x.trim() !== '');
    for (const n of names) if (!findCountry(n)) issues.push({ field: 'regions', level: 'warning', message: `Country "${n}" not found — use its English name or ISO code` });
    const single = readNumber(props.lat) !== undefined && readNumber(props.lon) !== undefined;
    if (!single && !(Array.isArray(props.locations) && props.locations.length) && !names.length) issues.push({ field: 'locations', level: 'error', message: 'Give lat/lon for one place, or locations[] / regions[]' });
    return issues;
  },
  example: { location: 'Varanasi', detail: 'Uttar Pradesh, India', lat: 25.32, lon: 82.97, highlight_country: 'India', zoom: 'region' },
};

export const ZOOM = { country: 3.2, region: 7, city: 16 } as const;
export const GLOBE_R = 400;
export const IMG_W = 280;
export const IMG_H = 158;

type Place = { label: string; detail: string; lat: number; lon: number; image?: string };
type Region = { f: CountryFeature; label: string; image?: string };
type Card = { title?: Line; detail?: Line; image?: string; w: number; h: number };
export type GlobeItem = { kind: 'region' | 'place'; card: Card | null; lonlat: [number, number]; region?: CountryFeature; color: string; label: string; hidden?: boolean };

function makeCard(title: string, detail: string, image: string | undefined, measure: Measure, spec: TemplateSpec, big: boolean): Card | null {
  if (!title && !image) return null;
  const F = spec.lists.locations.fields;
  const T = big ? spec.text.location : F.label;
  const D = big ? spec.text.detail : F.detail;
  const t = title ? fitText(title, T, 520, measure, false).lines[0] : undefined;
  const d = detail ? fitText(detail, D, 520, measure, false).lines[0] : undefined;
  const textW = Math.max(t ? measure(t.text, t.size, 800) : 0, d ? measure(d.text, d.size, 600) : 0);
  const w = Math.ceil(Math.max(textW + 40, image ? IMG_W + 20 : 0));
  const h = Math.ceil((image ? IMG_H + (t || d ? 10 : 0) : 0) + 20 + (t ? t.size * 1.15 : 0) + (d ? d.size * 1.2 + 2 : 0));
  return { title: t, detail: d, image, w, h };
}

export function planGlobe(n: number, duration: number, cueTimes?: number[]): Plan {
  const fly = Math.min(Math.round(duration * 0.4), 66);
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const first = 2 + fly + 2;
  const gap = n > 1 ? Math.max(6, Math.min(24, Math.floor((budget - first - 16) / (n - 1)))) : 0;
  const units: Unit[] = [{ key: 'fly', label: 'Fly + zoom', start: 2, dur: fly, cue: 0 }];
  for (let i = 0; i < n; i++) units.push({ key: `item${i}`, label: `Item ${i + 1}`, start: first + i * gap, dur: 16, cue: i + 1 });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareMP11(props: Record<string, unknown>, durationInFrames: number) {
  const S = MP11_SPEC.text;
  const LF = MP11_SPEC.lists.locations.fields;
  const RF = MP11_SPEC.lists.regions.fields;
  const A = (k: string) => readAnim(props, MP11_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(MP11_SPEC, props);
  const measure = measureFor(style);
  const s = (o: Record<string, unknown>, k: string) => (typeof o[k] === 'string' && (o[k] as string).trim() ? (o[k] as string) : undefined);

  // places: locations[] or the single-place props
  let places: Place[] = (Array.isArray(props.locations) ? props.locations : [])
    .map((x): Place | null => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const lat = readNumber(o.lat);
      const lon = readNumber(o.lon);
      const label = normaliseText(s(o, 'label'), LF.label);
      return lat !== undefined && lon !== undefined && label ? { label, detail: normaliseText(s(o, 'detail'), LF.detail), lat: Math.max(-85, Math.min(85, lat)), lon, image: s(o, 'image_url') } : null;
    })
    .filter((p): p is Place => p !== null)
    .slice(0, 5);
  const single = !places.length;
  if (single && readNumber(props.lat) !== undefined && readNumber(props.lon) !== undefined) {
    places = [{ label: normaliseText(readFirst(props, ['location', 'title']), S.location), detail: normaliseText(readFirst(props, ['detail']), S.detail), lat: Math.max(-85, Math.min(85, readNumber(props.lat)!)), lon: readNumber(props.lon)!, image: readFirst(props, ['image_url']) }];
  }
  const regions: Region[] = [];
  const hc = findCountry(readFirst(props, ['highlight_country']));
  if (hc) regions.push({ f: hc, label: '' });
  for (const x of Array.isArray(props.regions) ? props.regions : []) {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const f = findCountry(s(o, 'name'));
    if (f && !regions.some((r) => r.f === f)) regions.push({ f, label: normaliseText(s(o, 'label'), RF.label), image: s(o, 'image_url') });
  }
  regions.splice(5);

  const items: GlobeItem[] = [
    ...regions.map((r, i) => ({ kind: 'region' as const, card: makeCard(r.label, '', r.image, measure, sized.spec, false), lonlat: geoCentroid(r.f) as [number, number], region: r.f, color: seriesColor(style.colors, i), label: r.label })),
    ...places.map((p) => ({ kind: 'place' as const, card: makeCard(p.label, p.detail, p.image, measure, sized.spec, single && places.length === 1), lonlat: [p.lon, p.lat] as [number, number], color: style.colors.accent, label: p.label, detail: p.detail, image: p.image })),
  ];

  // target view: centre of everything, zoomed so all of it fits in the middle of the frame
  // regions only steer the framing when they carry a label / picture, or when there are no places
  const frameRegions = places.length ? regions.filter((r) => r.label || r.image) : regions;
  const pts: [number, number][] = [...places.map((p) => [p.lon, p.lat] as [number, number])];
  for (const r of frameRegions) {
    const [[x0, y0], [x1, y1]] = geoBounds(r.f);
    pts.push([x0, y0], [x1, y1], [x0, y1], [x1, y0], geoCentroid(r.f) as [number, number]);
  }
  const center = (pts.length ? geoCentroid({ type: 'MultiPoint', coordinates: pts }) : [78, 22]) as [number, number];
  const theta = Math.max(0, ...pts.map((p) => geoDistance(center, p)));
  const zoomOpt = ZOOM[opt(props, 'zoom', ['country', 'region', 'city'] as const, 'region')];
  const zoom = places.length === 1 && !frameRegions.length ? zoomOpt : Math.max(0.7, Math.min(16, 300 / (GLOBE_R * Math.sin(Math.min(theta, 1.35)) + 1e-6)));
  const startLat = readNumber(props.start_lat) ?? 20;
  const startLon = readNumber(props.start_lon) ?? center[0] - 100;
  const plan = planGlobe(items.length, durationInFrames, readCues(props));

  // label cards placed on the final view, clear of every pin and of each other
  const proj = geoOrthographic().rotate([-center[0], -center[1]]).scale(GLOBE_R * zoom).translate([FRAME_W / 2, FRAME_H / 2]).clipAngle(90);
  const anchors = items.map((it) => {
    const p = proj(it.lonlat) ?? [FRAME_W / 2, FRAME_H / 2];
    return { x: p[0] - SAFE_MARGIN, y: p[1] - SAFE_MARGIN };
  });
  // places closer than a pin's width share one pin and one card ("Delhi · Noida")
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind !== 'place' || items[i].hidden) continue;
    const group = [i];
    for (let j = i + 1; j < items.length; j++) {
      if (items[j].kind === 'place' && !items[j].hidden && Math.abs(anchors[i].x - anchors[j].x) < 64 && Math.abs(anchors[i].y - anchors[j].y) < 68) {
        items[j].hidden = true;
        group.push(j);
      }
    }
    if (group.length > 1) {
      const it = items[i] as GlobeItem & { image?: string };
      it.card = makeCard(group.map((g) => items[g].label).join(' · '), '', it.image, measure, sized.spec, false);
    }
  }
  const obstacles: Box[] = items.map((it, i) => (it.kind === 'place' && !it.hidden ? { x: anchors[i].x - 28, y: anchors[i].y - 58, w: 56, h: 60 } : { x: anchors[i].x - 4, y: anchors[i].y - 4, w: 8, h: 8 }));
  const bounds = { x: 0, y: 0, w: SAFE_W, h: SAFE_H };
  const boxes = items.map((it, i) => {
    if (!it.card || it.hidden) return null;
    const prefer = awayFrom(anchors[i], anchors.filter((_, j) => !items[j].hidden));
    let b: Box | null = placeNear({ x: anchors[i].x, y: anchors[i].y - (it.kind === 'place' ? 28 : 0) }, it.card.w, it.card.h, obstacles, bounds, undefined, prefer);
    if (!b && it.card.image) {
      // no room with the picture: try the text-only card
      it.card = it.card.title ? { ...it.card, image: undefined, h: it.card.h - IMG_H - 10 } : null;
      b = it.card && placeNear({ x: anchors[i].x, y: anchors[i].y - 28 }, it.card.w, it.card.h, obstacles, bounds, undefined, prefer);
    }
    if (b) obstacles.push(b);
    return b ? { dx: b.x - anchors[i].x, dy: b.y - anchors[i].y, w: b.w, h: b.h } : null;
  });
  return { style, sized, A, items, boxes, plan, center, zoom, startLat, startLon, debug: props.show_safe_area === true };
}

const graticule = geoGraticule10();

export function MP11GlobeZoom({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, items, boxes, plan, center, zoom, startLat, startLon, debug } = prepareMP11(props, durationInFrames);
  const w = plan.windows;
  const accent = style.colors.accent;
  const fp = easeInOutCubic(progress(frame, w.fly.start, w.fly.dur));
  const c = geoInterpolate([startLon, startLat], center)(Math.min(1, fp * 1.35));
  const k = Math.exp(Math.log(zoom) * Math.max(0, (fp - 0.3) / 0.7));
  const projection = geoOrthographic().rotate([-c[0], -c[1]]).scale(GLOBE_R * k).translate([FRAME_W / 2, FRAME_H / 2]).clipAngle(90).precision(0.4);
  const path = geoPath(projection);
  const land = withAlpha(style.colors.text, 0.2);
  const border = withAlpha(style.colors.background_2, 0.9);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const regionFill = new Map<CountryFeature, { color: string; p: number }>();
  items.forEach((it, i) => {
    if (it.region) {
      const iw = w[`item${i}`];
      const p = A('regions') === 'none' ? (frame >= iw.start ? 1 : 0) : progress(frame, iw.start, iw.dur);
      regionFill.set(it.region, { color: it.color, p });
    }
  });
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: `radial-gradient(90% 90% at 50% 50%, ${style.colors.background} 0%, ${style.colors.background_2} 100%)`, ...styleVars(style) }}>
      <svg width={FRAME_W} height={FRAME_H} style={{ position: 'absolute', inset: 0 }}>
        <path d={path({ type: 'Sphere' }) ?? ''} fill={withAlpha(style.colors.background_2, 0.9)} stroke={withAlpha(accent, 0.35)} strokeWidth={2} />
        <path d={path(graticule) ?? ''} fill="none" stroke={withAlpha(style.colors.text, 0.07)} strokeWidth={1} />
        {countries().map((f, i) => (
          <path key={i} d={path(f) ?? ''} fill={land} stroke={border} strokeWidth={0.8} />
        ))}
        {countries().map((f, i) => {
          const r = regionFill.get(f);
          return r && r.p > 0 ? <path key={`r${i}`} d={path(f) ?? ''} fill={withAlpha(r.color, 0.75 * r.p)} stroke={withAlpha(r.color, r.p)} strokeWidth={2} /> : null;
        })}
      </svg>
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {/* thin leader lines tie every card to its own pin / region */}
          <svg {...guide('leaders', 'card → pin')} width={SAFE_W} height={SAFE_H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
            {items.map((it, i) => {
              const box = boxes[i];
              const pp = projection(it.lonlat);
              if (!box || !pp || it.hidden) return null;
              const x = pp[0] - SAFE_MARGIN;
              const y = pp[1] - SAFE_MARGIN - (it.kind === 'place' ? 34 : 0);
              const bx = Math.max(x + box.dx, Math.min(x + box.dx + box.w, x));
              const by = Math.max(y + box.dy, Math.min(y + box.dy + box.h, y));
              const iw = w[`item${i}`];
              return <line key={i} x1={x} y1={y} x2={bx} y2={by} stroke={withAlpha(style.colors.text, 0.85)} strokeWidth={3} strokeLinecap="round" opacity={progress(frame, iw.start + 4, iw.dur)} />;
            })}
          </svg>
          {items.map((it, i) => {
            const iw = w[`item${i}`];
            const pp = projection(it.lonlat);
            if (!pp || it.hidden) return null;
            const x = pp[0] - SAFE_MARGIN;
            const y = pp[1] - SAFE_MARGIN;
            const box = boxes[i];
            const card = it.card;
            return (
              <div key={i}>
                {it.kind === 'place' && (
                  <div {...leaf(`pin-${i}`, 'lat / lon')} style={{ position: 'absolute', left: x - 28, top: y - 56, width: 56, height: 56, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', filter: `drop-shadow(0 2px 3px ${withAlpha('#000000', 0.6)})`, ...iconStyle(A('pins'), progress(frame, iw.start, iw.dur)) }}>
                    {/* light pin so it stands out on filled (accent) regions as well as on plain land */}
                    <LucideIconView name="map-pin" size={56} color={style.custom.has('icon') ? style.colors.icon : style.colors.text} />
                  </div>
                )}
                {card && box && (
                  <div
                    {...leaf(`card-${i}`, it.kind === 'place' ? 'label / detail / image_url' : 'regions[].label / image_url')}
                    style={{ position: 'absolute', left: x + box.dx, top: y + box.dy, width: box.w, height: box.h, boxSizing: 'border-box', padding: 10, borderRadius: 16, background: withAlpha(style.colors.scrim, 0.86), borderTop: `5px solid ${it.color}`, display: 'flex', flexDirection: 'column', gap: 6, ...cardStyle(A('labels'), progress(frame, iw.start + 4, iw.dur)) }}
                  >
                    {card.image && (
                      <div style={{ width: '100%', height: IMG_H, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                        <Img src={card.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div style={{ padding: '0 10px' }}>
                      {card.title && <div style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: card.title.size, lineHeight: 1.15, color: style.colors.text, whiteSpace: 'nowrap' }}>{card.title.text}</div>}
                      {card.detail && <div style={{ fontFamily: fontFor(600), fontWeight: 600, fontSize: card.detail.size, lineHeight: 1.2, color: style.custom.has('muted') ? style.colors.muted : '#E8EAF6', whiteSpace: 'nowrap' }}>{card.detail.text}</div>}
                    </div>
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
