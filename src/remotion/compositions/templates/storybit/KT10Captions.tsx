'use client';

/**
 * KT-10 · Word-Synced Captions  (animation_type: "kt_captions")   — overlay on footage
 * Big, bold captions that follow the voiceover word by word (Shorts / Reels style): pages of 1–2 lines,
 * the spoken word lit up (colour, pill or pop). Feed it the WhisperX word timings, or plain text for even timing.
 *
 * Inputs (full list, limits and JSON Schema: KT10Captions.inputs.json):
 *   words[] { text, start, end }  (seconds from the start of this clip)  — or —  text (spread evenly)
 *   look · position · case · max_words
 *   style{fonts, colours} · font_sizes{…} · animations{…}
 * Timing: 1.5–8s from clock.durationInFrames; word times beyond the clip are clipped.
 */
import type { TemplateProps } from '../../../types';
import { readNonEmptyString } from '../../../props';
import { applySizes, normaliseText, readAnim, type Issue, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { type Measure } from './core/fit';
import { easeOutBack, exitStyle, progress } from './core/motion';
import { FPS, exitFrames, planTimeline, type Plan } from './core/timeline';
import { readNumber } from './core/numbers';
import { OVERLAY_DURATION } from './core/overlay';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, readStyle, styleVars, withAlpha } from './core/style';
import { leaf } from './core/shared';

export const KT10_SPEC: TemplateSpec = {
  id: 'KT-10',
  animationType: 'kt_captions',
  name: 'Word-Synced Captions',
  pickWhen: 'Burned-in captions that follow the voiceover word by word (Shorts, Reels, hook sections).',
  placement: 'overlay',
  duration: OVERLAY_DURATION,
  text: {
    text: { label: 'Text', required: false, minChars: 1, maxChars: 200, minWords: 1, maxWords: 40, maxWordChars: 20, maxLines: 20, fontMax: 72, fontMin: 44, weight: 800, lineHeight: 1.15, hint: 'Only when you have no word timings: spread evenly over the clip.', fills: 'Caption text (fallback)' },
  },
  lists: {},
  custom: {
    inputs: [
      { path: 'words[]', type: 'list', required: false, fills: 'Word timings from WhisperX (preferred)', limits: 'up to 40 words' },
      { path: 'words[].text', type: 'text', required: true, fills: 'The word as spoken (punctuation allowed)', limits: '1–20 chars' },
      { path: 'words[].start', type: 'number', required: true, fills: 'When the word starts, seconds from the start of this clip' },
      { path: 'words[].end', type: 'number', required: false, fills: 'When the word ends (default: next word start)' },
    ],
    schema: {
      words: { type: 'array', maxItems: 40, items: { type: 'object', additionalProperties: false, required: ['text', 'start'], properties: { text: { type: 'string', minLength: 1, maxLength: 20 }, start: { type: 'number', minimum: 0 }, end: { type: 'number', minimum: 0 } } } },
    },
  },
  options: {
    look: { label: 'Look', values: ['color', 'pill', 'pop'], default: 'pill', fills: 'How the spoken word stands out: accent colour · accent pill behind it · colour + bounce' },
    position: { label: 'Position', values: ['bottom', 'center', 'top'], default: 'bottom', fills: 'Where the captions sit' },
    case: { label: 'Letter case', values: ['upper', 'as_given'], default: 'upper', fills: 'All capitals, or as written' },
    max_words: { label: 'Words per page', values: ['3', '4', '6', '8'], default: '6', fills: 'Most words on screen at once' },
  },
  animations: {
    pages: { label: 'Pages', kind: 'card', target: 'each caption page', default: 'pop' },
    exit: { label: 'Exit', kind: 'exit', target: 'the last page', default: 'fade' },
  },
  cues: { description: 'Timing comes from words[].start / end — no cue_times needed.', units: [] },
  colors: [],
  validate: (props) => {
    const issues: Issue[] = [];
    if (!(Array.isArray(props.words) && props.words.length) && !(typeof props.text === 'string' && props.text.trim())) issues.push({ field: 'words', level: 'error', message: 'Give words[] (with timings) or text' });
    return issues;
  },
  example: {
    words: [
      { text: 'Nobody', start: 0.1, end: 0.45 },
      { text: 'expected', start: 0.45, end: 0.9 },
      { text: 'this', start: 0.9, end: 1.1 },
      { text: 'to', start: 1.1, end: 1.2 },
      { text: 'happen', start: 1.2, end: 1.7 },
      { text: 'so', start: 1.9, end: 2.05 },
      { text: 'fast.', start: 2.05, end: 2.6 },
    ],
    look: 'pill',
    position: 'bottom',
  },
};

