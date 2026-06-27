import dagre from "@dagrejs/dagre";
import {
  getChildEdges,
  getParentEdges,
  getPartnerEdges,
  isParentChild,
  otherSideOf,
} from "@/lib/graph";
import type { Person, Relationship } from "@/lib/types";

export type TreeNodeData = {
  person: Person;
  isRoot: boolean;
  /** Generation distance from the root. Negative = ancestor (drawn
   *  above root), positive = descendant (drawn below), 0 = root row.
   *  Renderer can use it to tint by generation if it ever wants. */
  generation: number;
  /** IDs of the person's spouse(s) that are also in this view. Lets the
   *  node render a small "♥ Spouse" badge without re-querying the graph. */
  spouseIds: string[];
  /** Parents that EXIST in the relationship graph but are NOT shown in
   *  the current tree view (because depthUp clipped them, or because
   *  this person rode in as a same-gen spouse and we intentionally
   *  don't pull in-laws' ancestry). The renderer shows one small
   *  coloured marker per missing parent so the user knows there's
   *  more family hiding off-screen — blue = M, red = F, slate = U.
   *  At most one marker per sex (so a person with two recorded fathers
   *  produces a single blue rectangle, not two). */
  hiddenParentsBySex: Array<"M" | "F" | "U">;
};

export type TreeNode = {
  id: string;
  position: { x: number; y: number };
  data: TreeNodeData;
  width: number;
  height: number;
};

export type TreeEdge = {
  id: string;
  source: string;
  target: string;
  /** parent-child edges drive dagre layout; marriage edges are visual
   *  only and added AFTER layout so they don't shove ranks around. */
  kind: "parent-child" | "marriage";
  /** Per-edge meta the renderer can use. */
  divorced?: boolean;
};

export type LayoutResult = {
  nodes: TreeNode[];
  edges: TreeEdge[];
  /** Truthy when the requested root id isn't in the tree. */
  rootMissing?: boolean;
};

const NODE_W = 200;
const NODE_H = 100;

/**
 * Pure layout pipeline: BFS-walk the family graph from `rootId` in
 * BOTH directions — ancestors up to `depthUp` generations, descendants
 * down to `depthDown` — include every visited person's spouse, then
 * run dagre on the combined parent-child edge set. Marriage overlays
 * are added after layout.
 *
 * Why a combined view: this is the standard "hourglass" / kinship
 * chart you see in MyHeritage et al — the user picks one focal
 * person and looks at their full vertical slice of family at once.
 * The previous mode-toggle ("ancestors OR descendants") forced the
 * user to flip back and forth to see the whole picture.
 *
 * Dagre rankdir is fixed at TB (top-to-bottom). Parent→child edges
 * naturally place parents ABOVE their children, so ancestors end up
 * above root and descendants below — no special ranking required.
 *
 * Why dagre isn't fed marriage edges: same-rank edges confuse rank
 * assignment and produce uglier layouts. Marriages get drawn on top
 * of the dagre output as pure visual overlays.
 */
