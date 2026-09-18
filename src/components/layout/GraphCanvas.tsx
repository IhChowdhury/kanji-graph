import { useCallback, useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  useStoreApi,
  type NodeMouseHandler,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { computeAncestorPath } from '../graph/graphPath'
import { layoutGraph } from '../graph/graphLayout'
import { nodeTypes } from '../graph/nodeTypes'
import { computeBoundingBox, planBranchFit } from '../graph/viewportFit'
import { useDailyKanji } from '../study/useDailyKanji'
import { useJlptFilterStore } from '../../store/useJlptFilterStore'
import { DEFAULT_JLPT_LEVEL, useKanjiDatasetStore } from '../../store/useKanjiDatasetStore'
import { useKanjiGraphStore } from '../../store/useKanjiGraphStore'
import { useKanjiSelectionStore } from '../../store/useKanjiSelectionStore'
import type { KanjiInfo } from '../../types/kanji'

const PATH_EDGE_STYLE = { stroke: '#fbbf24', strokeWidth: 2.5 }
const FADED_OPACITY = 0.2

function DatasetStatusOverlay() {
  const manifestStatus = useKanjiDatasetStore((state) => state.manifestStatus)
  const manifestError = useKanjiDatasetStore((state) => state.manifestError)
  const defaultLevelState = useKanjiDatasetStore(
    (state) => state.levelStates[DEFAULT_JLPT_LEVEL],
  )
  const initialize = useKanjiDatasetStore((state) => state.initialize)
  const ensureLevelLoaded = useKanjiDatasetStore((state) => state.ensureLevelLoaded)

  let message: string | null = null
  let retry: (() => void) | null = null

  if (manifestStatus === 'loading' || manifestStatus === 'idle') {
    message = 'Loading kanji data…'
  } else if (manifestStatus === 'error') {
    message = `Failed to load kanji dataset: ${manifestError}`
    retry = () => void initialize()
  } else if (defaultLevelState.status === 'loading') {
    message = `Loading ${DEFAULT_JLPT_LEVEL} kanji…`
  } else if (defaultLevelState.status === 'error') {
    message = `Failed to load ${DEFAULT_JLPT_LEVEL} kanji: ${defaultLevelState.error}`
    retry = () => void ensureLevelLoaded(DEFAULT_JLPT_LEVEL)
  } else if (defaultLevelState.status === 'empty') {
    message = `No kanji data available yet for ${DEFAULT_JLPT_LEVEL}.`
  }

  if (!message) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="pointer-events-auto flex flex-col items-center gap-2 rounded-md border border-slate-700 bg-slate-900/90 px-6 py-4 text-center text-sm text-slate-300 shadow-lg">
        <p>{message}</p>
        {retry && (
          <button
            type="button"
            onClick={retry}
            className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}

function GraphCanvasInner() {
  const nodes = useKanjiGraphStore((state) => state.nodes)
  const edges = useKanjiGraphStore((state) => state.edges)
  const onNodesChange = useKanjiGraphStore((state) => state.onNodesChange)
  const onEdgesChange = useKanjiGraphStore((state) => state.onEdgesChange)
  const focusKanji = useKanjiSelectionStore((state) => state.focusKanji)
  const focusNodeId = useKanjiSelectionStore((state) => state.focusNodeId)
  const focusToken = useKanjiSelectionStore((state) => state.focusToken)
  const focusExtraNodeIds = useKanjiSelectionStore((state) => state.focusExtraNodeIds)
  const focusDurationMs = useKanjiSelectionStore((state) => state.focusDurationMs)
  const isExpandFocus = useKanjiSelectionStore((state) => state.isExpandFocus)
  const enabledLevels = useJlptFilterStore((state) => state.enabledLevels)
  const { dailyKanji } = useDailyKanji()
  const { fitView, setCenter, fitBounds, getViewport } = useReactFlow()
  const storeApi = useStoreApi()

  const initializeDataset = useKanjiDatasetStore((state) => state.initialize)
  const defaultLevelStatus = useKanjiDatasetStore(
    (state) => state.levelStates[DEFAULT_JLPT_LEVEL].status,
  )
  const seedRootsIfNeeded = useKanjiGraphStore((state) => state.seedRootsIfNeeded)

  // Runs once on mount: loads the manifest, then the default JLPT level
  // only - other levels load lazily when the user enables their filter
  // (see useJlptFilterStore.toggleLevel).
  useEffect(() => {
    void initializeDataset()
  }, [initializeDataset])

  // Seeds the initial root nodes once the default level resolves (loaded
  // or empty - either way there's nothing more to wait for).
  useEffect(() => {
    if (defaultLevelStatus === 'loaded' || defaultLevelStatus === 'empty') {
      seedRootsIfNeeded()
    }
  }, [defaultLevelStatus, seedRootsIfNeeded])

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

  // Collapsing and filter changes intentionally do NOT move the viewport -
  // zoom and pan are preserved so the user doesn't lose their place (see
  // KanjiNode.handleExpandClick: collapse never calls focusKanjiForExpand,
  // so focusToken/focusNodeId simply don't change on collapse). Only an
  // explicit focus action recenters the view, below - and expand vs. every
  // other kind of focus (node click, search result, breadcrumb nav) behave
  // differently, per isExpandFocus.
  useEffect(() => {
    if (!focusNodeId) return

    if (!isExpandFocus) {
      // Plain focus - unchanged from before expand had its own viewport
      // behavior: fit just the focused node, no zoom-preservation logic.
      fitView({ nodes: [{ id: focusNodeId }], duration: 800, maxZoom: 1.5 })
      return
    }

    // Expand: bring the expanded node + its newly-revealed children into
    // view together, preserving the current zoom whenever that's actually
    // possible (see viewportFit.ts) - only falling back to a
    // zoom-adjusting fit when the branch genuinely doesn't fit otherwise.
    const positionsById = new Map(visibleNodes.map((node) => [node.id, node.position]))
    const bounds = computeBoundingBox([focusNodeId, ...focusExtraNodeIds], positionsById)
    if (!bounds) return

    const { width, height } = storeApi.getState()
    const action = planBranchFit(bounds, getViewport(), width, height)

    if (action.type === 'pan') {
      setCenter(action.x, action.y, { zoom: action.zoom, duration: focusDurationMs })
    } else if (action.type === 'fit') {
      fitBounds(action.bounds, { padding: 0.3, duration: focusDurationMs })
    }
    // action.type === 'none': the branch is already fully visible - do
    // nothing, so both pan and zoom stay exactly as the user left them.
  }, [
    focusToken,
    focusNodeId,
    focusExtraNodeIds,
    focusDurationMs,
    isExpandFocus,
    fitView,
    setCenter,
    fitBounds,
    getViewport,
    visibleNodes,
    storeApi,
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
