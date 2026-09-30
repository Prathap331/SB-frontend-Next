/**
 * Content limits for every Storybit template.
 * The same spec drives: the backend/LLM prompt (what to generate), validation before render,
 * the renderer's font ranges, and the preview's form + stress test.
 * Limits are derived from the 1720×880 safe box so text never overlaps or crosses the margin.
 */
import { words, type FontRange } from './fit';
import { ANIMS_BY_KIND, describeAnim, type AnimKind } from './motion';
import { FPS } from './timeline';
import { COLOR_SLOTS, COMMON_COLORS, FONT_CHOICES, FONT_KEYS, HEX, type ColorSlot } from './style';

export type TextSpec = FontRange & {
  label: string;
  required: boolean;
  minChars: number;
  maxChars: number;
  minWords: number;
  maxWords: number;
  /** Longest single word allowed (a word can't wrap, so it must fit its box at fontMin). */
  maxWordChars: number;
  lineHeight: number;
  hint?: string;
  /** Which element on screen this field fills. */
  fills?: string;
  example?: string;
  /** Size follows another element (e.g. a prefix scales with the number): no font-size input. */
  noSize?: boolean;
};

/** A numeric input. The template formats it (so it can count up); the LLM sends the raw number. */
export type NumberSpec = {
  label: string;
  required: boolean;
  fills: string;
  min?: number;
  max?: number;
  integer?: boolean;
  hint?: string;
  example?: number;
};

export type IconSpec = { label: string; required: boolean; fills: string; fallback: string; example?: string };
export type ImageSpec = { label: string; required: boolean; fills: string };

export type ListSpec = {
  label: string;
  minItems: number;
  /** The whole list may be left out (minItems then applies only when it is given). */
  optional?: boolean;
  maxItems: number;
  fields: Record<string, TextSpec>;
  /** Numeric fields of each item (raw numbers). */
  numbers?: Record<string, NumberSpec>;
  /** Item carries a Lucide icon name. */
  icon?: { required: boolean; fallback: string };
  /** Item carries an image URL (prop `image_url` on each item). */
  image?: { required: boolean; fills: string };
  /** Item can carry its own background colour (prop `bg_color`, hex) — what it fills, e.g. "this column's panel". */
  bgColor?: string;
  fills?: string;
};

export type SizeSpec = { label: string; min: number; max: number; fills: string };

export type OptionSpec = { label: string; values: string[]; default: string; fills?: string };

/** One animatable element of a template (what moves, which presets it accepts, the default). */
export type AnimSlot = {
  label: string;
  kind: AnimKind;
  /** Which content it animates, shown in the editor, e.g. "title (each line)". */
  target: string;
  default: string;
};

/** What each entry of `cue_times` pins. */
export type CueSpec = { description: string; units: string[] };

export type Placement = 'full' | 'overlay' | 'both';

export type TemplateSpec = {
  id: string;
  animationType: string;
  name: string;
  /** One line the LLM Director matches narration against. */
  pickWhen?: string;
  placement?: Placement;
  numbers?: Record<string, NumberSpec>;
  icons?: Record<string, IconSpec>;
  image?: ImageSpec;
  /** Other image inputs (e.g. portrait_url), keyed by prop name. */
  images?: Record<string, ImageSpec>;
  /** Inputs with shapes the generic spec can't express (arrays of numbers, nested series…). */
  custom?: { inputs: InputDef[]; schema: Record<string, unknown>; required?: string[] };
  /** Template-specific checks (e.g. a highlight phrase must appear in the quote). */
  validate?: (props: Record<string, unknown>) => Issue[];
  /** A complete, valid props object (used in the input file and the preview). */
  example?: Record<string, unknown>;
  /** Colour slots this template uses beyond the common ones (background, background_2, scrim, text, muted, accent). */
  colors?: ColorSlot[];
  /** Font-size inputs that are not text fields (e.g. the big number in FS-04). */
  sizes?: Record<string, SizeSpec>;
  duration: { min: number; default: number; max: number; perItemFrames?: number };
  text: Record<string, TextSpec>;
  lists: Record<string, ListSpec>;
  options: Record<string, OptionSpec>;
  animations: Record<string, AnimSlot>;
  cues: CueSpec;
};

export type Issue = { field: string; level: 'error' | 'warning'; message: string };

export const countWords = (t: string) => words(t).length;

