import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import { parseStrokePaths } from '../panels/parseStrokePaths'
import { useStrokeOrderSvg } from '../panels/useStrokeOrderSvg'
import {
  usePracticeHistoryStore,
  type PracticeAttempt,
} from '../../store/usePracticeHistoryStore'
import {
  computeOverallScore,
  passesStrokeGate,
  scoreAcceptedStroke,
  strokeAccuracyPercent,
  type GateThresholds,
  type ScoreBreakdown,
  type StrokeScore,
} from './scoring'
import {
  angleBetweenDegrees,
  boundingBox,
  boundingBoxIoU,
  directionVector,
  distance,
  pathLength,
  ratioScore,
  type BoundingBox,
  type Point,
  type Vector,
} from './strokeGeometry'

const DEFAULT_CANVAS_SIZE = 260
const INK_COLOR = '#2563eb'
const CORRECT_COLOR = '#16a34a'

// Number of points sampled along each reference stroke's curve (via
// getPointAtLength) to build its bounding box - more than just start/end,
// since many KanjiVG strokes curve and a start/end-only box would miss the
// curve's actual extent.
const REFERENCE_SAMPLE_COUNT = 16

// Strict stroke-order/shape gate thresholds (see scoring.ts for how these
// also drive the continuous per-stroke accuracy scoring, not just
// accept/reject). A function of canvas size since maxPointDistance is a
// pixel tolerance - the mobile Practice screen renders a much larger canvas
// than the desktop/tablet detail-panel embed, so the tolerance has to scale
// with it or the gate becomes stricter (in visual terms) the bigger the
// canvas gets.
function buildGate(canvasSize: number): GateThresholds {
  return {
    // How far off (in degrees) a drawn stroke's overall direction may be
    // from the reference stroke's direction and still count as correct.
    // Generous enough for imprecise mouse/touch input, strict enough to
    // catch a genuinely wrong or reversed stroke.
    maxAngleDiffDegrees: 70,
    // How far (in canvas pixels) a drawn stroke's start/end may be from the
    // *specific* expected stroke's start/end and still count as correct.
    // Direction alone isn't enough to identify which stroke was drawn - many
    // kanji have several strokes pointing the same general way (e.g.
    // multiple horizontal strokes), so without a position check, drawing
    // any stroke with a similar direction to the current one would be
    // wrongly accepted regardless of where it was actually drawn.
    maxPointDistance: canvasSize * 0.3,
    // A drawn stroke's path length must be within this fraction of the
    // reference's length (in either direction - e.g. 0.35 allows anywhere
    // from 35% to ~286% of the reference length), and its bounding-box
    // overlap (IoU) with the reference must be at least MIN_BBOX_OVERLAP.
    // These exist specifically to catch a stroke whose start, end, and net
    // angle all happen to land close to the reference but whose actual path
    // is a scribble/wiggle far longer (or a wildly different shape/extent)
    // than a real stroke - the "shape differs significantly" bug this
    // scoring pass was written to fix. Deliberately generous (not
    // exact-match) so ordinary imprecise handwriting still passes.
    minLengthRatio: 0.35,
    minBboxOverlap: 0.15,
  }
}

interface ReferenceStroke {
  start: Point
  end: Point
  vector: Vector
  length: number
  boundingBox: BoundingBox
}

