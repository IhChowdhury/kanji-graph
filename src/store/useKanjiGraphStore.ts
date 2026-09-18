import {
  MarkerType,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from 'reactflow'
import { create } from 'zustand'

import { getChildKanji, getKanjiInfo, rootKanjiIds } from '../data/kanjiCatalog'
import type { KanjiNodeData } from '../types/kanji'

// Positions here are placeholders only - GraphCanvas runs an automatic
// layout (see graphLayout.ts) over whatever is currently expanded.
function createInitialNodes(): Node<KanjiNodeData>[] {
  return rootKanjiIds.map((id) => ({
    id,
    type: 'kanji',
    position: { x: 0, y: 0 },
    data: getKanjiInfo(id),
  }))
}

// BFS from the roots over the post-collapse edge set. Anything still
// reachable stays (e.g. 休 remains visible if 木 is still expanded even
// after collapsing 人), everything else - including now-orphaned
// descendants of what was collapsed - is dropped in one pass.
function findReachableIds(edges: Edge[]): Set<string> {
  const adjacency = new Map<string, string[]>()
  edges.forEach((edge) => {
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target])
  })

  const reachable = new Set<string>(rootKanjiIds)
  const queue = [...rootKanjiIds]
  while (queue.length > 0) {
    const current = queue.shift() as string
    for (const next of adjacency.get(current) ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next)
        queue.push(next)
      }
    }
  }
  return reachable
}

interface KanjiGraphState {
  nodes: Node<KanjiNodeData>[]
  edges: Edge[]
  expandedIds: Set<string>
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  toggleExpand: (kanjiId: string) => void
  revealKanji: (character: string) => void
}

export const useKanjiGraphStore = create<KanjiGraphState>((set, get) => ({
  nodes: createInitialNodes(),
  edges: [],
  expandedIds: new Set<string>(),

  onNodesChange: (changes) =>
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),

  onEdgesChange: (changes) =>
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),

  toggleExpand: (kanjiId) => {
    const { expandedIds, edges, nodes } = get()

    if (expandedIds.has(kanjiId)) {
      const edgesAfterRemoval = edges.filter((edge) => edge.source !== kanjiId)
      const reachable = findReachableIds(edgesAfterRemoval)

      set({
        nodes: nodes.filter((node) => reachable.has(node.id)),
        edges: edgesAfterRemoval.filter(
          (edge) => reachable.has(edge.source) && reachable.has(edge.target),
        ),
        expandedIds: new Set(
          [...expandedIds].filter((id) => id !== kanjiId && reachable.has(id)),
        ),
      })
      return
    }

    const children = getChildKanji(kanjiId)
    const existingIds = new Set(nodes.map((node) => node.id))
    const newNodes: Node<KanjiNodeData>[] = children
      .filter((child) => !existingIds.has(child.character))
      .map((child) => ({
        id: child.character,
        type: 'kanji',
        position: { x: 0, y: 0 },
        data: child,
      }))

    const existingEdgeIds = new Set(edges.map((edge) => edge.id))
    const newEdges: Edge[] = children
      .map((child) => ({
        id: `${kanjiId}->${child.character}`,
        source: kanjiId,
        target: child.character,
        markerEnd: { type: MarkerType.ArrowClosed },
      }))
      .filter((edge) => !existingEdgeIds.has(edge.id))

    set({
      nodes: [...nodes, ...newNodes],
      edges: [...edges, ...newEdges],
      expandedIds: new Set(expandedIds).add(kanjiId),
    })
  },

  revealKanji: (character) => {
    if (get().nodes.some((node) => node.id === character)) return

    const parent = getKanjiInfo(character).components[0]
    if (!parent) return

    get().revealKanji(parent)
    if (!get().expandedIds.has(parent)) {
      get().toggleExpand(parent)
    }
  },
}))