/** Trim, collapse spaces, then clamp to maxWords and maxChars (at a word boundary). */
export function normaliseText(raw: unknown, spec: TextSpec): string {
  if (typeof raw !== 'string') return '';
  let t = raw.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  const ws = words(t);
  if (ws.length > spec.maxWords) t = ws.slice(0, spec.maxWords).join(' ');
  if (t.length > spec.maxChars) {
    const cut = t.slice(0, spec.maxChars - 1);
    const sp = cut.lastIndexOf(' ');
    t = `${(sp > spec.maxChars * 0.5 ? cut.slice(0, sp) : cut).trimEnd()}…`;
  }
  return t;
}

export function checkText(field: string, raw: unknown, spec: TextSpec): Issue[] {
  const issues: Issue[] = [];
  const t = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (!t) {
    if (spec.required) issues.push({ field, level: 'error', message: `${spec.label} is required` });
    return issues;
  }
  const n = countWords(t);
  if (t.length < spec.minChars) issues.push({ field, level: 'error', message: `${spec.label}: ${t.length} characters, minimum ${spec.minChars}` });
  if (t.length > spec.maxChars) issues.push({ field, level: 'warning', message: `${spec.label}: ${t.length} characters, maximum ${spec.maxChars} — will be shortened` });
  if (n < spec.minWords) issues.push({ field, level: 'error', message: `${spec.label}: ${n} words, minimum ${spec.minWords}` });
  if (n > spec.maxWords) issues.push({ field, level: 'warning', message: `${spec.label}: ${n} words, maximum ${spec.maxWords} — will be shortened` });
  const longest = words(t).reduce((m, w) => Math.max(m, w.length), 0);
  if (longest > spec.maxWordChars) issues.push({ field, level: 'warning', message: `${spec.label}: a ${longest}-letter word (max ${spec.maxWordChars}) — that line will be shrunk to fit` });
  return issues;
}

export function animValues(slot: AnimSlot): readonly string[] {
  return ANIMS_BY_KIND[slot.kind];
}

/** Chosen preset for an element: props.animations[key] → props[`${key}_animation`] → default. */
export function readAnim(props: Record<string, unknown>, spec: TemplateSpec, key: string): string {
  const slot = spec.animations[key];
  if (!slot) return 'none';
  const bag = props.animations && typeof props.animations === 'object' ? (props.animations as Record<string, unknown>) : {};
  const v = bag[key] ?? props[`${key}_animation`];
  return typeof v === 'string' && animValues(slot).includes(v) ? v : slot.default;
}

