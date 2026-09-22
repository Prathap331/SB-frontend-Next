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

/**
 * Corner/edge placements pin an overlay. `center` / `full_frame` are composition
 * defaults and must not move the drag box to the middle of the frame.
 */
export function overlayBoxPlacement(
  placement: string | undefined,
  animationType?: string,
): string | undefined {
  const raw = (placement || '').trim();
  if (!raw) return undefined;
  const kind = normalizePlacement(raw);
  const type = (animationType || '').trim().toLowerCase();
  const fullscreenType =
    type.startsWith('full_screen') ||
    type.includes('title_card') ||
    type.includes('quote_card') ||
    type.includes('data_viz');
  if (kind === 'full_frame' && !fullscreenType) return undefined;
  if (kind === 'center' && !fullscreenType) return undefined;
  if (kind === 'unknown') return undefined;
  return raw;
}

export type OverlayMotionPx = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  style?: string;
};

/**
 * Same origin the Remotion visual uses: follow a motion path when it exists,
 * otherwise the geometry box. If geometry was resolved to screen-center but
 * motion still has the authored corner, keep the corner.
 */
export function overlayDrawOrigin(
  geometry: OverlayGeometryPx,
  motion: OverlayMotionPx | null | undefined,
  progress = 0,
): { x: number; y: number } {
  const geoX = geometry.x;
  const geoY = geometry.y;
  if (!motion) return { x: geoX, y: geoY };
  const pathDx = Math.abs(motion.endX - motion.startX);
  const pathDy = Math.abs(motion.endY - motion.startY);
  const t = Math.min(1, Math.max(0, progress));
  const motionX = motion.startX + (motion.endX - motion.startX) * t;
  const motionY = motion.startY + (motion.endY - motion.startY) * t;
  const motionLooksPlaced = motion.startX > 8 || motion.startY > 8 || motion.endX > 8 || motion.endY > 8;
  const geoLooksCentered =
    Math.abs(geoX + geometry.width / 2 - OVERLAY_DESIGN_W / 2) < 120 &&
    Math.abs(geoY + geometry.height / 2 - OVERLAY_DESIGN_H / 2) < 120;
  if (pathDx < 1 && pathDy < 1) {
    if (motionLooksPlaced && geoLooksCentered) return { x: motion.startX, y: motion.startY };
    return { x: geoX, y: geoY };
  }
  return { x: motionX, y: motionY };
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
 * Type-specific 1920×1080 box used when `geometry_px` is missing.
 * Shared by the Remotion visual and the preview drag handles so they stay aligned.
 */
export function defaultOverlayGeometry(animationType: string | undefined): OverlayGeometryPx {
  switch ((animationType || '').trim().toLowerCase()) {
    case 'emoji_reaction':
      return { x: 1696, y: 64, width: 160, height: 160 };
    case 'badge_sticker':
      return { x: 1696, y: 64, width: 200, height: 200 };
    case 'pip_video':
      return { x: 1360, y: 720, width: 480, height: 270 };
    case 'pip_video_frame':
      return { x: 1280, y: 64, width: 576, height: 324 };
    case 'image_pip':
      return { x: 1560, y: 48, width: 300, height: 220 };
    case 'intro_lower_third':
    case 'lower_third':
      return { x: 64, y: 820, width: 720, height: 180 };
    case 'avatar_overlay':
    case 'avatar_overlay_placeholder':
      return { x: 64, y: 64, width: 160, height: 160 };
    case 'mascot_animation':
    case 'mascot_animation_placeholder':
      return { x: 1600, y: 700, width: 260, height: 260 };
    case 'speed_ramp_indicator':
      return { x: 1700, y: 64, width: 160, height: 80 };
    case 'icon_pop_in':
      return { x: 1696, y: 64, width: 160, height: 160 };
    case 'icon_sequence':
    case 'stat_counter_overlay':
      return { x: 64, y: 360, width: 720, height: 280 };
    default:
      return { x: 64, y: 854, width: 520, height: 160 };
  }
}

/**
 * A 160×160 pop box cannot hold 2–3 icons — they clip off the right edge and
 * the preview only shows the first. Widen and shift left so every icon stays on frame.
 */
export function fitOverlayBoxForIcons(
  geo: OverlayGeometryPx,
  iconCount: number,
  canvasW = OVERLAY_DESIGN_W,
): OverlayGeometryPx {
  const n = Math.max(1, Math.round(iconCount));
  if (n <= 1) return geo;
  const minW = Math.min(canvasW - 48, Math.max(geo.width, 48 + n * 130));
  const minH = Math.max(geo.height, 200);
  let x = geo.x;
  if (x + minW > canvasW - 32) {
    x = Math.max(32, canvasW - 32 - minW);
  }
  return { x, y: geo.y, width: minW, height: minH };
}

/**
 * Prefer explicit `geometry_px`. If x/y are missing, use a real `placement`
 * string; if that is also missing, keep the type-specific fallback corner
 * (do not treat empty placement as full-frame center).
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
  const hasPlacement = Boolean(placement && placement.trim());
  if (hasPlacement) {
    const fromPlacement = placementToDesignPx(placement, width, height);
    return {
      x: explicitX ?? fromPlacement.x,
      y: explicitY ?? fromPlacement.y,
      width,
      height,
    };
  }
  return {
    x: explicitX ?? fallback.x,
    y: explicitY ?? fallback.y,
    width,
    height,
  };
}

/**
 * Maps preview anchors (left % / bottom %) onto a backend placement string.
 * Mirrors the editor's left / center / right and top / middle / bottom zones.
 */
export function placementFromPreviewOffsets(offsetX: number, offsetY: number): string {
  const v = offsetY >= 65 ? 'top' : offsetY <= 30 ? 'bottom' : 'center';
  const h = offsetX <= 30 ? 'left' : offsetX >= 70 ? 'right' : 'center';
  if (v === 'center' && h === 'center') return 'center';
  if (v === 'center') return h === 'left' ? 'center_left' : 'center_right';
  if (h === 'center') return v;
  return `${v}_${h}`;
}

/**
 * Converts the preview's left/bottom percentages into `geometry_px` on 1920×1080.
 * The preview anchors the box with the same left/center/right transform as on-screen text.
 */
export function geometryPxFromPreviewOffsets(
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  canvasW = OVERLAY_DESIGN_W,
  canvasH = OVERLAY_DESIGN_H,
): OverlayGeometryPx {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  let x: number;
  if (offsetX <= 30) x = (offsetX / 100) * canvasW;
  else if (offsetX >= 70) x = (offsetX / 100) * canvasW - safeW;
  else x = (offsetX / 100) * canvasW - safeW / 2;
  const y = canvasH - (offsetY / 100) * canvasH - safeH;
  return {
    x: Math.round(Math.max(0, Math.min(canvasW - safeW, x))),
    y: Math.round(Math.max(0, Math.min(canvasH - safeH, y))),
    width: Math.round(safeW),
    height: Math.round(safeH),
  };
}

/** Center of a design-pixel box as the preview's left% / bottom% anchors. */
export function previewOffsetsFromGeometryPx(
  geo: OverlayGeometryPx,
  canvasW = OVERLAY_DESIGN_W,
  canvasH = OVERLAY_DESIGN_H,
): { offsetX: number; offsetY: number } {
  const cx = geo.x + geo.width / 2;
  const fromBottom = canvasH - (geo.y + geo.height / 2);
  return {
    offsetX: Math.max(4, Math.min(96, (cx / canvasW) * 100)),
    offsetY: Math.max(4, Math.min(96, (fromBottom / canvasH) * 100)),
  };
}

const MIN_OVERLAY_W = 64;
const MIN_OVERLAY_H = 48;

/** Keeps an overlay box inside the 1920×1080 design frame. */
export function clampOverlayGeometry(
  geo: OverlayGeometryPx,
  canvasW = OVERLAY_DESIGN_W,
  canvasH = OVERLAY_DESIGN_H,
): OverlayGeometryPx {
  const width = Math.round(Math.max(MIN_OVERLAY_W, Math.min(canvasW, geo.width)));
  const height = Math.round(Math.max(MIN_OVERLAY_H, Math.min(canvasH, geo.height)));
  return {
    x: Math.round(Math.max(0, Math.min(canvasW - width, geo.x))),
    y: Math.round(Math.max(0, Math.min(canvasH - height, geo.y))),
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
