import { useState } from 'react'

import BottomSheet from './BottomSheet'
import KanjiDetailSheetContent from './KanjiDetailSheetContent'
import { useKanjiDetailSheetState } from './useKanjiDetailSheetState'
import JlptFilterPanel from '../filters/JlptFilterPanel'
import KanjiListView from '../list/KanjiListView'
import KanjiSearch from '../search/KanjiSearch'
import { useKanjiGraphStore } from '../../store/useKanjiGraphStore'
import { useKanjiSelectionStore } from '../../store/useKanjiSelectionStore'
import { useMobileTabStore } from '../../store/useMobileTabStore'
import type { KanjiInfo } from '../../types/kanji'

// Default landing screen on mobile (Kanji List / Study Mode from the spec) -
// tapping a kanji opens its details in a bottom sheet in place, rather than
// navigating to the Graph screen, matching the
// List -> Details -> Graph -> Practice flow. The one exception is when the
// user arrived here via the Graph tab's empty-state "Select Kanji" button
// (isAwaitingGraphSelection) - then picking a kanji jumps straight back to
// Graph instead, so that flow feels like "Graph -> pick -> graph opens", not
// an extra detour through the details sheet.
function LearnScreen() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const revealKanji = useKanjiGraphStore((state) => state.revealKanji)
  const focusKanji = useKanjiSelectionStore((state) => state.focusKanji)
  const isAwaitingGraphSelection = useMobileTabStore((state) => state.isAwaitingGraphSelection)
  const setActiveTab = useMobileTabStore((state) => state.setActiveTab)
  const cancelGraphSelection = useMobileTabStore((state) => state.cancelGraphSelection)
  const sheet = useKanjiDetailSheetState()

  const handleSelect = (kanji: KanjiInfo) => {
    revealKanji(kanji.character)
    focusKanji(kanji)
    if (isAwaitingGraphSelection) {
      setActiveTab('graph')
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-950">
      {isAwaitingGraphSelection && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-teal-800 bg-teal-950/60 px-4 py-2 text-sm text-teal-300">
          <span>🌳 Select a Kanji to open its graph</span>
          <button
            type="button"
            onClick={cancelGraphSelection}
            className="shrink-0 text-xs font-medium underline underline-offset-2"
          >
            Cancel
          </button>
        </div>
      )}
      <div className="shrink-0 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <KanjiSearch navigateToGraph={false} />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-label="Toggle JLPT level filters"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-lg text-slate-200"
          >
            <span aria-hidden>⚙</span>
          </button>
        </div>
        {filtersOpen && (
          <div className="mt-3">
            <JlptFilterPanel />
          </div>
        )}
      </div>

      <KanjiListView onSelectKanji={handleSelect} hideHeading className="!p-4" />

      {sheet.kanji && (
        <BottomSheet
          open={sheet.open}
          snap={sheet.snap}
          onSnapChange={sheet.setSnap}
          onClose={sheet.close}
          title={`${sheet.kanji.character} details`}
        >
          <KanjiDetailSheetContent
            kanji={sheet.kanji}
            onExploreGraph={() => setActiveTab('graph')}
          />
        </BottomSheet>
      )}
    </div>
  )
}

export default LearnScreen