/** Validate a props object against a template spec (for the backend and the preview). */
export function validateProps(props: Record<string, unknown>, spec: TemplateSpec): Issue[] {
  const issues: Issue[] = [];
  for (const [key, s] of Object.entries(spec.text)) issues.push(...checkText(key, props[key], s));
  for (const [key, l] of Object.entries(spec.lists)) {
    const items = Array.isArray(props[key]) ? (props[key] as unknown[]) : [];
    if (items.length < l.minItems && !(l.optional && items.length === 0)) issues.push({ field: key, level: 'error', message: `${l.label}: ${items.length} items, minimum ${l.minItems}` });
    if (items.length > l.maxItems) issues.push({ field: key, level: 'warning', message: `${l.label}: ${items.length} items, maximum ${l.maxItems} — extra items are dropped` });
    items.slice(0, l.maxItems).forEach((it, i) => {
      const o = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
      for (const [fk, fs] of Object.entries(l.fields)) issues.push(...checkText(`${key}[${i}].${fk}`, o[fk], { ...fs, label: `${l.label} ${i + 1} ${fs.label.toLowerCase()}` }));
      if (l.icon?.required && typeof o.icon !== 'string') issues.push({ field: `${key}[${i}].icon`, level: 'warning', message: `${l.label} ${i + 1}: no icon — "${l.icon.fallback}" is used` });
    });
  }
  const checkNumber = (field: string, v: unknown, n: NumberSpec) => {
    if (v === undefined || v === null || v === '') {
      if (n.required) issues.push({ field, level: 'error', message: `${n.label} is required` });
      return;
    }
    const x = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(x)) issues.push({ field, level: 'error', message: `${n.label} must be a raw number (got "${String(v)}")` });
    else {
      if (n.min !== undefined && x < n.min) issues.push({ field, level: 'error', message: `${n.label} must be ≥ ${n.min}` });
      if (n.max !== undefined && x > n.max) issues.push({ field, level: 'error', message: `${n.label} must be ≤ ${n.max}` });
      if (n.integer && !Number.isInteger(x)) issues.push({ field, level: 'warning', message: `${n.label} should be a whole number` });
      if (typeof v === 'string') issues.push({ field, level: 'warning', message: `${n.label} was sent as text — send a raw number` });
    }
  };
  for (const [k, n] of Object.entries(spec.numbers ?? {})) checkNumber(k, props[k], n);
  for (const [k, l] of Object.entries(spec.lists)) {
    const items = Array.isArray(props[k]) ? (props[k] as unknown[]) : [];
    items.slice(0, l.maxItems).forEach((it, i) => {
      const o = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
      for (const [fk, n] of Object.entries(l.numbers ?? {})) checkNumber(`${k}[${i}].${fk}`, o[fk], { ...n, label: `${l.label} ${i + 1} ${n.label.toLowerCase()}` });
    });
  }
  const hasUrl = (v: unknown) => typeof v === 'string' && v.trim() !== '';
  if (spec.image?.required && !hasUrl(props.image_url)) issues.push({ field: 'image_url', level: 'error', message: `${spec.image.label ?? 'Image'} is required` });
  for (const [k, im] of Object.entries(spec.images ?? {})) if (im.required && !hasUrl(props[k])) issues.push({ field: k, level: 'error', message: `${im.label} is required` });
  for (const [k, ic] of Object.entries(spec.icons ?? {}))
    if (ic.required && typeof props[k] !== 'string') issues.push({ field: k, level: 'warning', message: `${ic.label}: no icon — "${ic.fallback}" is used` });
  const bag = props.animations && typeof props.animations === 'object' ? (props.animations as Record<string, unknown>) : {};
  for (const [key, v] of Object.entries(bag)) {
    const slot = spec.animations[key];
    if (!slot) issues.push({ field: `animations.${key}`, level: 'warning', message: `Unknown animation slot "${key}"` });
    else if (typeof v !== 'string' || !animValues(slot).includes(v))
      issues.push({ field: `animations.${key}`, level: 'warning', message: `${slot.label}: "${String(v)}" is not one of ${animValues(slot).join(', ')} — "${slot.default}" is used` });
  }
  issues.push(...validateStyle(props, spec));
  if (spec.validate) issues.push(...spec.validate(props));
  const d = typeof props.duration_frames === 'number' ? props.duration_frames : undefined;
  if (d !== undefined && (d < spec.duration.min || d > spec.duration.max))
    issues.push({ field: 'duration_frames', level: 'warning', message: `Duration ${(d / FPS).toFixed(1)}s is outside ${spec.duration.min / FPS}–${spec.duration.max / FPS}s` });
  if (Array.isArray(props.cue_times)) {
    const cues = props.cue_times as unknown[];
    cues.forEach((c, i) => {
      if (c === null) return;
      if (typeof c !== 'number' || !Number.isFinite(c) || c < 0) issues.push({ field: `cue_times[${i}]`, level: 'error', message: `Cue ${i + 1} must be a number of seconds ≥ 0` });
      else if (i > 0 && typeof cues[i - 1] === 'number' && c < (cues[i - 1] as number)) issues.push({ field: `cue_times[${i}]`, level: 'warning', message: `Cue ${i + 1} is earlier than cue ${i} — it will follow cue ${i}` });
    });
  }
  return issues;
}

/** JSON view of a spec for the backend / LLM prompt. */
export function specToJSON(spec: TemplateSpec) {
  const text = (s: TextSpec) => ({
    required: s.required,
    chars: [s.minChars, s.maxChars],
    words: [s.minWords, s.maxWords],
    max_word_chars: s.maxWordChars,
    max_lines: s.maxLines,
    font_px: [s.fontMin, s.fontMax],
    ...(s.hint ? { hint: s.hint } : {}),
  });
  return {
    id: spec.id,
    animation_type: spec.animationType,
    name: spec.name,
    duration_frames: spec.duration,
    text: Object.fromEntries(Object.entries(spec.text).map(([k, s]) => [k, text(s)])),
    lists: Object.fromEntries(
      Object.entries(spec.lists).map(([k, l]) => [
        k,
        { items: [l.minItems, l.maxItems], icon: l.icon ?? null, fields: Object.fromEntries(Object.entries(l.fields).map(([fk, fs]) => [fk, text(fs)])) },
      ]),
    ),
    options: Object.fromEntries(Object.entries(spec.options).map(([k, o]) => [k, { values: o.values, default: o.default }])),
    animations: Object.fromEntries(
      Object.entries(spec.animations).map(([k, a]) => [
        k,
        { target: a.target, default: a.default, values: Object.fromEntries(animValues(a).map((v) => [v, describeAnim(a.kind, v)])) },
      ]),
    ),
    timing: {
      duration_frames: [spec.duration.min, spec.duration.max],
      fps: FPS,
      cue_times: { unit: 'seconds from template start', description: spec.cues.description, pins: spec.cues.units },
    },
  };
}