type Word = { text: string; start: number; end: number };
export const LINE_W = 1500;
export type CaptionLayout = { size: number; pages: { lines: { words: number[]; widths: number[] }[]; start: number; end: number }[]; gap: number; pad: number };

export function layoutCaptions(input: { words: Word[]; maxWords: number; upper: boolean }, measure: Measure): CaptionLayout {
  const W = input.words.map((w) => (input.upper ? w.text.toLocaleUpperCase() : w.text));
  const pad = 14;
  // one font for the whole clip: the biggest at which every page fits in two lines
  for (let size = 72; ; size -= 4) {
    const gap = size * 0.28;
    const width = (i: number) => measure(W[i], size, 800) + pad * 2;
    const pages: CaptionLayout['pages'] = [];
    let i = 0;
    let ok = true;
    while (i < W.length) {
      const lines: { words: number[]; widths: number[] }[] = [];
      let count = 0;
      while (lines.length < 2 && i < W.length && count < input.maxWords) {
        const line = { words: [] as number[], widths: [] as number[] };
        let lw = 0;
        while (i < W.length && count < input.maxWords) {
          const ww = width(i);
          if (line.words.length && lw + gap + ww > LINE_W) break;
          if (!line.words.length && ww > LINE_W) ok = false;
          line.words.push(i);
          line.widths.push(ww);
          lw += (line.words.length > 1 ? gap : 0) + ww;
          i++;
          count++;
          // end a page early at sentence ends
          if (/[.!?।]$/.test(W[i - 1])) break;
        }
        lines.push(line);
        if (/[.!?।]$/.test(W[i - 1])) break;
      }
      const first = lines[0].words[0];
      const last = lines[lines.length - 1].words[lines[lines.length - 1].words.length - 1];
      pages.push({ lines, start: input.words[first].start, end: input.words[last].end });
    }
    if (ok || size <= 40) return { size, pages, gap, pad };
  }
}

