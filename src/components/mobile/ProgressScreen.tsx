import BottomSheet from './BottomSheet'
import KanjiDetailSheetContent from './KanjiDetailSheetContent'
import { useKanjiDetailSheetState } from './useKanjiDetailSheetState'
import MasteryProgress from '../progress/MasteryProgress'
import StudyModePanel from '../study/StudyModePanel'
import { useMobileTabStore } from '../../store/useMobileTabStore'

// Combines the existing Mastery Progress and Study Mode panels (unchanged
// logic) into one full screen with card-based mobile visual hierarchy,
// instead of the cramped always-visible desktop sidebar stack.
function ProgressScreen() {
  const setActiveTab = useMobileTabStore((state) => state.setActiveTab)
  const sheet = useKanjiDetailSheetState()

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-950 p-4">
      <h1 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Progress
      </h1>

      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
          <MasteryProgress />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
          <StudyModePanel />
        </div>
      </div>

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

export default ProgressScreen
