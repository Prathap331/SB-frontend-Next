/**
 * Editor overrides — lets the video-editing frontend change any element of any template without
 * touching template code. Every element a template draws is tagged `data-sb-group="<element id>"`
 * (see leaf() in shared.tsx); the element manifest (element_manifest.json) lists them per template.
 *
 * props.elements  { [elementId]: ElementOverride }    — per-element edits
 * props.groups    [ { id, members[], …GroupOverride } ] — move / hide / fade / animate several together
 *
 * Matching: "title" edits the element "title" and all its parts ("title-0", "title-1" = lines);
 * "title-1" edits only that line.
 *
 * All values are resolved per frame into one CSS rule per element (deterministic in Remotion):
 *   position   → CSS translate / scale / rotate (composes with the template's own animation)
 *   opacity    → filter: opacity()               (multiplies the template's own fade)
 *   animation  → frame-driven entrance / exit / emphasis, added on top
 * Offsets are canvas pixels (1920×1080); SafeArea converts them for the auto-fit scale.
 */
import { createContext, useContext, type ComponentType } from 'react';
import type { TemplateProps } from '../../../../types';
import { FONT_CHOICES, HEX } from './style';

export type Easing = 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out' | 'back_out';
export type EntranceType = 'none' | 'fade' | 'slide_up' | 'slide_down' | 'slide_left' | 'slide_right' | 'pop' | 'zoom_in' | 'blur_in' | 'drop' | 'spin_in';
export type ExitType = 'none' | 'fade' | 'slide_up' | 'slide_down' | 'slide_left' | 'slide_right' | 'zoom_out' | 'blur_out' | 'shrink';
export type EmphasisType = 'none' | 'pulse' | 'shake' | 'wiggle' | 'bounce' | 'float' | 'glow';
export const ENTRANCES: EntranceType[] = ['none', 'fade', 'slide_up', 'slide_down', 'slide_left', 'slide_right', 'pop', 'zoom_in', 'blur_in', 'drop', 'spin_in'];
export const EXITS: ExitType[] = ['none', 'fade', 'slide_up', 'slide_down', 'slide_left', 'slide_right', 'zoom_out', 'blur_out', 'shrink'];
export const EMPHASES: EmphasisType[] = ['none', 'pulse', 'shake', 'wiggle', 'bounce', 'float', 'glow'];
export const EASINGS: Easing[] = ['linear', 'ease_in', 'ease_out', 'ease_in_out', 'back_out'];

export type ElementAnimation = {
  entrance?: { type: EntranceType; start?: number; duration?: number; easing?: Easing; distance?: number };
  exit?: { type: ExitType; start?: number; duration?: number; easing?: Easing; distance?: number };
  emphasis?: { type: EmphasisType; start?: number; period?: number; intensity?: number };
};

export type ElementOverride = {
  visible?: boolean;
  offset_x?: number;
  offset_y?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
  z_index?: number;
  font_family?: string;
  font_weight?: number;
  text_color?: string;
  letter_spacing?: number;
  text_case?: 'none' | 'upper' | 'lower' | 'title';
  text_align?: 'left' | 'center' | 'right';
  italic?: boolean;
  underline?: boolean;
  fill?: string;
  border?: { color?: string; width?: number; radius?: number };
  shadow?: { color?: string; blur?: number; offset_x?: number; offset_y?: number };
  blend_mode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'lighten' | 'darken';
  animation?: ElementAnimation;
};
export type GroupOverride = Pick<ElementOverride, 'visible' | 'offset_x' | 'offset_y' | 'opacity' | 'animation'> & { id: string; members: string[] };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const num = (v: unknown, lo: number, hi: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : undefined);
const hex = (v: unknown): string | undefined => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim() : undefined);
const ID = /^[A-Za-z0-9_.:-]{1,80}$/;

