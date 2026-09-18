export interface Point {
  x: number
  y: number
}

export interface Vector {
  x: number
  y: number
}

export interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function directionVector(points: Point[]): Vector {
  if (points.length < 2) return { x: 0, y: 0 }
  const first = points[0]
  const last = points[points.length - 1]
  return { x: last.x - first.x, y: last.y - first.y }
}

// Angle between two vectors, 0-180 degrees. Scale-invariant, so it doesn't
// matter that user strokes are captured in canvas-pixel space while
// reference vectors come from the SVG's 0-109 viewBox space - only the
// direction is compared, not magnitude.
export function angleBetweenDegrees(a: Vector, b: Vector): number {
  const magA = Math.hypot(a.x, a.y)
  const magB = Math.hypot(b.x, b.y)
  if (magA === 0 || magB === 0) return 180
  const cos = Math.min(1, Math.max(-1, (a.x * b.x + a.y * b.y) / (magA * magB)))
  return (Math.acos(cos) * 180) / Math.PI
}

/** Total polyline length (sum of consecutive-point distances) - the actual
 * drawn path length, as opposed to the straight-line start-to-end distance.
 * A wiggly/scribbled stroke that starts and ends near the right spots but
 * wanders in between has a much larger path length than a clean stroke -
 * this is what makes stroke-length comparison catch shape distortion that
 * start/end/angle checks alone miss. */
export function pathLength(points: Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += distance(points[i - 1], points[i])
  }
  return total
}

export function boundingBox(points: Point[]): BoundingBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  return { minX, minY, maxX, maxY }
}

// Straight (near-horizontal/vertical) strokes have a near-zero-width or
// near-zero-height bounding box, which would make IoU degenerate (any tiny
// offset looks like a 0% overlap even for an otherwise well-matched
// stroke). Padding both boxes by the same margin before comparing keeps IoU
// meaningful for straight strokes without changing the comparison for
// strokes that already have real width/height.
const BOUNDING_BOX_PADDING = 6

function padBoundingBox(box: BoundingBox, padding: number): BoundingBox {
  return {
    minX: box.minX - padding,
    minY: box.minY - padding,
    maxX: box.maxX + padding,
    maxY: box.maxY + padding,
  }
}

/** Intersection-over-union of two axis-aligned boxes, 0 (no overlap) to 1
 * (identical). A stroke drawn with a much larger/smaller/differently
 * shaped extent than the reference - even if its start, end, and net angle
 * happen to line up - scores low here, which is exactly the "shape differs
 * significantly" case the angle/position checks alone can't catch. */
export function boundingBoxIoU(a: BoundingBox, b: BoundingBox): number {
  const paddedA = padBoundingBox(a, BOUNDING_BOX_PADDING)
  const paddedB = padBoundingBox(b, BOUNDING_BOX_PADDING)

  const overlapX = Math.min(paddedA.maxX, paddedB.maxX) - Math.max(paddedA.minX, paddedB.minX)
  const overlapY = Math.min(paddedA.maxY, paddedB.maxY) - Math.max(paddedA.minY, paddedB.minY)
  if (overlapX <= 0 || overlapY <= 0) return 0

  const intersection = overlapX * overlapY
  const areaA = (paddedA.maxX - paddedA.minX) * (paddedA.maxY - paddedA.minY)
  const areaB = (paddedB.maxX - paddedB.minX) * (paddedB.maxY - paddedB.minY)
  const union = areaA + areaB - intersection
  if (union <= 0) return 1

  return intersection / union
}

/** Symmetric ratio of two positive magnitudes (e.g. stroke lengths), 1 when
 * equal, shrinking toward 0 as they diverge in either direction. */
export function ratioScore(a: number, b: number): number {
  if (a <= 0 && b <= 0) return 1
  const smaller = Math.min(a, b)
  const larger = Math.max(a, b)
  if (larger <= 0) return 1
  return smaller / larger
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
