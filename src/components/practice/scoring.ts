import { clamp01 } from './strokeGeometry'

// Overall score weights (must sum to 1).
export const SCORE_WEIGHTS = {
  strokeCount: 0.1,
  strokeOrder: 0.3,
  direction: 0.2,
  position: 0.2,
  shape: 0.2,
} as const

export interface GateThresholds {
  maxAngleDiffDegrees: number
  maxPointDistance: number
  minLengthRatio: number
  minBboxOverlap: number
}

export interface StrokeMetrics {
  angleDiffDegrees: number
  startDistance: number
  endDistance: number
  lengthRatio: number
  bboxOverlap: number
}

/**
 * Strict stroke-order gate: a drawn stroke only advances to the next
 * expected stroke if it passes every check. Unchanged in spirit from the
 * original angle+position gate, now also rejecting a stroke whose actual
 * shape (length/bounding-box) is drastically different from the reference
 * even if its start, end, and net angle happen to land close enough - a
 * scribble/wiggle that start/end/angle alone would have wrongly accepted.
 */
export function passesStrokeGate(metrics: StrokeMetrics, gate: GateThresholds): boolean {
  return (
    metrics.angleDiffDegrees <= gate.maxAngleDiffDegrees &&
    metrics.startDistance <= gate.maxPointDistance &&
    metrics.endDistance <= gate.maxPointDistance &&
    metrics.lengthRatio >= gate.minLengthRatio &&
    metrics.bboxOverlap >= gate.minBboxOverlap
  )
}

export interface StrokeScore {
  direction: number
  position: number
  shape: number
}

/**
 * Only meaningful for a stroke that already passed the gate. Each
 * sub-score is 0 at the gate's own boundary (the worst value that still
 * passes) and 1 at a perfect match - so a stroke that only just squeaks
 * past the gate scores near 0%, not the ~60%+ a flat "1 - diff/180"
 * formula used to give it.
 */
export function scoreAcceptedStroke(metrics: StrokeMetrics, gate: GateThresholds): StrokeScore {
  const direction = clamp01(1 - metrics.angleDiffDegrees / gate.maxAngleDiffDegrees)
  const position = clamp01(
    1 - (metrics.startDistance + metrics.endDistance) / (2 * gate.maxPointDistance),
  )
  const lengthScore = clamp01(
    (metrics.lengthRatio - gate.minLengthRatio) / (1 - gate.minLengthRatio),
  )
  const bboxScore = clamp01(
    (metrics.bboxOverlap - gate.minBboxOverlap) / (1 - gate.minBboxOverlap),
  )
  // Squared product (an "AND", not an average) - a stroke needs BOTH a
  // right length AND a right bounding-box extent to score well here.
  // Averaging would let a stroke that's badly wrong on only one of the two
  // (e.g. a scribble that wiggles a lot but stays roughly inside the right
  // box) get bailed out by the other, which is exactly the "shape differs
  // but still scores high" failure mode this check exists to close.
  // Squaring on top pushes anything short of a good match down further -
  // see computeOverallScore for why that matters.
  const shape = (lengthScore * bboxScore) ** 2
  return { direction, position, shape }
}

export function strokeAccuracyPercent(score: StrokeScore): number {
  return Math.round(((score.direction + score.position + score.shape) / 3) * 100)
}

export interface ScoreBreakdown {
  strokeCount: number
  strokeOrder: number
  direction: number
  position: number
  shape: number
}

export interface OverallScoreResult {
  score: number
  breakdown: ScoreBreakdown
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/**
 * Combines the per-attempt (count, order) and per-stroke-averaged
 * (direction, position, shape) components into the final 0-100 score.
 *
 * Count (10%) and Order (30%) are both ~1.0 for any completed attempt with
 * clean first-try strokes, regardless of shape - together up to 40 points
 * "for free". Direction and Position are next, each capped at 0 for a
 * stroke that only just squeaks past the gate - together up to another 40.
 * That leaves Shape (20%) as the only component standing between a
 * clearly-distorted-but-technically-accepted kanji and a score above 80:
 * its squared-product formula drives it to (near) 0 whenever length or
 * bounding-box match is at/near the gate's own minimum, capping the
 * theoretical max at 80 for that case (see scoring.test.ts).
 */
export function computeOverallScore(params: {
  acceptedStrokeCount: number
  referenceStrokeCount: number
  /** Rejections per stroke slot before it was accepted, indexed 0..referenceStrokeCount-1. */
  retryCounts: number[]
  /** One entry per accepted stroke, in acceptance order. */
  strokeScores: StrokeScore[]
}): OverallScoreResult {
  const { acceptedStrokeCount, referenceStrokeCount, retryCounts, strokeScores } = params

  const strokeCountScore = clamp01(
    1 - Math.abs(acceptedStrokeCount - referenceStrokeCount) / referenceStrokeCount,
  )
  const strokeOrderScore = average(
    Array.from({ length: referenceStrokeCount }, (_, i) => 1 / (1 + (retryCounts[i] ?? 0))),
  )
  const direction = average(strokeScores.map((s) => s.direction))
  const position = average(strokeScores.map((s) => s.position))
  const shape = average(strokeScores.map((s) => s.shape))

  const overall =
    strokeCountScore * SCORE_WEIGHTS.strokeCount +
    strokeOrderScore * SCORE_WEIGHTS.strokeOrder +
    direction * SCORE_WEIGHTS.direction +
    position * SCORE_WEIGHTS.position +
    shape * SCORE_WEIGHTS.shape

  return {
    score: Math.round(overall * 100),
    breakdown: {
      strokeCount: Math.round(strokeCountScore * 100),
      strokeOrder: Math.round(strokeOrderScore * 100),
      direction: Math.round(direction * 100),
      position: Math.round(position * 100),
      shape: Math.round(shape * 100),
    },
  }
}
