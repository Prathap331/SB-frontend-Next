/**
 * Number formatting shared by every numeric template (FS-04, FS-06, charts…).
 * The LLM sends raw numbers; templates format them so they can count up.
 */
export const NUMBER_FORMATS = ['indian_compact', 'intl_compact', 'indian_full', 'intl_full', 'plain'] as const;
export type NumberFormat = (typeof NUMBER_FORMATS)[number];
export type Scale = { div: number; suffix: string };

export const FORMAT_HELP =
  'indian_compact 4,200 Cr / 73.5 L · intl_compact 42B · indian_full 4,20,00,00,00,000 · intl_full 42,000,000,000 · plain 42000000000';

export function pickScale(v: number, format: NumberFormat): Scale {
  const a = Math.abs(v);
  if (format === 'indian_compact') {
    if (a >= 1e12) return { div: 1e12, suffix: 'L Cr' };
    if (a >= 1e7) return { div: 1e7, suffix: 'Cr' };
    if (a >= 1e5) return { div: 1e5, suffix: 'L' };
  }
  if (format === 'intl_compact') {
    if (a >= 1e12) return { div: 1e12, suffix: 'T' };
    if (a >= 1e9) return { div: 1e9, suffix: 'B' };
    if (a >= 1e6) return { div: 1e6, suffix: 'M' };
    if (a >= 1e3) return { div: 1e3, suffix: 'K' };
  }
  return { div: 1, suffix: '' };
}

function group(intPart: string, style: 'indian' | 'intl' | 'none'): string {
  if (style === 'none' || intPart.length <= 3) return intPart;
  if (style === 'intl') return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** Decimal places, decided once from the final value so a count-up never changes width. */
export function decimalsFor(finalValue: number, scale: Scale, decimals: string): number {
  if (decimals !== 'auto') return Number(decimals);
  const x = Math.abs(finalValue / scale.div);
  if (scale.div > 1) return x < 100 && !Number.isInteger(Math.round(x * 10) / 10) ? 1 : 0;
  if (Number.isInteger(finalValue)) return 0;
  return Math.min(2, (String(finalValue).split('.')[1] ?? '').length);
}

export function formatDigits(v: number, scale: Scale, format: NumberFormat, d: number): string {
  const x = Math.abs(v / scale.div);
  const [i, f] = x.toFixed(d).split('.');
  const style = format === 'plain' ? 'none' : format.startsWith('indian') ? 'indian' : 'intl';
  return `${v < 0 ? '−' : ''}${group(i, style)}${f ? `.${f}` : ''}`;
}

/** Parse a raw number from props (numbers, or numeric strings with commas/spaces). */
export const readNumber = (v: unknown): number | undefined => {
  const x = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(/[,\s]/g, '')) : NaN;
  return Number.isFinite(x) ? x : undefined;
};
