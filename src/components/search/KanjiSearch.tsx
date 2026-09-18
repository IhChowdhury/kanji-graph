import { useMemo, useState } from 'react'

import { useKanjiDatasetStore } from '../../store/useKanjiDatasetStore'
import { useKanjiGraphStore } from '../../store/useKanjiGraphStore'
import { useKanjiSelectionStore } from '../../store/useKanjiSelectionStore'
import { useViewModeStore } from '../../store/useViewModeStore'
import type { KanjiInfo } from '../../types/kanji'

interface KanjiSearchProps {
  // Desktop/tablet search switches to Graph view on select; the mobile Learn
  // screen instead opens the detail bottom sheet in place, so it passes
  // false here to skip the view-mode change.
  navigateToGraph?: boolean
}

function KanjiSearch({ navigateToGraph = true }: KanjiSearchProps) {
  const [query, setQuery] = useState('')
  const revealKanji = useKanjiGraphStore((state) => state.revealKanji)
  const focusKanji = useKanjiSelectionStore((state) => state.focusKanji)
  const setViewMode = useViewModeStore((state) => state.setViewMode)
  const allKanji = useKanjiDatasetStore((state) => state.allKanji)

  const results = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return []

    const lower = trimmed.toLowerCase()
    return allKanji.filter(
      (kanji) =>
        kanji.character.includes(trimmed) ||
        kanji.meaning.toLowerCase().includes(lower),
    )
  }, [query, allKanji])

  const handleSelect = (kanji: KanjiInfo) => {
    setQuery('')
    revealKanji(kanji.character)
    focusKanji(kanji)
    if (navigateToGraph) setViewMode('graph')
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search 休 or “rest”…"
        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
      />

      {query.trim() && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-800 shadow-lg">
          {results.length > 0 ? (
            <ul>
              {results.map((kanji) => (
                <li key={kanji.character}>
                  <button
                    type="button"
                    onClick={() => handleSelect(kanji)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700"
                  >
                    <span className="text-xl">{kanji.character}</span>
                    <span className="text-slate-400">{kanji.meaning}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-slate-500">No matches</p>
          )}
        </div>
      )}
    </div>
  )
}

export default KanjiSearch
