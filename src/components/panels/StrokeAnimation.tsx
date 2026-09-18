import { useLayoutEffect, useMemo, useRef, useState } from 'react'

import { parseStrokePaths } from './parseStrokePaths'

const SPEEDS = [0.5, 1, 2] as const
type Speed = (typeof SPEEDS)[number]

const BASE_STROKE_DURATION_MS = 500

function StrokeAnimation({ svgText }: { svgText: string }) {
  const strokePaths = useMemo(() => parseStrokePaths(svgText), [svgText])
  const total = strokePaths.length

  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  const lengthsRef = useRef<number[]>([])
  const strokeIndexRef = useRef(0)
  const strokeStartTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const speedRef = useRef<Speed>(1)

  const [completedCount, setCompletedCount] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  speedRef.current = speed

  const resetPaths = () => {
    pathRefs.current.forEach((el, index) => {
      if (!el) return
      const length = lengthsRef.current[index] ?? 0
      el.style.strokeDasharray = `${length}`
      el.style.strokeDashoffset = `${length}`
    })
  }

  // Measure each path's real length before paint (so strokes never flash
  // fully drawn) and reset whenever the kanji - and so its stroke set -
  // changes.
  useLayoutEffect(() => {
    lengthsRef.current = pathRefs.current.map((el) => el?.getTotalLength() ?? 0)
    strokeIndexRef.current = 0
    strokeStartTimeRef.current = null
    setCompletedCount(0)
    setIsPlaying(false)
    resetPaths()
    // Deliberately re-runs only when the stroke set itself changes -
    // resetPaths reads refs, not state, so it doesn't need to be a dep.
  }, [strokePaths])

  useLayoutEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      return
    }

    const step = (timestamp: number) => {
      const index = strokeIndexRef.current
      if (index >= total) {
        setIsPlaying(false)
        return
      }

      if (strokeStartTimeRef.current === null) {
        strokeStartTimeRef.current = timestamp
      }

      const duration = BASE_STROKE_DURATION_MS / speedRef.current
      const elapsed = timestamp - strokeStartTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      const el = pathRefs.current[index]
      const length = lengthsRef.current[index] ?? 0
      if (el) {
        el.style.strokeDashoffset = `${length * (1 - progress)}`
      }

      if (progress >= 1) {
        strokeIndexRef.current += 1
        strokeStartTimeRef.current = null
        setCompletedCount(strokeIndexRef.current)
      }

      if (strokeIndexRef.current < total) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        setIsPlaying(false)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, total])

  const handlePlay = () => {
    if (total === 0) return
    if (strokeIndexRef.current >= total) {
      strokeIndexRef.current = 0
      strokeStartTimeRef.current = null
      setCompletedCount(0)
      resetPaths()
    }
    setIsPlaying(true)
  }

  const handlePause = () => setIsPlaying(false)

  const handleReset = () => {
    setIsPlaying(false)
    strokeIndexRef.current = 0
    strokeStartTimeRef.current = null
    setCompletedCount(0)
    resetPaths()
  }

  const handleSpeedChange = (value: Speed) => {
    // Rebase the current stroke's start time so switching speed mid-draw
    // doesn't jump the in-progress stroke forward or backward.
    if (isPlaying && strokeStartTimeRef.current !== null) {
      const now = performance.now()
      const oldDuration = BASE_STROKE_DURATION_MS / speed
      const progress = Math.min(
        (now - strokeStartTimeRef.current) / oldDuration,
        1,
      )
      const newDuration = BASE_STROKE_DURATION_MS / value
      strokeStartTimeRef.current = now - progress * newDuration
    }
    setSpeed(value)
  }

  return (
    <div>
      <div className="flex aspect-square w-full max-w-[180px] items-center justify-center overflow-hidden rounded-md border border-slate-700 bg-white p-2">
        <svg viewBox="0 0 109 109" className="h-full w-full">
          <g
            style={{
              fill: 'none',
              stroke: '#1f2937',
              strokeWidth: 3,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
            }}
          >
            {strokePaths.map((d, index) => (
              <path
                key={index}
                ref={(el) => {
                  pathRefs.current[index] = el
                }}
                d={d}
              />
            ))}
          </g>
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-slate-400">
          Stroke {completedCount} of {total}
        </span>
        <div className="flex items-center gap-1">
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleSpeedChange(value)}
              className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
                speed === value
                  ? 'bg-emerald-600/30 text-emerald-300'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {value}x
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={handlePlay}
          disabled={isPlaying || total === 0}
          className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ▶ Play
        </button>
        <button
          type="button"
          onClick={handlePause}
          disabled={!isPlaying}
          className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ⏸ Pause
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
        >
          ↺ Reset
        </button>
      </div>
    </div>
  )
}

export default StrokeAnimation
