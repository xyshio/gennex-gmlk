"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  buildTreeLayout,
  type TreeNodeData,
} from "@/lib/treeLayout";
import type { Person, Relationship } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { TreeNode } from "./TreeNode";

type Props = {
  persons: Person[];
  relationships: Relationship[];
  rootId: string;
  depthUp: number;
  depthDown: number;
};

const NODE_TYPES = { person: TreeNode };

/**
 * react-flow canvas wired to the dagre layout pipeline. Recomputes the
 * whole layout when any of the inputs change — cheap because dagre is
 * fast and the visited set is bounded by the depth cap in
 * `lib/treeLayout.ts`.
 *
 * Layout decisions:
 *   - `fitView` re-centers the camera every time the layout changes.
 *   - MiniMap + Controls + dot Background keep the canvas readable on
 *     large trees without extra UI noise.
 *   - Marriage edges render as dashed pink lines (solid pink when not
 *     divorced) and stack BENEATH parent-child edges so the family
 *     spine stays the visual anchor.
 */
export function TreeCanvas({
  persons,
  relationships,
  rootId,
  depthUp,
  depthDown,
}: Props) {
  const { t } = useLocale();
  const { nodes, edges, rootMissing } = useMemo(
    () =>
      buildTreeLayout({
        persons,
        relationships,
        rootId,
        depthUp,
        depthDown,
      }),
    [persons, relationships, rootId, depthUp, depthDown],
  );

  const flowNodes = useMemo<Node[]>(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: "person",
        position: n.position,
        data: n.data as unknown as Record<string, unknown>,
        width: n.width,
        height: n.height,
        draggable: false,
        selectable: true,
      })),
    [nodes],
  );

  const flowEdges = useMemo<Edge[]>(() => {
    const parentChild = edges
      .filter((e) => e.kind === "parent-child")
      .map<Edge>((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        // `step` = orthogonal step routing (right-angle bends, never
        // diagonal). When two siblings share a parent, the shared
        // first vertical segment from the parent overlaps for both
        // edges — produces the classic "sibling bus" bracket look for
        // free, without needing custom path drawing.
        type: "step",
        animated: false,
        style: { stroke: "rgb(148 163 184)", strokeWidth: 1.75 },
      }));
    const marriages = edges
      .filter((e) => e.kind === "marriage")
      .map<Edge>((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: "left",
        target: e.target,
        targetHandle: "right",
        type: "straight",
        animated: false,
        style: {
          stroke: e.divorced ? "rgb(148 163 184)" : "rgb(244 114 182)",
          strokeWidth: 1.5,
          strokeDasharray: e.divorced ? "6 3" : undefined,
        },
      }));
    // marriages first → painted under parent-child edges
    return [...marriages, ...parentChild];
  }, [edges]);

  if (rootMissing) {
    return (
      <div className="flex h-full items-center justify-center text-sm italic text-ink-muted">
        {t("tree.emptyRoot")}
      </div>
    );
  }

  if (flowNodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm italic text-ink-muted">
        {t("tree.emptyView")}
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={NODE_TYPES}
      // `fitView` would always re-fit to encompass every visible node.
      // The user wants the central person at the geometric centre of
      // the viewport on (re)load — `CenterOnRoot` below handles that
      // explicitly with an animated camera move, so fitView would
      // fight it.
      minZoom={0.05}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      panOnScroll
      selectionOnDrag={false}
    >
      <CenterOnRoot rootId={rootId} nodes={flowNodes} />
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="rgb(226 232 240)"
      />
      <Controls showInteractive={false} />
      <MiniMap
        zoomable
        pannable
        maskColor="rgba(15, 23, 42, 0.08)"
        nodeColor={(n) => {
          const d = n.data as unknown as TreeNodeData;
          if (d.isRoot) return "rgb(139 92 246)";
          if (d.person.sex === "M") return "rgb(56 189 248)";
          if (d.person.sex === "F") return "rgb(244 114 182)";
          return "rgb(148 163 184)";
        }}
      />
    </ReactFlow>
  );
}

/**
 * Pans + zooms the camera so the root node sits in the geometric
 * centre of the viewport. Re-fires whenever `rootId` changes (i.e. the
 * user picked a new central person via the Target icon or the edit
 * page button) so the focus follows the data.
 *
 * Mounted INSIDE `<ReactFlow>` because `useReactFlow()` requires that
 * context. Renders nothing visible — it's an effect-only component.
 *
 * Two RAF ticks of grace before the camera move: the freshly-mounted
 * canvas needs one paint to know its own size, and dagre layout
 * positions in the parent need one more pass to land in the node
 * objects we read here.
 */
function CenterOnRoot({
  rootId,
  nodes,
}: {
  rootId: string;
  nodes: Node[];
}) {
  const flow = useReactFlow();
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!rootId) return;
    const root = nodes.find((n) => n.id === rootId);
    if (!root) return;
    // node.width/height come from the layout; fall back to the
    // hard-coded card dimensions when not set.
    const w = (root.width ?? 200) as number;
    const h = (root.height ?? 100) as number;
    const cx = root.position.x + w / 2;
    const cy = root.position.y + h / 2;
    // Defer one frame so the freshly-mounted ReactFlow viewport has a
    // chance to measure its own container — calling setCenter before
    // that measurement sometimes lands at the wrong coords.
    rafRef.current = requestAnimationFrame(() => {
      flow.setCenter(cx, cy, { zoom: 1, duration: 400 });
    });
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // We intentionally re-run when EITHER rootId changes OR the node
    // set is replaced wholesale (depth change, person added).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId, nodes]);

  return null;
}