function ease(e: Easing | undefined, t: number): number {
  const x = clamp(t, 0, 1);
  switch (e ?? 'ease_out') {
    case 'linear': return x;
    case 'ease_in': return x * x * x;
    case 'ease_in_out': return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    case 'back_out': { const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
    default: return 1 - Math.pow(1 - x, 3);
  }
}

/** Per-frame motion from an element's animation: extra translate (px), scale, rotate (deg), opacity, blur (px), glow. */
type Motion = { dx: number; dy: number; s: number; r: number; o: number; blur: number; glow: number };
const IDENTITY: Motion = { dx: 0, dy: 0, s: 1, r: 0, o: 1, blur: 0, glow: 0 };

export function animationAt(a: ElementAnimation | undefined, tSec: number, clipSec: number): Motion {
  const m = { ...IDENTITY };
  if (!a) return m;
  const en = a.entrance;
  if (en && en.type !== 'none') {
    const start = en.start ?? 0;
    const dur = Math.max(0.05, en.duration ?? 0.5);
    const p = tSec < start ? 0 : ease(en.easing ?? (en.type === 'pop' ? 'back_out' : 'ease_out'), (tSec - start) / dur);
    const q = 1 - p;
    const d = en.distance ?? 80;
    switch (en.type) {
      case 'fade': m.o *= p; break;
      case 'slide_up': m.dy += d * q; m.o *= p; break;
      case 'slide_down': m.dy -= d * q; m.o *= p; break;
      case 'slide_left': m.dx += d * q; m.o *= p; break;
      case 'slide_right': m.dx -= d * q; m.o *= p; break;
      case 'pop': m.s *= Math.max(0, p); m.o *= tSec < start ? 0 : 1; break;
      case 'zoom_in': m.s *= 0.6 + 0.4 * p; m.o *= p; break;
      case 'blur_in': m.blur += 16 * q; m.o *= p; break;
      case 'drop': m.dy -= (d * 3) * q; m.o *= tSec < start ? 0 : 1; break;
      case 'spin_in': m.r -= 180 * q; m.s *= 0.5 + 0.5 * p; m.o *= p; break;
    }
  }
  const ex = a.exit;
  if (ex && ex.type !== 'none') {
    const dur = Math.max(0.05, ex.duration ?? 0.4);
    const start = ex.start ?? Math.max(0, clipSec - dur);
    const p = tSec <= start ? 0 : ease(ex.easing ?? 'ease_in', (tSec - start) / dur);
    const d = ex.distance ?? 80;
    switch (ex.type) {
      case 'fade': m.o *= 1 - p; break;
      case 'slide_up': m.dy -= d * p; m.o *= 1 - p; break;
      case 'slide_down': m.dy += d * p; m.o *= 1 - p; break;
      case 'slide_left': m.dx -= d * p; m.o *= 1 - p; break;
      case 'slide_right': m.dx += d * p; m.o *= 1 - p; break;
      case 'zoom_out': m.s *= 1 + 0.4 * p; m.o *= 1 - p; break;
      case 'blur_out': m.blur += 16 * p; m.o *= 1 - p; break;
      case 'shrink': m.s *= 1 - p; break;
    }
  }
  const em = a.emphasis;
  if (em && em.type !== 'none') {
    const start = em.start ?? 0;
    if (tSec >= start) {
      const period = Math.max(0.2, em.period ?? 1);
      const k = clamp(em.intensity ?? 1, 0, 3);
      const ph = ((tSec - start) / period) * Math.PI * 2;
      switch (em.type) {
        case 'pulse': m.s *= 1 + 0.06 * k * (0.5 + 0.5 * Math.sin(ph)); break;
        case 'shake': m.dx += Math.sin(ph * 4) * 8 * k; break;
        case 'wiggle': m.r += Math.sin(ph * 2) * 5 * k; break;
        case 'bounce': m.dy -= Math.abs(Math.sin(ph)) * 16 * k; break;
        case 'float': m.dy += Math.sin(ph) * 10 * k; break;
        case 'glow': m.glow = (0.5 + 0.5 * Math.sin(ph)) * 18 * k; break;
      }
    }
  }
  return m;
}

/** Parse / sanitise editor input (anything invalid is dropped, numbers are clamped to safe ranges). */
export function readOverrides(props: Record<string, unknown>): { elements: Record<string, ElementOverride>; groups: GroupOverride[] } {
  const elements: Record<string, ElementOverride> = {};
  const raw = props.elements && typeof props.elements === 'object' ? (props.elements as Record<string, unknown>) : {};
  for (const [id, v] of Object.entries(raw)) {
    if (!ID.test(id) || !v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const b = (o.border && typeof o.border === 'object' ? o.border : {}) as Record<string, unknown>;
    const sh = (o.shadow && typeof o.shadow === 'object' ? o.shadow : {}) as Record<string, unknown>;
    elements[id] = {
      visible: typeof o.visible === 'boolean' ? o.visible : undefined,
      offset_x: num(o.offset_x, -1920, 1920),
      offset_y: num(o.offset_y, -1080, 1080),
      scale: num(o.scale, 0.2, 4),
      rotation: num(o.rotation, -360, 360),
      opacity: num(o.opacity, 0, 1),
      z_index: num(o.z_index, -10, 100),
      font_family: typeof o.font_family === 'string' ? o.font_family : undefined,
      font_weight: num(o.font_weight, 100, 900),
      text_color: hex(o.text_color),
      letter_spacing: num(o.letter_spacing, -0.2, 1),
      text_case: ['none', 'upper', 'lower', 'title'].includes(o.text_case as string) ? (o.text_case as ElementOverride['text_case']) : undefined,
      text_align: ['left', 'center', 'right'].includes(o.text_align as string) ? (o.text_align as ElementOverride['text_align']) : undefined,
      italic: typeof o.italic === 'boolean' ? o.italic : undefined,
      underline: typeof o.underline === 'boolean' ? o.underline : undefined,
      fill: hex(o.fill),
      border: o.border ? { color: hex(b.color), width: num(b.width, 0, 40), radius: num(b.radius, 0, 999) } : undefined,
      shadow: o.shadow ? { color: hex(sh.color), blur: num(sh.blur, 0, 80), offset_x: num(sh.offset_x, -80, 80), offset_y: num(sh.offset_y, -80, 80) } : undefined,
      blend_mode: ['normal', 'multiply', 'screen', 'overlay', 'lighten', 'darken'].includes(o.blend_mode as string) ? (o.blend_mode as ElementOverride['blend_mode']) : undefined,
      animation: o.animation && typeof o.animation === 'object' ? (o.animation as ElementAnimation) : undefined,
    };
  }
  const groups: GroupOverride[] = (Array.isArray(props.groups) ? props.groups : [])
    .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object')
    .map((g) => ({
      id: String(g.id ?? ''),
      members: (Array.isArray(g.members) ? g.members : []).filter((m): m is string => typeof m === 'string' && ID.test(m)),
      visible: typeof g.visible === 'boolean' ? g.visible : undefined,
      offset_x: num(g.offset_x, -1920, 1920),
      offset_y: num(g.offset_y, -1080, 1080),
      opacity: num(g.opacity, 0, 1),
      animation: g.animation && typeof g.animation === 'object' ? (g.animation as ElementAnimation) : undefined,
    }))
    .filter((g) => g.members.length);
  return { elements, groups };
}

/** Resolved per-frame values handed to SafeArea (canvas px). */
export type ResolvedEdit = { id: string; o: ElementOverride; m: Motion };
export const EditsContext = createContext<ResolvedEdit[]>([]);
export const useEdits = () => useContext(EditsContext);

export function resolveEdits(props: Record<string, unknown>, frame: number, durationInFrames: number, fps = 30): ResolvedEdit[] {
  const { elements, groups } = readOverrides(props);
  const t = frame / fps;
  const clip = durationInFrames / fps;
  const ids = new Set([...Object.keys(elements), ...groups.flatMap((g) => g.members)]);
  const out: ResolvedEdit[] = [];
  for (const id of ids) {
    const o = elements[id] ?? {};
    let m = animationAt(o.animation, t, clip);
    // group edits add to the member's own (move, fade, hide and animate together)
    let o2: ElementOverride = { ...o };
    for (const g of groups) {
      if (!g.members.includes(id)) continue;
      const gm = animationAt(g.animation, t, clip);
      m = { dx: m.dx + gm.dx, dy: m.dy + gm.dy, s: m.s * gm.s, r: m.r + gm.r, o: m.o * gm.o, blur: m.blur + gm.blur, glow: Math.max(m.glow, gm.glow) };
      o2 = { ...o2, offset_x: (o2.offset_x ?? 0) + (g.offset_x ?? 0), offset_y: (o2.offset_y ?? 0) + (g.offset_y ?? 0), opacity: (o2.opacity ?? 1) * (g.opacity ?? 1), visible: g.visible === false ? false : o2.visible };
    }
    out.push({ id, o: o2, m });
  }
  return out;
}

const fontCss = (f: string) => {
  const c = (FONT_CHOICES as Record<string, { family: string }>)[f];
  return `"${(c?.family ?? f).replace(/"/g, '')}", "Noto Sans Devanagari", sans-serif`;
};

/** One CSS rule per edited element. `s` = the auto-fit scale of the content (offsets are canvas px). */
export function editsCss(edits: ResolvedEdit[], s = 1, scope = ''): string {
  const pre = scope ? `[data-sb-scope="${scope}"] ` : '';
  return edits
    .map(({ id, o, m }) => {
      // the element and its parts ("title", "title-0"…), but only the outermost match — a line inside an edited
      // block must not be moved / scaled a second time
      const m1 = `[data-sb-group="${id}"],[data-sb-group^="${id}-"]`;
      const sel = `${pre}:is(${m1}):not(:is(${m1}) *)`;
      const d: string[] = [];
      const dx = ((o.offset_x ?? 0) + m.dx) / s;
      const dy = ((o.offset_y ?? 0) + m.dy) / s;
      if (dx || dy) d.push(`translate:${dx.toFixed(2)}px ${dy.toFixed(2)}px`);
      const sc = (o.scale ?? 1) * m.s;
      if (sc !== 1) d.push(`scale:${sc.toFixed(4)}`);
      const rot = (o.rotation ?? 0) + m.r;
      if (rot) d.push(`rotate:${rot.toFixed(2)}deg`);
      const op = (o.opacity ?? 1) * m.o;
      const filters = [op !== 1 ? `opacity(${op.toFixed(3)})` : '', m.blur ? `blur(${m.blur.toFixed(1)}px)` : '', m.glow ? `drop-shadow(0 0 ${m.glow.toFixed(1)}px rgba(255,255,255,0.9))` : ''].filter(Boolean);
      if (filters.length) d.push(`filter:${filters.join(' ')}`);
      if (o.visible === false) d.push('visibility:hidden');
      if (o.z_index !== undefined) d.push(`z-index:${Math.round(o.z_index)}`);
      if (o.fill) d.push(`background:${o.fill}`);
      if (o.border) {
        if (o.border.width !== undefined || o.border.color) d.push(`border:${o.border.width ?? 2}px solid ${o.border.color ?? 'currentColor'}`);
        if (o.border.radius !== undefined) d.push(`border-radius:${o.border.radius}px`);
      }
      if (o.shadow) d.push(`box-shadow:${o.shadow.offset_x ?? 0}px ${o.shadow.offset_y ?? 6}px ${o.shadow.blur ?? 18}px ${o.shadow.color ?? 'rgba(0,0,0,0.45)'}`);
      if (o.blend_mode) d.push(`mix-blend-mode:${o.blend_mode}`);
      // text properties go on the element and everything inside it
      const t: string[] = [];
      if (o.font_family) t.push(`font-family:${fontCss(o.font_family)}`);
      if (o.font_weight) t.push(`font-weight:${Math.round(o.font_weight / 100) * 100}`);
      if (o.text_color) t.push(`color:${o.text_color}`);
      if (o.letter_spacing !== undefined) t.push(`letter-spacing:${o.letter_spacing}em`);
      if (o.text_case) t.push(`text-transform:${o.text_case === 'upper' ? 'uppercase' : o.text_case === 'lower' ? 'lowercase' : o.text_case === 'title' ? 'capitalize' : 'none'}`);
      if (o.text_align) t.push(`text-align:${o.text_align};justify-content:${o.text_align === 'left' ? 'flex-start' : o.text_align === 'right' ? 'flex-end' : 'center'}`);
      if (o.italic !== undefined) t.push(`font-style:${o.italic ? 'italic' : 'normal'}`);
      if (o.underline !== undefined) t.push(`text-decoration:${o.underline ? 'underline' : 'none'}`);
      const imp = (xs: string[]) => xs.map((x) => x.split(';').map((y) => `${y} !important`).join(';')).join(';');
      let css = d.length ? `${sel}{${imp(d)}}` : '';
      if (t.length) css += `${sel},${sel} *{${imp(t)}}`;
      return css;
    })
    .join('\n');
}

/** Wrap a template so it accepts props.elements / props.groups. Applied once in registry.ts. */
export function withEditable(Comp: ComponentType<TemplateProps>): ComponentType<TemplateProps> {
  function Editable(p: TemplateProps) {
    const props = (p.data?.props ?? {}) as Record<string, unknown>;
    const has = (props.elements && typeof props.elements === 'object') || Array.isArray(props.groups);
    if (!has) return <Comp {...p} />;
    const edits = resolveEdits(props, p.clock.frame, p.clock.durationInFrames, (p.clock as { fps?: number }).fps ?? 30);
    return (
      <EditsContext.Provider value={edits}>
        <Comp {...p} />
      </EditsContext.Provider>
    );
  }
  Editable.displayName = `Editable(${Comp.displayName ?? Comp.name ?? 'Template'})`;
  return Editable;
}