export function buildTreeLayout(opts: {
  persons: Person[];
  relationships: Relationship[];
  rootId: string;
  depthUp: number;
  depthDown: number;
}): LayoutResult {
  const { persons, relationships, rootId } = opts;
  // Hard caps stop wild settings from locking the browser on a 5000-node
  // tree.
  const depthUp = Math.max(0, Math.min(opts.depthUp, 8));
  const depthDown = Math.max(0, Math.min(opts.depthDown, 8));

  const byId = new Map(persons.map((p) => [p.id, p]));
  if (!byId.has(rootId)) {
    return { nodes: [], edges: [], rootMissing: true };
  }

  // Adjacency lookups — precomputed once per layout.
  const parentsOf = (id: string) =>
    getParentEdges(id, relationships).map((e) => e.parent);
  const childrenOf = (id: string) =>
    getChildEdges(id, relationships).map((e) => e.child);
  const partnersOf = (id: string) =>
    getPartnerEdges(id, relationships).map((e) => otherSideOf(id, e));

  // BFS that tracks the generation offset from root. Same-generation
  // spouses ride along on the same rank without spending a depth tick.
  // Negative generations = ancestors, positive = descendants.
  const visited = new Map<string, number>();
  type Q = { id: string; gen: number };
  const queue: Q[] = [{ id: rootId, gen: 0 }];

  while (queue.length > 0) {
    const head = queue.shift()!;
    if (visited.has(head.id)) continue;
    visited.set(head.id, head.gen);

    // Spouses at the same generation — always included, no depth cost.
    // Lets the renderer show both parents side-by-side above shared
    // children.
    for (const spId of partnersOf(head.id)) {
      if (!visited.has(spId)) queue.push({ id: spId, gen: head.gen });
    }

    // Walk one generation up if we still have budget on the ancestor
    // side. gen-1 is an ancestor (parents are above root visually).
    if (Math.abs(head.gen - 1) <= depthUp && head.gen <= 0) {
      for (const pid of parentsOf(head.id)) {
        if (!visited.has(pid)) queue.push({ id: pid, gen: head.gen - 1 });
      }
    }
    // Walk one generation down on the descendant side.
    if (head.gen + 1 <= depthDown && head.gen >= 0) {
      for (const cid of childrenOf(head.id)) {
        if (!visited.has(cid)) queue.push({ id: cid, gen: head.gen + 1 });
      }
    }
    // When the head is a same-rank spouse riding along, also walk
    // their children down (so the children of a step-parent show up
    // even if the step-parent isn't directly in the root's ancestry).
    // Symmetric for ancestors: a spouse's parents would expand the
    // in-laws unbounded, so we DON'T pull in their parents.
    if (head.gen >= 0 && head.gen + 1 <= depthDown) {
      for (const cid of childrenOf(head.id)) {
        if (!visited.has(cid)) queue.push({ id: cid, gen: head.gen + 1 });
      }
    }
  }

  // Restrict relationships to ones whose BOTH endpoints survived BFS.
  const inSet = (id: string) => visited.has(id);
  const includedRels = relationships.filter((r) => {
    if (isParentChild(r)) return inSet(r.parent) && inSet(r.child);
    return inSet(r.personA) && inSet(r.personB);
  });

  // dagre layout. TB (top-to-bottom): parents (edge source) end up
  // above children (edge target). Naturally puts ancestors at the top
  // of the canvas and descendants at the bottom — root in the middle.
  //
  // `compound: true` + per-family cluster nodes group siblings of the
  // same parent-set tightly together AND push unrelated families apart
  // — which is exactly the visual "spacing between adjacent families"
  // the user asked for. Larger nodesep / ranksep give breathing room
  // around each cluster.
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    nodesep: 40,
    ranksep: 110,
    marginx: 20,
    marginy: 20,
  });

  for (const id of visited.keys()) {
    g.setNode(id, { width: NODE_W, height: NODE_H });
  }

  // Build "child → parent-set" so we can assign siblings to a shared
  // cluster. Each unique parent-set becomes one cluster node; dagre
  // keeps the cluster's children adjacent in the layout.
  const childParents = new Map<string, string[]>();
  for (const r of includedRels) {
    if (isParentChild(r)) {
      const arr = childParents.get(r.child) ?? [];
      arr.push(r.parent);
      childParents.set(r.child, arr);
    }
  }
  const clusterByKey = new Map<string, string>();
  function familyClusterId(parents: string[]): string {
    const key = [...parents].sort().join("|");
    let id = clusterByKey.get(key);
    if (!id) {
      id = `__cluster_${clusterByKey.size + 1}`;
      clusterByKey.set(key, id);
      g.setNode(id, {});
    }
    return id;
  }
  for (const [childId, parents] of childParents) {
    if (parents.length === 0) continue;
    g.setParent(childId, familyClusterId(parents));
  }

  // Only feed parent-child edges to dagre — marriages would confuse
  // the rank assignment.
  for (const r of includedRels) {
    if (isParentChild(r)) {
      g.setEdge(r.parent, r.child);
    }
  }
  dagre.layout(g);

  // Build nodes with computed positions.
  const nodes: TreeNode[] = [];
  for (const [id, gen] of visited) {
    const person = byId.get(id);
    if (!person) continue;
    const n = g.node(id);
    const spouseIds = partnersOf(id).filter((sid) => visited.has(sid));

    // Off-screen parents — collapse to a sex-distinct set so the
    // renderer shows at most one marker per sex even when there are
    // multiple parent rows (bio + adoptive).
    const hiddenParentIds = parentsOf(id).filter((pid) => !visited.has(pid));
    const sexes = new Set<"M" | "F" | "U">();
    for (const pid of hiddenParentIds) {
      const p = byId.get(pid);
      const s: "M" | "F" | "U" =
        p?.sex === "M" ? "M" : p?.sex === "F" ? "F" : "U";
      sexes.add(s);
    }
    // Stable order — M first (left), F next, U last — so the visual
    // doesn't shift around between renders.
    const ORDER: Array<"M" | "F" | "U"> = ["M", "F", "U"];
    const hiddenParentsBySex = ORDER.filter((s) => sexes.has(s));

    nodes.push({
      id,
      position: { x: n.x - NODE_W / 2, y: n.y - NODE_H / 2 },
      width: NODE_W,
      height: NODE_H,
      data: {
        person,
        isRoot: id === rootId,
        generation: gen,
        spouseIds,
        hiddenParentsBySex,
      },
    });
  }

  // Edge set — parent-child from the relationship list + marriage
  // overlays. Marriage edges are kept separate so the renderer can
  // style them differently (color, dashed-when-divorced).
  const edges: TreeEdge[] = [];
  for (const r of includedRels) {
    if (isParentChild(r)) {
      edges.push({
        id: `pc-${r.id}`,
        source: r.parent,
        target: r.child,
        kind: "parent-child",
      });
    } else if (r.type === "marriage") {
      // Stable ordering for marriage edges so React reconciliation
      // doesn't re-mount them on every render.
      const [a, b] = [r.personA, r.personB].sort();
      edges.push({
        id: `m-${r.id}`,
        source: a,
        target: b,
        kind: "marriage",
        divorced: !!r.divorced,
      });
    }
    // Partnerships intentionally left out for v1 — same render treatment
    // as marriages can land in a follow-up.
  }

  return { nodes, edges };
}
