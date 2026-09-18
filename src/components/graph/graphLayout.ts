import dagre from 'dagre'
import type { Edge, Node } from 'reactflow'

import type { KanjiNodeData } from '../../types/kanji'

// Matches KanjiNode's rendered footprint (w-28 card plus badge/button overhang).
const NODE_WIDTH = 112
const NODE_HEIGHT = 96
const NODE_SEP = 32
const RANK_SEP = 72
const COMPONENT_GAP = 56
const ROW_MAX_WIDTH = 1400

function layoutConnectedComponent(
  nodes: Node<KanjiNodeData>[],
  edges: Edge[],
): { nodes: Node<KanjiNodeData>[]; width: number; height: number } {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'TB', nodesep: NODE_SEP, ranksep: RANK_SEP })

  nodes.forEach((node) =>
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }),
  )
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target))

  dagre.layout(graph)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const positioned = nodes.map((node) => {
    const { x, y } = graph.node(node.id)
    minX = Math.min(minX, x - NODE_WIDTH / 2)
    minY = Math.min(minY, y - NODE_HEIGHT / 2)
    maxX = Math.max(maxX, x + NODE_WIDTH / 2)
    maxY = Math.max(maxY, y + NODE_HEIGHT / 2)
    return { ...node, position: { x, y } }
  })

  return {
    nodes: positioned.map((node) => ({
      ...node,
      position: { x: node.position.x - minX, y: node.position.y - minY },
    })),
    width: maxX - minX,
    height: maxY - minY,
  }
}

function findConnectedComponents(
  nodes: Node<KanjiNodeData>[],
  edges: Edge[],
): string[][] {
  const adjacency = new Map<string, Set<string>>()
  nodes.forEach((node) => adjacency.set(node.id, new Set()))
  edges.forEach((edge) => {
    adjacency.get(edge.source)?.add(edge.target)
    adjacency.get(edge.target)?.add(edge.source)
  })

  const visited = new Set<string>()
  const components: string[][] = []

  for (const node of nodes) {
    if (visited.has(node.id)) continue
    const component: string[] = []
    const queue = [node.id]
    visited.add(node.id)
    while (queue.length > 0) {
      const current = queue.shift() as string
      component.push(current)
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
    components.push(component)
  }

  return components
}

/**
 * Lays out the visible graph automatically. Dagre alone isn't a great fit
 * here: this graph is a forest of many independent component trees (edges
 * only ever run component -> compound, never between two roots), so a
 * single dagre pass would place every disconnected root in one long row.
 * Instead each connected component is laid out with dagre individually,
 * then the resulting blocks are packed into a wrapping grid.
 */
export function layoutGraph(
  nodes: Node<KanjiNodeData>[],
  edges: Edge[],
): Node<KanjiNodeData>[] {
  if (nodes.length === 0) return nodes

  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const componentIdGroups = findConnectedComponents(nodes, edges)

  const laidOutComponents = componentIdGroups.map((ids) => {
    const idSet = new Set(ids)
    const componentNodes = ids.map((id) => nodesById.get(id) as Node<KanjiNodeData>)
    const componentEdges = edges.filter(
      (edge) => idSet.has(edge.source) && idSet.has(edge.target),
    )
    return layoutConnectedComponent(componentNodes, componentEdges)
  })

  const result: Node<KanjiNodeData>[] = []
  let cursorX = 0
  let cursorY = 0
  let rowHeight = 0

  for (const component of laidOutComponents) {
    if (cursorX > 0 && cursorX + component.width > ROW_MAX_WIDTH) {
      cursorX = 0
      cursorY += rowHeight + COMPONENT_GAP
      rowHeight = 0
    }

    for (const node of component.nodes) {
      result.push({
        ...node,
        position: {
          x: node.position.x + cursorX,
          y: node.position.y + cursorY,
        },
      })
    }

    cursorX += component.width + COMPONENT_GAP
    rowHeight = Math.max(rowHeight, component.height)
  }

  return result
}
