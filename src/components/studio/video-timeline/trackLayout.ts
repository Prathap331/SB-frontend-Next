/** Uniform row height so track labels and clip rows stay pixel-aligned. */
export const TRACK_ROW_HEIGHT = 40;

export function trackHeightPx(_track?: {
  collapsed?: boolean;
  height?: 'compact' | 'normal' | 'expanded';
}): number {
  return TRACK_ROW_HEIGHT;
}

export const RULER_HEIGHT = 28;
