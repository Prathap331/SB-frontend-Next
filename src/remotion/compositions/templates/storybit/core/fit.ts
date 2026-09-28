/**
 * Storybit text-fitting engine (pure — no React/Remotion imports).
 *
 * Guarantees for every text field:
 *   1. It never gets wider than its box: font shrinks from spec.fontMax → spec.fontMin, and if a
 *      single line still doesn't fit at fontMin (e.g. one very long word) that line alone is scaled down.
 *   2. It never uses more than spec.maxLines lines (extra words merge into the last line, which then shrinks).
 * Templates then stack these measured blocks and shrink further if the stack is taller than its area,
 * so nothing overlaps and nothing crosses the 100px margin.
 */

/** Rendered width in px of `text` at `fontSize` / `weight` in the Storybit font stack. */
export type Measure = (text: string, fontSize: number, weight: number, opts?: { tabular?: boolean }) => number;

/** 2% headroom so anti-aliasing / hinting never touches a box edge. */
export const HEADROOM = 0.98;

/** Conservative fallback when real measurement is unavailable. */
export const estimateMeasure: Measure = (text, fontSize, weight) =>
  text.length * fontSize * (weight >= 700 ? 0.64 : weight >= 600 ? 0.6 : 0.54);

export type FontRange = { fontMax: number; fontMin: number; weight: number; maxLines: number };

/** One rendered line; `size` may be below the block font if the line needed a last-resort shrink. */
export type Line = { text: string; size: number };

export type FittedText = { font: number; lines: Line[]; width: number };

export function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export function wrap(text: string, font: number, weight: number, width: number, measure: Measure): string[] {
  const max = width * HEADROOM;
  const out: string[] = [];
  let line = '';
  for (const w of words(text)) {
    const next = line ? `${line} ${w}` : w;
    if (line && measure(next, font, weight) > max) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Re-split a 2-line wrap so both lines are as even as possible (no lone orphan word). */
export function balance(text: string, font: number, weight: number, width: number, measure: Measure): string[] {
  const greedy = wrap(text, font, weight, width, measure);
  if (greedy.length !== 2) return greedy;
  const ws = words(text);
  let best = greedy;
  let bestW = Math.max(...greedy.map((l) => measure(l, font, weight)));
  for (let k = 1; k < ws.length; k++) {
    const a = ws.slice(0, k).join(' ');
    const b = ws.slice(k).join(' ');
    const w = Math.max(measure(a, font, weight), measure(b, font, weight));
    if (w <= width * HEADROOM && w < bestW) {
      best = [a, b];
      bestW = w;
    }
  }
  return best;
}

function fitsAt(text: string, f: number, r: FontRange, width: number, measure: Measure): boolean {
  const lines = wrap(text, f, r.weight, width, measure);
  return lines.length <= r.maxLines && lines.every((l) => measure(l, f, r.weight) <= width * HEADROOM);
}

/** Largest font (step 2) at which every text in the group fits; fontMin if none does. */
export function sharedFont(texts: string[], r: FontRange, width: number, measure: Measure, cap = r.fontMax): number {
  const top = Math.min(cap, r.fontMax);
  for (let f = top; f >= r.fontMin; f -= 2) {
    if (texts.every((t) => !t || fitsAt(t, f, r, width, measure))) return f;
  }
  return r.fontMin;
}

/** Lines for `text` at `font`, capped to maxLines, each guaranteed ≤ width. */
export function linesAt(
  text: string,
  font: number,
  r: FontRange,
  width: number,
  measure: Measure,
  balanced = true,
): Line[] {
  if (!text) return [];
  let raw = r.maxLines === 2 && balanced ? balance(text, font, r.weight, width, measure) : wrap(text, font, r.weight, width, measure);
  if (raw.length > r.maxLines) {
    raw = [...raw.slice(0, r.maxLines - 1), raw.slice(r.maxLines - 1).join(' ')];
  }
  const max = width * HEADROOM;
  return raw.map((t) => {
    const w = measure(t, font, r.weight);
    return { text: t, size: w > max ? Math.floor(font * (max / w) * 10) / 10 : font };
  });
}

/** Fit one text into a box of `width`. */
export function fitText(text: string, r: FontRange, width: number, measure: Measure, balanced = true, cap?: number): FittedText {
  const font = sharedFont([text], r, width, measure, cap);
  const lines = linesAt(text, font, r, width, measure, balanced);
  return { font, lines, width: Math.max(0, ...lines.map((l) => measure(l.text, l.size, r.weight))) };
}

/** Height of a block of lines. */
export function blockHeight(lines: Line[], lineHeight: number): number {
  return lines.reduce((h, l) => h + l.size * lineHeight, 0);
}
