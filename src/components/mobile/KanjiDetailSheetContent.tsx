import { jlptStyles } from '../graph/jlptStyles'
import { useGraphModeStore } from '../../store/useGraphModeStore'
import { useKanjiGraphStore } from '../../store/useKanjiGraphStore'
import { useMasteryStore } from '../../store/useMasteryStore'
import { useMobileTabStore } from '../../store/useMobileTabStore'
import LearningFamily from '../panels/LearningFamily'
import LearningPath from '../panels/LearningPath'
import MnemonicPanel from '../panels/MnemonicPanel'
import StrokeOrderPanel from '../panels/StrokeOrderPanel'
import type { KanjiInfo } from '../../types/kanji'

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h3>
      <p className="mt-1 text-sm text-slate-200">{value}</p>
    </div>
  )
}

interface KanjiDetailSheetContentProps {
  kanji: KanjiInfo
  // Called after the shared "reveal + force Learning Focus Mode" logic
  // below runs. What it needs to do differs by caller: LearnScreen/
  // ProgressScreen switch the mobile tab to Graph; GraphScreen (whose own
  // sheet is already showing this kanji) just dismisses the sheet to reveal
  // the graph that's already centered on it - switching tabs there would be
  // a same-tab no-op and do nothing visible, which was the bug.
  onExploreGraph: () => void
}

// Shared bottom-sheet body for the Learn and Graph mobile screens - same
// content the desktop/tablet KanjiDetailPanel shows, minus the inline
// writing-practice canvas (that's its own dedicated mobile screen per the
// redesign spec).
function KanjiDetailSheetContent({ kanji, onExploreGraph }: KanjiDetailSheetContentProps) {
  const isMastered = useMasteryStore((state) => Boolean(state.masteredIds[kanji.character]))
  const toggleMastered = useMasteryStore((state) => state.toggleMastered)
  const setActiveTab = useMobileTabStore((state) => state.setActiveTab)
  const revealKanji = useKanjiGraphStore((state) => state.revealKanji)
  const setGraphMode = useGraphModeStore((state) => state.setMode)

  // selectedKanji/focusNodeId are already this kanji (the sheet only ever
  // shows the current selection), so this deliberately doesn't re-select it
  // - just makes sure it's reachable in Full Graph Mode too and forces
  // Learning Focus Mode on (per spec, regardless of whatever mode was last
  // active) before handing off to the caller-specific navigation above.
  const handleExploreGraph = () => {
    revealKanji(kanji.character)
    setGraphMode('focus')
    onExploreGraph()
  }

  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="flex items-start justify-between">
        <span className="flex items-center gap-2 text-5xl font-semibold text-white">
          {kanji.character}
          {isMastered && <span className="text-2xl">✅</span>}
        </span>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`rounded px-2 py-1 text-xs font-semibold ${jlptStyles[kanji.jlptLevel].badge}`}
          >
            {kanji.jlptLevel}
          </span>
          <span className="rounded bg-slate-700 px-2 py-1 text-xs font-semibold text-slate-200">
            {kanji.strokeCount} strokes
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2">
        <button
          type="button"
          onClick={() => toggleMastered(kanji.character)}
          className={`flex min-h-11 items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            isMastered
              ? 'border-slate-700 bg-slate-800 text-slate-300 active:bg-slate-700'
              : 'border-emerald-600 bg-emerald-600/20 text-emerald-400 active:bg-emerald-600/30'
          }`}
        >
          {isMastered ? 'Remove mastered' : 'Mark as mastered'}
        </button>
        <button
          type="button"
          onClick={handleExploreGraph}
          className="flex min-h-11 items-center justify-center rounded-lg border border-teal-600 bg-teal-600/20 px-3 py-2 text-sm font-medium text-teal-300 active:bg-teal-600/30"
        >
          🌳 Explore Graph
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('practice')}
          className="flex min-h-11 items-center justify-center rounded-lg border border-sky-600 bg-sky-600/20 px-3 py-2 text-sm font-medium text-sky-300 active:bg-sky-600/30"
        >
          ✍ Practice Writing
        </button>
      </div>

      <StrokeOrderPanel character={kanji.character} />

      <DetailRow label="Meaning" value={kanji.meaning} />
      <DetailRow label="Onyomi" value={kanji.onyomi} />
      <DetailRow label="Kunyomi" value={kanji.kunyomi} />

      <LearningFamily kanji={kanji} />
      <MnemonicPanel kanji={kanji} />
      <LearningPath character={kanji.character} />
    </div>
  )
}

export default KanjiDetailSheetContent
