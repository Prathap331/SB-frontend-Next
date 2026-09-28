/**
 * Tidy top-down tree layout (pure), shared by DG-09 Decision Tree and DG-14 Hierarchy.
 * Nodes reference their parent by index (-1 = root). Leaves get equal slots across the width;
 * each parent sits centred over its children; levels are evenly spaced rows.
 */
export type TreeNodeIn = { parent: number };
export type TreePos = { level: number; cx: number; slotW: number };

export function treeLayout(nodes: TreeNodeIn[], width: number): { pos: TreePos[]; levels: number; leaves: number; children: number[][] } {
  const n = nodes.length;
  const children: number[][] = Array.from({ length: n }, () => []);
  let root = nodes.findIndex((x) => x.parent < 0);
  if (root < 0) root = 0;
  nodes.forEach((x, i) => {
    if (i !== root && x.parent >= 0 && x.parent < n && x.parent !== i) children[x.parent].push(i);
  });
  // any node whose parent chain does not reach the root is hung under the root
  const reach = new Set<number>();
  const walk = (i: number) => {
    if (reach.has(i)) return;
    reach.add(i);
    children[i].forEach(walk);
  };
  walk(root);
  nodes.forEach((_, i) => {
    if (!reach.has(i)) {
      children[root].push(i);
      walk(i);
    }
  });
  const level = new Array(n).fill(0);
  const order: number[] = [];
  const leavesOf: number[] = [];
  const visit = (i: number, d: number) => {
    level[i] = d;
    order.push(i);
    if (!children[i].length) leavesOf.push(i);
    children[i].forEach((c) => visit(c, d + 1));
  };
  visit(root, 0);
  const leaves = Math.max(1, leavesOf.length);
  const slotW = width / leaves;
  const cx = new Array(n).fill(0);
  leavesOf.forEach((l, k) => (cx[l] = slotW * (k + 0.5)));
  // parents centred over their children (deepest first)
  [...order].reverse().forEach((i) => {
    if (children[i].length) cx[i] = children[i].reduce((a, c) => a + cx[c], 0) / children[i].length;
  });
  const levels = Math.max(...level) + 1;
  // horizontal room for a node = distance to its nearest neighbour on the same level
  const pos: TreePos[] = nodes.map((_, i) => {
    const same = order.filter((j) => j !== i && level[j] === level[i]).map((j) => Math.abs(cx[j] - cx[i]));
    const room = same.length ? Math.min(...same) : width;
    return { level: level[i], cx: cx[i], slotW: Math.min(room, width) };
  });
  return { pos, levels, leaves, children };
}

/**
 * Limit a tree to `maxLevels` rows: a node deeper than that is re-attached to its ancestor one level up
 * (it becomes a sibling instead of a grand-child), so the tree always fits the frame.
 */
export function flattenDepth<T extends TreeNodeIn>(nodes: T[], maxLevels: number): T[] {
  const out = nodes.map((n) => ({ ...n }));
  for (let guard = 0; guard < 50; guard++) {
    let changed = false;
    out.forEach((n, i) => {
      let d = 0;
      let p = n.parent;
      const seen = new Set<number>([i]);
      while (p >= 0 && p < out.length && !seen.has(p)) {
        seen.add(p);
        d++;
        p = out[p].parent;
      }
      if (d > maxLevels - 1 && n.parent >= 0) {
        n.parent = out[n.parent].parent;
        changed = true;
      }
    });
    if (!changed) break;
  }
  return out;
}