/* ------------------------------------------------------------------ */
/* Shared field presets                                                 */
/* ------------------------------------------------------------------ */

/** Hero title used by every template with a big title (FS-01, FS-03, …). */
export const HERO_TITLE: TextSpec = {
  label: 'Title',
  required: true,
  minChars: 3,
  maxChars: 40,
  minWords: 1,
  maxWords: 8,
  maxWordChars: 18,
  maxLines: 2,
  fontMax: 150,
  fontMin: 84,
  weight: 800,
  lineHeight: 1.04,
  hint: 'Short, punchy. 2–8 words.',
  fills: 'Big title',
};

/** Background image input shared by every template with image backgrounds. */
export const BACKGROUND_IMAGE: ImageSpec = {
  label: 'Background image',
  required: false,
  fills: 'Full-bleed background (used when background = "image")',
};

/* ------------------------------------------------------------------ */
/* Input list, JSON Schema and input file                               */
/* ------------------------------------------------------------------ */

export type InputType = 'text' | 'number' | 'icon' | 'image' | 'color' | 'choice' | 'list' | 'array' | 'animation' | 'cues';

export type InputDef = {
  path: string;
  type: InputType;
  required: boolean;
  fills: string;
  limits?: string;
  values?: readonly string[];
  default?: unknown;
  fallback?: string;
  hint?: string;
  example?: unknown;
};

const textLimits = (t: TextSpec) =>
  `${t.minChars}–${t.maxChars} chars · ${t.minWords}–${t.maxWords} words · longest word ${t.maxWordChars} · max ${t.maxLines} line${t.maxLines > 1 ? 's' : ''}`;
const numberLimits = (n: NumberSpec) =>
  [n.integer ? 'integer' : 'number', n.min !== undefined ? `≥ ${n.min}` : '', n.max !== undefined ? `≤ ${n.max}` : ''].filter(Boolean).join(' · ');

/** Every input of a template, in the order the LLM should think about them. */
export function buildInputs(spec: TemplateSpec): InputDef[] {
  const out: InputDef[] = [];
  for (const [k, n] of Object.entries(spec.numbers ?? {}))
    out.push({ path: k, type: 'number', required: n.required, fills: n.fills, limits: numberLimits(n), hint: n.hint, example: n.example });
  for (const [k, t] of Object.entries(spec.text))
    out.push({ path: k, type: 'text', required: t.required, fills: t.fills ?? t.label, limits: textLimits(t), hint: t.hint, example: t.example });
  for (const [k, ic] of Object.entries(spec.icons ?? {}))
    out.push({ path: k, type: 'icon', required: ic.required, fills: ic.fills, limits: 'Lucide icon name', fallback: ic.fallback, example: ic.example });
  for (const [k, l] of Object.entries(spec.lists)) {
    out.push({ path: `${k}[]`, type: 'list', required: l.minItems > 0 && !l.optional, fills: l.fills ?? `${l.label}s`, limits: `${l.minItems}–${l.maxItems} items` });
    for (const [fk, t] of Object.entries(l.fields))
      out.push({ path: `${k}[].${fk}`, type: 'text', required: t.required, fills: t.fills ?? `${l.label} ${t.label.toLowerCase()}`, limits: textLimits(t), hint: t.hint });
    for (const [fk, n] of Object.entries(l.numbers ?? {}))
      out.push({ path: `${k}[].${fk}`, type: 'number', required: n.required, fills: n.fills, limits: numberLimits(n), hint: n.hint });
    if (l.icon)
      out.push({ path: `${k}[].icon`, type: 'icon', required: l.icon.required, fills: `${l.label} icon`, limits: 'Lucide icon name', fallback: l.icon.fallback });
    if (l.image)
      out.push({ path: `${k}[].image_url`, type: 'image', required: l.image.required, fills: l.image.fills, limits: 'https URL or asset URL' });
    if (l.bgColor)
      out.push({ path: `${k}[].bg_color`, type: 'color', required: false, fills: `Background colour of ${l.bgColor} (to highlight it)`, limits: 'hex #RRGGBB (or #RRGGBBAA)', default: 'theme card colour' });
  }
  if (spec.custom) out.push(...spec.custom.inputs);
  if (spec.image) out.push({ path: 'image_url', type: 'image', required: spec.image.required, fills: spec.image.fills, limits: 'https URL or asset URL' });
  for (const [k, im] of Object.entries(spec.images ?? {})) out.push({ path: k, type: 'image', required: im.required, fills: im.fills, limits: 'https URL or asset URL' });
  for (const [k, o] of Object.entries(spec.options))
    out.push({ path: k, type: 'choice', required: false, fills: o.fills ?? o.label, values: o.values, default: o.default });
  out.push(...styleInputs(spec));
  for (const [k, a] of Object.entries(spec.animations))
    out.push({
      path: `animations.${k}`,
      type: 'animation',
      required: false,
      fills: a.target,
      values: ANIMS_BY_KIND[a.kind],
      default: a.default,
      hint: ANIMS_BY_KIND[a.kind].map((v) => `${v}: ${describeAnim(a.kind, v)}`).join('; '),
    });
  out.push({
    path: 'cue_times',
    type: 'cues',
    required: false,
    fills: `When elements appear: ${spec.cues.units.join(' → ')}`,
    limits: `seconds from the template start, increasing; ${spec.cues.description}`,
  });
  return out;
}

