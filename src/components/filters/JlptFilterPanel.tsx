import { jlptStyles } from '../graph/jlptStyles'
import { JLPT_LEVELS, useJlptFilterStore } from '../../store/useJlptFilterStore'

function JlptFilterPanel() {
  const enabledLevels = useJlptFilterStore((state) => state.enabledLevels)
  const toggleLevel = useJlptFilterStore((state) => state.toggleLevel)

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        JLPT Level
      </h3>
      <div className="mt-2 flex flex-col gap-2">
        {JLPT_LEVELS.map((level) => {
          const dotColor = jlptStyles[level].badge.split(' ')[0]

          return (
            <label
              key={level}
              className="flex cursor-pointer items-center gap-2 text-sm text-slate-300"
            >
              <input
                type="checkbox"
                checked={enabledLevels[level]}
                onChange={() => toggleLevel(level)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800"
              />
              <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
              {level}
            </label>
          )
        })}
      </div>
    </div>
  )
}

export default JlptFilterPanel
