import { useMemo } from 'react'

import { computeLearningPath } from '../graph/graphPath'
import { isKanjiVisible } from '../../data/kanjiVisibility'
import { useJlptFilterStore } from '../../store/useJlptFilterStore'
import { useKanjiDatasetStore } from '../../store/useKanjiDatasetStore'
import { useKanjiGraphStore } from '../../store/useKanjiGraphStore'
import { useKanjiSelectionStore } from '../../store/useKanjiSelectionStore'
import { useViewModeStore } from '../../store/useViewModeStore'

// The "Back to Kanji List"/breadcrumb bar above the graph. Always shows the
// "Kanji List" crumb (the back control); when a kanji is selected, its
// learning-path chain (root -> selected, via computeLearningPath - same
// primary-component chain shown in the detail panel's Learning Path) is
// appended after it, each step clickable except the current one.
function GraphViewNav() {
  const focusNodeId = useKanjiSelectionStore((state) => state.focusNodeId)
  const clearFocus = useKanjiSelectionStore((state) => state.clearFocus)
  const focusKanji = useKanjiSelectionStore((state) => state.focusKanji)
  const revealKanji = useKanjiGraphStore((state) => state.revealKanji)
  const setViewMode = useViewModeStore((state) => state.setViewMode)
  const catalog = useKanjiDatasetStore((state) => state.catalog)
  const enabledLevels = useJlptFilterStore((state) => state.enabledLevels)

  const path = useMemo(
    () =>
      computeLearningPath(focusNodeId, catalog, (id) =>
        isKanjiVisible(id, catalog, enabledLevels),
      ),
    [focusNodeId, catalog, enabledLevels],
  )

  const handleBack = () => {
    // Clearing focus (rather than forcing Full Graph mode) is enough to
    // return Learning Focus Mode to its no-selection default view next time
    // the user opens the graph - the persisted Focus/Full preference itself
    // is left untouched.
    clearFocus()
    setViewMode('list')
  }

  const goToStep = (step: string) => {
    const info = catalog[step]
    if (!info) return
    revealKanji(step)
    focusKanji(info)
  }

  return (
    <nav
      aria-label="Graph navigation"
      className="flex shrink-0 items-center gap-1 border-b border-slate-800 bg-slate-950 px-4 py-2 text-sm"
    >
      <button
        type="button"
        onClick={handleBack}
        className="flex items-center gap-1 font-medium text-slate-300 hover:text-white"
      >
        <span aria-hidden>←</span> Back to Kanji List
      </button>

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
                className="text-slate-300 hover:text-white hover:underline"
              >
                {step}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}

export default GraphViewNav
