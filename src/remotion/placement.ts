import type { CSSProperties } from 'react';

export type PlacementKind =
  | 'full_frame'
  | 'center'
  | 'center_right'
  | 'center_left'
  | 'top'
  | 'bottom'
  | 'top_left'
  | 'top_right'
  | 'bottom_left'
  | 'bottom_right'
  | 'overlay'
  | 'unknown';

export function normalizePlacement(placement: string | undefined): PlacementKind {
  const p = (placement || 'full_frame').trim().toLowerCase();
  if (p === 'fullscreen' || p === 'full_screen' || p === 'full_frame') return 'full_frame';
  if (p === 'center') return 'center';
  if (p === 'center_right' || p === 'right') return 'center_right';
  if (p === 'center_left' || p === 'left') return 'center_left';
  if (p === 'top') return 'top';
  if (p === 'bottom') return 'bottom';
  if (p === 'top_left') return 'top_left';
  if (p === 'top_right') return 'top_right';
  if (p === 'bottom_left') return 'bottom_left';
  if (p === 'bottom_right') return 'bottom_right';
  if (p === 'overlay') return 'overlay';
  return 'unknown';
}

export function isFullFramePlacement(placement: string | undefined): boolean {
  return normalizePlacement(placement) === 'full_frame';
}

/** Backend overlay tracks are authored against a 1920×1080 frame. */
export const OVERLAY_DESIGN_W = 1920;
export const OVERLAY_DESIGN_H = 1080;
const EDGE_MARGIN = 64;

export type OverlayGeometryPx = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function finitePx(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Pixel origin for an overlay of `width`×`height` on the 1920×1080 design frame.
 * `top_right` + 160×160 → { x: 1696, y: 64 } (1920 − 160 − 64).
 */
export function placementToDesignPx(
  placement: string | undefined,
  width: number,
  height: number,
  canvasW = OVERLAY_DESIGN_W,
  canvasH = OVERLAY_DESIGN_H,
): { x: number; y: number } {
  const kind = normalizePlacement(placement);
  const mx = EDGE_MARGIN;
  const my = EDGE_MARGIN;
  switch (kind) {
    case 'top_left':
      return { x: mx, y: my };
    case 'top_right':
      return { x: canvasW - width - mx, y: my };
    case 'top':
      return { x: (canvasW - width) / 2, y: my };
    case 'bottom_left':
      return { x: mx, y: canvasH - height - my };
    case 'bottom_right':
      return { x: canvasW - width - mx, y: canvasH - height - my };
    case 'bottom':
    case 'overlay':
      return { x: (canvasW - width) / 2, y: canvasH - height - my };
    case 'center_left':
      return { x: mx, y: (canvasH - height) / 2 };
    case 'center_right':
      return { x: canvasW - width - mx, y: (canvasH - height) / 2 };
    case 'center':
    case 'full_frame':
    default:
      return { x: (canvasW - width) / 2, y: (canvasH - height) / 2 };
  }
}

/**
 * Prefer explicit `geometry_px`. If x/y are missing, fall back to `placement`
 * so icon overlays still land in the correct corner.
 */
export function resolveOverlayGeometry(
  geometryPx: Partial<OverlayGeometryPx> | null | undefined,
  placement: string | undefined,
  fallback: OverlayGeometryPx,
): OverlayGeometryPx {
  const width = finitePx(geometryPx?.width) ?? fallback.width;
  const height = finitePx(geometryPx?.height) ?? fallback.height;
  const explicitX = finitePx(geometryPx?.x);
  const explicitY = finitePx(geometryPx?.y);
  if (explicitX != null && explicitY != null) {
    return { x: explicitX, y: explicitY, width, height };
  }
  const fromPlacement = placementToDesignPx(placement, width, height);
  return {
    x: explicitX ?? fromPlacement.x,
    y: explicitY ?? fromPlacement.y,
    width,
    height,
  };
}

export function isRightPlacement(placement: string | undefined): boolean {
  const kind = normalizePlacement(placement);
  return kind === 'top_right' || kind === 'bottom_right' || kind === 'center_right';
}

export function isCenterXPlacement(placement: string | undefined): boolean {
  const kind = normalizePlacement(placement);
  return kind === 'top' || kind === 'bottom' || kind === 'center' || kind === 'overlay' || kind === 'full_frame';
}

/**
 * Outer AbsoluteFill: transparent for overlays so the video stays visible.
 * Full-frame layouts may paint their own opaque background inside.
 */
export function rootFillStyle(placement: string | undefined): CSSProperties {
  return {
    backgroundColor: isFullFramePlacement(placement) ? undefined : 'transparent',
    pointerEvents: 'none',
  };
}

/** Positions the content panel within the composition. */
export function contentPanelStyle(placement: string | undefined): CSSProperties {
  const kind = normalizePlacement(placement);

  const base: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
  };

  switch (kind) {
    case 'full_frame':
      return {
        ...base,
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 80px',
      };
    case 'center_right':
      return {
        ...base,
        position: 'absolute',
        right: '6%',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '38%',
        maxWidth: 720,
        padding: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(10, 12, 16, 0.78)',
        backdropFilter: 'blur(8px)',
      };
    case 'center_left':
      return {
        ...base,
        position: 'absolute',
        left: '6%',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '38%',
        maxWidth: 720,
        padding: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(10, 12, 16, 0.78)',
        backdropFilter: 'blur(8px)',
      };
    case 'center':
      return {
        ...base,
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: '52%',
        maxWidth: 900,
        padding: 48,
        borderRadius: 20,
        backgroundColor: 'rgba(10, 12, 16, 0.78)',
        backdropFilter: 'blur(8px)',
      };
    case 'top':
      return {
        ...base,
        position: 'absolute',
        left: '50%',
        top: '8%',
        transform: 'translateX(-50%)',
        width: '70%',
        maxWidth: 1000,
        padding: 36,
        borderRadius: 16,
        backgroundColor: 'rgba(10, 12, 16, 0.75)',
      };
    case 'bottom':
    case 'overlay':
      return {
        ...base,
        position: 'absolute',
        left: '50%',
        bottom: '8%',
        transform: 'translateX(-50%)',
        width: '70%',
        maxWidth: 1000,
        padding: 36,
        borderRadius: 16,
        backgroundColor: 'rgba(10, 12, 16, 0.75)',
      };
    case 'top_left':
      return {
        ...base,
        position: 'absolute',
        left: '5%',
        top: '8%',
        width: '40%',
        maxWidth: 720,
        padding: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(10, 12, 16, 0.75)',
      };
    case 'top_right':
      return {
        ...base,
        position: 'absolute',
        right: '5%',
        top: '8%',
        width: '40%',
        maxWidth: 720,
        padding: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(10, 12, 16, 0.75)',
      };
    case 'bottom_left':
      return {
        ...base,
        position: 'absolute',
        left: '5%',
        bottom: '8%',
        width: '40%',
        maxWidth: 720,
        padding: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(10, 12, 16, 0.75)',
      };
    case 'bottom_right':
      return {
        ...base,
        position: 'absolute',
        right: '5%',
        bottom: '8%',
        width: '40%',
        maxWidth: 720,
        padding: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(10, 12, 16, 0.75)',
      };
    default:
      return {
        ...base,
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: '50%',
        maxWidth: 860,
        padding: 40,
        borderRadius: 16,
        backgroundColor: 'rgba(10, 12, 16, 0.78)',
      };
  }
}
