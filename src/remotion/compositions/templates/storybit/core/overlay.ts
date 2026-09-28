/**
 * Overlay placement (pure). Overlays sit on footage with a transparent background and are placed
 * at an anchor inside the 1720×880 safe box.
 */
import { SAFE_H, SAFE_W } from './safeArea';

export const OVERLAY_POSITIONS = ['top_left', 'top_right', 'bottom_left', 'bottom_right', 'bottom_center', 'top_center', 'center'] as const;
export type OverlayPosition = (typeof OVERLAY_POSITIONS)[number];

/** Top-left corner of a w×h box at `pos`, inside the safe box. */
export function anchorBox(pos: OverlayPosition, w: number, h: number): { left: number; top: number } {
  const left = pos.endsWith('left') ? 0 : pos.endsWith('right') ? SAFE_W - w : (SAFE_W - w) / 2;
  const top = pos.startsWith('top') ? 0 : pos.startsWith('bottom') ? SAFE_H - h : (SAFE_H - h) / 2;
  return { left: Math.max(0, left), top: Math.max(0, top) };
}

/** Overlays are allowed to be short: 1.5–8 s. */
export const OVERLAY_DURATION = { min: 45, default: 120, max: 240 };
