import type { Edge } from 'reactflow'

import type { KanjiInfo } from '../../types/kanji'

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
 * Returns [] if nothing is selected. Stops early (rather than throwing) if a
 * step's data isn't loaded yet - e.g. a cross-level parent whose JLPT level
 * hasn't been enabled - since the catalog only ever contains loaded levels.
 *
 * `isVisible` additionally stops the walk before adding an ancestor that's
 * loaded but currently JLPT-filtered out, so the chain never exposes a
 * kanji the rest of the UI is hiding (see isKanjiVisible). The selected
 * character itself is always included regardless of `isVisible` - it's the
 * current selection, not a relationship being surfaced.
 */
export function computeLearningPath(
  character: string | null,
  catalog: Record<string, KanjiInfo>,
  isVisible: (character: string) => boolean = () => true,
): string[] {
  if (!character) return []

  const chain: string[] = [character]
  const visited = new Set<string>([character])
  let current = catalog[character]?.components[0]

  while (current && !visited.has(current) && isVisible(current)) {
    visited.add(current)
    chain.push(current)
    current = catalog[current]?.components[0]
  }

  return chain.reverse()
}
