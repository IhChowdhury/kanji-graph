import { useCallback, useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeMouseHandler,
} from 'reactflow'
import 'reactflow/dist/style.css'

import DatasetStatusOverlay from './DatasetStatusOverlay'
import { computeAncestorPath } from '../graph/graphPath'
import { NODE_HEIGHT, NODE_WIDTH, layoutGraph } from '../graph/graphLayout'
import { computeLearningFocusGraph } from '../graph/learningFocus'
import { nodeTypes } from '../graph/nodeTypes'
import { useDailyKanji } from '../study/useDailyKanji'
import { useGraphModeStore } from '../../store/useGraphModeStore'
import { useJlptFilterStore } from '../../store/useJlptFilterStore'
import { useKanjiDatasetStore } from '../../store/useKanjiDatasetStore'
import { useKanjiGraphStore } from '../../store/useKanjiGraphStore'
import { useKanjiSelectionStore } from '../../store/useKanjiSelectionStore'
import type { KanjiInfo, KanjiNodeData } from '../../types/kanji'

const PATH_EDGE_STYLE = { stroke: '#fbbf24', strokeWidth: 2.5 }
const FADED_OPACITY = 0.2

function GraphCanvasInner() {
  const mode = useGraphModeStore((state) => state.mode)
  const nodes = useKanjiGraphStore((state) => state.nodes)
  const edges = useKanjiGraphStore((state) => state.edges)
  const onNodesChange = useKanjiGraphStore((state) => state.onNodesChange)
  const onEdgesChange = useKanjiGraphStore((state) => state.onEdgesChange)
  const focusKanji = useKanjiSelectionStore((state) => state.focusKanji)
  const focusNodeId = useKanjiSelectionStore((state) => state.focusNodeId)
  const focusToken = useKanjiSelectionStore((state) => state.focusToken)
  const focusDurationMs = useKanjiSelectionStore((state) => state.focusDurationMs)
  const isExpandFocus = useKanjiSelectionStore((state) => state.isExpandFocus)
  const clearFocus = useKanjiSelectionStore((state) => state.clearFocus)
  const enabledLevels = useJlptFilterStore((state) => state.enabledLevels)
  const { dailyKanji } = useDailyKanji()
  const { setCenter, getViewport } = useReactFlow()

  const catalog = useKanjiDatasetStore((state) => state.catalog)
  const childIndex = useKanjiDatasetStore((state) => state.childIndex)
  const rootKanjiIds = useKanjiDatasetStore((state) => state.rootKanjiIds)

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

  // ---- Full Graph Mode: the existing expand/collapse exploration graph ----

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

  const fullLayoutNodes = useMemo(
    () => layoutGraph(filteredNodes, filteredEdges),
    [filteredNodes, filteredEdges],
  )

  const fullAncestorPath = useMemo(
    () => computeAncestorPath(focusNodeId, filteredEdges),
    [focusNodeId, filteredEdges],
  )

  const hasSelection = Boolean(focusNodeId)

  const fullVisibleNodes = useMemo(
    () =>
      fullLayoutNodes.map((node) => {
        const isFocused = node.id === focusNodeId
        const isOnPath = fullAncestorPath.nodeIds.has(node.id) && !isFocused
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
    [fullLayoutNodes, focusNodeId, fullAncestorPath, hasSelection, studyTargetIds],
  )

  const fullVisibleEdges = useMemo(
    () =>
      filteredEdges.map((edge) =>
        fullAncestorPath.edgeIds.has(edge.id)
          ? { ...edge, animated: true, style: { ...PATH_EDGE_STYLE, opacity: 1 } }
          : {
              ...edge,
              animated: false,
              style: { opacity: hasSelection ? FADED_OPACITY : 1 },
            },
      ),
    [filteredEdges, fullAncestorPath, hasSelection],
  )

  // ---- Learning Focus Mode: only the selected kanji's family, computed ----
  // straight from the dataset catalog (parents/children may not have been
  // "expanded" in the exploration graph above at all).

  const focusGraph = useMemo(
    () => computeLearningFocusGraph(focusNodeId, catalog, childIndex),
    [focusNodeId, catalog, childIndex],
  )

  const focusRawNodes = useMemo((): Node<KanjiNodeData>[] => {
    // Nothing selected yet: land on the root kanji so there's something to
    // click into, rather than an empty canvas.
    const ids = focusGraph.nodeIds.size > 0 ? focusGraph.nodeIds : new Set(rootKanjiIds)
    return [...ids]
      .filter((id) => catalog[id] && enabledLevels[catalog[id].jlptLevel])
      .map((id) => ({
        id,
        type: 'kanji',
        position: { x: 0, y: 0 },
        data: catalog[id],
      }))
  }, [focusGraph.nodeIds, rootKanjiIds, catalog, enabledLevels])

  const focusRawEdges = useMemo(() => {
    const visibleIds = new Set(focusRawNodes.map((node) => node.id))
    return focusGraph.edges.filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    )
  }, [focusGraph.edges, focusRawNodes])

  const focusLayoutNodes = useMemo(
    () => layoutGraph(focusRawNodes, focusRawEdges),
    [focusRawNodes, focusRawEdges],
  )

  const focusAncestorPath = useMemo(
    () => computeAncestorPath(focusNodeId, focusRawEdges),
    [focusNodeId, focusRawEdges],
  )

  const focusVisibleNodes = useMemo(
    () =>
      focusLayoutNodes.map((node) => {
        const isFocused = node.id === focusNodeId
        const isOnPath = focusAncestorPath.nodeIds.has(node.id) && !isFocused
        const focusTier = isFocused || isOnPath
          ? undefined
          : focusGraph.childIds.has(node.id)
            ? 'child'
            : focusGraph.grandchildIds.has(node.id)
              ? 'grandchild'
              : undefined
        return {
          ...node,
          selected: isFocused,
          data: {
            ...node.data,
            onPath: isOnPath,
            focusTier,
            isStudyTarget: studyTargetIds.has(node.id),
          },
          // Learning Focus Mode never dims a visible node - anything not
          // relevant to the current family is removed entirely (see
          // focusRawNodes), not faded.
          style: { opacity: 1 },
        }
      }),
    [focusLayoutNodes, focusNodeId, focusAncestorPath, focusGraph, studyTargetIds],
  )

  const focusVisibleEdges = useMemo(
    () =>
      focusRawEdges.map((edge) =>
        focusAncestorPath.edgeIds.has(edge.id)
          ? { ...edge, animated: true, style: { ...PATH_EDGE_STYLE, opacity: 1 } }
          : { ...edge, animated: false, style: { opacity: 1 } },
      ),
    [focusRawEdges, focusAncestorPath],
  )

  const visibleNodes = mode === 'focus' ? focusVisibleNodes : fullVisibleNodes
  const visibleEdges = mode === 'focus' ? focusVisibleEdges : fullVisibleEdges

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes],
  )
  const visiblePositionsById = useMemo(
    () => new Map(visibleNodes.map((node) => [node.id, node.position])),
    [visibleNodes],
  )

  // Keeps the graph and detail panel from disagreeing about what's selected
  // (Issue 3): if the focused kanji's node drops out of the currently
  // rendered set - its JLPT level got disabled, or (Full Graph Mode) it was
  // pruned by collapsing an ancestor - there's nothing left to show as
  // selected, so the selection itself is cleared rather than leaving a
  // "selected" kanji with no visible indication of it.
  useEffect(() => {
    if (focusNodeId && !visibleNodeIds.has(focusNodeId)) {
      clearFocus()
    }
  }, [focusNodeId, visibleNodeIds, clearFocus])

  // A plain selection change (node click, search, parent/child chip,
  // breadcrumb) pans the focused node to center - current zoom preserved,
  // fitView() never called - so it's always visible without the user
  // losing pan/zoom control. An expand-triggered focus (isExpandFocus)
  // deliberately never touches the viewport, matching the expand/collapse
  // viewport rules.
  useEffect(() => {
    if (!focusNodeId || isExpandFocus) return
    const position = visiblePositionsById.get(focusNodeId)
    if (!position) return

    setCenter(position.x + NODE_WIDTH / 2, position.y + NODE_HEIGHT / 2, {
      zoom: getViewport().zoom,
      duration: focusDurationMs,
    })
  }, [
    focusToken,
    focusNodeId,
    isExpandFocus,
    visiblePositionsById,
    focusDurationMs,
    setCenter,
    getViewport,
  ])

  return (
    <>
      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        onlyRenderVisibleElements
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
      <DatasetStatusOverlay />
    </>
  )
}

function GraphCanvas() {
  return (
    <main className="relative flex-1 bg-slate-950">
      <ReactFlowProvider>
        <GraphCanvasInner />
      </ReactFlowProvider>
    </main>
  )
}

export default GraphCanvas
