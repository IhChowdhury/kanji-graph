import { useGraphModeStore, type GraphMode } from '../../store/useGraphModeStore'

const OPTIONS: { mode: GraphMode; label: string }[] = [
  { mode: 'focus', label: 'Learning Focus' },
  { mode: 'full', label: 'Full Graph' },
]

function GraphModeSwitcher() {
  const mode = useGraphModeStore((state) => state.mode)
  const setMode = useGraphModeStore((state) => state.setMode)

  return (
    <div
      role="radiogroup"
      aria-label="Graph mode"
      className="flex rounded-md border border-slate-700 bg-slate-900 p-0.5 text-xs font-medium"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.mode}
          type="button"
          role="radio"
          aria-checked={mode === option.mode}
          onClick={() => setMode(option.mode)}
          className={`rounded px-3 py-1 transition-colors ${
            mode === option.mode
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default GraphModeSwitcher
