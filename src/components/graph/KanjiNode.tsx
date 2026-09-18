import type { MouseEvent } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'

import { useGraphModeStore } from '../../store/useGraphModeStore'
import { useKanjiDatasetStore } from '../../store/useKanjiDatasetStore'
import { useKanjiGraphStore } from '../../store/useKanjiGraphStore'
import { useKanjiSelectionStore } from '../../store/useKanjiSelectionStore'
import { useMasteryStore } from '../../store/useMasteryStore'
import type { KanjiNodeData } from '../../types/kanji'
import { jlptStyles } from './jlptStyles'

interface KanjiNodeProps extends NodeProps<KanjiNodeData> {
  data: KanjiNodeData & {
    onPath?: boolean
    isStudyTarget?: boolean
    focusTier?: 'child' | 'grandchild'
  }
}

function KanjiNode({ id, data, selected }: KanjiNodeProps) {
  const styles = jlptStyles[data.jlptLevel]
  const isFocusMode = useGraphModeStore((state) => state.mode === 'focus')
  const isExpanded = useKanjiGraphStore((state) => state.expandedIds.has(id))
  const toggleExpand = useKanjiGraphStore((state) => state.toggleExpand)
  const focusKanjiForExpand = useKanjiSelectionStore((state) => state.focusKanjiForExpand)
  const isMastered = useMasteryStore((state) => Boolean(state.masteredIds[id]))
  const hasChildren = useKanjiDatasetStore(
    (state) => (state.childIndex[id]?.length ?? 0) > 0,
  )
  // Learning Focus Mode already shows a node's children (and grandchildren)
  // automatically, so the manual expand/collapse control - which only makes
  // sense for the Full Graph exploration tree - is hidden there.
  const expandable = hasChildren && !isFocusMode

  const handleExpandClick = (event: MouseEvent) => {
    event.stopPropagation()
    const newlyAddedIds = toggleExpand(id)
    // null means this click collapsed the node instead of expanding it -
    // selection/detail-panel/viewport must stay untouched on collapse.
    if (newlyAddedIds !== null) {
      focusKanjiForExpand(data, newlyAddedIds)
    }
  }

  const ringClass = selected
    ? 'ring-4 ring-white/80'
    : data.onPath
      ? 'ring-4 ring-amber-400/70'
      : data.focusTier === 'child'
        ? 'ring-2 ring-teal-400/60'
        : data.focusTier === 'grandchild'
          ? 'ring-2 ring-teal-400/30'
          : data.isStudyTarget
            ? 'ring-4 ring-sky-400/70'
            : ''

  return (
    <div
      className={`kanji-node-card relative flex w-28 flex-col items-center gap-1 rounded-lg border-2 px-4 py-3 shadow-lg transition-shadow ${styles.border} ${styles.bg} ${ringClass}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />

      {data.isStudyTarget && (
        <span
          className="absolute -left-2 -top-2 text-lg leading-none"
          title="Today's study target"
        >
          📅
        </span>
      )}

      {isMastered && (
        <span
          className="absolute -right-2 -top-2 text-lg leading-none"
          title="Mastered"
        >
          ✅
        </span>
      )}

      <span className="text-3xl font-semibold text-white">
        {data.character}
      </span>
      <span
        className={`rounded px-2 py-0.5 text-xs font-semibold ${styles.badge}`}
      >
        {data.jlptLevel}
      </span>

      {expandable && (
        <button
          type="button"
          onClick={handleExpandClick}
          title={isExpanded ? 'Collapse' : 'Expand'}
          className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
    </div>
  )
}

export default KanjiNode
