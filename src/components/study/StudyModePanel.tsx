import { useKanjiGraphStore } from '../../store/useKanjiGraphStore'
import { useKanjiSelectionStore } from '../../store/useKanjiSelectionStore'
import { useStudyModeStore } from '../../store/useStudyModeStore'
import type { KanjiInfo } from '../../types/kanji'
import { useDailyKanji } from './useDailyKanji'

function StudyModePanel() {
  const isActive = useStudyModeStore((state) => state.isActive)
  const toggleActive = useStudyModeStore((state) => state.toggleActive)
  const completedByDate = useStudyModeStore((state) => state.completedByDate)
  const toggleComplete = useStudyModeStore((state) => state.toggleComplete)
  const revealKanji = useKanjiGraphStore((state) => state.revealKanji)
  const focusKanji = useKanjiSelectionStore((state) => state.focusKanji)

  const { today, dailyKanji } = useDailyKanji()

  const completedToday = new Set(completedByDate[today] ?? [])
  const completedCount = dailyKanji.filter((kanji) =>
    completedToday.has(kanji.character),
  ).length
  const total = dailyKanji.length
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0

  const navigateTo = (kanji: KanjiInfo) => {
    revealKanji(kanji.character)
    focusKanji(kanji)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Study Mode
        </h3>
        <button
          type="button"
          onClick={toggleActive}
          className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
            isActive
              ? 'bg-emerald-600/30 text-emerald-300'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          {isActive ? 'On' : 'Off'}
        </button>
      </div>

      {isActive && (
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Today&rsquo;s progress</span>
              <span className="text-slate-400">
                {completedCount} / {total} ({percent}%)
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {total > 0 ? (
            <ul className="flex flex-col gap-1">
              {dailyKanji.map((kanji) => {
                const isDone = completedToday.has(kanji.character)
                return (
                  <li
                    key={kanji.character}
                    className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-800/50 px-2 py-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => toggleComplete(today, kanji.character)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => navigateTo(kanji)}
                      className={`flex flex-1 items-center gap-2 text-left text-sm hover:text-white ${
                        isDone ? 'text-slate-500 line-through' : 'text-slate-200'
                      }`}
                    >
                      <span className="text-lg">{kanji.character}</span>
                      <span className="text-xs text-slate-400">
                        {kanji.meaning}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">
              No kanji available for today with the current JLPT filters.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default StudyModePanel
