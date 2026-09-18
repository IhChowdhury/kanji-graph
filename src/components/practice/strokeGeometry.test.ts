import { describe, expect, it } from 'vitest'

import {
  angleBetweenDegrees,
  boundingBox,
  boundingBoxIoU,
  clamp01,
  distance,
  pathLength,
  ratioScore,
  type Point,
} from './strokeGeometry'

describe('pathLength', () => {
  it('sums consecutive-point distances, not straight-line start-to-end distance', () => {
    // A right-angle zigzag: straight-line distance is 10, actual path is 20.
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]
    expect(pathLength(points)).toBeCloseTo(20)
    expect(distance(points[0], points[points.length - 1])).toBeCloseTo(
      Math.hypot(10, 10),
    )
  })

  it('returns 0 for a single point', () => {
    expect(pathLength([{ x: 5, y: 5 }])).toBe(0)
  })
})

describe('boundingBox', () => {
  it('computes the axis-aligned extent of a point set', () => {
    const box = boundingBox([
      { x: 3, y: -2 },
      { x: -1, y: 5 },
      { x: 0, y: 0 },
    ])
    expect(box).toEqual({ minX: -1, minY: -2, maxX: 3, maxY: 5 })
  })
})

describe('boundingBoxIoU', () => {
  it('returns close to 1 for identical boxes', () => {
    const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 }
    expect(boundingBoxIoU(box, box)).toBeCloseTo(1)
  })

  it('returns 0 for boxes that do not overlap at all, even after padding', () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 }
    const b = { minX: 1000, minY: 1000, maxX: 1010, maxY: 1010 }
    expect(boundingBoxIoU(a, b)).toBe(0)
  })

  it('scores a much larger/differently-shaped box lower than a similarly-sized one', () => {
    const reference = { minX: 0, minY: 0, maxX: 20, maxY: 20 }
    const closeMatch = { minX: 2, minY: 2, maxX: 22, maxY: 18 }
    const wildlyDifferent = { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    expect(boundingBoxIoU(reference, closeMatch)).toBeGreaterThan(
      boundingBoxIoU(reference, wildlyDifferent),
    )
  })

  it('does not unfairly punish a perfectly straight (zero-height) stroke overlapping another', () => {
    const a = { minX: 0, minY: 50, maxX: 100, maxY: 50 }
    const b = { minX: 0, minY: 52, maxX: 100, maxY: 52 }
    expect(boundingBoxIoU(a, b)).toBeGreaterThan(0.5)
  })
})

describe('ratioScore', () => {
  it('is 1 for equal magnitudes', () => {
    expect(ratioScore(10, 10)).toBe(1)
  })

  it('is symmetric and shrinks as magnitudes diverge', () => {
    expect(ratioScore(10, 20)).toBeCloseTo(0.5)
    expect(ratioScore(20, 10)).toBeCloseTo(0.5)
    expect(ratioScore(10, 100)).toBeCloseTo(0.1)
  })

  it('treats two zero-length magnitudes as a perfect match', () => {
    expect(ratioScore(0, 0)).toBe(1)
  })
})

describe('clamp01', () => {
  it('clamps below 0 and above 1', () => {
    expect(clamp01(-5)).toBe(0)
    expect(clamp01(5)).toBe(1)
    expect(clamp01(0.42)).toBe(0.42)
  })
})

describe('angleBetweenDegrees (existing behavior, unchanged)', () => {
  it('is 0 for identical directions and 180 for opposite directions', () => {
    expect(angleBetweenDegrees({ x: 1, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0)
    expect(angleBetweenDegrees({ x: 1, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(180)
  })
})
