'use client';

/**
 * Auto-fit: when a template's content is small (short text, few items), everything inside the safe box is
 * scaled up as one piece — fonts, cards, rows, icons, gaps — until it fills the 1720×880 safe box
 * (never past the 100 px margin, never more than MAX_GROW×, never smaller than designed).
 *
 * How: the template is rendered once, hidden, at its settled frame (just before the exit); the union of
 * everything that is actually painted inside the SafeArea (text, images, SVG shapes, filled / bordered
 * boxes) is measured; SafeArea then applies one translate + scale to its contents for every frame.
 * The measure happens once per set of props, before the first paint (Remotion waits via delayRender).
 * Turn it off per clip with props.auto_fit = "off".
 */
import { createContext, useContext, useLayoutEffect, useRef, useState, type ComponentType } from 'react';
import type { TemplateProps } from '../../../../types';
import { continueRenderSafe, delayRenderSafe } from './remotionSafe';
import { SAFE_H, SAFE_W } from './safeArea';
import { exitFrames } from './timeline';

export type Fit = { s: number; dx: number; dy: number };
export const NO_FIT: Fit = { s: 1, dx: 0, dy: 0 };
export const MAX_GROW = 1.8;
const AutoFitContext = createContext<Fit | null>(null);
export const useAutoFit = () => useContext(AutoFitContext);

type Box = { x0: number; y0: number; x1: number; y1: number };

const visible = (c: string) => {
  if (!c || c === 'transparent') return false;
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return true;
  const parts = m[1].split(',').map((p) => parseFloat(p));
  return parts.length < 4 || parts[3] > 0.02;
};
const GRAPHICS = new Set(['path', 'line', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'text', 'image']);

/** Union of everything painted inside `root`, in root coordinates. */
export function paintedBox(root: HTMLElement): Box | null {
  const r0 = root.getBoundingClientRect();
  // the preview may show the frame scaled down (and not uniformly): convert screen pixels back to frame pixels
  const kx = root.offsetWidth > 0 && r0.width > 0 ? r0.width / root.offsetWidth : 1;
  const ky = root.offsetHeight > 0 && r0.height > 0 ? r0.height / root.offsetHeight : kx;
  let b: Box | null = null;
  const add = (r: DOMRect | { left: number; top: number; right: number; bottom: number; width: number; height: number }, pad = 0) => {
    if (r.width <= 0.5 && r.height <= 0.5) return;
    const x0 = (r.left - r0.left) / kx - pad;
    const y0 = (r.top - r0.top) / ky - pad;
    const x1 = (r.right - r0.left) / kx + pad;
    const y1 = (r.bottom - r0.top) / ky + pad;
    b = b ? { x0: Math.min(b.x0, x0), y0: Math.min(b.y0, y0), x1: Math.max(b.x1, x1), y1: Math.max(b.y1, y1) } : { x0, y0, x1, y1 };
  };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (!n.textContent || !n.textContent.trim()) continue;
      range.selectNodeContents(n);
      for (const rr of Array.from(range.getClientRects())) add(rr, 2);
      continue;
    }
    const el = n as Element;
    const tag = el.tagName.toLowerCase();
    // every checked element (leaf / guide) counts with its whole box, so growing never pushes one past the margin
    if (el.hasAttribute('data-sb')) add(el.getBoundingClientRect());
    if (tag === 'svg' || tag === 'defs' || tag === 'marker' || tag === 'filter' || tag === 'g' || tag === 'clippath' || tag === 'mask') continue;
    if (el.closest('defs, marker, filter, clipPath, mask')) continue;
    if (GRAPHICS.has(tag)) {
      add(el.getBoundingClientRect(), 6); // stroke width is not in the box
      continue;
    }
    if (tag === 'img' || tag === 'video' || tag === 'canvas') {
      add(el.getBoundingClientRect());
      continue;
    }
    const cs = getComputedStyle(el);
    const bordered = ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs.getPropertyValue(`border-${s.toLowerCase()}-width`)) > 0 && cs.getPropertyValue(`border-${s.toLowerCase()}-style`) !== 'none');
    if (visible(cs.backgroundColor) || (cs.backgroundImage && cs.backgroundImage !== 'none') || bordered) add(el.getBoundingClientRect());
  }
  return b;
}

