import { describe, expect, it } from 'vitest'

import {
  SCORE_WEIGHTS,
  computeOverallScore,
  passesStrokeGate,
  scoreAcceptedStroke,
  strokeAccuracyPercent,
  type GateThresholds,
  type StrokeMetrics,
} from './scoring'

const GATE: GateThresholds = {
  maxAngleDiffDegrees: 70,
  maxPointDistance: 78, // 260 * 0.3, matching the component's real threshold
  minLengthRatio: 0.35,
  minBboxOverlap: 0.15,
}

function perfectMetrics(): StrokeMetrics {
  return { angleDiffDegrees: 0, startDistance: 0, endDistance: 0, lengthRatio: 1, bboxOverlap: 1 }
}

describe('SCORE_WEIGHTS', () => {
  it('sums to 1 (100%), matching the required rubric', () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((sum, w) => sum + w, 0)
    expect(total).toBeCloseTo(1)
    expect(SCORE_WEIGHTS).toEqual({
      strokeCount: 0.1,
      strokeOrder: 0.3,
      direction: 0.2,
      position: 0.2,
      shape: 0.2,
    })
  })
})

describe('passesStrokeGate', () => {
  it('accepts a perfect stroke', () => {
    expect(passesStrokeGate(perfectMetrics(), GATE)).toBe(true)
  })

  it('rejects a stroke whose angle exceeds the threshold', () => {
    expect(passesStrokeGate({ ...perfectMetrics(), angleDiffDegrees: 71 }, GATE)).toBe(false)
  })

  it('rejects a stroke whose start or end drifted too far', () => {
    expect(passesStrokeGate({ ...perfectMetrics(), startDistance: 79 }, GATE)).toBe(false)
    expect(passesStrokeGate({ ...perfectMetrics(), endDistance: 79 }, GATE)).toBe(false)
  })

  it('rejects a stroke whose length ratio is below the minimum (e.g. a scribble)', () => {
    expect(passesStrokeGate({ ...perfectMetrics(), lengthRatio: 0.3 }, GATE)).toBe(false)
  })

  it('rejects a stroke whose bounding-box overlap is below the minimum', () => {
    expect(passesStrokeGate({ ...perfectMetrics(), bboxOverlap: 0.1 }, GATE)).toBe(false)
  })
})

describe('scoreAcceptedStroke', () => {
  it('scores a perfect stroke at 100% on every axis', () => {
    const score = scoreAcceptedStroke(perfectMetrics(), GATE)
    expect(score.direction).toBeCloseTo(1)
    expect(score.position).toBeCloseTo(1)
    expect(score.shape).toBeCloseTo(1)
    expect(strokeAccuracyPercent(score)).toBe(100)
  })

  it('scores a stroke that only just squeaks past the gate near 0%, not ~60%+', () => {
    const barelyPassing: StrokeMetrics = {
      angleDiffDegrees: GATE.maxAngleDiffDegrees,
      startDistance: GATE.maxPointDistance,
      endDistance: GATE.maxPointDistance,
      lengthRatio: GATE.minLengthRatio,
      bboxOverlap: GATE.minBboxOverlap,
    }
    const score = scoreAcceptedStroke(barelyPassing, GATE)
    expect(score.direction).toBe(0)
    expect(score.position).toBe(0)
    expect(score.shape).toBe(0)
    expect(strokeAccuracyPercent(score)).toBe(0)
  })

  it('scores shape low when only ONE of length/bbox is bad, even if the other is perfect (AND, not average)', () => {
    const badLengthGoodBbox = scoreAcceptedStroke(
      { ...perfectMetrics(), lengthRatio: GATE.minLengthRatio },
      GATE,
    )
    // A naive average of (0, 1) would give 0.5 (50%) - the product-based
    // formula must stay much lower, since a scribbled stroke with a
    // coincidentally-matching bounding box is still clearly wrong.
    expect(badLengthGoodBbox.shape).toBeLessThan(0.1)
  })
})

describe('computeOverallScore', () => {
  function perfectAttempt(referenceStrokeCount: number) {
    const strokeScores = Array.from({ length: referenceStrokeCount }, () => ({
      direction: 1,
      position: 1,
      shape: 1,
    }))
    return computeOverallScore({
      acceptedStrokeCount: referenceStrokeCount,
      referenceStrokeCount,
      retryCounts: new Array(referenceStrokeCount).fill(0),
      strokeScores,
    })
  }

  it('scores a flawless attempt at 100', () => {
    const { score, breakdown } = perfectAttempt(6)
    expect(score).toBe(100)
    expect(breakdown).toEqual({
      strokeCount: 100,
      strokeOrder: 100,
      direction: 100,
      position: 100,
      shape: 100,
    })
  })

  it('lowers the Stroke Order component when strokes needed retries', () => {
    const { breakdown: clean } = perfectAttempt(4)
    const { breakdown: withRetries } = computeOverallScore({
      acceptedStrokeCount: 4,
      referenceStrokeCount: 4,
      retryCounts: [0, 2, 0, 1], // two strokes needed extra attempts
      strokeScores: Array.from({ length: 4 }, () => ({ direction: 1, position: 1, shape: 1 })),
    })
    expect(withRetries.strokeOrder).toBeLessThan(clean.strokeOrder)
  })

  it('REQUIREMENT: a clearly distorted kanji (shape at the gate boundary) never scores above 80, even with perfect order/count/direction/position', () => {
    // Worst-case-but-still-accepted shape on every stroke: length and
    // bounding-box overlap both sitting exactly at the gate's own minimum
    // (i.e. as distorted as a stroke can be while still passing at all),
    // while direction/position/order/count are all flawless - the
    // scenario that would defeat the cap if Shape weren't steep enough.
    const strokeScores = Array.from({ length: 8 }, () => ({
      direction: 1,
      position: 1,
      shape: 0, // (lengthScore * bboxScore) ** 2 at the gate boundary
    }))
    const { score, breakdown } = computeOverallScore({
      acceptedStrokeCount: 8,
      referenceStrokeCount: 8,
      retryCounts: new Array(8).fill(0),
      strokeScores,
    })
    expect(breakdown.shape).toBe(0)
    expect(score).toBeLessThanOrEqual(80)
    expect(score).toBe(80) // strokeCount(10) + strokeOrder(30) + direction(20) + position(20)
  })

  it('REQUIREMENT: stays at or under 80 for moderately (not just maximally) distorted shape too', () => {
    // lengthRatio=0.5, bboxOverlap=0.3 relative to the same GATE as above -
    // clearly wrong, not just borderline.
    const lengthScore = (0.5 - GATE.minLengthRatio) / (1 - GATE.minLengthRatio)
    const bboxScore = (0.3 - GATE.minBboxOverlap) / (1 - GATE.minBboxOverlap)
    const shape = (lengthScore * bboxScore) ** 2
    const strokeScores = Array.from({ length: 6 }, () => ({ direction: 1, position: 1, shape }))
    const { score } = computeOverallScore({
      acceptedStrokeCount: 6,
      referenceStrokeCount: 6,
      retryCounts: new Array(6).fill(0),
      strokeScores,
    })
    expect(score).toBeLessThanOrEqual(80)
  })

  it('a genuinely well-drawn kanji still scores well above 80', () => {
    const strokeScores = Array.from({ length: 6 }, () => ({
      direction: 0.9,
      position: 0.9,
      shape: 0.85,
    }))
    const { score } = computeOverallScore({
      acceptedStrokeCount: 6,
      referenceStrokeCount: 6,
      retryCounts: new Array(6).fill(0),
      strokeScores,
    })
    expect(score).toBeGreaterThan(85)
  })
})
