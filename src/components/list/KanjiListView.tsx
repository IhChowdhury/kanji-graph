import { useMemo } from 'react'

import DatasetStatusOverlay from '../layout/DatasetStatusOverlay'
import { jlptStyles } from '../graph/jlptStyles'
import { useJlptFilterStore } from '../../store/useJlptFilterStore'
import { useKanjiDatasetStore } from '../../store/useKanjiDatasetStore'
import { useKanjiGraphStore } from '../../store/useKanjiGraphStore'
import { useKanjiSelectionStore } from '../../store/useKanjiSelectionStore'
import { useMasteryStore } from '../../store/useMasteryStore'
import { useViewModeStore } from '../../store/useViewModeStore'
import type { KanjiInfo } from '../../types/kanji'

function KanjiListCard({ kanji, onSelect }: { kanji: KanjiInfo; onSelect: () => void }) {
  const styles = jlptStyles[kanji.jlptLevel]
  const isMastered = useMasteryStore((state) => Boolean(state.masteredIds[kanji.character]))

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col items-center gap-1 rounded-lg border-2 px-4 py-3 text-left shadow-lg transition-shadow hover:shadow-xl ${styles.border} ${styles.bg}`}
    >
      {isMastered && (
        <span className="absolute -right-2 -top-2 text-lg leading-none" title="Mastered">
          ✅
        </span>
      )}
      <span className="text-3xl font-semibold text-white">{kanji.character}</span>
      <span className="truncate text-xs text-slate-300">{kanji.meaning}</span>
      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${styles.badge}`}>
        {kanji.jlptLevel}
      </span>
    </button>
  )
}

function KanjiListView() {
  const allKanji = useKanjiDatasetStore((state) => state.allKanji)
  const enabledLevels = useJlptFilterStore((state) => state.enabledLevels)
  const revealKanji = useKanjiGraphStore((state) => state.revealKanji)
  const focusKanji = useKanjiSelectionStore((state) => state.focusKanji)
  const setViewMode = useViewModeStore((state) => state.setViewMode)

  const visibleKanji = useMemo(
    () =>
      allKanji
        .filter((kanji) => enabledLevels[kanji.jlptLevel])
        .sort((a, b) =>
          a.jlptLevel === b.jlptLevel
            ? a.character.localeCompare(b.character)
            : a.jlptLevel.localeCompare(b.jlptLevel),
        ),
    [allKanji, enabledLevels],
  )

  const handleSelect = (kanji: KanjiInfo) => {
    revealKanji(kanji.character)
    focusKanji(kanji)
    setViewMode('graph')
  }

  return (
    <main className="relative flex-1 overflow-y-auto bg-slate-950 p-6">
      <h1 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Kanji List
      </h1>

      {visibleKanji.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-3">
          {visibleKanji.map((kanji) => (
            <KanjiListCard
              key={kanji.character}
              kanji={kanji}
              onSelect={() => handleSelect(kanji)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          No kanji match the current JLPT filters.
        </p>
      )}

      <DatasetStatusOverlay />
    </main>
  )
}

export default KanjiListView
