import { jlptStyles } from '../graph/jlptStyles'
import { useKanjiSelectionStore } from '../../store/useKanjiSelectionStore'
import { useMasteryStore } from '../../store/useMasteryStore'
import LearningFamily from './LearningFamily'
import LearningPath from './LearningPath'
import MnemonicPanel from './MnemonicPanel'
import StrokeOrderPanel from './StrokeOrderPanel'
import WritingPracticePanel from '../practice/WritingPracticePanel'

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </h3>
      <p className="mt-1 text-sm text-slate-200">{value}</p>
    </div>
  )
}

function KanjiDetailPanel() {
  const selectedKanji = useKanjiSelectionStore((state) => state.selectedKanji)
  const isMastered = useMasteryStore((state) =>
    selectedKanji ? Boolean(state.masteredIds[selectedKanji.character]) : false,
  )
  const toggleMastered = useMasteryStore((state) => state.toggleMastered)

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto border-l border-slate-800 bg-slate-900 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Details
      </h2>

      {selectedKanji ? (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <span className="flex items-center gap-2 text-5xl font-semibold text-white">
              {selectedKanji.character}
              {isMastered && <span className="text-2xl">✅</span>}
            </span>
            <div className="flex flex-col items-end gap-1">
              <span
                className={`rounded px-2 py-1 text-xs font-semibold ${jlptStyles[selectedKanji.jlptLevel].badge}`}
              >
                {selectedKanji.jlptLevel}
              </span>
              <span className="rounded bg-slate-700 px-2 py-1 text-xs font-semibold text-slate-200">
                {selectedKanji.strokeCount} strokes
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => toggleMastered(selectedKanji.character)}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              isMastered
                ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'border-emerald-600 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
            }`}
          >
            {isMastered ? 'Remove mastered status' : 'Mark as mastered'}
          </button>

          <StrokeOrderPanel character={selectedKanji.character} />

          <WritingPracticePanel character={selectedKanji.character} />

          <DetailRow label="Meaning" value={selectedKanji.meaning} />
          <DetailRow label="Onyomi" value={selectedKanji.onyomi} />
          <DetailRow label="Kunyomi" value={selectedKanji.kunyomi} />

          <LearningFamily kanji={selectedKanji} />

          <MnemonicPanel kanji={selectedKanji} />

          <LearningPath character={selectedKanji.character} />
        </div>
      ) : (
        <div className="mt-4 flex-1 rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-500">
          Select a kanji node to see its details here.
        </div>
      )}
    </aside>
  )
}

export default KanjiDetailPanel
