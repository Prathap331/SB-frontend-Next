'use client';

/**
 * UI-08 · Search Bar Typing  (animation_type: "ui_search_bar")
 * A search box: the query types itself letter by letter with a blinking cursor, suggestions drop down
 * (one can be picked), and an optional result line appears — "everyone was searching for…".
 * Generic look, no search-engine logos.
 *
 * Inputs (full list, limits and JSON Schema: UI08SearchBar.inputs.json):
 *   query (required) · suggestions[] { text } · pick · result_line · image_url · theme_style · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [bar, typing, suggestions, pick, result]
 * Timing: 3–8s from clock.durationInFrames (typing speed adapts to fit).
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec, type TextSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { fitText, sharedFont, linesAt, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, progress } from './core/motion';
import { planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { readNumber } from './core/numbers';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, readStyle, styleVars, withAlpha } from './core/style';
import { StoryBackground, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

const SUGGESTION: TextSpec = { label: 'Suggestion', required: true, minChars: 2, maxChars: 60, minWords: 1, maxWords: 11, maxWordChars: 20, maxLines: 1, fontMax: 34, fontMin: 22, weight: 500, lineHeight: 1.2, fills: 'One suggestion' };

export const UI08_SPEC: TemplateSpec = {
  id: 'UI-08',
  animationType: 'ui_search_bar',
  name: 'Search Bar Typing',
  pickWhen: '"Everyone was searching for…", "I typed X into the search bar": a query being typed with suggestions.',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 150, max: 240 },
  numbers: { pick: { label: 'Pick', required: false, fills: 'Suggestion number that gets picked (1 = first)', min: 1, max: 5, integer: true } },
  text: {
    query: { label: 'Query', required: true, minChars: 2, maxChars: 60, minWords: 1, maxWords: 11, maxWordChars: 20, maxLines: 1, fontMax: 44, fontMin: 26, weight: 500, lineHeight: 1.2, hint: 'What is typed.', fills: 'Search text', example: 'how to invest in' },
    result_line: { label: 'Result line', required: false, minChars: 3, maxChars: 60, minWords: 1, maxWords: 10, maxWordChars: 18, maxLines: 1, fontMax: 28, fontMin: 20, weight: 600, lineHeight: 1.2, hint: '"Searches up 400% this week (illustrative)".', fills: 'Line under the box at the end' },
  },
  lists: { suggestions: { label: 'Suggestion', fills: 'Dropdown suggestions, top to bottom', minItems: 1, maxItems: 5, optional: true, fields: { text: SUGGESTION } } },
  options: {
    theme_style: { label: 'Look', values: ['light', 'dark'], default: 'light', fills: 'Light or dark search box' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage' },
  },
  animations: {
    bar: { label: 'Search box', kind: 'card', target: 'the search box', default: 'pop' },
    dropdown: { label: 'Suggestions', kind: 'card', target: 'the suggestion list', default: 'fade' },
    result: { label: 'Result line', kind: 'text', target: 'result line', default: 'fade_up' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'everything', default: 'fade' },
  },
  cues: { description: 'bar → typing starts → suggestions → pick → result line.', units: ['bar', 'typing', 'suggestions', 'pick', 'result'] },
  colors: [],
  example: { query: 'how to invest in', suggestions: [{ text: 'how to invest in mutual funds' }, { text: 'how to invest in gold' }, { text: 'how to invest in stocks' }], pick: 1, result_line: 'Searches up 4× this year (illustrative)', background: 'theme' },
};

export const BAR_W = 1320;
export const BAR_H = 104;
export const ROW_H = 72;
export type SearchLayout = { query: Line; sugg: Line[]; result?: Line; top: number };

export function layoutSearch(input: { query: string; sugg: string[]; result: string }, measure: Measure, spec: TemplateSpec = UI08_SPEC): SearchLayout {
  const T = spec.text;
  const inner = BAR_W - 180;
  const query = fitText(input.query, T.query, inner, measure, false).lines[0];
  // measured bold: the part after the typed text is drawn in bold
  const bold = { ...SUGGESTION, weight: 800 };
  const sf = sharedFont(input.sugg, bold, inner, measure);
  const sugg = input.sugg.map((t) => linesAt(t, sf, bold, inner, measure, false)[0]);
  const result = input.result ? fitText(input.result, T.result_line, BAR_W, measure, false).lines[0] : undefined;
  const total = BAR_H + (sugg.length ? sugg.length * ROW_H + 24 : 0) + (result ? result.size * 1.2 + 32 : 0);
  return { query, sugg, result, top: Math.max(0, (SAFE_H - total) / 2) };
}

export function planSearch(L: SearchLayout, hasPick: boolean, duration: number, cueTimes?: number[]): Plan {
  const chars = L.query.text.length;
  const typeDur = Math.max(12, Math.min(60, Math.round(chars * 1.6)));
  const units: Unit[] = [
    { key: 'bar', label: 'Search box', start: 4, dur: 12, cue: 0 },
    { key: 'typing', label: 'Typing', start: 16, dur: typeDur, cue: 1 },
  ];
  let t = 16 + typeDur;
  if (L.sugg.length) {
    units.push({ key: 'suggestions', label: 'Suggestions', start: t + 2, dur: 12, cue: 2 });
    t += 14;
    if (hasPick) {
      units.push({ key: 'pick', label: 'Pick', start: t + 10, dur: 10, cue: 3 });
      t += 20;
    }
  }
  if (L.result) units.push({ key: 'result', label: 'Result line', start: t + 6, dur: 14, cue: 4 });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareUI08(props: Record<string, unknown>, durationInFrames: number) {
  const S = UI08_SPEC.text;
  const A = (k: string) => readAnim(props, UI08_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(UI08_SPEC, props);
  const measure = measureFor(style);
  const sugg = (Array.isArray(props.suggestions) ? props.suggestions : []).map((x) => normaliseText(typeof x === 'string' ? x : x && typeof x === 'object' && typeof (x as Record<string, unknown>).text === 'string' ? ((x as Record<string, unknown>).text as string) : '', SUGGESTION)).filter(Boolean).slice(0, 5);
  const L = layoutSearch({ query: normaliseText(readFirst(props, ['query', 'text']), S.query), sugg, result: normaliseText(readFirst(props, ['result_line']), S.result_line) }, measure, sized.spec);
  const pickRaw = readNumber(props.pick);
  const pick = pickRaw !== undefined && pickRaw >= 1 && pickRaw <= sugg.length ? Math.round(pickRaw) - 1 : -1;
  const plan = planSearch(L, pick >= 0, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, L, plan, pick, dark: opt(props, 'theme_style', ['light', 'dark'] as const, 'light') === 'dark', imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

function UI08SearchBarBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, L, plan, pick, dark, imageUrl, bg, debug } = prepareUI08(props, durationInFrames);
  const w = plan.windows;
  const C = dark ? { box: '#202124', ink: '#E8EAED', muted: '#9AA0A6', line: '#3C4043', hover: '#303134' } : { box: '#FFFFFF', ink: '#202124', muted: '#70757A', line: '#E8EAED', hover: '#F1F3F4' };
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const left = (SAFE_W - BAR_W) / 2;
  const tp = progress(frame, w.typing.start, w.typing.dur);
  const shown = L.query.text.slice(0, Math.round(tp * L.query.text.length));
  const typing = frame >= w.typing.start && tp < 1;
  const blink = typing || Math.floor(frame / 15) % 2 === 0;
  const ddOpen = w.suggestions && frame >= w.suggestions.start;
  const picked = w.pick && frame >= w.pick.start ? pick : -1;
  const barTextColor = picked >= 0 ? C.ink : C.ink;
  const barText = picked >= 0 ? L.sugg[picked].text : shown;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={style.colors.accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          <div style={{ position: 'absolute', left, top: L.top, width: BAR_W, ...cardStyle(A('bar'), progress(frame, w.bar.start, w.bar.dur)) }}>
            <div style={{ height: BAR_H, borderRadius: ddOpen && L.sugg.length ? '52px 52px 0 0' : 52, background: C.box, boxShadow: `0 10px 30px ${withAlpha('#000000', 0.25)}`, display: 'flex', alignItems: 'center', padding: '0 40px', gap: 24, boxSizing: 'border-box' }}>
              <LucideIconView name="search" size={40} color={C.muted} />
              <span {...leaf('query', 'query')} style={{ fontFamily: fontFor(500), fontWeight: 500, fontSize: L.query.size, lineHeight: 1.2, color: barTextColor, whiteSpace: 'nowrap', minWidth: 10 }}>
                {barText}
                <span style={{ display: 'inline-block', width: 3, height: L.query.size * 1.05, marginLeft: 3, verticalAlign: 'text-bottom', background: style.colors.accent, opacity: picked < 0 && blink && frame >= w.typing.start ? 1 : 0 }} />
              </span>
            </div>
            {ddOpen && L.sugg.length > 0 && (
              <div style={{ background: C.box, borderRadius: '0 0 36px 36px', borderTop: `1px solid ${C.line}`, padding: '8px 0 16px', boxShadow: `0 16px 30px ${withAlpha('#000000', 0.25)}`, ...cardStyle(A('dropdown'), progress(frame, w.suggestions!.start, w.suggestions!.dur)) }}>
                {L.sugg.map((sg, i) => {
                  const typed = L.query.text.toLowerCase();
                  const same = sg.text.toLowerCase().startsWith(typed);
                  return (
                    <div key={i} style={{ height: ROW_H, display: 'flex', alignItems: 'center', gap: 24, padding: '0 40px', background: i === picked ? C.hover : 'transparent' }}>
                      <LucideIconView name="search" size={30} color={C.muted} />
                      <span {...leaf(`sugg-${i}`, `suggestions[${i}].text`)} style={{ fontFamily: fontFor(500), fontWeight: 500, fontSize: sg.size, lineHeight: 1.2, color: C.ink, whiteSpace: 'nowrap' }}>
                        {same ? (
                          <>
                            {sg.text.slice(0, typed.length)}
                            <b style={{ fontWeight: 800 }}>{sg.text.slice(typed.length)}</b>
                          </>
                        ) : (
                          sg.text
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {L.result && w.result && (
            <span {...leaf('result', 'result_line')} style={{ position: 'absolute', left, width: BAR_W, textAlign: 'center', top: L.top + BAR_H + (L.sugg.length ? L.sugg.length * ROW_H + 24 : 0) + 32, fontFamily: fontFor(600), fontWeight: 600, fontSize: L.result.size, lineHeight: 1.2, color: style.colors.text, whiteSpace: 'nowrap', textShadow: bg === 'theme' ? 'none' : '0 2px 8px rgba(0,0,0,0.6)', opacity: progress(frame, w.result.start, w.result.dur) }}>
              {L.result.text}
            </span>
          )}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const UI08SearchBar = withAutoFit(UI08SearchBarBase);
