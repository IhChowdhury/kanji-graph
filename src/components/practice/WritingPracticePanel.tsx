import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import { parseStrokePaths } from '../panels/parseStrokePaths'
import { useStrokeOrderSvg } from '../panels/useStrokeOrderSvg'
import {
  usePracticeHistoryStore,
  type PracticeAttempt,
} from '../../store/usePracticeHistoryStore'
import {
  angleBetweenDegrees,
  directionVector,
  distance,
  type Point,
  type Vector,
} from './strokeGeometry'

const CANVAS_SIZE = 260
const INK_COLOR = '#2563eb'
const CORRECT_COLOR = '#16a34a'

// KanjiVG paths live in a 0-109 viewBox; the canvas is CANVAS_SIZE square.
const REFERENCE_SCALE = CANVAS_SIZE / 109

// How far off (in degrees) a drawn stroke's overall direction may be from
// the reference stroke's direction and still count as correct. Generous
// enough for imprecise mouse/touch input, strict enough to catch a
// genuinely wrong or reversed stroke.
const CORRECT_ANGLE_THRESHOLD_DEGREES = 70

// How far (in canvas pixels) a drawn stroke's start/end may be from the
// *specific* expected stroke's start/end and still count as correct.
// Direction alone isn't enough to identify which stroke was drawn - many
// kanji have several strokes pointing the same general way (e.g. multiple
// horizontal strokes), so without a position check, drawing any stroke
// with a similar direction to the current one would be wrongly accepted
// regardless of where it was actually drawn. This anchors the match to
// the current expected stroke's actual location, not just its direction.
const MAX_POINT_DISTANCE = CANVAS_SIZE * 0.3

interface ReferenceStroke {
  start: Point
  end: Point
  vector: Vector
}

const EMPTY_HISTORY: PracticeAttempt[] = []

function drawStroke(ctx: CanvasRenderingContext2D, points: Point[], color: string) {
  if (points.length < 2) return
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (const point of points.slice(1)) {
    ctx.lineTo(point.x, point.y)
  }
  ctx.stroke()
}

