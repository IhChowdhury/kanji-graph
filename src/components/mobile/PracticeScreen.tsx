import EmptyState from './EmptyState'
import { useElementSize } from '../../hooks/useElementSize'
import WritingPracticePanel from '../practice/WritingPracticePanel'
import { useKanjiSelectionStore } from '../../store/useKanjiSelectionStore'
import { useMobileTabStore } from '../../store/useMobileTabStore'

const CANVAS_MARGIN_PX = 32
const MIN_CANVAS_PX = 120
const MAX_CANVAS_PX = 480

// Dedicated full-screen writing practice, per the redesign spec - the
// canvas fills most of the available space instead of the small
// desktop/tablet detail-panel embed (see WritingPracticePanel's `size` prop).
// Always driven by the shared selectedKanji - Learn/Graph selections apply
// here automatically, no separate in-screen picker.
function PracticeScreen() {
  const selectedKanji = useKanjiSelectionStore((state) => state.selectedKanji)
  const clearFocus = useKanjiSelectionStore((state) => state.clearFocus)
  const setActiveTab = useMobileTabStore((state) => state.setActiveTab)
  const [containerRef, containerSize] = useElementSize<HTMLDivElement>()

  const canvasSize = Math.max(
    MIN_CANVAS_PX,
    Math.min(
      containerSize.width - CANVAS_MARGIN_PX,
      containerSize.height - CANVAS_MARGIN_PX,
      MAX_CANVAS_PX,
    ),
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-950">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
        <h1 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Writing Practice
        </h1>
        {selectedKanji && (
          <button
            type="button"
            onClick={clearFocus}
            className="flex h-11 items-center rounded-md border border-slate-700 px-3 text-sm text-slate-300 active:bg-slate-800"
          >
            Change kanji
          </button>
        )}
      </div>

      {!selectedKanji ? (
        <EmptyState
          icon="✍"
          title="Practice"
          description="Select a Kanji from Learn Mode to start writing practice."
          actionLabel="Go to Learn"
          onAction={() => setActiveTab('learn')}
        />
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-2 px-4 pt-3">
            <span className="text-2xl font-semibold text-white">{selectedKanji.character}</span>
            <span className="truncate text-sm text-slate-400">{selectedKanji.meaning}</span>
          </div>
          <div
            ref={containerRef}
            className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-4"
          >
            <WritingPracticePanel character={selectedKanji.character} size={canvasSize} hideHeading />
          </div>
        </>
      )}
    </div>
  )
}

export default PracticeScreen
