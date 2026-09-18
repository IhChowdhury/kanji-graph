import type { Edge } from 'reactflow'

import type { KanjiInfo } from '../../types/kanji'

export interface LearningFocusGraph {
  nodeIds: Set<string>
  parentIds: Set<string>
  childIds: Set<string>
  grandchildIds: Set<string>
  edges: Edge[]
}

const EMPTY_FOCUS_GRAPH: LearningFocusGraph = {
  nodeIds: new Set(),
  parentIds: new Set(),
  childIds: new Set(),
  grandchildIds: new Set(),
  edges: [],
}

/**
 * Learning Focus Mode's neighborhood for `character`: itself, its direct
 * parents (from its own `components`), its direct children, and its
 * grandchildren (children of children) - depth 2 max, per spec. Computed
 * straight from the dataset catalog/childIndex rather than from the
 * exploration graph (useKanjiGraphStore), since a kanji's family may not be
 * "revealed" there yet.
 */
export function computeLearningFocusGraph(
  character: string | null,
  catalog: Record<string, KanjiInfo>,
  childIndex: Record<string, string[]>,
): LearningFocusGraph {
  if (!character || !catalog[character]) return EMPTY_FOCUS_GRAPH

  const parentIds = new Set(
    catalog[character].components.filter((id) => catalog[id]),
  )
  const childIds = new Set(childIndex[character] ?? [])

  const grandchildIds = new Set<string>()
  const edges: Edge[] = []

  parentIds.forEach((parentId) => {
    edges.push({ id: `${parentId}->${character}`, source: parentId, target: character })
  })

  childIds.forEach((childId) => {
    edges.push({ id: `${character}->${childId}`, source: character, target: childId })

    for (const grandchildId of childIndex[childId] ?? []) {
      if (!catalog[grandchildId]) continue
      grandchildIds.add(grandchildId)
      edges.push({
        id: `${childId}->${grandchildId}`,
        source: childId,
        target: grandchildId,
      })
    }
  })

  const nodeIds = new Set<string>([character, ...parentIds, ...childIds, ...grandchildIds])

  return { nodeIds, parentIds, childIds, grandchildIds, edges }
}
