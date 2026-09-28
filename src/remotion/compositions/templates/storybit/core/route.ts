/**
 * Route finding for the map templates: sea routes that stay on water and land routes that stay on land,
 * on a 0.25° grid (core/landmask.ts). A* search with 8 neighbours and longitude wrap-around, then
 * "string pulling" so the route is a few straight hops that still never cross the wrong surface.
 * Results are cached, so a route is computed once per render worker, not once per frame.
 */
import { LAND_MASK_B64, LAND_MASK_RES } from './landmask';

const R = LAND_MASK_RES;
const W = 360 * R;
const H = 180 * R;
let MASK: Uint8Array | null = null;

function mask(): Uint8Array {
  if (MASK) return MASK;
  const bin = typeof atob === 'function' ? atob(LAND_MASK_B64) : Buffer.from(LAND_MASK_B64, 'base64').toString('binary');
  const u16 = new Uint16Array(bin.length / 2);
  for (let i = 0; i < u16.length; i++) u16[i] = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
  const m = new Uint8Array(W * H);
  let p = 0;
  for (let y = 0; y < H; y++) {
    const runs = u16[p++];
    let x = 0;
    for (let r = 0; r < runs; r++) {
      const len = u16[p++];
      if (r % 2 === 1) m.fill(1, y * W + x, y * W + x + len);
      x += len;
    }
  }
  MASK = m;
  return m;
}

const cellOf = (lon: number, lat: number) => {
  const x = (((Math.floor((lon + 180) * R) % W) + W) % W);
  const y = Math.max(0, Math.min(H - 1, Math.floor((90 - lat) * R)));
  return { x, y };
};
const lonOf = (x: number) => x / R - 180 + 0.5 / R;
const latOf = (y: number) => 90 - y / R - 0.5 / R;

export const isLand = (lon: number, lat: number) => {
  const { x, y } = cellOf(lon, lat);
  return mask()[y * W + x] === 1;
};

/** Nearest cell of the wanted surface within `maxCells` (ring search). */
function nearest(lon: number, lat: number, wantLand: boolean, maxCells = 60): { x: number; y: number } | null {
  const m = mask();
  const c = cellOf(lon, lat);
  const want = wantLand ? 1 : 0;
  if (m[c.y * W + c.x] === want) return c;
  for (let r = 1; r <= maxCells; r++) {
    let best: { x: number; y: number; d: number } | null = null;
    for (let dy = -r; dy <= r; dy++) {
      for (const dx of Math.abs(dy) === r ? Array.from({ length: 2 * r + 1 }, (_, i) => i - r) : [-r, r]) {
        const y = c.y + dy;
        if (y < 0 || y >= H) continue;
        const x = (((c.x + dx) % W) + W) % W;
        if (m[y * W + x] === want) {
          const d = dx * dx + dy * dy;
          if (!best || d < best.d) best = { x, y, d };
        }
      }
    }
    if (best) return { x: best.x, y: best.y };
  }
  return null;
}

/** Binary min-heap of (priority, index). */
class Heap {
  pri: number[] = [];
  idx: number[] = [];
  get size() {
    return this.pri.length;
  }
  push(p: number, i: number) {
    const a = this.pri;
    const b = this.idx;
    let k = a.length;
    a.push(p);
    b.push(i);
    while (k > 0) {
      const u = (k - 1) >> 1;
      if (a[u] <= a[k]) break;
      [a[u], a[k]] = [a[k], a[u]];
      [b[u], b[k]] = [b[k], b[u]];
      k = u;
    }
  }
  pop(): number {
    const a = this.pri;
    const b = this.idx;
    const top = b[0];
    const lp = a.pop()!;
    const li = b.pop()!;
    if (a.length) {
      a[0] = lp;
      b[0] = li;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let s = k;
        if (l < a.length && a[l] < a[s]) s = l;
        if (r < a.length && a[r] < a[s]) s = r;
        if (s === k) break;
        [a[s], a[k]] = [a[k], a[s]];
        [b[s], b[k]] = [b[k], b[s]];
        k = s;
      }
    }
    return top;
  }
}

