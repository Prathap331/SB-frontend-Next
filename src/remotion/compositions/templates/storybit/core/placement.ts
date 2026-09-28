/**
 * Label placement around anchor points (pure). Tries 8 directions at growing distances and keeps the
 * first spot that is inside the bounds and clear of every obstacle; returns null if there is none.
 */
export type Box = { x: number; y: number; w: number; h: number };

export const overlaps = (a: Box, b: Box, gap = 8) => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;

export function placeNear(
  anchor: { x: number; y: number },
  w: number,
  h: number,
  obstacles: Box[],
  bounds: Box,
  distances = [22, 60, 120, 200],
  /** Preferred side, e.g. away from the other anchors; default: towards the middle of the bounds. */
  prefer?: { x: number; y: number },
): Box | null {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const sx = prefer && prefer.x !== 0 ? Math.sign(prefer.x) : anchor.x < cx ? 1 : -1;
  const sy = prefer && prefer.y !== 0 ? Math.sign(prefer.y) : anchor.y < cy ? 1 : -1;
  const dirs: [number, number][] = [[sx, 0], [sx, -sy], [sx, sy], [-sx, 0], [0, -sy], [0, sy], [-sx, -sy], [-sx, sy]];
  for (const d of distances) {
    for (const [dx, dy] of dirs) {
      const x = dx > 0 ? anchor.x + d : dx < 0 ? anchor.x - d - w : anchor.x - w / 2;
      const y = dy > 0 ? anchor.y + d * 0.7 : dy < 0 ? anchor.y - d * 0.7 - h : anchor.y - h / 2;
      const b = { x, y, w, h };
      if (b.x < bounds.x || b.y < bounds.y || b.x + w > bounds.x + bounds.w || b.y + h > bounds.y + bounds.h) continue;
      if (obstacles.some((o) => overlaps(b, o))) continue;
      return b;
    }
  }
  return null;
}

/** Direction pointing away from the other anchors (so neighbouring labels do not cross). */
export function awayFrom(anchor: { x: number; y: number }, others: { x: number; y: number }[]) {
  const rest = others.filter((o) => o !== anchor);
  if (!rest.length) return undefined;
  const mx = rest.reduce((a, o) => a + o.x, 0) / rest.length;
  const my = rest.reduce((a, o) => a + o.y, 0) / rest.length;
  const dx = anchor.x - mx;
  const dy = anchor.y - my;
  return { x: Math.abs(dx) < 4 ? 0 : dx, y: Math.abs(dy) < 4 ? 0 : dy };
}
