import type { Edge } from 'reactflow'

import { getKanjiInfo } from '../../data/kanjiCatalog'

export interface AncestorPath {
  nodeIds: Set<string>
  edgeIds: Set<string>
}

/**
 * Full ancestor set for graph highlighting: walks backward from the
 * selected node through every incoming edge (a kanji can have more than
 * one component - e.g. 休 comes from both 人 and 木), collecting the union
 * of every parent chain. Unlike computeLearningPath below, this is not
 * reduced to a single line, so all real parent edges get highlighted, not
 * just one.
 */
export function computeAncestorPath(
  focusNodeId: string | null,
  edges: Edge[],
): AncestorPath {
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  if (!focusNodeId) return { nodeIds, edgeIds }

  const incomingByTarget = new Map<string, Edge[]>()
  edges.forEach((edge) => {
    incomingByTarget.set(edge.target, [
      ...(incomingByTarget.get(edge.target) ?? []),
      edge,
    ])
  })

  const visited = new Set<string>([focusNodeId])
  const queue = [focusNodeId]

  while (queue.length > 0) {
    const current = queue.shift() as string
    for (const edge of incomingByTarget.get(current) ?? []) {
      edgeIds.add(edge.id)
      if (!visited.has(edge.source)) {
        visited.add(edge.source)
        nodeIds.add(edge.source)
        queue.push(edge.source)
      }
    }
  }

  return { nodeIds, edgeIds }
}

/**
 * The "Learning Path" breadcrumb for a kanji: the single chain from a root
 * kanji down to the selected one, walked via each kanji's primary
 * (first-listed) component. A kanji can have more than one component (e.g.
 * 休 comes from both 人 and 木), but a breadcrumb has to be one linear
 * line, so only the primary component is followed at each step.
 *
 * This is deliberately narrower than computeAncestorPath above, which is
 * what drives graph highlighting - the graph should show every real
 * parent edge, not just the primary one.
 *
 * Returns the chain in root-to-selected order, e.g. ['木', '休'].
 * Returns [] if nothing is selected.
 */
export function computeLearningPath(character: string | null): string[] {
  if (!character) return []

  const chain: string[] = []
  const visited = new Set<string>()
  let current: string | undefined = character

  while (current && !visited.has(current)) {
    visited.add(current)
    chain.push(current)
    current = getKanjiInfo(current).components[0]
  }

  return chain.reverse()
}