const COS = Array.from({ length: H }, (_, y) => Math.max(0.05, Math.cos((latOf(y) * Math.PI) / 180)));
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function astar(s: { x: number; y: number }, t: { x: number; y: number }, surface: 0 | 1): number[] | null {
  const m = mask();
  const N = W * H;
  const g = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const done = new Uint8Array(N);
  const start = s.y * W + s.x;
  const goal = t.y * W + t.x;
  const heap = new Heap();
  const hDist = (x: number, y: number) => {
    let dx = Math.abs(x - t.x);
    dx = Math.min(dx, W - dx);
    return Math.hypot(dx * COS[Math.round((y + t.y) / 2)], y - t.y);
  };
  g[start] = 0;
  heap.push(hDist(s.x, s.y), start);
  let steps = 0;
  while (heap.size) {
    const cur = heap.pop();
    if (cur === goal) break;
    if (done[cur]) continue;
    done[cur] = 1;
    if (++steps > 1_500_000) return null;
    const cy = (cur / W) | 0;
    const cx = cur - cy * W;
    for (const [dx, dy] of DIRS) {
      const ny = cy + dy;
      if (ny < 0 || ny >= H) continue;
      const nx = (cx + dx + W) % W;
      const ni = ny * W + nx;
      if (done[ni] || (m[ni] !== surface && ni !== goal)) continue;
      // ships keep a little offshore: water cells next to land cost more
      let coast = 1;
      if (surface === 0) {
        for (const [ex, ey] of DIRS) {
          const yy = ny + ey;
          if (yy >= 0 && yy < H && m[yy * W + ((nx + ex + W) % W)] === 1) {
            coast = 1.5;
            break;
          }
        }
      }
      const step = Math.hypot(dx * COS[ny], dy) * coast;
      const ng = g[cur] + step;
      if (ng < g[ni]) {
        g[ni] = ng;
        from[ni] = cur;
        heap.push(ng + hDist(nx, ny) * 1.2, ni);
      }
    }
  }
  if (from[goal] === -1 && goal !== start) return null;
  const path: number[] = [];
  for (let c = goal; c !== -1; c = from[c]) path.push(c);
  return path.reverse();
}

/** True if the straight hop between two cells stays on the wanted surface. */
function clear(a: number, b: number, surface: 0 | 1): boolean {
  const m = mask();
  const ay = (a / W) | 0;
  const ax = a - ay * W;
  const by = (b / W) | 0;
  let bx = b - by * W;
  if (Math.abs(bx - ax) > W / 2) bx += bx < ax ? W : -W;
  const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2) + 1;
  for (let i = 1; i < n; i++) {
    const x = Math.round(ax + ((bx - ax) * i) / n);
    const y = Math.round(ay + ((by - ay) * i) / n);
    if (m[y * W + ((x % W) + W) % W] !== surface) return false;
  }
  return true;
}

function pull(path: number[], surface: 0 | 1): number[] {
  if (path.length < 3) return path;
  const out = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let j = path.length - 1;
    while (j > i + 1 && !clear(path[i], path[j], surface)) j--;
    out.push(path[j]);
    i = j;
  }
  return out;
}

/** Make longitudes continuous along a route (no jump at ±180°). */
export function unwrap(pts: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const p of pts) {
    if (!out.length) {
      out.push([p[0], p[1]]);
      continue;
    }
    let lon = p[0];
    const prev = out[out.length - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([lon, p[1]]);
  }
  return out;
}

const cache = new Map<string, [number, number][] | null>();

/**
 * Route from a to b ([lon, lat]) over sea (stays on water) or land (stays on land).
 * The first and last hops join the places themselves to the nearest water / land cell (ports, coasts).
 * Returns null when no such route exists (e.g. a land route to an island, or a sea route from far inland).
 */
export function findRoute(a: [number, number], b: [number, number], surface: 'sea' | 'land'): [number, number][] | null {
  const key = `${surface}:${a[0].toFixed(3)},${a[1].toFixed(3)}>${b[0].toFixed(3)},${b[1].toFixed(3)}`;
  if (cache.has(key)) return cache.get(key)!;
  const want: 0 | 1 = surface === 'land' ? 1 : 0;
  const s = nearest(a[0], a[1], want === 1, surface === 'sea' ? 60 : 8);
  const t = nearest(b[0], b[1], want === 1, surface === 'sea' ? 60 : 8);
  let result: [number, number][] | null = null;
  if (s && t) {
    const cells = astar(s, t, want);
    if (cells) {
      const hops = pull(cells, want).map((c) => {
        const y = (c / W) | 0;
        return [lonOf(c - y * W), latOf(y)] as [number, number];
      });
      result = unwrap([a, ...hops, b]);
    }
  }
  cache.set(key, result);
  return result;
}

/** True if a water cell lies within `cells` of this point (i.e. the point is on or near a coast). */
export function nearWater(lon: number, lat: number, cells = 2): boolean {
  const m = mask();
  const c = cellOf(lon, lat);
  for (let dy = -cells; dy <= cells; dy++) {
    const y = c.y + dy;
    if (y < 0 || y >= H) continue;
    for (let dx = -cells; dx <= cells; dx++) if (m[y * W + (((c.x + dx) % W) + W) % W] === 0) return true;
  }
  return false;
}