function WritingPracticePanel({ character }: { character: string }) {
  const { status, svgText } = useStrokeOrderSvg(character)
  // The ordered stroke sequence KanjiVG authored for this kanji - this
  // array's order *is* the expected stroke sequence to validate against.
  const strokePaths = useMemo(
    () => (svgText ? parseStrokePaths(svgText) : []),
    [svgText],
  )
  const total = strokePaths.length

  const referencePathRefs = useRef<(SVGPathElement | null)[]>([])
  const referenceStrokesRef = useRef<ReferenceStroke[]>([])

  useLayoutEffect(() => {
    referenceStrokesRef.current = referencePathRefs.current.map((el) => {
      if (!el) return { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, vector: { x: 0, y: 0 } }
      const length = el.getTotalLength()
      if (length === 0) {
        return { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, vector: { x: 0, y: 0 } }
      }
      const rawStart = el.getPointAtLength(0)
      const rawEnd = el.getPointAtLength(length)
      // Scale from the SVG's 0-109 viewBox into canvas-pixel space so
      // start/end distances are directly comparable to drawn points.
      const start = { x: rawStart.x * REFERENCE_SCALE, y: rawStart.y * REFERENCE_SCALE }
      const end = { x: rawEnd.x * REFERENCE_SCALE, y: rawEnd.y * REFERENCE_SCALE }
      return { start, end, vector: { x: end.x - start.x, y: end.y - start.y } }
    })
  }, [strokePaths])

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef<Point[]>([])
  const acceptedStrokesRef = useRef<Point[][]>([])
  const currentStrokeIndexRef = useRef(0)
  const accuracySumRef = useRef(0)

  const [currentStrokeIndex, setCurrentStrokeIndex] = useState(0)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [finalScore, setFinalScore] = useState<number | null>(null)

  const recordAttempt = usePracticeHistoryStore((state) => state.recordAttempt)
  const history = usePracticeHistoryStore(
    (state) => state.history[character] ?? EMPTY_HISTORY,
  )

  const resetAttempt = () => {
    isDrawingRef.current = false
    currentStrokeRef.current = []
    acceptedStrokesRef.current = []
    currentStrokeIndexRef.current = 0
    accuracySumRef.current = 0
    setCurrentStrokeIndex(0)
    setFeedback(null)
    setFinalScore(null)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  // Switching kanji starts a fresh attempt.
  useEffect(() => {
    resetAttempt()
    // Deliberately re-runs only when the kanji itself changes.
  }, [character])

  // Redraws every accepted-so-far stroke in green (confirmed correct) and
  // wipes anything else - used both to erase a just-rejected stroke and to
  // turn a just-accepted stroke's ink from in-progress blue to green.
  const redrawAcceptedStrokes = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const stroke of acceptedStrokesRef.current) {
      drawStroke(ctx, stroke, CORRECT_COLOR)
    }
  }

  const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_SIZE,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_SIZE,
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (currentStrokeIndexRef.current >= total) return
    event.currentTarget.setPointerCapture(event.pointerId)
    isDrawingRef.current = true
    const point = getPoint(event)
    currentStrokeRef.current = [point]
    setFeedback(null)

    // Start a fresh path for this stroke - without this, lineTo() in
    // handlePointerMove would keep extending the previous stroke's path,
    // drawing a connecting line from its last point to this new one.
    const ctx = canvasRef.current?.getContext('2d')
    ctx?.beginPath()
    ctx?.moveTo(point.x, point.y)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    const point = getPoint(event)
    currentStrokeRef.current.push(point)

    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.strokeStyle = INK_COLOR
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
    }
  }

  const finishStroke = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false

    const strokePoints = currentStrokeRef.current
    currentStrokeRef.current = []
    if (strokePoints.length < 2) return // ignore taps/clicks

    const index = currentStrokeIndexRef.current
    if (index >= total) return // already finished, ignore stray input

    const expected = referenceStrokesRef.current[index] ?? {
      start: { x: 0, y: 0 },
      end: { x: 0, y: 0 },
      vector: { x: 0, y: 0 },
    }
    const drawnStart = strokePoints[0]
    const drawnEnd = strokePoints[strokePoints.length - 1]

    const angleDiff = angleBetweenDegrees(directionVector(strokePoints), expected.vector)
    const startDistance = distance(drawnStart, expected.start)
    const endDistance = distance(drawnEnd, expected.end)

    const isCorrect =
      angleDiff <= CORRECT_ANGLE_THRESHOLD_DEGREES &&
      startDistance <= MAX_POINT_DISTANCE &&
      endDistance <= MAX_POINT_DISTANCE

    if (isCorrect) {
      acceptedStrokesRef.current = [...acceptedStrokesRef.current, strokePoints]
      accuracySumRef.current += Math.max(0, 1 - angleDiff / 180)
      currentStrokeIndexRef.current = index + 1
      setCurrentStrokeIndex(currentStrokeIndexRef.current)
      setFeedback(null)
      redrawAcceptedStrokes()

      if (currentStrokeIndexRef.current >= total) {
        const score = Math.round((accuracySumRef.current / total) * 100)
        setFinalScore(score)
        recordAttempt(character, {
          score,
          timestamp: new Date().toISOString(),
          userStrokeCount: total,
          referenceStrokeCount: total,
        })
      }
    } else {
      // Wrong stroke (or the right shape drawn in the wrong order) -
      // reject it, erase its ink, and keep expecting the same stroke.
      setFeedback('Incorrect stroke order')
      redrawAcceptedStrokes()
    }
  }

  const isPracticeReady = status === 'ready' && total > 0

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Writing Practice
      </h3>

      {!isPracticeReady ? (
        <p className="mt-2 text-sm text-slate-500">
          {status === 'loading'
            ? 'Loading…'
            : 'Practice not available for this kanji.'}
        </p>
      ) : (
        <div key={character} className="mt-2 flex flex-col gap-2">
          <div className="relative aspect-square w-full max-w-[260px] overflow-hidden rounded-md border border-slate-700 bg-white">
            <svg
              viewBox="0 0 109 109"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <g
                style={{
                  fill: 'none',
                  strokeWidth: 3,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }}
              >
                {strokePaths.map((d, index) => {
                  const isDone = index < currentStrokeIndex
                  const isCurrent = index === currentStrokeIndex
                  return (
                    <path
                      key={index}
                      ref={(el) => {
                        referencePathRefs.current[index] = el
                      }}
                      d={d}
                      style={{
                        stroke: isCurrent
                          ? INK_COLOR
                          : isDone
                            ? CORRECT_COLOR
                            : '#1f2937',
                        opacity: isDone ? 0.35 : isCurrent ? 0.55 : 0.2,
                      }}
                    />
                  )
                })}
              </g>
            </svg>

            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="absolute inset-0 h-full w-full touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishStroke}
              onPointerLeave={finishStroke}
            />
          </div>

          <p className="text-xs text-slate-400">
            Current Stroke: {Math.min(currentStrokeIndex + 1, total)} / {total}
          </p>

          {feedback && (
            <p className="text-xs font-medium text-rose-400">❌ {feedback}</p>
          )}

          {finalScore !== null && (
            <div className="rounded-md border border-emerald-700 bg-emerald-600/10 p-2">
              <p className="text-sm font-semibold text-emerald-300">
                ✅ Complete! Score: {finalScore} / 100
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={resetAttempt}
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            ↺ Reset
          </button>

          {history.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-slate-500">
                Recent attempts
              </h4>
              <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                {history.slice(0, 5).map((attempt) => (
                  <li
                    key={attempt.timestamp}
                    className="flex items-center justify-between text-slate-400"
                  >
                    <span>{new Date(attempt.timestamp).toLocaleDateString()}</span>
                    <span className="font-medium text-slate-300">
                      {attempt.score} / 100
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default WritingPracticePanel
