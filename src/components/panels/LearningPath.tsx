import { getKanjiInfo } from '../../data/kanjiCatalog'
import { computeLearningPath } from '../graph/graphPath'
import { useKanjiGraphStore } from '../../store/useKanjiGraphStore'
import { useKanjiSelectionStore } from '../../store/useKanjiSelectionStore'

function LearningPath({ character }: { character: string }) {
  const revealKanji = useKanjiGraphStore((state) => state.revealKanji)
  const focusKanji = useKanjiSelectionStore((state) => state.focusKanji)
  const path = computeLearningPath(character)

  if (path.length === 0) return null

  const goToStep = (step: string) => {
    revealKanji(step)
    focusKanji(getKanjiInfo(step))
  }

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Learning Path
      </h3>

      <nav
        aria-label="Learning path"
        className="mt-2 flex flex-wrap items-center gap-1 text-sm"
      >
        {path.map((step, index) => {
          const isLast = index === path.length - 1
          return (
            <span key={step} className="flex items-center gap-1">
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
              {!isLast && <span className="text-slate-600">{'>'}</span>}
            </span>
          )
        })}
      </nav>

      {path.length > 1 && (
        <div className="mt-3 flex flex-col items-center gap-1">
          {path.map((step, index) => (
            <div key={step} className="flex flex-col items-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-2xl text-white">
                {step}
              </span>
              {index < path.length - 1 && (
                <span className="my-1 text-slate-500">↓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default LearningPath