export function planCaptions(L: CaptionLayout, duration: number): Plan {
  // the plan only reports windows for the lab; timing comes from the words themselves
  const units = L.pages.map((p, i) => ({ key: `page${i}`, label: `Page ${i + 1}`, start: Math.round(p.start * FPS), dur: Math.max(4, Math.round((p.end - p.start) * FPS)) }));
  return planTimeline(duration, units, undefined);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareKT10(props: Record<string, unknown>, durationInFrames: number) {
  const A = (k: string) => readAnim(props, KT10_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(KT10_SPEC, props);
  const measure = measureFor(style);
  const clipEnd = (durationInFrames - exitFrames(durationInFrames)) / FPS;
  let words: Word[] = (Array.isArray(props.words) ? props.words : [])
    .map((x) => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const t = typeof o.text === 'string' ? o.text.trim().slice(0, 20) : '';
      const s = readNumber(o.start);
      return t && s !== undefined ? { text: t, start: Math.max(0, s), end: readNumber(o.end) ?? -1 } : null;
    })
    .filter((w): w is Word => w !== null)
    .sort((a, b) => a.start - b.start)
    .slice(0, 40);
  if (!words.length) {
    // no timings: spread the text evenly over the clip
    const txt = normaliseText(typeof props.text === 'string' ? props.text : '', KT10_SPEC.text.text).split(' ').filter(Boolean).slice(0, 40);
    const step = (clipEnd - 0.2) / Math.max(1, txt.length);
    words = txt.map((t, i) => ({ text: t, start: 0.1 + i * step, end: 0.1 + (i + 1) * step }));
  }
  words = words.filter((w) => w.start < clipEnd).map((w, i, all) => ({ ...w, end: Math.min(clipEnd, w.end > w.start ? w.end : all[i + 1]?.start ?? w.start + 0.4) }));
  const L = layoutCaptions({ words, maxWords: Number(opt(props, 'max_words', ['3', '4', '6', '8'] as const, '6')), upper: opt(props, 'case', ['upper', 'as_given'] as const, 'upper') === 'upper' }, measure);
  const plan = planCaptions(L, durationInFrames);
  return { style, sized, A, words, L, plan, look: opt(props, 'look', ['color', 'pill', 'pop'] as const, 'pill'), position: opt(props, 'position', ['bottom', 'center', 'top'] as const, 'bottom'), upper: opt(props, 'case', ['upper', 'as_given'] as const, 'upper') === 'upper', debug: props.show_safe_area === true };
}

export function KT10Captions({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, words, L, plan, look, position, upper, debug } = prepareKT10(props, durationInFrames);
  const accent = style.colors.accent;
  const t = frame / FPS;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  // current page: the last one that has started (pages stay up until the next one begins)
  let pi = -1;
  L.pages.forEach((p, i) => {
    if (t >= p.start - 0.05) pi = i;
  });
  if (pi < 0 || !words.length) return <div style={{ position: 'absolute', inset: 0 }} />;
  const page = L.pages[pi];
  const lineH = L.size * 1.15 + L.pad;
  const blockH = page.lines.length * lineH + (page.lines.length - 1) * 8;
  const top = position === 'top' ? 20 : position === 'center' ? (SAFE_H - blockH) / 2 : SAFE_H - blockH - 20;
  const pp = progress(frame, Math.round(page.start * FPS) - 1, 6);
  const pageIn = A('pages') === 'none' ? 1 : A('pages') === 'fade' ? pp : Math.max(0, easeOutBack(pp));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', left: 0, top, width: SAFE_W, ...exit }}>
          {page.lines.map((ln, li) => {
            const lw = ln.widths.reduce((a, b) => a + b, 0) + L.gap * (ln.words.length - 1);
            return (
              <div key={`${pi}-${li}`} {...leaf(`line-${li}`, 'words')} style={{ position: 'relative', margin: '0 auto', marginBottom: 8, width: lw, height: lineH, display: 'flex', gap: L.gap, transform: `scale(${0.85 + 0.15 * pageIn})`, opacity: Math.min(1, pageIn * 1.5) }}>
                {ln.words.map((wi, k) => {
                  const w = words[wi];
                  const on = t >= w.start && t < (words[wi + 1]?.start ?? Infinity);
                  const said = t >= w.start;
                  const pop = look === 'pop' && on ? 1 + 0.12 * Math.max(0, 1 - (t - w.start) / 0.25) : 1;
                  return (
                    <span key={wi} style={{ width: ln.widths[k], height: lineH, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, background: look === 'pill' && on ? accent : 'transparent', fontFamily: fontFor(800), fontWeight: 800, fontSize: L.size, lineHeight: 1.15, whiteSpace: 'nowrap', color: look === 'pill' ? (on ? style.colors.on_accent : '#FFFFFF') : on ? accent : said ? '#FFFFFF' : withAlpha('#FFFFFF', 0.9), textShadow: look === 'pill' && on ? 'none' : '0 4px 0 rgba(0,0,0,0.55), 0 0 18px rgba(0,0,0,0.6)', WebkitTextStroke: look === 'pill' && on ? undefined : '2px rgba(0,0,0,0.6)', transform: `scale(${pop})` }}>
                      {upper ? w.text.toLocaleUpperCase() : w.text}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </SafeArea>
    </div>
  );
}
