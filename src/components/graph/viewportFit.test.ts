import { describe, expect, it } from 'vitest'

import { computeBoundingBox, planBranchFit, type Viewport } from './viewportFit'
import { NODE_HEIGHT, NODE_WIDTH } from './graphLayout'

describe('computeBoundingBox', () => {
  it('covers every named node\'s footprint', () => {
    const positions = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 200, y: 100 }],
    ])
    const box = computeBoundingBox(['a', 'b'], positions)
    expect(box).toEqual({
      x: 0,
      y: 0,
      width: 200 + NODE_WIDTH,
      height: 100 + NODE_HEIGHT,
    })
  })

  it('skips ids with no known position', () => {
    const positions = new Map([['a', { x: 10, y: 10 }]])
    const box = computeBoundingBox(['a', 'missing'], positions)
    expect(box).toEqual({ x: 10, y: 10, width: NODE_WIDTH, height: NODE_HEIGHT })
  })

  it('returns null when none of the ids resolve', () => {
    expect(computeBoundingBox(['missing'], new Map())).toBeNull()
  })
})

describe('planBranchFit', () => {
  const containerWidth = 1000
  const containerHeight = 800

  it('does nothing when the bounds are already fully visible (preserves zoom exactly)', () => {
    const viewport: Viewport = { x: 0, y: 0, zoom: 1 }
    const bounds = { x: 100, y: 100, width: 100, height: 100 }
    expect(planBranchFit(bounds, viewport, containerWidth, containerHeight)).toEqual({
      type: 'none',
    })
  })

  it('pans without changing zoom when the branch would fit at the current zoom', () => {
    const viewport: Viewport = { x: 0, y: 0, zoom: 1 }
    // Off to the right, out of the visible area, but small enough to fit.
    const bounds = { x: 5000, y: 5000, width: 100, height: 100 }
    const action = planBranchFit(bounds, viewport, containerWidth, containerHeight)
    expect(action).toEqual({
      type: 'pan',
      x: 5050,
      y: 5050,
      zoom: 1, // zoom preserved
    })
  })

  it('falls back to a zoom-adjusting fit only when the branch is too big for the current zoom', () => {
    const viewport: Viewport = { x: 0, y: 0, zoom: 2 }
    // At zoom 2, this branch is 2x too wide for the container - can't pan
    // its way into view without zooming out.
    const bounds = { x: 0, y: 0, width: 2000, height: 100 }
    const action = planBranchFit(bounds, viewport, containerWidth, containerHeight)
    expect(action.type).toBe('fit')
    if (action.type === 'fit') {
      expect(action.bounds).toEqual(bounds)
    }
  })

  it('treats a branch just past the edge of the viewport as not-yet-visible', () => {
    const viewport: Viewport = { x: 0, y: 0, zoom: 1 }
    // Container is 1000 wide; this box starts just past the right edge.
    const bounds = { x: 1050, y: 10, width: 50, height: 50 }
    const action = planBranchFit(bounds, viewport, containerWidth, containerHeight)
    expect(action.type).not.toBe('none')
  })

  it('accounts for pan offset and zoom when checking visibility', () => {
    // Viewport panned/zoomed such that flow-space (500,500) is at screen center.
    const zoom = 1.5
    const viewport: Viewport = {
      x: containerWidth / 2 - 500 * zoom,
      y: containerHeight / 2 - 500 * zoom,
      zoom,
    }
    const bounds = { x: 480, y: 480, width: 40, height: 40 } // centered on (500,500)
    expect(planBranchFit(bounds, viewport, containerWidth, containerHeight)).toEqual({
      type: 'none',
    })
  })
})