type Json = Record<string, unknown>;
const textSchema = (t: TextSpec): Json => ({
  type: 'string',
  minLength: t.minChars,
  maxLength: t.maxChars,
  description: `${t.fills ?? t.label}. ${t.minWords}–${t.maxWords} words, longest word ${t.maxWordChars} letters.${t.hint ? ` ${t.hint}` : ''}`,
});
const numberSchema = (n: NumberSpec): Json => ({
  type: n.integer ? 'integer' : 'number',
  ...(n.min !== undefined ? { minimum: n.min } : {}),
  ...(n.max !== undefined ? { maximum: n.max } : {}),
  description: `${n.fills}.${n.hint ? ` ${n.hint}` : ''} Raw number, no units or commas.`,
});

/** JSON Schema (draft 2020-12) for the LLM's structured output. */
export function toJsonSchema(spec: TemplateSpec): Json {
  const properties: Json = {};
  const required: string[] = [];
  for (const [k, n] of Object.entries(spec.numbers ?? {})) {
    properties[k] = numberSchema(n);
    if (n.required) required.push(k);
  }
  for (const [k, t] of Object.entries(spec.text)) {
    properties[k] = textSchema(t);
    if (t.required) required.push(k);
  }
  for (const [k, ic] of Object.entries(spec.icons ?? {})) {
    properties[k] = { type: 'string', description: `${ic.fills}. Lucide icon name (kebab-case), e.g. "${ic.example ?? ic.fallback}".` };
    if (ic.required) required.push(k);
  }
  for (const [k, l] of Object.entries(spec.lists)) {
    const ip: Json = {};
    const ir: string[] = [];
    for (const [fk, t] of Object.entries(l.fields)) {
      ip[fk] = textSchema(t);
      if (t.required) ir.push(fk);
    }
    for (const [fk, n] of Object.entries(l.numbers ?? {})) {
      ip[fk] = numberSchema(n);
      if (n.required) ir.push(fk);
    }
    if (l.icon) {
      ip.icon = { type: 'string', description: `Lucide icon name (kebab-case). Optional; fallback ${l.icon.fallback}.` };
      if (l.icon.required) ir.push('icon');
    }
    if (l.image) {
      ip.image_url = { type: 'string', format: 'uri', description: l.image.fills };
      if (l.image.required) ir.push('image_url');
    }
    if (l.bgColor) ip.bg_color = { type: 'string', pattern: HEX.source, description: `Background colour of ${l.bgColor}, hex e.g. #1E3A8A (optional — highlights it)` };
    properties[k] = {
      type: 'array',
      minItems: l.minItems,
      maxItems: l.maxItems,
      items: { type: 'object', properties: ip, required: ir, additionalProperties: false },
      description: l.fills ?? `${l.label}s`,
    };
    if (l.minItems > 0 && !l.optional) required.push(k);
  }
  if (spec.custom) {
    Object.assign(properties, spec.custom.schema);
    required.push(...(spec.custom.required ?? []));
  }
  if (spec.image) {
    properties.image_url = { type: 'string', format: 'uri', description: spec.image.fills };
    if (spec.image.required) required.push('image_url');
  }
  for (const [k, im] of Object.entries(spec.images ?? {})) {
    properties[k] = { type: 'string', format: 'uri', description: im.fills };
    if (im.required) required.push(k);
  }
  for (const [k, o] of Object.entries(spec.options)) properties[k] = { type: 'string', enum: o.values, default: o.default, description: o.fills ?? o.label };
  Object.assign(properties, styleSchema(spec));
  properties.animations = {
    type: 'object',
    additionalProperties: false,
    description: 'Animation preset per element. Omit a key to use its default.',
    properties: Object.fromEntries(
      Object.entries(spec.animations).map(([k, a]) => [k, { type: 'string', enum: [...ANIMS_BY_KIND[a.kind]], default: a.default, description: a.target }]),
    ),
  };
  properties.cue_times = {
    type: 'array',
    items: { type: ['number', 'null'], minimum: 0 },
    maxItems: spec.cues.units.length,
    description: `Seconds from the template start when each element appears, in order: ${spec.cues.units.join(', ')}. ${spec.cues.description} Compute as (spoken word time − beat start time) from WhisperX.`,
  };
  // editor overrides (core/editable.tsx) — written by the video-editing frontend, not by the LLM
  const HEXS = { type: 'string', pattern: HEX.source };
  const ANIM = {
    type: 'object',
    additionalProperties: false,
    properties: {
      entrance: { type: 'object', properties: { type: { enum: ['none', 'fade', 'slide_up', 'slide_down', 'slide_left', 'slide_right', 'pop', 'zoom_in', 'blur_in', 'drop', 'spin_in'] }, start: { type: 'number' }, duration: { type: 'number' }, easing: { enum: ['linear', 'ease_in', 'ease_out', 'ease_in_out', 'back_out'] }, distance: { type: 'number' } } },
      exit: { type: 'object', properties: { type: { enum: ['none', 'fade', 'slide_up', 'slide_down', 'slide_left', 'slide_right', 'zoom_out', 'blur_out', 'shrink'] }, start: { type: 'number' }, duration: { type: 'number' }, easing: { enum: ['linear', 'ease_in', 'ease_out', 'ease_in_out', 'back_out'] }, distance: { type: 'number' } } },
      emphasis: { type: 'object', properties: { type: { enum: ['none', 'pulse', 'shake', 'wiggle', 'bounce', 'float', 'glow'] }, start: { type: 'number' }, period: { type: 'number' }, intensity: { type: 'number' } } },
    },
  };
  properties.elements = {
    type: 'object',
    description: 'Editor edits per element id (see element_manifest.json): position, style, visibility and animation.',
    additionalProperties: {
      type: 'object',
      additionalProperties: false,
      properties: {
        visible: { type: 'boolean' }, offset_x: { type: 'number' }, offset_y: { type: 'number' }, scale: { type: 'number', minimum: 0.2, maximum: 4 }, rotation: { type: 'number' }, opacity: { type: 'number', minimum: 0, maximum: 1 }, z_index: { type: 'number' },
        font_family: { type: 'string' }, font_weight: { type: 'number' }, text_color: HEXS, letter_spacing: { type: 'number' }, text_case: { enum: ['none', 'upper', 'lower', 'title'] }, text_align: { enum: ['left', 'center', 'right'] }, italic: { type: 'boolean' }, underline: { type: 'boolean' },
        fill: HEXS, border: { type: 'object', properties: { color: HEXS, width: { type: 'number' }, radius: { type: 'number' } } }, shadow: { type: 'object', properties: { color: HEXS, blur: { type: 'number' }, offset_x: { type: 'number' }, offset_y: { type: 'number' } } },
        blend_mode: { enum: ['normal', 'multiply', 'screen', 'overlay', 'lighten', 'darken'] }, animation: ANIM,
      },
    },
  };
  properties.groups = {
    type: 'array',
    description: 'Editor groups: move / fade / hide / animate several elements together.',
    items: { type: 'object', additionalProperties: false, required: ['id', 'members'], properties: { id: { type: 'string' }, members: { type: 'array', items: { type: 'string' } }, visible: { type: 'boolean' }, offset_x: { type: 'number' }, offset_y: { type: 'number' }, opacity: { type: 'number', minimum: 0, maximum: 1 }, animation: ANIM } },
  };
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: `${spec.id} ${spec.name}`,
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

/** The per-template input file handed to the backend / LLM (XX00Name.inputs.json). */
export function toInputFile(spec: TemplateSpec) {
  return {
    template: spec.id,
    name: spec.name,
    animation_type: spec.animationType,
    pick_when: spec.pickWhen ?? '',
    placement: spec.placement ?? 'full',
    frame: { width: 1920, height: 1080, fps: FPS, safe_margin_px: 100, safe_box: [1720, 880] },
    duration: {
      frames: [spec.duration.min, spec.duration.max],
      seconds: [spec.duration.min / FPS, spec.duration.max / FPS],
      default_frames: spec.duration.default,
      note: 'Length comes from the voice beat (clock.durationInFrames), not from props.',
    },
    rules: [
      'Stay within every limit below; longer text is shortened at a word boundary, too-short or missing required fields are errors.',
      'Numbers are raw values (no commas, units or currency symbols) — the template formats and animates them.',
      'Only real, sourced facts, quotes and figures. Label invented example numbers as illustrative.',
      'Icons are Lucide names from the repository icon map; unknown names render as a circle.',
    ],
    inputs: buildInputs(spec),
    json_schema: toJsonSchema(spec),
    example: spec.example ?? {},
  };
}


/* ------------------------------------------------------------------ */
/* Font sizes and colours                                               */
/* ------------------------------------------------------------------ */

/** Every font-size input of a template: text fields, list fields ("steps.title") and extras. */
export function sizeInputs(spec: TemplateSpec): Record<string, SizeSpec> {
  const out: Record<string, SizeSpec> = {};
  for (const [k, t] of Object.entries(spec.text)) if (!t.noSize) out[k] = { label: t.label, min: t.fontMin, max: t.fontMax, fills: t.fills ?? t.label };
  for (const [k, l] of Object.entries(spec.lists))
    for (const [fk, t] of Object.entries(l.fields))
      out[`${k}.${fk}`] = { label: `${l.label} ${t.label.toLowerCase()}`, min: t.fontMin, max: t.fontMax, fills: t.fills ?? `${l.label} ${t.label.toLowerCase()}` };
  for (const [k, z] of Object.entries(spec.sizes ?? {})) out[k] = z;
  return out;
}

export function colorSlots(spec: TemplateSpec): ColorSlot[] {
  return [...COMMON_COLORS, ...(spec.colors ?? []).filter((c) => !COMMON_COLORS.includes(c))];
}

const clampNum = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Applies props.font_sizes: each requested size becomes that field's starting (largest) size,
 * clamped to its allowed range. Fitting can still shrink it so nothing overlaps.
 * Returns a copy of the spec plus the resolved extra sizes.
 */
export function applySizes(spec: TemplateSpec, props: Record<string, unknown>): { spec: TemplateSpec; extra: Record<string, number> } {
  const bag = props.font_sizes && typeof props.font_sizes === 'object' ? (props.font_sizes as Record<string, unknown>) : {};
  const want = (key: string, min: number, max: number): number | undefined => {
    const v = typeof bag[key] === 'number' ? (bag[key] as number) : typeof bag[key] === 'string' ? Number(bag[key]) : NaN;
    return Number.isFinite(v) ? clampNum(v, min, max) : undefined;
  };
  const text = Object.fromEntries(
    Object.entries(spec.text).map(([k, t]) => [k, { ...t, fontMax: want(k, t.fontMin, t.fontMax) ?? t.fontMax }]),
  );
  const lists = Object.fromEntries(
    Object.entries(spec.lists).map(([k, l]) => [
      k,
      { ...l, fields: Object.fromEntries(Object.entries(l.fields).map(([fk, t]) => [fk, { ...t, fontMax: want(`${k}.${fk}`, t.fontMin, t.fontMax) ?? t.fontMax }])) },
    ]),
  );
  const extra = Object.fromEntries(Object.entries(spec.sizes ?? {}).map(([k, z]) => [k, want(k, z.min, z.max) ?? z.max]));
  return { spec: { ...spec, text, lists }, extra };
}

/** Style + font-size inputs for the input list. */
export function styleInputs(spec: TemplateSpec): InputDef[] {
  const out: InputDef[] = [
    { path: 'style.heading_font', type: 'choice', required: false, fills: 'Font for bold text (weight ≥ 700: titles, numbers, headings)', values: FONT_KEYS, default: 'poppins' },
    { path: 'style.body_font', type: 'choice', required: false, fills: 'Font for all other text', values: FONT_KEYS, default: 'poppins (or the heading font)' },
  ];
  for (const slot of colorSlots(spec)) {
    const c = COLOR_SLOTS[slot];
    out.push({ path: `style.${slot}_color`, type: 'color', required: false, fills: c.fills, limits: 'hex #RRGGBB (or #RRGGBBAA)', default: c.default ?? 'derived' });
  }
  // theme background colours can also be given at the top level (they win over style.*)
  for (const slot of ['background', 'background_2'] as const) {
    const c = COLOR_SLOTS[slot];
    out.push({ path: `${slot}_color`, type: 'color', required: false, fills: `${c.fills} — same as style.${slot}_color; used when background is "theme"`, limits: 'hex #RRGGBB (or #RRGGBBAA)', default: c.default ?? 'derived' });
  }
  for (const [k, z] of Object.entries(sizeInputs(spec)))
    out.push({ path: `font_sizes.${k}`, type: 'number', required: false, fills: `Font size of ${z.fills.toLowerCase()} (px, largest; shrinks only if it would not fit)`, limits: `${z.min}–${z.max} px`, default: z.max });
  return out;
}

export function styleSchema(spec: TemplateSpec): Record<string, unknown> {
  const colorProps = Object.fromEntries(
    colorSlots(spec).map((slot) => [
      `${slot}_color`,
      { type: 'string', pattern: HEX.source, description: COLOR_SLOTS[slot].fills, ...(COLOR_SLOTS[slot].default ? { default: COLOR_SLOTS[slot].default } : {}) },
    ]),
  );
  return {
    background_color: { type: 'string', pattern: HEX.source, description: `${COLOR_SLOTS.background.fills} (same as style.background_color; wins over it)` },
    background_2_color: { type: 'string', pattern: HEX.source, description: `${COLOR_SLOTS.background_2.fills} (same as style.background_2_color; wins over it)` },
    style: {
      type: 'object',
      additionalProperties: false,
      description: 'Fonts and colours. Omit any key to use the default.',
      properties: {
        heading_font: { type: 'string', enum: FONT_KEYS, default: 'poppins', description: 'Font for weight ≥ 700 text' },
        body_font: { type: 'string', enum: FONT_KEYS, description: 'Font for other text' },
        ...colorProps,
      },
    },
    font_sizes: {
      type: 'object',
      additionalProperties: false,
      description: 'Largest font size per element in px. The template still shrinks text that would not fit.',
      properties: Object.fromEntries(
        Object.entries(sizeInputs(spec)).map(([k, z]) => [k, { type: 'number', minimum: z.min, maximum: z.max, default: z.max, description: z.fills }]),
      ),
    },
  };
}

/** Beat length vs the template's allowed range (spec.duration, in frames at 30 fps). */
export function validateDuration(spec: TemplateSpec, durationInFrames: number): Issue[] {
  const { min, max } = spec.duration;
  const sec = (f: number) => Math.round((f / 30) * 10) / 10;
  if (durationInFrames > max) return [{ field: 'duration', level: 'error', message: `Beat is ${sec(durationInFrames)}s but ${spec.id} allows ${sec(min)}–${sec(max)}s — split the beat or pick a longer template` }];
  if (durationInFrames < min) return [{ field: 'duration', level: 'error', message: `Beat is ${sec(durationInFrames)}s but ${spec.id} needs at least ${sec(min)}s` }];
  return [];
}

export function validateStyle(props: Record<string, unknown>, spec: TemplateSpec, durationInFrames?: number): Issue[] {
  const issues: Issue[] = durationInFrames !== undefined ? validateDuration(spec, durationInFrames) : [];
  for (const k of ['background_color', 'background_2_color'])
    if (props[k] !== undefined && !(typeof props[k] === 'string' && HEX.test((props[k] as string).trim()))) issues.push({ field: k, level: 'warning', message: `${k} must be a hex colour like #141A45 — default used` });
  const st = props.style && typeof props.style === 'object' ? (props.style as Record<string, unknown>) : {};
  for (const f of ['heading_font', 'body_font'])
    if (st[f] !== undefined && !(typeof st[f] === 'string' && (st[f] as string) in FONT_CHOICES))
      issues.push({ field: `style.${f}`, level: 'warning', message: `Unknown font "${String(st[f])}" — default used. Options: ${FONT_KEYS.join(', ')}` });
  for (const [k, v] of Object.entries(st)) {
    if (!k.endsWith('_color')) continue;
    if (!(k.replace(/_color$/, '') in COLOR_SLOTS)) issues.push({ field: `style.${k}`, level: 'warning', message: `Unknown colour "${k}"` });
    else if (typeof v !== 'string' || !HEX.test(v.trim())) issues.push({ field: `style.${k}`, level: 'warning', message: `${k} must be a hex colour like #F5A524 — default used` });
  }
  const sz = props.font_sizes && typeof props.font_sizes === 'object' ? (props.font_sizes as Record<string, unknown>) : {};
  const allowed = sizeInputs(spec);
  for (const [k, v] of Object.entries(sz)) {
    const z = allowed[k];
    if (!z) issues.push({ field: `font_sizes.${k}`, level: 'warning', message: `No font size input "${k}"` });
    else if (typeof v !== 'number' || v < z.min || v > z.max) issues.push({ field: `font_sizes.${k}`, level: 'warning', message: `${z.label} size must be ${z.min}–${z.max}px — clamped` });
  }
  return issues;
}
