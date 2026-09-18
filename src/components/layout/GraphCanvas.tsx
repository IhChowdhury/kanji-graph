import { useCallback, useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type NodeMouseHandler,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { computeAncestorPath } from '../graph/graphPath'
import { layoutGraph } from '../graph/graphLayout'
import { nodeTypes } from '../graph/nodeTypes'
import { useDailyKanji } from '../study/useDailyKanji'
import { useJlptFilterStore } from '../../store/useJlptFilterStore'
import { useKanjiGraphStore } from '../../store/useKanjiGraphStore'
import { useKanjiSelectionStore } from '../../store/useKanjiSelectionStore'
import type { KanjiInfo } from '../../types/kanji'

const PATH_EDGE_STYLE = { stroke: '#fbbf24', strokeWidth: 2.5 }
const FADED_OPACITY = 0.2

function GraphCanvasInner() {
  const nodes = useKanjiGraphStore((state) => state.nodes)
  const edges = useKanjiGraphStore((state) => state.edges)
  const onNodesChange = useKanjiGraphStore((state) => state.onNodesChange)
  const onEdgesChange = useKanjiGraphStore((state) => state.onEdgesChange)
  const focusKanji = useKanjiSelectionStore((state) => state.focusKanji)
  const focusNodeId = useKanjiSelectionStore((state) => state.focusNodeId)
  const focusToken = useKanjiSelectionStore((state) => state.focusToken)
  const enabledLevels = useJlptFilterStore((state) => state.enabledLevels)
  const { dailyKanji } = useDailyKanji()
  const { fitView } = useReactFlow()

  const studyTargetIds = useMemo(
    () => new Set(dailyKanji.map((kanji) => kanji.character)),
    [dailyKanji],
  )

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      focusKanji(node.data as KanjiInfo)
    },
    [focusKanji],
  )

  const filteredNodes = useMemo(
    () => nodes.filter((node) => enabledLevels[node.data.jlptLevel]),
    [nodes, enabledLevels],
  )

  const filteredEdges = useMemo(() => {
    const visibleIds = new Set(filteredNodes.map((node) => node.id))
    return edges.filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    )
  }, [edges, filteredNodes])

  const layoutNodes = useMemo(
    () => layoutGraph(filteredNodes, filteredEdges),
    [filteredNodes, filteredEdges],
  )

  const ancestorPath = useMemo(
    () => computeAncestorPath(focusNodeId, filteredEdges),
    [focusNodeId, filteredEdges],
  )
  const pathNodeIds = ancestorPath.nodeIds
  const pathEdgeIds = ancestorPath.edgeIds

  const hasSelection = Boolean(focusNodeId)

  const visibleNodes = useMemo(
    () =>
      layoutNodes.map((node) => {
        const isFocused = node.id === focusNodeId
        const isOnPath = pathNodeIds.has(node.id) && !isFocused
        const isHighlighted = isFocused || isOnPath
        return {
          ...node,
          selected: isFocused,
          data: {
            ...node.data,
            onPath: isOnPath,
            isStudyTarget: studyTargetIds.has(node.id),
          },
          style: { opacity: !hasSelection || isHighlighted ? 1 : FADED_OPACITY },
        }
      }),
    [layoutNodes, focusNodeId, pathNodeIds, hasSelection, studyTargetIds],
  )

  const visibleEdges = useMemo(
    () =>
      filteredEdges.map((edge) =>
        pathEdgeIds.has(edge.id)
          ? { ...edge, animated: true, style: { ...PATH_EDGE_STYLE, opacity: 1 } }
          : {
              ...edge,
              animated: false,
              style: { opacity: hasSelection ? FADED_OPACITY : 1 },
            },
      ),
    [filteredEdges, pathEdgeIds, hasSelection],
  )

  // Expand/collapse and filter changes intentionally do NOT move the
  // viewport - zoom and pan are preserved so the user doesn't lose their
  // place. Only an explicit focus action (click a node, pick a search
  // result) recenters the view, below.
  useEffect(() => {
    if (!focusNodeId) return
    fitView({ nodes: [{ id: focusNodeId }], duration: 800, maxZoom: 1.5 })
  }, [focusToken, focusNodeId, fitView])

  return (
    <ReactFlow
      nodes={visibleNodes}
      edges={visibleEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      <Controls />
      <MiniMap
        pannable
        zoomable
        className="!bg-slate-900"
        maskColor="rgba(15, 23, 42, 0.6)"
        nodeColor="#64748b"
      />
    </ReactFlow>
  )
}

function GraphCanvas() {
  return (
    <main className="flex-1 bg-slate-950">
      <ReactFlowProvider>
        <GraphCanvasInner />
      </ReactFlowProvider>
    </main>
  )
}

export default GraphCanvas
