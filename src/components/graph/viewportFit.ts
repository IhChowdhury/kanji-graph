import { NODE_HEIGHT, NODE_WIDTH } from './graphLayout'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export type BranchFitAction =
  | { type: 'none' }
  | { type: 'pan'; x: number; y: number; zoom: number }
  | { type: 'fit'; bounds: Rect }

// Extra breathing room (in flow units, same scale as node position/width) around
// the target bounding box before deciding whether it already fits - without
// this, a branch sitting exactly flush against the viewport edge would count
// as "visible" but look cramped.
const FIT_PADDING = 40

/** Bounding box (in flow coordinates) covering every named node's footprint.
 * Ids with no known position (e.g. filtered out, or simply not found) are
 * skipped; returns null if none of the ids resolved to a position at all. */
export function computeBoundingBox(
  nodeIds: string[],
  positionsById: Map<string, { x: number; y: number }>,
): Rect | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let found = false

  for (const id of nodeIds) {
    const position = positionsById.get(id)
    if (!position) continue
    found = true
    minX = Math.min(minX, position.x)
    minY = Math.min(minY, position.y)
    maxX = Math.max(maxX, position.x + NODE_WIDTH)
    maxY = Math.max(maxY, position.y + NODE_HEIGHT)
  }

  if (!found) return null
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Decides how to bring `bounds` into view while preserving the current pan
 * and zoom whenever that's actually possible:
 * - already fully visible at the current viewport -> do nothing (zoom AND pan preserved)
 * - not visible, but would fit within the container at the current zoom -> pan only (zoom preserved)
 * - too big for the container at the current zoom -> fall back to a zoom-adjusting fit (only case zoom changes)
 */
export function planBranchFit(
  bounds: Rect,
  viewport: Viewport,
  containerWidth: number,
  containerHeight: number,
): BranchFitAction {
  const paddedMinX = bounds.x - FIT_PADDING
  const paddedMinY = bounds.y - FIT_PADDING
  const paddedMaxX = bounds.x + bounds.width + FIT_PADDING
  const paddedMaxY = bounds.y + bounds.height + FIT_PADDING

  // screen = flow * zoom + translate, so the currently-visible flow-space
  // rectangle is (0..containerWidth, 0..containerHeight) mapped back through
  // that transform.
  const visibleMinX = -viewport.x / viewport.zoom
  const visibleMinY = -viewport.y / viewport.zoom
  const visibleMaxX = (containerWidth - viewport.x) / viewport.zoom
  const visibleMaxY = (containerHeight - viewport.y) / viewport.zoom

  const alreadyVisible =
    paddedMinX >= visibleMinX &&
    paddedMinY >= visibleMinY &&
    paddedMaxX <= visibleMaxX &&
    paddedMaxY <= visibleMaxY

  if (alreadyVisible) return { type: 'none' }

  const paddedWidth = bounds.width + FIT_PADDING * 2
  const paddedHeight = bounds.height + FIT_PADDING * 2
  const fitsAtCurrentZoom =
    paddedWidth * viewport.zoom <= containerWidth &&
    paddedHeight * viewport.zoom <= containerHeight

  if (fitsAtCurrentZoom) {
    return {
      type: 'pan',
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
      zoom: viewport.zoom,
    }
  }

  return { type: 'fit', bounds }
}