const DEFAULT_REFERENCE_STROKE: ReferenceStroke = {
  start: { x: 0, y: 0 },
  end: { x: 0, y: 0 },
  vector: { x: 0, y: 0 },
  length: 0,
  boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
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

interface WritingPracticePanelProps {
  character: string
  // Canvas side length in pixels. Defaults to the compact desktop/tablet
  // detail-panel size; the mobile Practice screen passes a much larger,
  // viewport-derived size instead (see PracticeScreen.tsx).
  size?: number
  // The dedicated mobile Practice screen has its own screen-level heading,
  // so it hides this component's own "Writing Practice" label to avoid
  // showing it twice.
  hideHeading?: boolean
}

function WritingPracticePanel({
  character,
  size = DEFAULT_CANVAS_SIZE,
  hideHeading,
}: WritingPracticePanelProps) {
  const { status, svgText } = useStrokeOrderSvg(character)
  // The ordered stroke sequence KanjiVG authored for this kanji - this
  // array's order *is* the expected stroke sequence to validate against.
  const strokePaths = useMemo(
    () => (svgText ? parseStrokePaths(svgText) : []),
    [svgText],
  )
  const total = strokePaths.length

  // KanjiVG paths live in a 0-109 viewBox; the canvas is `size` square.
  const referenceScale = size / 109
  const gate = useMemo(() => buildGate(size), [size])

  const referencePathRefs = useRef<(SVGPathElement | null)[]>([])
  const referenceStrokesRef = useRef<ReferenceStroke[]>([])

  useLayoutEffect(() => {
    referenceStrokesRef.current = referencePathRefs.current.map((el) => {
      if (!el) return DEFAULT_REFERENCE_STROKE
      const svgLength = el.getTotalLength()
      if (svgLength === 0) return DEFAULT_REFERENCE_STROKE

      // Sample along the curve (not just start/end) so curved strokes get
      // an accurate bounding box, then scale every sampled point from the
      // SVG's 0-109 viewBox into canvas-pixel space so they're directly
      // comparable to drawn points.
      const sampledPoints: Point[] = []
      for (let i = 0; i < REFERENCE_SAMPLE_COUNT; i += 1) {
        const raw = el.getPointAtLength((i / (REFERENCE_SAMPLE_COUNT - 1)) * svgLength)
        sampledPoints.push({ x: raw.x * referenceScale, y: raw.y * referenceScale })
      }

      const start = sampledPoints[0]
      const end = sampledPoints[sampledPoints.length - 1]

      return {
        start,
        end,
        vector: { x: end.x - start.x, y: end.y - start.y },
        length: svgLength * referenceScale,
        boundingBox: boundingBox(sampledPoints),
      }
    })
  }, [strokePaths, referenceScale])

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef<Point[]>([])
  const acceptedStrokesRef = useRef<Point[][]>([])
  const currentStrokeIndexRef = useRef(0)
  // Rejections per stroke slot before it was finally accepted - the signal
  // behind the Stroke Order component of the final score (a stroke nailed
  // on the first try scores higher than one that took several retries).
  const retryCountsRef = useRef<number[]>([])
  // Per-stroke direction/position/shape sub-scores, one entry per accepted
  // stroke, in acceptance order (== reference order, since order is strict).
  const strokeScoresRef = useRef<StrokeScore[]>([])

  const [currentStrokeIndex, setCurrentStrokeIndex] = useState(0)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [finalScore, setFinalScore] = useState<number | null>(null)
  const [strokeAccuracy, setStrokeAccuracy] = useState<number | null>(null)
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null)

  const recordAttempt = usePracticeHistoryStore((state) => state.recordAttempt)
  const history = usePracticeHistoryStore(
    (state) => state.history[character] ?? EMPTY_HISTORY,
  )

  const resetAttempt = () => {
    isDrawingRef.current = false
    currentStrokeRef.current = []
    acceptedStrokesRef.current = []
    currentStrokeIndexRef.current = 0
    retryCountsRef.current = []
    strokeScoresRef.current = []
    setCurrentStrokeIndex(0)
    setFeedback(null)
    setFinalScore(null)
    setStrokeAccuracy(null)
    setScoreBreakdown(null)
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
      x: ((event.clientX - rect.left) / rect.width) * size,
      y: ((event.clientY - rect.top) / rect.height) * size,
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

    const expected = referenceStrokesRef.current[index] ?? DEFAULT_REFERENCE_STROKE
    const drawnStart = strokePoints[0]
    const drawnEnd = strokePoints[strokePoints.length - 1]

    const metrics = {
      angleDiffDegrees: angleBetweenDegrees(directionVector(strokePoints), expected.vector),
      startDistance: distance(drawnStart, expected.start),
      endDistance: distance(drawnEnd, expected.end),
      lengthRatio: ratioScore(pathLength(strokePoints), expected.length),
      bboxOverlap: boundingBoxIoU(boundingBox(strokePoints), expected.boundingBox),
    }

    if (passesStrokeGate(metrics, gate)) {
      const strokeScore = scoreAcceptedStroke(metrics, gate)
      strokeScoresRef.current = [...strokeScoresRef.current, strokeScore]
      setStrokeAccuracy(strokeAccuracyPercent(strokeScore))

      acceptedStrokesRef.current = [...acceptedStrokesRef.current, strokePoints]
      currentStrokeIndexRef.current = index + 1
      setCurrentStrokeIndex(currentStrokeIndexRef.current)
      setFeedback(null)
      redrawAcceptedStrokes()

      if (currentStrokeIndexRef.current >= total) {
        const { score, breakdown } = computeOverallScore({
          acceptedStrokeCount: acceptedStrokesRef.current.length,
          referenceStrokeCount: total,
          retryCounts: retryCountsRef.current,
          strokeScores: strokeScoresRef.current,
        })
        setFinalScore(score)
        setScoreBreakdown(breakdown)
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
      retryCountsRef.current[index] = (retryCountsRef.current[index] ?? 0) + 1
      setFeedback('Incorrect stroke order')
      redrawAcceptedStrokes()
    }
  }

  const isPracticeReady = status === 'ready' && total > 0

  return (
    <div>
      {!hideHeading && (
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Writing Practice
        </h3>
      )}

      {!isPracticeReady ? (
        <p className="mt-2 text-sm text-slate-500">
          {status === 'loading'
            ? 'Loading…'
            : 'Practice not available for this kanji.'}
        </p>
      ) : (
        <div key={character} className="mt-2 flex flex-col gap-2">
          <div
            className="relative aspect-square w-full overflow-hidden rounded-md border border-slate-700 bg-white"
            style={{ maxWidth: size }}
          >
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
              width={size}
              height={size}
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

          {strokeAccuracy !== null && finalScore === null && (
            <p className="text-xs font-medium text-slate-300">
              Stroke Accuracy: {strokeAccuracy}%
            </p>
          )}

          {finalScore !== null && (
            <div className="rounded-md border border-emerald-700 bg-emerald-600/10 p-2">
              <p className="text-sm font-semibold text-emerald-300">
                ✅ Complete! Score: {finalScore} / 100
              </p>
              {scoreBreakdown && (
                <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-emerald-200/80">
                  <li>Stroke Count: {scoreBreakdown.strokeCount}%</li>
                  <li>Stroke Order: {scoreBreakdown.strokeOrder}%</li>
                  <li>Direction: {scoreBreakdown.direction}%</li>
                  <li>Position: {scoreBreakdown.position}%</li>
                  <li>Shape: {scoreBreakdown.shape}%</li>
                </ul>
              )}
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
