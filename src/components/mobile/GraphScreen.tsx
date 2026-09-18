import { useMemo, useState } from 'react'

import BottomSheet from './BottomSheet'
import EmptyState from './EmptyState'
import KanjiDetailSheetContent from './KanjiDetailSheetContent'
import LoadingState from './LoadingState'
import { useKanjiDetailSheetState } from './useKanjiDetailSheetState'
import { computeLearningPath } from '../graph/graphPath'
import GraphCanvas from '../layout/GraphCanvas'
import GraphModeSwitcher from '../layout/GraphModeSwitcher'
import JlptFilterPanel from '../filters/JlptFilterPanel'
import { isKanjiVisible } from '../../data/kanjiVisibility'
import { useJlptFilterStore } from '../../store/useJlptFilterStore'
import { DEFAULT_JLPT_LEVEL, useKanjiDatasetStore } from '../../store/useKanjiDatasetStore'
import { useKanjiGraphStore } from '../../store/useKanjiGraphStore'
import { useKanjiSelectionStore } from '../../store/useKanjiSelectionStore'
import { useMobileTabStore } from '../../store/useMobileTabStore'

// Fullscreen graph exploration screen - no sidebar, no permanent detail
// panel. A condensed breadcrumb replaces GraphViewNav's desktop version, and
// Full Graph Mode / JLPT filtering live behind the overflow menu rather than
// being on by default (Learning Focus Mode is the mobile default).
function GraphScreen() {
  const [optionsOpen, setOptionsOpen] = useState(false)
  const focusNodeId = useKanjiSelectionStore((state) => state.focusNodeId)
  const clearFocus = useKanjiSelectionStore((state) => state.clearFocus)
  const focusKanji = useKanjiSelectionStore((state) => state.focusKanji)
  const revealKanji = useKanjiGraphStore((state) => state.revealKanji)
  const setActiveTab = useMobileTabStore((state) => state.setActiveTab)
  const requestKanjiForGraph = useMobileTabStore((state) => state.requestKanjiForGraph)
  const catalog = useKanjiDatasetStore((state) => state.catalog)
  const enabledLevels = useJlptFilterStore((state) => state.enabledLevels)
  const manifestStatus = useKanjiDatasetStore((state) => state.manifestStatus)
  const defaultLevelStatus = useKanjiDatasetStore(
    (state) => state.levelStates[DEFAULT_JLPT_LEVEL].status,
  )
  const sheet = useKanjiDetailSheetState()

  // Graph data (manifest + default JLPT level) is still being fetched -
  // show a loading state rather than an empty/blank graph.
  const isLoading =
    manifestStatus === 'idle' || manifestStatus === 'loading' || defaultLevelStatus === 'loading'

  const path = useMemo(
    () =>
      computeLearningPath(focusNodeId, catalog, (id) =>
        isKanjiVisible(id, catalog, enabledLevels),
      ),
    [focusNodeId, catalog, enabledLevels],
  )

  const handleBack = () => {
    clearFocus()
    setActiveTab('learn')
  }

  const goToStep = (step: string) => {
    const info = catalog[step]
    if (!info) return
    revealKanji(step)
    focusKanji(info)
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-slate-950">
      <nav
        aria-label="Graph navigation"
        className="flex shrink-0 items-center gap-1 border-b border-slate-800 bg-slate-950 px-3 py-2 text-sm"
      >
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back to Kanji List"
          className="flex h-11 items-center gap-1 px-1 font-medium text-slate-300"
        >
          <span aria-hidden className="text-lg">
            ←
          </span>
        </button>

        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {path.map((step) => {
            const isLast = step === focusNodeId
            return (
              <span key={step} className="flex items-center gap-1">
                <span className="text-slate-600">{'>'}</span>
                {isLast ? (
                  <span className="font-semibold text-white">{step}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => goToStep(step)}
                    className="text-slate-300"
                  >
                    {step}
                  </button>
                )}
              </span>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => setOptionsOpen((open) => !open)}
          aria-expanded={optionsOpen}
          aria-label="Graph options"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-lg text-slate-300"
        >
          <span aria-hidden>⋯</span>
        </button>
      </nav>

      {optionsOpen && (
        <div className="absolute right-2 top-12 z-30 flex w-64 flex-col gap-4 rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-xl">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Graph Mode
            </h3>
            <GraphModeSwitcher />
          </div>
          <JlptFilterPanel />
        </div>
      )}

      <div className="relative flex flex-1">
        {isLoading ? (
          <LoadingState message="Preparing graph data…" />
        ) : !focusNodeId ? (
          <EmptyState
            icon="🌳"
            title="Graph Explorer"
            description="Explore Kanji relationships and learning paths."
            note="No Kanji is currently selected."
            actionLabel="Select Kanji"
            onAction={requestKanjiForGraph}
          />
        ) : (
          <GraphCanvas />
        )}
      </div>

      {sheet.kanji && (
        <BottomSheet
          open={sheet.open}
          snap={sheet.snap}
          onSnapChange={sheet.setSnap}
          onClose={sheet.close}
          title={`${sheet.kanji.character} details`}
        >
          <KanjiDetailSheetContent kanji={sheet.kanji} onExploreGraph={sheet.dismiss} />
        </BottomSheet>
      )}
    </div>
  )
}

export default GraphScreen
