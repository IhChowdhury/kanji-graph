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

import { useKanjiDatasetStore } from './useKanjiDatasetStore'
import type { KanjiNodeData } from '../types/kanji'

// BFS from the roots over the post-collapse edge set. Anything still
// reachable stays (e.g. 休 remains visible if 木 is still expanded even
// after collapsing 人), everything else - including now-orphaned
// descendants of what was collapsed - is dropped in one pass.
function findReachableIds(edges: Edge[], rootIds: string[]): Set<string> {
  const adjacency = new Map<string, string[]>()
  edges.forEach((edge) => {
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target])
  })

  const reachable = new Set<string>(rootIds)
  const queue = [...rootIds]
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
  /**
   * Expands or collapses `kanjiId`. Returns the ids of newly-added child
   * nodes when this call expanded (empty array if the children were
   * already present for some other reason), or `null` when this call
   * collapsed - callers (KanjiNode) use that distinction to decide whether
   * to change selection/viewport at all (expand does, collapse never does).
   */
  toggleExpand: (kanjiId: string) => string[] | null
  revealKanji: (character: string) => void
  /**
   * Adds any not-yet-present root kanji from whatever levels are currently
   * loaded. Called once the default level's data resolves, and again after
   * every subsequent level load (see useJlptFilterStore.toggleLevel) - safe
   * to call repeatedly, existing nodes are never duplicated.
   */
  seedRootsIfNeeded: () => void
}

export const useKanjiGraphStore = create<KanjiGraphState>((set, get) => ({
  // Starts empty: root kanji aren't known synchronously anymore - data
  // loads at runtime (see useKanjiDatasetStore). seedRootsIfNeeded populates
  // this once the default level resolves.
  nodes: [],
  edges: [],
  expandedIds: new Set<string>(),

  onNodesChange: (changes) =>
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),

  onEdgesChange: (changes) =>
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),

  seedRootsIfNeeded: () => {
    const { rootKanjiIds, getKanjiInfo } = useKanjiDatasetStore.getState()
    const { nodes } = get()
    const existingIds = new Set(nodes.map((node) => node.id))
    const newNodes: Node<KanjiNodeData>[] = rootKanjiIds
      .filter((id) => !existingIds.has(id))
      .map((id) => ({
        id,
        type: 'kanji',
        position: { x: 0, y: 0 },
        data: getKanjiInfo(id) as KanjiNodeData,
      }))

    if (newNodes.length === 0) return
    set({ nodes: [...nodes, ...newNodes] })
  },

  toggleExpand: (kanjiId) => {
    const { expandedIds, edges, nodes } = get()

    if (expandedIds.has(kanjiId)) {
      const edgesAfterRemoval = edges.filter((edge) => edge.source !== kanjiId)
      const rootIds = useKanjiDatasetStore.getState().rootKanjiIds
      const reachable = findReachableIds(edgesAfterRemoval, rootIds)

      set({
        nodes: nodes.filter((node) => reachable.has(node.id)),
        edges: edgesAfterRemoval.filter(
          (edge) => reachable.has(edge.source) && reachable.has(edge.target),
        ),
        expandedIds: new Set(
          [...expandedIds].filter((id) => id !== kanjiId && reachable.has(id)),
        ),
      })
      return null
    }

    const children = useKanjiDatasetStore.getState().getChildKanji(kanjiId)
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
    return newNodes.map((node) => node.id)
  },

  revealKanji: (character) => {
    if (get().nodes.some((node) => node.id === character)) return

    // If this character's own data isn't loaded yet (e.g. a cross-level
    // component whose level hasn't been enabled), there's nothing to reveal
    // it from - stop here rather than throwing.
    const info = useKanjiDatasetStore.getState().getKanjiInfo(character)
    const parent = info?.components[0]
    if (!parent) return

    get().revealKanji(parent)
    if (!get().expandedIds.has(parent)) {
      get().toggleExpand(parent)
    }
  },
}))
