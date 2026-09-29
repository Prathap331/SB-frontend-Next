'use client';

/**
 * DC-05 · Case File  (animation_type: "dc_case_file")
 * A manila case folder: tab with the case number, subject name, a clipped photo, typed fact rows
 * (Name / Charge / Status…) and a rubber stamp ("CONFIDENTIAL", "CLOSED", "WANTED"). Any value can be
 * shown redacted (black bar). Only real, sourced case details; keep private data out.
 *
 * Inputs (full list, limits and JSON Schema: DC05CaseFile.inputs.json):
 *   subject (required) · case_no · stamp · fields[] { label, value, redacted } · photo_url · image_url · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [file, field 1…6, stamp]
 * Typed text uses Roboto Slab (typewriter feel) regardless of style fonts.
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from 'remotion';
import type { TemplateProps } from '../../../types';
import { readImageUrl } from '../../../props';
import { LucideIconView } from '../../../icons';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureWith } from './core/measure';
import { fitText, sharedFont, linesAt, words, type Line, type Measure } from './core/fit';
import { cardStyle, easeOutBack, exitStyle, progress, textAnimFrames } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontStack, readStyle, styleVars, withAlpha, readHex } from './core/style';
import { AnimatedText, StoryBackground, guide, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

export const TYPE_FONT = fontStack('roboto_slab');

export const DC05_SPEC: TemplateSpec = {
  id: 'DC-05',
  animationType: 'dc_case_file',
  name: 'Case File',
  pickWhen: 'Introducing a case, a suspect, an accused company or an investigation in true-crime / scam stories.',
  placement: 'full',
  image: BACKGROUND_IMAGE,
  images: { photo_url: { label: 'Photo', required: false, fills: 'Photo clipped to the file (person, building, evidence)' } },
  duration: { min: 90, default: 180, max: 240 },
  text: {
    subject: { label: 'Subject', required: true, minChars: 2, maxChars: 34, minWords: 1, maxWords: 6, maxWordChars: 18, maxLines: 2, fontMax: 56, fontMin: 34, weight: 800, lineHeight: 1.1, hint: 'Whose / what case this is.', fills: 'Big name at the top of the page', example: 'The Example Bank Fraud' },
    case_no: { label: 'Case number', required: false, minChars: 2, maxChars: 22, minWords: 1, maxWords: 4, maxWordChars: 16, maxLines: 1, fontMax: 26, fontMin: 18, weight: 700, lineHeight: 1.2, hint: '"Case 2018/CBI/14" or "File No. 7".', fills: 'Text on the folder tab', example: 'Case No. 2018/14' },
    stamp: { label: 'Stamp', required: false, minChars: 2, maxChars: 16, minWords: 1, maxWords: 2, maxWordChars: 14, maxLines: 1, fontMax: 56, fontMin: 30, weight: 800, lineHeight: 1, hint: 'Default "CONFIDENTIAL": "CLOSED", "WANTED", "CONVICTED", "UNSOLVED".', fills: 'Rubber stamp on the page', example: 'CONFIDENTIAL' },
  },
  lists: {
    fields: {
      label: 'Fact',
      fills: 'Typed fact rows',
      minItems: 2,
      maxItems: 6,
      bgColor: 'this row (like a highlighter over the line)',
      fields: {
        label: { label: 'Label', required: true, minChars: 2, maxChars: 16, minWords: 1, maxWords: 3, maxWordChars: 14, maxLines: 1, fontMax: 24, fontMin: 16, weight: 700, lineHeight: 1.3, hint: '"Accused", "Amount", "Status".', fills: 'Row label' },
        value: { label: 'Value', required: true, minChars: 1, maxChars: 44, minWords: 1, maxWords: 8, maxWordChars: 18, maxLines: 2, fontMax: 30, fontMin: 20, weight: 500, lineHeight: 1.3, hint: 'The fact.', fills: 'Row value' },
      },
      numbers: { redacted: { label: 'Redacted', required: false, fills: '1 = show the value as a black bar', min: 0, max: 1, integer: true } },
    },
  },
  options: { background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'Behind the folder (a desk photo works well)' } },
  animations: {
    folder: { label: 'Folder', kind: 'card', target: 'the folder', default: 'slide_up' },
    photo: { label: 'Photo', kind: 'card', target: 'clipped photo', default: 'pop' },
    fields: { label: 'Fact rows', kind: 'text', target: 'each typed row', default: 'typewriter' },
    stamp: { label: 'Stamp', kind: 'shape', target: 'rubber stamp', default: 'pop' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'the folder', default: 'fade' },
  },
  cues: { description: 'Fixed slots: file → fact 1…6 → stamp. Send null for slots you do not use.', units: ['file', 'fact 1', 'fact 2', 'fact 3', 'fact 4', 'fact 5', 'fact 6', 'stamp'] },
  colors: ['negative'],
  example: {
    subject: 'The Example Bank Fraud',
    case_no: 'Case No. 2018/14',
    fields: [
      { label: 'Accused', value: 'Replace with the real name' },
      { label: 'Amount', value: '₹13,000 crore (illustrative)' },
      { label: 'Filed by', value: 'Replace with the agency' },
      { label: 'Status', value: 'Trial ongoing' },
    ],
    stamp: 'CONFIDENTIAL',
    background: 'theme',
  },
};

type Field = { label: string; value: string; redacted: boolean; bg?: string };
export const FOLDER_W = 1440;
export const FOLDER_H = 800;
export const TAB_H = 56;
export const PAGE_PAD = 44;
export type FileLayout = { folderW: number; folderH: number; subject: Line[]; caseNo?: Line; stamp: Line; photo: number; textW: number; labelW: number; rows: { label: Line; value: Line[] }[]; rowH: number[] };

export function layoutFile(input: { subject: string; caseNo: string; stamp: string; fields: Field[]; hasPhoto: boolean }, measure: Measure, spec: TemplateSpec = DC05_SPEC): FileLayout {
  const T = spec.text;
  const F = spec.lists.fields.fields;
  const pageW = FOLDER_W - 40;
  const photo = input.hasPhoto ? 380 : 0;
  const textW = pageW - PAGE_PAD * 2 - (photo ? photo + 48 : 0);
  const subject = fitText(input.subject, T.subject, textW, measure).lines;
  const caseNo = input.caseNo ? fitText(input.caseNo, T.case_no, 420, measure, false).lines[0] : undefined;
  const stamp = fitText(input.stamp.toLocaleUpperCase(), T.stamp, 520, measure, false).lines[0];
  const lf = sharedFont(input.fields.map((f) => f.label), F.label, 240, measure);
  const labelW = Math.ceil(Math.max(...input.fields.map((f) => measure(f.label.toLocaleUpperCase(), lf, 700)), 80)) + 24;
  const valueW = textW - labelW;
  const avail = FOLDER_H - TAB_H - PAGE_PAD * 2 - subject.length * subject[0].size * 1.1 - 36;
  let cap = F.value.fontMax;
  for (;;) {
    const vf = sharedFont(input.fields.map((f) => f.value), F.value, valueW, measure, cap);
    const rows = input.fields.map((f) => ({ label: { text: f.label.toLocaleUpperCase(), size: lf }, value: linesAt(f.value, vf, F.value, valueW, measure) }));
    const rowH = rows.map((r) => Math.max(r.label.size, r.value.length * r.value[0].size) * 1.3 + 14);
    if (rowH.reduce((a, b) => a + b, 0) <= avail || cap <= F.value.fontMin) {
      // the folder hugs what is written in it, keeping room for the stamp in the lower-right corner
      const used = Math.ceil(Math.max(...subject.map((l) => measure(l.text, l.size, 800)), labelW + Math.max(...rows.flatMap((r) => r.value.map((l) => measure(l.text, l.size, F.value.weight))), 0), 420)) + 8;
      const tw = Math.min(textW, used);
      const textH = subject.length * subject[0].size * 1.1 + 39 + rowH.reduce((a, b) => a + b, 0);
      const bodyH = Math.max(textH, photo ? photo * 1.2 : 0);
      const stampRoom = stamp.size + 70;
      const folderW = Math.max(900, 40 + PAGE_PAD * 2 + (photo ? photo + 48 : 0) + tw);
      const folderH = Math.min(FOLDER_H, Math.max(420, TAB_H + 32 + PAGE_PAD * 2 + bodyH + stampRoom));
      return { folderW, folderH, subject, caseNo, stamp, photo, textW: tw, labelW, rows, rowH };
    }
    cap -= 2;
  }
}

export function planFile(L: FileLayout, anim: string, duration: number, cueTimes?: number[]): Plan {
  const n = L.rows.length;
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const gap = n > 1 ? Math.max(6, Math.min(26, Math.floor((budget - 24 - 40) / (n - 1)))) : 0;
  const units: Unit[] = [{ key: 'file', label: 'Folder', start: 4, dur: 16, cue: 0 }];
  L.rows.forEach((r, i) => {
    const t = r.value.map((l) => l.text).join(' ');
    units.push({ key: `field${i}`, label: `Fact ${i + 1}`, start: 24 + i * gap, dur: textAnimFrames(anim, words(t).length, t.length, 16), cue: 1 + i });
  });
  units.push({ key: 'stamp', label: 'Stamp', start: 24 + (n - 1) * gap + 24, dur: 12, cue: 7 });
  units.push({ key: 'photo', label: 'Photo', start: 12, dur: 14, follows: { key: 'file', offset: 8 } });
  return planTimeline(duration, units, cueTimes);
}

export function prepareDC05(props: Record<string, unknown>, durationInFrames: number) {
  const S = DC05_SPEC.text;
  const F = DC05_SPEC.lists.fields.fields;
  const A = (k: string) => readAnim(props, DC05_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(DC05_SPEC, props);
  const measure = measureWith(TYPE_FONT, TYPE_FONT);
  const fields: Field[] = (Array.isArray(props.fields) ? props.fields : [])
    .map((x): Field | null => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const label = normaliseText(typeof o.label === 'string' ? o.label : '', F.label);
      const value = normaliseText(typeof o.value === 'string' ? o.value : typeof o.value === 'number' ? String(o.value) : '', F.value);
      return label && value ? { label, value, redacted: o.redacted === 1 || o.redacted === true, bg: readHex(o.bg_color) } : null;
    })
    .filter((x): x is Field => x !== null)
    .slice(0, 6);
  const photo = readFirst(props, ['photo_url']);
  const L = layoutFile({ subject: normaliseText(readFirst(props, ['subject', 'title']), S.subject), caseNo: normaliseText(readFirst(props, ['case_no']), S.case_no), stamp: normaliseText(readFirst(props, ['stamp']), S.stamp) || 'CONFIDENTIAL', fields, hasPhoto: Boolean(photo) }, measure, sized.spec);
  const plan = planFile(L, A('fields'), durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, fields, photo, L, plan, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

function DC05CaseFileBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, fields, photo, L, plan, imageUrl, bg, debug } = prepareDC05(props, durationInFrames);
  const w = plan.windows;
  const F = DC05_SPEC.lists.fields.fields;
  const ink = '#1F1B16';
  const red = style.custom.has('negative') ? style.colors.negative : '#C62828';
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const left = (SAFE_W - L.folderW) / 2;
  const top = (SAFE_H - L.folderH) / 2;
  const sp = progress(frame, w.stamp.start, w.stamp.dur);
  const stampScale = A('stamp') === 'none' ? (sp > 0 ? 1 : 0) : A('stamp') === 'fade' ? 1 : 1 + 0.9 * (1 - easeOutBack(sp));
  const stampOpacity = A('stamp') === 'fade' ? sp : sp > 0 ? Math.min(1, sp * 3) : 0;
  let y = 0;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={style.colors.accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', left, top, width: L.folderW, height: L.folderH, ...exit, ...cardStyle(A('folder'), progress(frame, w.file.start, w.file.dur)) }}>
          {/* folder back + tab */}
          <div style={{ position: 'absolute', left: 0, top: 0, width: 520, height: TAB_H + 20, borderRadius: '16px 16px 0 0', background: '#C9A46A' }} />
          {L.caseNo && <span {...leaf('case-no', 'case_no')} style={{ position: 'absolute', left: 28, top: (TAB_H - L.caseNo.size * 1.2) / 2 + 4, fontFamily: TYPE_FONT, fontWeight: 700, fontSize: L.caseNo.size, lineHeight: 1.2, color: '#3B2A12', whiteSpace: 'nowrap' }}>{L.caseNo.text}</span>}
          <div style={{ position: 'absolute', left: 0, top: TAB_H, width: L.folderW, height: L.folderH - TAB_H, borderRadius: '0 16px 16px 16px', background: 'linear-gradient(180deg, #D9B77E 0%, #C99F5E 100%)' }} />
          {/* the page */}
          <div style={{ position: 'absolute', left: 20, top: TAB_H + 16, width: L.folderW - 40, height: L.folderH - TAB_H - 32, background: '#FAF7F0', boxSizing: 'border-box', padding: PAGE_PAD, display: 'flex', gap: 48 }}>
            {L.photo > 0 && photo && (
              <div {...leaf('photo', 'photo_url')} style={{ position: 'relative', width: L.photo, height: L.photo * 1.2, flexShrink: 0, background: '#FFFFFF', padding: 12, boxSizing: 'border-box', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', ...cardStyle(A('photo'), progress(frame, w.photo.start, w.photo.dur)) }}>
                <Img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(0.4) contrast(1.05)' }} />
                <div style={{ position: 'absolute', top: -18, left: '50%', marginLeft: -12, display: 'flex' }}>
                  <LucideIconView name="paperclip" size={40} color="#8A8F99" />
                </div>
              </div>
            )}
            <div style={{ width: L.textW, display: 'flex', flexDirection: 'column' }}>
              <AnimatedText lines={L.subject} anim="none" start={w.file.start} dur={1} frame={frame} weight={800} lineHeight={1.1} color={ink} shadow="none" group="subject" input="subject" fontFamily={TYPE_FONT} />
              <div style={{ height: 3, background: ink, opacity: 0.8, margin: '16px 0 20px' }} />
              {fields.map((f, i) => {
                const r = L.rows[i];
                const fw = w[`field${i}`];
                const rowTop = y;
                y += L.rowH[i];
                return (
                  <div key={i} style={{ display: 'flex', minHeight: L.rowH[i], borderBottom: `1px dashed ${withAlpha(ink, 0.25)}`, alignItems: 'flex-start', paddingTop: 7, boxSizing: 'border-box', background: f.bg ? withAlpha(f.bg, 0.55) : undefined, borderRadius: f.bg ? 6 : undefined }} data-row={rowTop}>
                    <span {...leaf(`label-${i}`, `fields[${i}].label`)} style={{ width: L.labelW, flexShrink: 0, fontFamily: TYPE_FONT, fontWeight: 700, fontSize: r.label.size, lineHeight: 1.3, color: withAlpha(ink, 0.7), whiteSpace: 'nowrap', opacity: progress(frame, fw.start, 6) }}>{r.label.text}</span>
                    {f.redacted ? (
                      <div {...leaf(`value-${i}`, `fields[${i}].value (redacted)`)} style={{ height: r.value[0].size * 1.1, marginTop: r.value[0].size * 0.1, width: Math.min(L.textW - L.labelW, r.value[0].text.length * r.value[0].size * 0.55) * progress(frame, fw.start, fw.dur), background: '#111111' }} />
                    ) : (
                      <AnimatedText lines={r.value} anim={A('fields')} start={fw.start} dur={fw.dur} frame={frame} weight={F.value.weight} lineHeight={F.value.lineHeight} color={ink} shadow="none" group={`value-${i}`} input={`fields[${i}].value`} fontFamily={TYPE_FONT} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* rubber stamp: decorative, sits over the lower-right corner of the page */}
          <div {...guide('stamp', 'stamp')} style={{ position: 'absolute', right: 70, bottom: 60, padding: '10px 26px', border: `6px solid ${withAlpha(red, 0.85)}`, borderRadius: 10, transform: `rotate(-12deg) scale(${stampScale})`, opacity: stampOpacity }}>
            <span style={{ fontFamily: TYPE_FONT, fontWeight: 800, fontSize: L.stamp.size, lineHeight: 1, letterSpacing: '0.08em', color: withAlpha(red, 0.85), whiteSpace: 'nowrap' }}>{L.stamp.text}</span>
          </div>
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const DC05CaseFile = withAutoFit(DC05CaseFileBase);
