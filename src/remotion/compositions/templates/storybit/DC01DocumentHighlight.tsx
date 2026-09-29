'use client';

/**
 * DC-01 · Document Highlight  (animation_type: "dc_document_highlight")
 * A typeset document page — judgment, report, contract, policy — with a highlighter sweeping over
 * the key phrase. Other lines can dim so the phrase stands out. Only real, sourced document text.
 *
 * Inputs (full list, limits and JSON Schema: DC01DocumentHighlight.inputs.json):
 *   doc_title (required) · meta · text (required) · highlight · image_url · marker · focus · page · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [page, highlight]
 * Uses serif document fonts (Playfair Display / Lora, Noto fallbacks) regardless of style fonts.
 * Timing: 3–8s from clock.durationInFrames.
 */
import type { CSSProperties } from 'react';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type Issue, type TemplateSpec } from './core/contentSpec';
import { measureWith } from './core/measure';
import { blockHeight, fitText, type Line, type Measure } from './core/fit';
import { cardStyle, easeInOutCubic, exitStyle, progress } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H } from './core/safeArea';
import { fontStack, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, StoryBackground, highlightWords, leaf, readBgMode, readFirst, type HighlightStyle } from './core/shared';
import { withAutoFit } from './core/autofit';

export const DC01_SPEC: TemplateSpec = {
  id: 'DC-01',
  animationType: 'dc_document_highlight',
  name: 'Document Highlight',
  pickWhen: 'Quoting a line from a court judgment, report, contract, law or policy: "the document actually says…".',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 180, max: 240 },
  text: {
    doc_title: { label: 'Document title', required: true, minChars: 3, maxChars: 60, minWords: 1, maxWords: 10, maxWordChars: 18, maxLines: 2, fontMax: 38, fontMin: 26, weight: 700, lineHeight: 1.2, hint: '"Supreme Court of India — Judgment, 2017".', fills: 'Title at the top of the page', example: 'RBI Circular on Digital Payments' },
    meta: { label: 'Meta line', required: false, minChars: 3, maxChars: 60, minWords: 1, maxWords: 10, maxWordChars: 18, maxLines: 1, fontMax: 22, fontMin: 16, weight: 500, lineHeight: 1.3, hint: 'Reference, page, date: "Ref. DPSS/2024/12 · Page 3".', fills: 'Small line under the title' },
    text: { label: 'Document text', required: true, minChars: 40, maxChars: 420, minWords: 8, maxWords: 80, maxWordChars: 18, maxLines: 12, fontMax: 34, fontMin: 22, weight: 500, lineHeight: 1.55, hint: 'The real passage, word for word (trim with "…").', fills: 'Body of the page', example: 'Replace with the real passage from the document. The highlighter will sweep over the phrase given in highlight, and the rest of the page can dim so that it stands out.' },
    highlight: { label: 'Highlight', required: false, minChars: 3, maxChars: 90, minWords: 1, maxWords: 16, maxWordChars: 18, maxLines: 1, fontMax: 34, fontMin: 22, weight: 500, lineHeight: 1.55, hint: 'Exact words from the text to highlight.', fills: 'Phrase the highlighter sweeps over', example: 'the highlighter will sweep over the phrase', noSize: true },
  },
  lists: {},
  options: {
    marker: { label: 'Marker colour', values: ['yellow', 'green', 'pink', 'accent'], default: 'yellow', fills: 'Highlighter colour' },
    focus: { label: 'Dim other words', values: ['on', 'off'], default: 'on', fills: 'Fade the rest of the text after the highlight is drawn' },
    page: { label: 'Page', values: ['white', 'cream'], default: 'white', fills: 'Paper colour' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    page: { label: 'Page', kind: 'card', target: 'the page', default: 'slide_up' },
    text: { label: 'Text', kind: 'text', target: 'the lines of the page', default: 'fade' },
    highlight: { label: 'Highlighter', kind: 'shape', target: 'highlighter sweep', default: 'grow' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the page', default: 'fade' },
  },
  cues: { description: 'page → highlight (when the narrator reads the phrase).', units: ['page', 'highlight'] },
  colors: [],
  validate: (props) => {
    const issues: Issue[] = [];
    const t = typeof props.text === 'string' ? props.text.replace(/\s+/g, ' ').trim() : '';
    const h = typeof props.highlight === 'string' ? props.highlight.trim() : '';
    if (h && t && highlightWords([{ text: t, size: 0 }], h).size === 0) issues.push({ field: 'highlight', level: 'warning', message: 'Highlight phrase is not in the text — nothing is highlighted' });
    return issues;
  },
  example: {
    doc_title: 'RBI Circular on Digital Payments',
    meta: 'Sample reference · Page 3',
    text: 'Replace with the real passage from the document. The highlighter will sweep over the phrase given in highlight, and the rest of the page can dim so that it stands out.',
    highlight: 'The highlighter will sweep over the phrase',
    marker: 'yellow',
    background: 'theme',
  },
};

export const SERIF_HEAD = fontStack('playfair_display');
export const SERIF_BODY = fontStack('lora');
export const PAGE_W = 1180;
export const PAD = 64;
export type DocLayout = { pageH: number; title: Line[]; meta?: Line; body: Line[] };

export function layoutDoc(input: { title: string; meta: string; text: string }, measure: Measure, spec: TemplateSpec = DC01_SPEC): DocLayout {
  const T = spec.text;
  const inner = PAGE_W - PAD * 2;
  const title = fitText(input.title, T.doc_title, inner, measure).lines;
  const meta = input.meta ? fitText(input.meta, T.meta, inner, measure, false).lines[0] : undefined;
  const headH = blockHeight(title, T.doc_title.lineHeight) + (meta ? 8 + meta.size * T.meta.lineHeight : 0) + 36;
  let cap = T.text.fontMax;
  for (;;) {
    const body = fitText(input.text, T.text, inner, measure, false, cap).lines;
    const pageH = Math.ceil(PAD * 2 + headH + blockHeight(body, T.text.lineHeight));
    if (pageH <= SAFE_H || cap <= T.text.fontMin) return { pageH: Math.min(pageH, SAFE_H), title, meta, body };
    cap -= 2;
  }
}

export function planDoc(duration: number, cueTimes?: number[]): Plan {
  const units: Unit[] = [
    { key: 'page', label: 'Page', start: 4, dur: 16, cue: 0 },
    { key: 'highlight', label: 'Highlighter', start: 40, dur: 24, cue: 1 },
    { key: 'text', label: 'Text', start: 12, dur: 14, follows: { key: 'page', offset: 8 } },
  ];
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareDC01(props: Record<string, unknown>, durationInFrames: number) {
  const S = DC01_SPEC.text;
  const A = (k: string) => readAnim(props, DC01_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DC01_SPEC, props);
  const measure = measureWith(SERIF_HEAD, SERIF_BODY);
  const L = layoutDoc({ title: normaliseText(readFirst(props, ['doc_title', 'title']), S.doc_title), meta: normaliseText(readFirst(props, ['meta', 'source']), S.meta), text: normaliseText(readFirst(props, ['text', 'body']), S.text) }, measure, sized.spec);
  const hl = normaliseText(readFirst(props, ['highlight']), S.highlight);
  const highlight = highlightWords(L.body, hl).size ? hl : '';
  const plan = planDoc(durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, L, plan, highlight, imageUrl, bg: readBgMode(props, imageUrl), marker: opt(props, 'marker', ['yellow', 'green', 'pink', 'accent'] as const, 'yellow'), focus: opt(props, 'focus', ['on', 'off'] as const, 'on') === 'on', cream: opt(props, 'page', ['white', 'cream'] as const, 'white') === 'cream', debug: props.show_safe_area === true };
}

const MARKERS = { yellow: '#FFE24A', green: '#7CF0A0', pink: '#FF9BD2' } as const;

function DC01DocumentHighlightBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, highlight, imageUrl, bg, marker, focus, cream, debug } = prepareDC01(props, durationInFrames);
  const w = plan.windows;
  const S = DC01_SPEC.text;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const ink = '#1C1B19';
  const mk = marker === 'accent' ? style.colors.accent : MARKERS[marker];
  const hp = progress(frame, w.highlight.start, w.highlight.dur);
  const hAnim = A('highlight');
  const dim = focus && highlight ? 1 - 0.6 * progress(frame, w.highlight.start + w.highlight.dur - 6, 12) : 1;
  const markerStyle: HighlightStyle = (order, count) => {
    const q = hAnim === 'none' ? (hp > 0 ? 1 : 0) : hAnim === 'fade' || hAnim === 'pop' ? hp : easeInOutCubic(Math.min(1, Math.max(0, hp * count - order)));
    const sweep = hAnim === 'fade' || hAnim === 'pop' ? 1 : q;
    const a = hAnim === 'fade' || hAnim === 'pop' ? q : 1;
    return { color: ink, backgroundImage: `linear-gradient(${withAlpha(mk, 0.85 * a)}, ${withAlpha(mk, 0.85 * a)})`, backgroundRepeat: 'no-repeat', backgroundPosition: 'left 60%', backgroundSize: `${sweep * 100}% 78%` } as CSSProperties;
  };
  const tw = w.text;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={style.colors.accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...exit }}>
          <div style={{ width: PAGE_W, height: L.pageH, boxSizing: 'border-box', padding: PAD, background: cream ? '#F6F0E1' : '#FFFFFF', borderRadius: 6, boxShadow: '0 0 0 1px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', ...cardStyle(A('page'), progress(frame, w.page.start, w.page.dur)) }}>
            <AnimatedText lines={L.title} anim="none" start={w.page.start} dur={1} frame={frame} weight={700} lineHeight={S.doc_title.lineHeight} color={ink} shadow="none" group="doc-title" input="doc_title" fontFamily={SERIF_HEAD} />
            {L.meta && <span {...leaf('meta', 'meta')} style={{ fontFamily: SERIF_BODY, fontWeight: 500, fontSize: L.meta.size, lineHeight: S.meta.lineHeight, color: '#6B6760', marginTop: 8, whiteSpace: 'nowrap' }}>{L.meta.text}</span>}
            <div style={{ height: 2, background: '#D9D4CA', margin: '16px 0 18px' }} />
            {/* one block so a highlight can run across line breaks; other words dim after the sweep */}
            <AnimatedText lines={L.body} anim={A('text')} start={tw.start} dur={tw.dur} frame={frame} weight={500} lineHeight={S.text.lineHeight} color={withAlpha(ink, dim)} shadow="none" group="text" input="text" fontFamily={SERIF_BODY} highlight={highlight} highlightStyle={markerStyle} />
          </div>
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const DC01DocumentHighlight = withAutoFit(DC01DocumentHighlightBase);