/** Scale (≥ 1, ≤ max) and offset that make `box` as big as possible inside the safe box (centred, or kept against the edge it was pinned to). */
export function fitFor(box: Box | null, max = MAX_GROW): Fit {
  if (!box) return NO_FIT;
  const bw = box.x1 - box.x0;
  const bh = box.y1 - box.y0;
  if (bw <= 0 || bh <= 0) return NO_FIT;
  let s = Math.min(max, SAFE_W / bw, SAFE_H / bh);
  if (!(s > 1.03)) return NO_FIT;
  s = Math.floor(s * 100) / 100;
  // Where the grown content goes: a layout pinned to the left (or right) edge stays pinned there
  // (left-aligned title cards, charts); anything else is centred. Vertically it is always centred, so
  // short content never sits at the top with an empty band underneath.
  const gw = bw * s;
  const gh = bh * s;
  const X0 = box.x0 <= 4 ? 0 : box.x1 >= SAFE_W - 4 ? SAFE_W - gw : (SAFE_W - gw) / 2;
  const Y0 = (SAFE_H - gh) / 2;
  const dx = X0 - s * box.x0;
  const dy = Y0 - s * box.y0;
  return { s, dx: Math.round(dx * 10) / 10, dy: Math.round(dy * 10) / 10 };
}

/** Wrap a template so its content grows to fill the safe box when there is little of it. */
export function withAutoFit(Comp: ComponentType<TemplateProps>, max = MAX_GROW): ComponentType<TemplateProps> {
  function AutoFit(p: TemplateProps) {
    const props = (p.data?.props ?? {}) as Record<string, unknown>;
    const off = props.auto_fit === 'off';
    const D = p.clock.durationInFrames;
    const key = off ? 'off' : `${D}|${JSON.stringify(props)}`;
    const [fit, setFit] = useState<{ key: string; f: Fit } | null>(null);
    const [handle] = useState<number | null>(() => (off ? null : delayRenderSafe('storybit auto-fit')));
    const released = useRef(false);
    const hidden = useRef<HTMLDivElement>(null);
    const need = !off && fit?.key !== key;
    useLayoutEffect(() => {
      if (!need) return;
      const measure = () => {
        const safe = hidden.current?.querySelector('[data-sb-safe]') as HTMLElement | null;
        setFit({ key, f: safe ? fitFor(paintedBox(safe), max) : NO_FIT });
      };
      measure();
      const raf = requestAnimationFrame(measure);
      return () => cancelAnimationFrame(raf);
    }, [need, key]);
    useLayoutEffect(() => {
      if (handle !== null && fit && !released.current) {
        released.current = true;
        continueRenderSafe(handle);
      }
    }, [fit, handle]);
    const rest = Math.max(0, D - exitFrames(D) - 1);
    return (
      <>
        {need && (
          <div ref={hidden} aria-hidden style={{ position: 'absolute', inset: 0, visibility: 'hidden', pointerEvents: 'none', overflow: 'hidden' }}>
            <AutoFitContext.Provider value={NO_FIT}>
              <Comp {...p} clock={{ ...p.clock, frame: rest }} />
            </AutoFitContext.Provider>
          </div>
        )}
        <AutoFitContext.Provider value={off ? null : fit?.key === key ? fit.f : NO_FIT}>
          <Comp {...p} />
        </AutoFitContext.Provider>
      </>
    );
  }
  AutoFit.displayName = `AutoFit(${Comp.displayName ?? Comp.name ?? 'Template'})`;
  return AutoFit;
}
