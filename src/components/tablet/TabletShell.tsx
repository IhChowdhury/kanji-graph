import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import { computeLearningPath } from '../graph/graphPath'
import GraphCanvas from '../layout/GraphCanvas'
import GraphModeSwitcher from '../layout/GraphModeSwitcher'
import Header from '../layout/Header'
import JlptFilterPanel from '../filters/JlptFilterPanel'
import KanjiDetailPanel from '../panels/KanjiDetailPanel'
import KanjiListView from '../list/KanjiListView'
import KanjiSearch from '../search/KanjiSearch'
import MasteryProgress from '../progress/MasteryProgress'
import StudyModePanel from '../study/StudyModePanel'
import { isKanjiVisible } from '../../data/kanjiVisibility'
import { useJlptFilterStore } from '../../store/useJlptFilterStore'
import { useKanjiDatasetStore } from '../../store/useKanjiDatasetStore'
import { useKanjiGraphStore } from '../../store/useKanjiGraphStore'
import { useKanjiSelectionStore } from '../../store/useKanjiSelectionStore'
import type { KanjiInfo } from '../../types/kanji'

const LIST_MIN_WIDTH = 220
const LIST_MAX_WIDTH = 420
const DETAIL_MIN_WIDTH = 260
const DETAIL_MAX_WIDTH = 440

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function ResizeHandle({ onPointerDown, onPointerMove, onPointerUp, label }: {
  onPointerDown: (event: ReactPointerEvent) => void
  onPointerMove: (event: ReactPointerEvent) => void
  onPointerUp: () => void
  label: string
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="w-1.5 shrink-0 cursor-col-resize touch-none bg-slate-800 transition-colors hover:bg-slate-600"
    />
  )
}

function GraphColumnHeader() {
  const focusNodeId = useKanjiSelectionStore((state) => state.focusNodeId)
  const catalog = useKanjiDatasetStore((state) => state.catalog)
  const enabledLevels = useJlptFilterStore((state) => state.enabledLevels)
  const revealKanji = useKanjiGraphStore((state) => state.revealKanji)
  const focusKanji = useKanjiSelectionStore((state) => state.focusKanji)

  const path = useMemo(
    () =>
      computeLearningPath(focusNodeId, catalog, (id) =>
        isKanjiVisible(id, catalog, enabledLevels),
      ),
    [focusNodeId, catalog, enabledLevels],
  )

  const goToStep = (step: string) => {
    const info = catalog[step]
    if (!info) return
    revealKanji(step)
    focusKanji(info)
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-1">
        {path.length === 0 ? (
          <span className="text-slate-500">Select a kanji to explore its graph</span>
        ) : (
          path.map((step) => {
            const isLast = step === focusNodeId
            return (
              <span key={step} className="flex items-center gap-1">
                {isLast ? (
                  <span className="font-semibold text-white">{step}</span>
                ) : (
                  <button type="button" onClick={() => goToStep(step)} className="text-slate-300 hover:text-white">
                    {step}
                  </button>
                )}
                {!isLast && <span className="text-slate-600">{'>'}</span>}
              </span>
            )
          })
        )}
      </div>
      <GraphModeSwitcher />
    </div>
  )
}

// Split view: Kanji List | Graph | Details, all visible simultaneously
// (unlike Desktop's List<->Graph toggle) - tablets have the width for it,
// and it keeps the full Kanji -> Parents/Children -> Practice flow one
// glance away without navigating between screens.
function TabletShell() {
  const [listWidth, setListWidth] = useState(260)
  const [detailWidth, setDetailWidth] = useState(320)
  const [listCollapsed, setListCollapsed] = useState(false)
  const [detailCollapsed, setDetailCollapsed] = useState(false)

  const revealKanji = useKanjiGraphStore((state) => state.revealKanji)
  const focusKanji = useKanjiSelectionStore((state) => state.focusKanji)

  const handleSelect = (kanji: KanjiInfo) => {
    revealKanji(kanji.character)
    focusKanji(kanji)
  }

  const listDragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const detailDragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const handleListPointerDown = (event: ReactPointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    listDragRef.current = { startX: event.clientX, startWidth: listWidth }
  }
  const handleListPointerMove = (event: ReactPointerEvent) => {
    const drag = listDragRef.current
    if (!drag) return
    setListWidth(clamp(drag.startWidth + (event.clientX - drag.startX), LIST_MIN_WIDTH, LIST_MAX_WIDTH))
  }
  const handleListPointerUp = () => {
    listDragRef.current = null
  }

  const handleDetailPointerDown = (event: ReactPointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    detailDragRef.current = { startX: event.clientX, startWidth: detailWidth }
  }
  const handleDetailPointerMove = (event: ReactPointerEvent) => {
    const drag = detailDragRef.current
    if (!drag) return
    setDetailWidth(
      clamp(drag.startWidth - (event.clientX - drag.startX), DETAIL_MIN_WIDTH, DETAIL_MAX_WIDTH),
    )
  }
  const handleDetailPointerUp = () => {
    detailDragRef.current = null
  }

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {listCollapsed ? (
          <button
            type="button"
            onClick={() => setListCollapsed(false)}
            aria-label="Show kanji list"
            className="flex w-11 shrink-0 flex-col items-center justify-center gap-1 border-r border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
          >
            <span aria-hidden className="text-lg">
              📚
            </span>
          </button>
        ) : (
          <div
            className="flex shrink-0 flex-col overflow-hidden border-r border-slate-800 bg-slate-900"
            style={{ width: listWidth }}
          >
            <div className="flex items-center gap-2 border-b border-slate-800 p-3">
              <div className="flex-1">
                <KanjiSearch navigateToGraph={false} />
              </div>
              <button
                type="button"
                onClick={() => setListCollapsed(true)}
                aria-label="Collapse kanji list"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                ‹
              </button>
            </div>
            <div className="border-b border-slate-800 p-3">
              <JlptFilterPanel />
            </div>
            <KanjiListView onSelectKanji={handleSelect} hideHeading className="!p-3" />
            <div className="flex flex-col gap-3 border-t border-slate-800 p-3">
              <MasteryProgress />
              <StudyModePanel />
            </div>
          </div>
        )}

        {!listCollapsed && (
          <ResizeHandle
            label="Resize kanji list panel"
            onPointerDown={handleListPointerDown}
            onPointerMove={handleListPointerMove}
            onPointerUp={handleListPointerUp}
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <GraphColumnHeader />
          <div className="relative flex flex-1">
            <GraphCanvas />
          </div>
        </main>

        {!detailCollapsed && (
          <ResizeHandle
            label="Resize details panel"
            onPointerDown={handleDetailPointerDown}
            onPointerMove={handleDetailPointerMove}
            onPointerUp={handleDetailPointerUp}
          />
        )}

        {detailCollapsed ? (
          <button
            type="button"
            onClick={() => setDetailCollapsed(false)}
            aria-label="Show details panel"
            className="flex w-11 shrink-0 flex-col items-center justify-center gap-1 border-l border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
          >
            <span aria-hidden className="text-lg">
              ℹ
            </span>
          </button>
        ) : (
          <div className="relative shrink-0 overflow-hidden" style={{ width: detailWidth }}>
            <button
              type="button"
              onClick={() => setDetailCollapsed(true)}
              aria-label="Collapse details panel"
              className="absolute left-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-md bg-slate-800/90 text-slate-300 hover:bg-slate-700"
            >
              ›
            </button>
            <KanjiDetailPanel />
          </div>
        )}
      </div>
    </div>
  )
}

export default TabletShell
