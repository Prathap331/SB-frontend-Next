'use client';

/**
 * MP-13 · Travel Route Map  (animation_type: "mp_travel_route")
 * A world / regional map with 2–5 stops joined in order. Every stop carries everything about itself:
 *   { location, region, lat, lon, route_to_next, details, image_url }
 *   location       (required) city / place name — the stop's label
 *   region         (optional) country or larger region ("India", "Middle East", "Southern Asia", "EU") — filled on the map
 *   lat / lon      coordinates of the location (optional only when region is given: then the region is the stop)
 *   route_to_next  how to reach the next stop: air (dotted arc + plane) · sea (stays on water + ship) · land (stays on land + car)
 *   details        (optional) short line under the label; image_url (optional) picture on the card
 * Stops may repeat (A → B → C → D → C). Borders follow India's official view (core/geo.ts); sea and land
 * routes are found on a land / water grid (core/route.ts).
 * Inputs (full list, limits and JSON Schema: MP13TravelRoute.inputs.json):
 *   title · stops[] · style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, stop 1, leg 1, stop 2, …]
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from './core/remotionSafe';
import { geoBounds, geoCentroid, geoDistance, geoGraticule10, geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo';
import type { TemplateProps } from '../../../types';
import { LucideIconView } from '../../../icons';
import { applySizes, normaliseText, readAnim, type Issue, type TemplateSpec, type TextSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText } from './core/fit';
import { cardStyle, easeInOutCubic, exitStyle, iconStyle, progress } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { readNumber } from './core/numbers';
import { SafeArea, SAFE_H, SAFE_W, SAFE_MARGIN, FRAME_W, FRAME_H } from './core/safeArea';
import { KM_PER_DEG, countries, findRegion, type CountryFeature } from './core/geo';
import { findRoute, nearWater, unwrap } from './core/route';
import { awayFrom, placeNear, type Box } from './core/placement';
import { fontFor, readStyle, seriesColor, styleVars, withAlpha } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, guide, leaf, readFirst } from './core/shared';

const LOCATION: TextSpec = { label: 'Location', required: true, minChars: 2, maxChars: 28, minWords: 1, maxWords: 5, maxWordChars: 18, maxLines: 1, fontMax: 30, fontMin: 20, weight: 800, lineHeight: 1.15, fills: 'Stop label (city / place)' };
const SUBLINE: TextSpec = { label: 'Region · details', required: false, minChars: 2, maxChars: 60, minWords: 1, maxWords: 10, maxWordChars: 20, maxLines: 1, fontMax: 22, fontMin: 16, weight: 600, lineHeight: 1.2, fills: 'Line under the label: region and details' };

export const MP13_SPEC: TemplateSpec = {
  id: 'MP-13',
  animationType: 'mp_travel_route',
  name: 'Travel Route Map',
  pickWhen: 'A journey or trade route across places: a trip, a smuggling route, a supply chain, a historic voyage.',
  placement: 'full',
  duration: { min: 90, default: 210, max: 240 },
  text: {
    title: { label: 'Heading', required: false, minChars: 3, maxChars: 44, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 1, fontMax: 52, fontMin: 36, weight: 800, lineHeight: 1.05, fills: 'Heading in the top-left corner', example: 'A trade route (illustrative)' },
  },
  lists: {},
  sizes: { locations: { label: 'Stop labels', min: 20, max: 30, fills: 'Location names on the cards' } },
  custom: {
    inputs: [
      { path: 'stops[]', type: 'list', required: true, fills: 'Stops in travel order (a stop may repeat: A → B → C → D → C)', limits: '2–5 stops' },
      { path: 'stops[].location', type: 'text', required: true, fills: 'City / place name shown as the stop label', limits: '2–28 chars · 1–5 words' },
      { path: 'stops[].region', type: 'text', required: false, fills: 'Country or larger region (continent, "Middle East", "Southern Asia", "EU", "SAARC"…) — filled on the map and shown under the label', limits: 'English name or ISO-3 code' },
      { path: 'stops[].lat', type: 'number', required: false, fills: 'Latitude of the location (north positive). Needed unless region is given.', limits: '−85 to 85' },
      { path: 'stops[].lon', type: 'number', required: false, fills: 'Longitude of the location (east positive). Needed unless region is given.', limits: '−180 to 180' },
      { path: 'stops[].route_to_next', type: 'choice', required: false, fills: 'How to travel to the next stop: air · sea (stays on water) · land (stays on land). Default: land under 700 km, else air. Ignored on the last stop.', values: ['air', 'sea', 'land'] },
      { path: 'stops[].details', type: 'text', required: false, fills: 'Short line under the label (date, what happened)', limits: '2–36 chars · 1–6 words' },
      { path: 'stops[].image_url', type: 'image', required: false, fills: 'Picture on the stop card' },
    ],
    schema: {
      stops: {
        type: 'array',
        minItems: 2,
        maxItems: 5,
        description: 'Stops in travel order. Each stop holds its own region, location, route to the next stop and details.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['location'],
          properties: {
            location: { type: 'string', minLength: 2, maxLength: 28, description: 'City / place name (stop label).' },
            region: { type: 'string', minLength: 2, maxLength: 40, description: 'Country or larger region, e.g. "India", "Middle East".' },
            lat: { type: 'number', minimum: -85, maximum: 85, description: 'Latitude of the location (needed unless region is given).' },
            lon: { type: 'number', minimum: -180, maximum: 180, description: 'Longitude of the location (needed unless region is given).' },
            route_to_next: { type: 'string', enum: ['air', 'sea', 'land'], description: 'How to reach the next stop.' },
            details: { type: 'string', minLength: 2, maxLength: 36, description: 'Short line under the label.' },
            image_url: { type: 'string', format: 'uri', description: 'Picture on the stop card.' },
          },
        },
      },
    },
    required: ['stops'],
  },
  options: {},
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'fade' },
    pins: { label: 'Stops', kind: 'icon', target: 'stop markers', default: 'pop' },
    labels: { label: 'Stop labels', kind: 'card', target: 'label cards', default: 'pop' },
    paths: { label: 'Paths', kind: 'shape', target: 'travel paths (draw along with the vehicle)', default: 'grow' },
    exit: { label: 'Exit', kind: 'exit', target: 'route, stops and labels', default: 'fade' },
  },
  cues: { description: 'Fixed slots: heading → stop 1 → leg 1 → stop 2 → leg 2 → stop 3 → leg 3 → stop 4 → leg 4 → stop 5. Send null for slots you do not use.', units: ['heading', 'stop 1', 'leg 1', 'stop 2', 'leg 2', 'stop 3', 'leg 3', 'stop 4', 'leg 4', 'stop 5'] },
  colors: ['series_2', 'series_3', 'series_4'],
  validate: (props) => {
    const issues: Issue[] = [];
    const stops = Array.isArray(props.stops) ? (props.stops as Record<string, unknown>[]) : [];
    if (stops.length < 2) issues.push({ field: 'stops', level: 'error', message: 'At least 2 stops are needed' });
    stops.forEach((st, i) => {
      if (!(typeof st?.location === 'string' && st.location.trim())) issues.push({ field: `stops[${i}].location`, level: 'error', message: `Stop ${i + 1}: location is required` });
      const hasXY = typeof st?.lat === 'number' && typeof st?.lon === 'number';
      const reg = typeof st?.region === 'string' ? st.region : '';
      if (reg && !findRegion(reg).length) issues.push({ field: `stops[${i}].region`, level: 'warning', message: `Stop ${i + 1}: region "${reg}" not found — use a country / continent / sub-region name` });
      if (!hasXY && !(reg && findRegion(reg).length)) issues.push({ field: `stops[${i}]`, level: 'error', message: `Stop ${i + 1}: give lat / lon for the location (or a known region)` });
      if (st?.route_to_next !== undefined && !['air', 'sea', 'land'].includes(st.route_to_next as string)) issues.push({ field: `stops[${i}].route_to_next`, level: 'warning', message: `Stop ${i + 1}: route_to_next must be air, sea or land` });
    });
    return issues;
  },
  example: {
    title: 'A trade route (illustrative)',
    stops: [
      { region: 'India', location: 'Kochi', lat: 9.93, lon: 76.26, route_to_next: 'sea', details: 'Spices loaded' },
      { region: 'Oman', location: 'Muscat', lat: 23.59, lon: 58.41, route_to_next: 'land' },
      { region: 'Egypt', location: 'Alexandria', lat: 31.2, lon: 29.92, route_to_next: 'sea' },
      { region: 'Italy', location: 'Venice', lat: 45.44, lon: 12.32, details: 'Sold in Europe' },
    ],
  },
};

type Stop = { label: string; detail: string; lat: number; lon: number; image?: string; area?: CountryFeature[]; regionOnly: boolean };
type Mode = 'air' | 'sea' | 'land';
type Leg = { mode: Mode; vehicle: string };
const IMG_W = 240;
const IMG_H = 135;
const VEHICLE: Record<Mode, string> = { air: 'plane', sea: 'ship', land: 'car' };

function arc(a: [number, number], b: [number, number], bulge: number, n = 60, down = false): [number, number][] {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  // normal pointing "up" the screen so arcs bow like flight paths
  let nx = -dy / len;
  let ny = dx / len;
  if (ny > 0 !== down) {
    nx = -nx;
    ny = -ny;
  }
  const cx = mx + nx * len * bulge;
  const cy = my + ny * len * bulge;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cy + t * t * b[1]] as [number, number];
  });
}
const lengths = (pts: [number, number][]) => {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return acc;
};
function partial(pts: [number, number][], acc: number[], p: number) {
  const target = acc[acc.length - 1] * p;
  const out: [number, number][] = [pts[0]];
  let i = 1;
  for (; i < pts.length && acc[i] <= target; i++) out.push(pts[i]);
  if (i < pts.length) {
    const f = (target - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
    out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]);
  }
  const a = out[Math.max(0, out.length - 2)];
  const b = out[out.length - 1];
  return { out, head: b, angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
}

export function planRoute(nStops: number, hasTitle: boolean, duration: number, cueTimes?: number[]): Plan {
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const legs = nStops - 1;
  const legDur = Math.max(16, Math.min(34, Math.floor((budget - 20) / Math.max(1, legs) - 10)));
  const units: Unit[] = [];
  if (hasTitle) units.push({ key: 'title', label: 'Heading', start: 2, dur: 14, cue: 0 });
  let t = 10;
  for (let i = 0; i < nStops; i++) {
    units.push({ key: `stop${i}`, label: `Stop ${i + 1}`, start: t, dur: 12, cue: 1 + i * 2 });
    t += 8;
    if (i < legs) {
      units.push({ key: `leg${i}`, label: `Leg ${i + 1}`, start: t, dur: legDur, cue: 2 + i * 2 });
      t += legDur;
    }
  }
  return planTimeline(duration, units, cueTimes);
}

export function prepareMP13(props: Record<string, unknown>, durationInFrames: number) {
  const A = (k: string) => readAnim(props, MP13_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(MP13_SPEC, props);
  const measure = measureFor(style);
  const locSpec = { ...LOCATION, fontMax: sized.extra.locations ?? LOCATION.fontMax };
  const s = (o: Record<string, unknown>, k: string) => (typeof o[k] === 'string' && (o[k] as string).trim() ? (o[k] as string) : undefined);
  const fills: CountryFeature[] = [];
  const fillIndex = new Map<CountryFeature, number>(); // one colour per named region
  const regionNames: string[] = [];
  const raw = (Array.isArray(props.stops) ? props.stops : []).map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}));
  const parsed = raw
    .map((o) => {
      const location = normaliseText(s(o, 'location') ?? s(o, 'label'), LOCATION);
      const regionName = s(o, 'region');
      const area = findRegion(regionName);
      if (area.length && regionName && !regionNames.includes(regionName.toLowerCase())) regionNames.push(regionName.toLowerCase());
      const ci = regionName ? regionNames.indexOf(regionName.toLowerCase()) : 0;
      for (const f of area) if (!fills.includes(f)) {
        fills.push(f);
        fillIndex.set(f, ci);
      }
      let lat = readNumber(o.lat);
      let lon = readNumber(o.lon);
      const regionOnly = (lat === undefined || lon === undefined) && area.length > 0;
      if (regionOnly) {
        const c = geoCentroid({ type: 'FeatureCollection', features: area });
        lon = c[0];
        lat = c[1];
      }
      if (!location || lat === undefined || lon === undefined) return null;
      // region under the label (skipped when it just repeats the location, e.g. "India" / "India")
      const showRegion = regionName && regionName.trim().toLowerCase() !== location.trim().toLowerCase() ? regionName : undefined;
      const sub = normaliseText([showRegion, s(o, 'details')].filter(Boolean).join(' · '), SUBLINE);
      const route = ['air', 'sea', 'land'].includes(o.route_to_next as string) ? (o.route_to_next as Mode) : undefined;
      const stop: Stop = { label: location, detail: sub, lat: Math.max(-85, Math.min(85, lat)), lon, image: s(o, 'image_url'), area: area.length ? area : undefined, regionOnly };
      return { stop, route };
    })
    .filter((x): x is { stop: Stop; route: Mode | undefined } => x !== null)
    .slice(0, 5);
  const stops = parsed.map((x) => x.stop);
  const legs: Leg[] = stops.slice(0, -1).map((a, i) => {
    const b = stops[i + 1];
    const mode: Mode = parsed[i].route ?? (geoDistance([a.lon, a.lat], [b.lon, b.lat]) * (180 / Math.PI) * KM_PER_DEG < 700 ? 'land' : 'air');
    return { mode, vehicle: VEHICLE[mode] };
  });
  const regions: CountryFeature[] = fills;
  const title = normaliseText(readFirst(props, ['title']), MP13_SPEC.text.title);
  const titleLine = title ? fitText(title, MP13_SPEC.text.title, 1100, measure, false).lines[0] : undefined;
  const titleH = titleLine ? titleLine.size * 1.05 + 24 : 0;

  // a whole-country stop on a sea leg uses the country's coast nearest to where the ship comes from / goes to
  stops.forEach((st, i) => {
    if (!st.regionOnly || !st.area) return;
    const seaLeg = (i > 0 && legs[i - 1]?.mode === 'sea') || (i < legs.length && legs[i]?.mode === 'sea');
    if (!seaLeg) return;
    const other = stops[i + 1] ?? stops[i - 1];
    if (!other) return;
    // each country's main landmass only (its outer ring with the most points), so e.g. Japan means Honshu, not Okinawa
    const rings: number[][][] = st.area.map((f) => {
      const g = f.geometry as { type: string; coordinates: unknown };
      const outer: number[][][] = g.type === 'Polygon' ? [(g.coordinates as number[][][])[0]] : g.type === 'MultiPolygon' ? (g.coordinates as number[][][][]).map((p) => p[0]) : [];
      return outer.length ? outer.reduce((a, b) => (b.length > a.length ? b : a)) : [];
    });
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (const ring of rings) {
      for (let k = 0; k < ring.length; k += 3) {
        const v = ring[k] as [number, number];
        const d = geoDistance(v, [other.lon, other.lat]);
        if (d < bestD && nearWater(v[0], v[1])) {
          bestD = d;
          best = v;
        }
      }
    }
    if (best) {
      st.lon = best[0];
      st.lat = best[1];
    }
  });
  // sea legs stay on water, land legs on land (routed between the stop and any via points)
  const routes: ([number, number][] | null)[] = legs.map((l, i) => {
    if (l.mode === 'air') return null;
    // no water / land connection (e.g. a land route to an island): fall back to the drawn curve
    const part = findRoute([stops[i].lon, stops[i].lat], [stops[i + 1].lon, stops[i + 1].lat], l.mode === 'sea' ? 'sea' : 'land');
    return part ? unwrap(part) : null;
  });
  // centre the map on the journey (so routes over the 180° line stay in one piece)
  const allLon = unwrap([...stops.map((p) => [p.lon, p.lat] as [number, number]), ...routes.flatMap((r) => r ?? [])]).map((p) => p[0]);
  const centerLon = allLon.length ? (Math.min(...allLon) + Math.max(...allLon)) / 2 : 78;
  // map framing: every stop, via point and routed path, with room around it for labels
  const pts: [number, number][] = [...stops.map((p) => [p.lon, p.lat] as [number, number]), ...routes.flatMap((r) => r ?? [])];
  const [[x0, y0], [x1, y1]] = pts.length ? geoBounds({ type: 'MultiPoint', coordinates: pts }) : [[60, 5], [100, 35]];
  const lonSpan = Math.max(...allLon, 0) - Math.min(...allLon, 0);
  const wide = lonSpan > 70 || Math.abs(x1 - x0) > 70 || Math.abs(y1 - y0) > 50;
  // show at least ~12° × 8° so short trips keep some geographic context around them
  const cxm = (x0 + x1) / 2;
  const cym = (y0 + y1) / 2;
  if (Math.abs(x1 - x0) < 12) pts.push([cxm - 6, cym], [cxm + 6, cym]);
  if (Math.abs(y1 - y0) < 8) pts.push([cxm, Math.max(-80, cym - 4)], [cxm, Math.min(80, cym + 4)]);
  const projection = (wide ? geoNaturalEarth1() : geoMercator()).rotate([-centerLon, 0]).fitExtent(
    [[SAFE_MARGIN + 170, SAFE_MARGIN + titleH + 110], [FRAME_W - SAFE_MARGIN - 170, FRAME_H - SAFE_MARGIN - 110]],
    { type: 'MultiPoint', coordinates: pts.length > 1 ? pts : [[x0 - 5, y0 - 5], [x1 + 5, y1 + 5]] },
  );
  const toSafe = (lonlat: [number, number]): [number, number] => {
    const p = projection(lonlat) ?? [FRAME_W / 2, FRAME_H / 2];
    return [p[0] - SAFE_MARGIN, p[1] - SAFE_MARGIN];
  };

  // unique places (a stop may repeat) and their label cards
  // stops closer than a marker's width (or repeated) share one marker; different names are joined
  const uniq: { stop: Stop; first: number; xy: [number, number]; names: string[] }[] = [];
  const stopPlace = stops.map((p, i) => {
    const xy = toSafe([p.lon, p.lat]);
    let k = uniq.findIndex((u) => Math.abs(u.xy[0] - xy[0]) < 46 && Math.abs(u.xy[1] - xy[1]) < 46);
    if (k < 0) {
      uniq.push({ stop: p, first: i, xy, names: [p.label] });
      k = uniq.length - 1;
    } else if (!uniq[k].names.includes(p.label)) uniq[k].names.push(p.label);
    return k;
  });
  const obstacles: Box[] = uniq.map((u) => ({ x: u.xy[0] - 20, y: u.xy[1] - 20, w: 40, h: 40 }));
  if (titleLine) obstacles.push({ x: 0, y: 0, w: measure(titleLine.text, titleLine.size, 800) + 10, h: titleH });
  // the mode legend sits in the bottom-right corner
  const modesUsed = Array.from(new Set(legs.map((l) => l.mode)));
  const legendW = modesUsed.reduce((a, m) => a + 52 + measure(m === 'air' ? 'Air' : m === 'sea' ? 'Sea' : 'Land', 20, 600), 0) + 14 * (modesUsed.length - 1) + 28;
  if (modesUsed.length) obstacles.push({ x: SAFE_W - legendW, y: SAFE_H - 44, w: legendW, h: 44 });
  const cards = uniq.map((u) => {
    const t = fitText(u.names.join(' · '), locSpec, 420, measure, false).lines[0];
    const d = u.names.length === 1 && u.stop.detail ? fitText(u.stop.detail, SUBLINE, 420, measure, false).lines[0] : undefined;
    const textW = Math.max(measure(t.text, t.size, 800), d ? measure(d.text, d.size, 600) : 0);
    const withImg = { w: Math.ceil(Math.max(textW + 36, u.stop.image ? IMG_W + 16 : 0)), h: Math.ceil((u.stop.image ? IMG_H + 8 : 0) + 16 + t.size * 1.15 + (d ? d.size * 1.2 : 0)) };
    let image = u.stop.image;
    let size = withImg;
    const anchorsXY = uniq.map((q) => ({ x: q.xy[0], y: q.xy[1] }));
    const prefer = awayFrom(anchorsXY[uniq.indexOf(u)], anchorsXY);
    let box = placeNear({ x: u.xy[0], y: u.xy[1] }, size.w, size.h, obstacles, { x: 0, y: 0, w: SAFE_W, h: SAFE_H }, undefined, prefer);
    if (!box && image) {
      image = undefined;
      size = { w: Math.ceil(textW + 36), h: Math.ceil(16 + t.size * 1.15 + (d ? d.size * 1.2 : 0)) };
      box = placeNear({ x: u.xy[0], y: u.xy[1] }, size.w, size.h, obstacles, { x: 0, y: 0, w: SAFE_W, h: SAFE_H }, undefined, prefer);
    }
    if (box) obstacles.push(box);
    return { title: t, detail: d, image, box };
  });

  // leg geometry in safe-box pixels
  // a leg that repeats an earlier pair of places (e.g. the way back) bows the other way so both stay visible
  const seen = new Set<string>();
  const legGeom = legs.map((l, i) => {
    const a = uniq[stopPlace[i]].xy;
    const b = uniq[stopPlace[i + 1]].xy;
    const pair = [stopPlace[i], stopPlace[i + 1]].sort().join('-');
    const again = seen.has(pair);
    seen.add(pair);
    let pts2: [number, number][];
    const routed = routes[i];
    if (l.mode === 'air') pts2 = arc(a, b, 0.22, 60, again);
    else if (routed) {
      // hops were checked as straight lines in lon / lat: densify them before projecting so the drawn
      // path follows exactly the same water (or land) on any map projection
      const dense: [number, number][] = [];
      for (let k = 0; k < routed.length - 1; k++) {
        const [p0, p1] = [routed[k], routed[k + 1]];
        const n = Math.max(1, Math.ceil(Math.max(Math.abs(p1[0] - p0[0]), Math.abs(p1[1] - p0[1])) / 0.5));
        for (let t = 0; t < n; t++) dense.push([p0[0] + ((p1[0] - p0[0]) * t) / n, p0[1] + ((p1[1] - p0[1]) * t) / n]);
      }
      dense.push(routed[routed.length - 1]);
      pts2 = [a, ...dense.slice(1, -1).map((q) => toSafe(q)), b];
    }
    else pts2 = l.mode === 'sea' ? arc(a, b, 0.1, 60, again) : arc(a, b, again ? 0.08 : 0, 30, again);
    return { pts: pts2, acc: lengths(pts2) };
  });
  const plan = planRoute(stops.length, Boolean(titleLine), durationInFrames, readCues(props));
  return { style, sized, A, stops, legs, regions, fillIndex, projection, titleLine, uniq, stopPlace, cards, legGeom, plan, debug: props.show_safe_area === true };
}

const graticule = geoGraticule10();

export function MP13TravelRoute({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, stops, legs, regions, fillIndex, projection, titleLine, uniq, stopPlace, cards, legGeom, plan, debug } = prepareMP13(props, durationInFrames);
  const w = plan.windows;
  const accent = style.colors.accent;
  const path = geoPath(projection);
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const modeColor: Record<Mode, string> = { air: accent, sea: seriesColor(style.colors, 1), land: seriesColor(style.colors, 2) };
  const modeDash: Record<Mode, string> = { air: '0 15', sea: '18 12', land: '26 10' };
  const modeWidth: Record<Mode, number> = { air: 8, sea: 6, land: 6 };
  const mapIn = progress(frame, 0, 12);
  // first appearance of each unique place
  const placeStart = uniq.map((u) => w[`stop${u.first}`]);
  const usedModes = Array.from(new Set(legs.map((l) => l.mode)));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: `radial-gradient(120% 90% at 30% 25%, ${style.colors.background} 0%, ${style.colors.background_2} 100%)`, ...styleVars(style) }}>
      <svg width={FRAME_W} height={FRAME_H} style={{ position: 'absolute', inset: 0, opacity: mapIn }}>
        <path d={path(graticule) ?? ''} fill="none" stroke={withAlpha(style.colors.text, 0.06)} strokeWidth={1} />
        {countries().map((f, i) => {
          const hi = regions.includes(f) ? fillIndex.get(f) ?? 0 : -1;
          return <path key={i} d={path(f) ?? ''} fill={hi >= 0 ? withAlpha(seriesColor(style.colors, hi % 4), 0.3) : withAlpha(style.colors.text, 0.14)} stroke={withAlpha(style.colors.background_2, 0.95)} strokeWidth={1} />;
        })}
      </svg>
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {titleLine && w.title && (
            <AnimatedText lines={[titleLine]} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={800} lineHeight={1.05} shadow={FOOTAGE_SHADOW} group="title" input="title" />
          )}
          <svg {...guide('route', 'legs[]')} width={SAFE_W} height={SAFE_H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
            {legGeom.map((g, i) => {
              const lw = w[`leg${i}`];
              const p = A('paths') === 'grow' ? easeInOutCubic(progress(frame, lw.start, lw.dur)) : frame >= lw.start ? 1 : 0;
              if (p <= 0) return null;
              const { out } = partial(g.pts, g.acc, p);
              const m = legs[i].mode;
              return <path key={i} d={`M ${out.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' L ')}`} fill="none" stroke={modeColor[m]} strokeWidth={modeWidth[m]} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={modeDash[m]} opacity={A('paths') === 'fade' ? progress(frame, lw.start, lw.dur) : 1} />;
            })}
          </svg>
          {/* vehicles: visible only while their leg is being travelled */}
          {legGeom.map((g, i) => {
            const lw = w[`leg${i}`];
            if (frame < lw.start || frame > lw.start + lw.dur + 4) return null;
            const p = easeInOutCubic(progress(frame, lw.start, lw.dur));
            const { head, angle } = partial(g.pts, g.acc, Math.max(0.001, p));
            const m = legs[i].mode;
            const v = legs[i].vehicle;
            const rot = v === 'plane' ? angle + 45 : 0;
            const flip = v !== 'plane' && Math.abs(angle) > 90 ? -1 : 1;
            return (
              <div key={`v${i}`} style={{ position: 'absolute', left: head[0] - 26, top: head[1] - 26, width: 52, height: 52, borderRadius: '50%', background: modeColor[m], display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 1 - progress(frame, lw.start + lw.dur, 4) }}>
                <div style={{ transform: `rotate(${rot}deg) scaleX(${flip})`, display: 'flex' }}>
                  <LucideIconView name={v} size={30} color={style.colors.on_accent} />
                </div>
              </div>
            );
          })}
          <svg {...guide('leaders', 'card → stop')} width={SAFE_W} height={SAFE_H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
            {uniq.map((u, k) => {
              const b = cards[k].box;
              if (!b) return null;
              const bx = Math.max(b.x, Math.min(b.x + b.w, u.xy[0]));
              const by = Math.max(b.y, Math.min(b.y + b.h, u.xy[1]));
              return <line key={k} x1={u.xy[0]} y1={u.xy[1]} x2={bx} y2={by} stroke={withAlpha(style.colors.text, 0.7)} strokeWidth={2.5} strokeLinecap="round" opacity={progress(frame, placeStart[k].start + 4, placeStart[k].dur)} />;
            })}
          </svg>
          {uniq.map((u, k) => {
            const sw = placeStart[k];
            const c = cards[k];
            const order = stops.map((_, i) => i).filter((i) => stopPlace[i] === k).map((i) => i + 1).join(' · ');
            return (
              <div key={k}>
                <div {...leaf(`stop-${k}`, 'stops[].lat / lon')} style={{ position: 'absolute', left: u.xy[0] - 20, top: u.xy[1] - 20, width: 40, height: 40, borderRadius: '50%', background: accent, border: `4px solid ${style.colors.text}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', ...iconStyle(A('pins'), progress(frame, sw.start, sw.dur)) }}>
                  <span style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: order.length > 2 ? 12 : 17, color: style.colors.on_accent, lineHeight: 1 }}>{order}</span>
                </div>
                {c.box && (
                  <div {...leaf(`card-${k}`, 'stops[].label / detail / image_url')} style={{ position: 'absolute', left: c.box.x, top: c.box.y, width: c.box.w, height: c.box.h, boxSizing: 'border-box', padding: 8, borderRadius: 14, background: withAlpha(style.colors.scrim, 0.86), display: 'flex', flexDirection: 'column', gap: 4, ...cardStyle(A('labels'), progress(frame, sw.start + 4, sw.dur)) }}>
                    {c.image && (
                      <div style={{ width: '100%', height: IMG_H, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                        <Img src={c.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div style={{ padding: '0 10px' }}>
                      <div style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: c.title.size, lineHeight: 1.15, color: style.colors.text, whiteSpace: 'nowrap' }}>{c.title.text}</div>
                      {c.detail && <div style={{ fontFamily: fontFor(600), fontWeight: 600, fontSize: c.detail.size, lineHeight: 1.2, color: style.custom.has('muted') ? style.colors.muted : '#E8EAF6', whiteSpace: 'nowrap' }}>{c.detail.text}</div>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {/* legend of the travel modes used */}
          <div style={{ position: 'absolute', right: 0, bottom: 0, display: 'flex', gap: 14, padding: '8px 14px', borderRadius: 12, background: withAlpha(style.colors.scrim, 0.7), opacity: mapIn }}>
            {usedModes.map((m) => (
              <div key={m} {...leaf(`legend-${m}`, 'legs[].mode')} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width={44} height={10}>
                  <line x1={4} y1={5} x2={40} y2={5} stroke={modeColor[m]} strokeWidth={modeWidth[m] * 0.7} strokeLinecap="round" strokeDasharray={m === 'air' ? '0 9' : m === 'sea' ? '10 7' : '14 6'} />
                </svg>
                <span style={{ fontFamily: fontFor(600), fontWeight: 600, fontSize: 20, color: style.colors.text }}>{m === 'air' ? 'Air' : m === 'sea' ? 'Sea' : 'Land'}</span>
              </div>
            ))}
          </div>
        </div>
      </SafeArea>
    </div>
  );
}
