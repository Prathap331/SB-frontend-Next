/**
 * Chart helpers shared by the data-visualisation templates (pure).
 */
import { formatDigits, pickScale, decimalsFor, type NumberFormat, type Scale } from './numbers';

const niceNum = (x: number, round: boolean) => {
  const e = Math.floor(Math.log10(x));
  const f = x / 10 ** e;
  const nf = round ? (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) : f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * 10 ** e;
};

/** Rounded axis range and tick values (about `count` ticks). */
export function niceScale(min: number, max: number, count = 4): { min: number; max: number; step: number; ticks: number[] } {
  if (!(max > min)) {
    const pad = Math.abs(max) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const step = niceNum(niceNum(max - min, false) / count, true);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step * 0.5; v += step) ticks.push(+v.toFixed(10));
  return { min: lo, max: hi, step, ticks };
}

/** Value axis for a set of values: starts at zero unless the data sits far above it. */
export function valueAxis(values: number[], count = 4) {
  const vals = values.filter(Number.isFinite);
  const maxV = Math.max(...vals);
  const minV = Math.min(...vals);
  const lo = minV >= 0 && minV > 0.5 * maxV ? minV - (maxV - minV) * 0.15 : Math.min(0, minV);
  return niceScale(lo, Math.max(maxV, lo + 1e-9), count);
}

/** Formatter using one scale for every label on a chart (so 45 L and 1.2 Cr never mix). */
export function axisFormatter(values: number[], format: NumberFormat, decimals: string, prefix = '', unit = '') {
  const big = values.reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0);
  const scale: Scale = pickScale(big || 1, format);
  const d = Math.max(0, ...values.filter(Number.isFinite).map((v) => decimalsFor(v, scale, decimals)));
  const fmt = (v: number, dd = d) => `${prefix}${formatDigits(v, scale, format, dd)}${scale.suffix ? ` ${scale.suffix}` : ''}${unit ? ` ${unit}` : ''}`;
  return { scale, decimals: d, fmt };
}

/** SVG arc path for a donut / pie slice (angles in radians, 0 = 12 o'clock, clockwise). */
export function arcPath(cx: number, cy: number, r: number, inner: number, a0: number, a1: number): string {
  const sweep = Math.min(a1 - a0, Math.PI * 2 - 1e-4);
  const e = a0 + sweep;
  const p = (rad: number, a: number) => [cx + rad * Math.sin(a), cy - rad * Math.cos(a)];
  const large = sweep > Math.PI ? 1 : 0;
  const [x0, y0] = p(r, a0);
  const [x1, y1] = p(r, e);
  if (inner <= 0) return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
  const [x2, y2] = p(inner, e);
  const [x3, y3] = p(inner, a0);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${inner} ${inner} 0 ${large} 0 ${x3} ${y3} Z`;
}
