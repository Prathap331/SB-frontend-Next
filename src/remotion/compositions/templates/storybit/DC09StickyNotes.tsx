'use client';

/**
 * DC-09 · Sticky Notes Board  (animation_type: "dc_sticky_notes")
 * 2–6 sticky notes pinned to a board, appearing one by one — brainstorms, clues, "things we know",
 * a detective-board feel. Notes use a rounded handwriting-style font (Baloo 2).
 *
 * Inputs (full list, limits and JSON Schema: DC09StickyNotes.inputs.json):
 *   title · notes[] { text, color } · image_url · board · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [title, note 1, note 2, …]
 * Timing: 3–8s from clock.durationInFrames.
 */
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor, measureWith } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, progress, textAnimFrames } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontStack, readStyle, styleVars } from './core/style';
import { AnimatedText, FOOTAGE_SHADOW, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

export const DC09_SPEC: TemplateSpec = {
  id: 'DC-09',
  animationType: 'dc_sticky_notes',
  name: 'Sticky Notes Board',
  pickWhen: 'Listing clues, ideas, facts we know, or open questions in a loose, investigative way.',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 180, max: 240, perItemFrames: 30 },
  text: {
    title: { label: 'Heading', required: false, minChars: 3, maxChars: 40, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 1, fontMax: 60, fontMin: 40, weight: 800, lineHeight: 1.05, hint: '"What we know so far".', fills: 'Heading above the board', example: 'What we know so far' },
  },
  lists: {
    notes: {
      label: 'Note',
      fills: 'Notes in reading order (left to right, top to bottom)',
      minItems: 2,
      maxItems: 6,
      fields: {
        text: { label: 'Text', required: true, minChars: 2, maxChars: 70, minWords: 1, maxWords: 14, maxWordChars: 14, maxLines: 5, fontMax: 44, fontMin: 24, weight: 600, lineHeight: 1.18, hint: 'Short note.', fills: 'Note text' },
      },
      numbers: { color: { label: 'Colour', required: false, fills: '1 yellow · 2 pink · 3 blue · 4 green · 5 orange (default: cycles)', min: 1, max: 5, integer: true } },
    },
  },
  options: {
    board: { label: 'Board', values: ['cork', 'dark', 'none'], default: 'cork', fills: 'Cork board, dark board, or notes straight on the background' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage (behind the board)' },
  },
  animations: {
    title: { label: 'Heading', kind: 'text', target: 'heading', default: 'rise' },
    notes: { label: 'Notes', kind: 'card', target: 'each note', default: 'pop' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the board', default: 'fade_up' },
  },
  cues: { description: 'heading (if present), then one cue per note.', units: ['heading', 'note 1', 'note 2', 'note 3', 'note 4', 'note 5', 'note 6'] },
  colors: [],
  example: { title: 'What we know so far', notes: [{ text: 'The account was opened in 2019' }, { text: 'Money moved through 14 shell firms' }, { text: 'The CFO resigned a week before' }, { text: 'Who tipped off the auditors?' }], board: 'cork', background: 'theme' },
};

export const NOTE_FONT = fontStack('baloo_2');
export const BOARD_PAD = 44;
export const GAP = 40;
export type StickyLayout = { title: Line[]; titleH: number; cols: number; rows: number; size: number; notes: Line[][]; boardW: number; boardH: number };

export function layoutSticky(input: { title: string; notes: string[] }, measureTitle: Measure, measureNote: Measure, spec: TemplateSpec = DC09_SPEC): StickyLayout {
  const F = spec.lists.notes.fields.text;
  const n = Math.max(1, input.notes.length);
  const title = input.title ? fitText(input.title, spec.text.title, SAFE_W, measureTitle, false).lines : [];
  const titleH = title.length ? blockHeight(title, spec.text.title.lineHeight) + 32 : 0;
  const cols = n <= 4 ? n : 3;
  const rows = Math.ceil(n / cols);
  // square notes; leave room for the ±3° tilt so rotated notes never touch each other or the margin
  const size = Math.floor(Math.min(420, (SAFE_W - BOARD_PAD * 2 - GAP * (cols - 1)) / cols, (SAFE_H - titleH - BOARD_PAD * 2 - GAP * (rows - 1)) / rows));
  const inner = size - 56;
  const f = sharedFont(input.notes, F, inner, measureNote);
  const notes = input.notes.map((t) => linesAt(t, f, F, inner, measureNote));
  const boardW = cols * size + GAP * (cols - 1) + BOARD_PAD * 2;
  const boardH = rows * size + GAP * (rows - 1) + BOARD_PAD * 2;
  return { title, titleH, cols, rows, size, notes, boardW, boardH };
}
export function planSticky(L: StickyLayout, anims: { title: string }, duration: number, cueTimes?: number[]): Plan {
  const units: Unit[] = [];
  let cue = 0;
  if (L.title.length) {
    const t = L.title[0].text;
    units.push({ key: 'title', label: 'Heading', start: 2, dur: textAnimFrames(anims.title, words(t).length, t.length, 18), cue: cue++ });
  }
  const n = L.notes.length;
  const first = L.title.length ? 18 : 6;
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const gap = n > 1 ? Math.max(8, Math.min(36, Math.floor((budget - first - 16) / (n - 1)))) : 0;
  for (let i = 0; i < n; i++) units.push({ key: `note${i}`, label: `Note ${i + 1}`, start: first + i * gap, dur: 14, cue: cue + i });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareDC09(props: Record<string, unknown>, durationInFrames: number) {
  const F = DC09_SPEC.lists.notes.fields.text;
  const A = (k: string) => readAnim(props, DC09_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DC09_SPEC, props);
  const raw = (Array.isArray(props.notes) ? props.notes : []).map((x) => (typeof x === 'string' ? { text: x } : x && typeof x === 'object' ? (x as Record<string, unknown>) : {}));
  const notes = raw.map((o) => ({ text: normaliseText(typeof o.text === 'string' ? o.text : '', F), color: typeof o.color === 'number' && o.color >= 1 && o.color <= 5 ? Math.round(o.color) : 0 })).filter((x) => x.text).slice(0, 6);
  const L = layoutSticky({ title: normaliseText(readFirst(props, ['title', 'heading']), DC09_SPEC.text.title), notes: notes.map((x) => x.text) }, measureFor(style), measureWith(NOTE_FONT, NOTE_FONT), sized.spec);
  const plan = planSticky(L, { title: A('title') }, durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, notes, L, plan, imageUrl, bg: readBgMode(props, imageUrl), board: opt(props, 'board', ['cork', 'dark', 'none'] as const, 'cork'), debug: props.show_safe_area === true };
}

const COLORS = ['#FFE66D', '#FFB3C7', '#A7D8FF', '#B8F0B0', '#FFC98B'];
const TILT = [-2.4, 1.8, -1.2, 2.6, -2, 1.4];

function DC09StickyNotesBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, notes, L, plan, imageUrl, bg, board, debug } = prepareDC09(props, durationInFrames);
  const w = plan.windows;
  const F = DC09_SPEC.lists.notes.fields.text;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const boardTop = L.titleH + (SAFE_H - L.titleH - L.boardH) / 2;
  const boardLeft = (SAFE_W - L.boardW) / 2;
  const onFootage = bg !== 'theme';
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={style.colors.accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {L.title.length > 0 && w.title && (
            <AnimatedText lines={L.title} anim={A('title')} start={w.title.start} dur={w.title.dur} frame={frame} weight={DC09_SPEC.text.title.weight} lineHeight={DC09_SPEC.text.title.lineHeight} letterSpacing="-0.02em" shadow={onFootage ? FOOTAGE_SHADOW : 'none'} align="center" group="title" input="title" style={{ position: 'absolute', left: 0, top: boardTop - L.titleH, width: SAFE_W }} />
          )}
          {board !== 'none' && (
            <div style={{ position: 'absolute', left: boardLeft, top: boardTop, width: L.boardW, height: L.boardH, borderRadius: 18, background: board === 'cork' ? 'radial-gradient(circle at 30% 30%, #C9975F 0%, #A8763F 60%, #8E6232 100%)' : '#1E222B', boxShadow: `inset 0 0 0 10px ${board === 'cork' ? '#6E4A24' : '#2E333F'}` }} />
          )}
          {notes.map((nt, i) => {
            const c = i % L.cols;
            const r = Math.floor(i / L.cols);
            const inRow = Math.min(L.cols, notes.length - r * L.cols);
            const rowOffset = ((L.cols - inRow) * (L.size + GAP)) / 2;
            const x = boardLeft + BOARD_PAD + rowOffset + c * (L.size + GAP);
            const y = boardTop + BOARD_PAD + r * (L.size + GAP);
            const nw = w[`note${i}`];
            const cs = cardStyle(A('notes'), progress(frame, nw.start, nw.dur));
            const lines = L.notes[i];
            const h = blockHeight(lines, F.lineHeight);
            return (
              <div key={i} style={{ position: 'absolute', left: x, top: y, width: L.size, height: L.size, transform: `rotate(${TILT[i]}deg) ${String(cs.transform ?? '')}`, opacity: cs.opacity }}>
                <div style={{ position: 'absolute', inset: 0, background: COLORS[(nt.color || (i % 5) + 1) - 1], boxShadow: '0 10px 18px rgba(0,0,0,0.25)', borderRadius: 4 }} />
                <div style={{ position: 'absolute', left: '50%', top: 10, width: 26, height: 26, marginLeft: -13, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #FF7A7A, #C81E1E)', boxShadow: '0 3px 4px rgba(0,0,0,0.35)' }} />
                {/* one leaf per note so the tilt cannot make its lines "overlap" each other */}
                <div {...leaf(`note-${i}`, `notes[${i}].text`)} style={{ position: 'absolute', left: 28, width: L.size - 56, top: (L.size - h) / 2 + 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {lines.map((l, k) => (
                    <span key={k} style={{ fontFamily: NOTE_FONT, fontWeight: 600, fontSize: l.size, lineHeight: F.lineHeight, color: '#26221B', whiteSpace: 'nowrap' }}>{l.text}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const DC09StickyNotes = withAutoFit(DC09StickyNotesBase);
