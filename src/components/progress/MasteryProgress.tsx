import { JLPT_LEVELS } from '../../store/useJlptFilterStore'
import { useKanjiDatasetStore } from '../../store/useKanjiDatasetStore'
import { useMasteryStore } from '../../store/useMasteryStore'

function MasteryProgress() {
  const masteredIds = useMasteryStore((state) => state.masteredIds)
  const allKanji = useKanjiDatasetStore((state) => state.allKanji)

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Progress
      </h3>
      <div className="mt-2 flex flex-col gap-3">
        {JLPT_LEVELS.map((level) => {
          const kanjiAtLevel = allKanji.filter((kanji) => kanji.jlptLevel === level)
          const total = kanjiAtLevel.length
          const masteredCount = kanjiAtLevel.filter(
            (kanji) => masteredIds[kanji.character],
          ).length
          const percent = total > 0 ? (masteredCount / total) * 100 : 0

          return (
            <div key={level}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-300">{level}</span>
                <span className="text-slate-400">
                  {masteredCount} / {total} mastered
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MasteryProgress
