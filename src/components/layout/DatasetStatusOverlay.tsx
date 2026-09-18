import { DEFAULT_JLPT_LEVEL, useKanjiDatasetStore } from '../../store/useKanjiDatasetStore'

function DatasetStatusOverlay() {
  const manifestStatus = useKanjiDatasetStore((state) => state.manifestStatus)
  const manifestError = useKanjiDatasetStore((state) => state.manifestError)
  const defaultLevelState = useKanjiDatasetStore(
    (state) => state.levelStates[DEFAULT_JLPT_LEVEL],
  )
  const initialize = useKanjiDatasetStore((state) => state.initialize)
  const ensureLevelLoaded = useKanjiDatasetStore((state) => state.ensureLevelLoaded)

  let message: string | null = null
  let retry: (() => void) | null = null

  if (manifestStatus === 'loading' || manifestStatus === 'idle') {
    message = 'Loading kanji data…'
  } else if (manifestStatus === 'error') {
    message = `Failed to load kanji dataset: ${manifestError}`
    retry = () => void initialize()
  } else if (defaultLevelState.status === 'loading') {
    message = `Loading ${DEFAULT_JLPT_LEVEL} kanji…`
  } else if (defaultLevelState.status === 'error') {
    message = `Failed to load ${DEFAULT_JLPT_LEVEL} kanji: ${defaultLevelState.error}`
    retry = () => void ensureLevelLoaded(DEFAULT_JLPT_LEVEL)
  } else if (defaultLevelState.status === 'empty') {
    message = `No kanji data available yet for ${DEFAULT_JLPT_LEVEL}.`
  }

  if (!message) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="pointer-events-auto flex flex-col items-center gap-2 rounded-md border border-slate-700 bg-slate-900/90 px-6 py-4 text-center text-sm text-slate-300 shadow-lg">
        <p>{message}</p>
        {retry && (
          <button
            type="button"
            onClick={retry}
            className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}

export default DatasetStatusOverlay
