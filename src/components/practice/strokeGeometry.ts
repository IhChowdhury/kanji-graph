export interface Point {
  x: number
  y: number
}

export interface Vector {
  x: number
  y: number
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
