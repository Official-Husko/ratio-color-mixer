import { solve3x3 } from './solve3x3'

export interface Vec3 {
  x: number
  y: number
  z: number
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s }
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

const INSIDE_EPS = 1e-7

/**
 * Barycentric weights [wa, wb, wc, wd] of point P with respect to
 * tetrahedron ABCD, i.e. the unique a,b,c,d with a+b+c+d=1 and
 * P = aA + bB + cC + dD. Returns null if ABCD is degenerate (the four
 * points don't actually span 3D — collinear or coplanar).
 *
 * Solves `[A-D  B-D  C-D] * [a,b,c] = P-D` (see 01_GEOMETRIC_SOLVER.md §5),
 * then d = 1 - a - b - c.
 */
export function tetrahedronWeights(a: Vec3, b: Vec3, c: Vec3, d: Vec3, p: Vec3): number[] | null {
  const ad = sub(a, d)
  const bd = sub(b, d)
  const cd = sub(c, d)
  const pd = sub(p, d)

  const solved = solve3x3(
    [
      [ad.x, bd.x, cd.x],
      [ad.y, bd.y, cd.y],
      [ad.z, bd.z, cd.z],
    ],
    [pd.x, pd.y, pd.z],
  )
  if (!solved) return null

  const [wa, wb, wc] = solved
  return [wa, wb, wc, 1 - wa - wb - wc]
}

/** True if every weight is non-negative within numerical tolerance — i.e. P lies inside (or on) the simplex. */
export function isInsideSimplex(weights: number[]): boolean {
  return weights.every((w) => w >= -INSIDE_EPS)
}

/** Clamps tiny negative numerical noise to 0 and renormalizes so the weights sum to exactly 1. */
export function cleanupWeights(weights: number[]): number[] {
  const clamped = weights.map((w) => Math.max(0, w))
  const sum = clamped.reduce((a, b) => a + b, 0)
  return sum > 0 ? clamped.map((w) => w / sum) : clamped
}

export interface ClosestPointResult {
  point: Vec3
  weights: number[]
  distanceSquared: number
}

/** Closest point to P on the segment AB, as a convex combination [1-t, t]. */
export function closestPointOnSegment(a: Vec3, b: Vec3, p: Vec3): ClosestPointResult {
  const ab = sub(b, a)
  const abLengthSquared = dot(ab, ab)
  const t = abLengthSquared > 0 ? Math.min(1, Math.max(0, dot(sub(p, a), ab) / abLengthSquared)) : 0
  const point = add(a, scale(ab, t))
  return { point, weights: [1 - t, t], distanceSquared: dot(sub(p, point), sub(p, point)) }
}

/**
 * Closest point to P on triangle ABC (Ericson, "Real-Time Collision
 * Detection" §5.1.5) — checks the vertex, edge, and face Voronoi regions and
 * returns whichever the point actually projects into. Handles the point
 * lying outside the triangle (returns a point on its boundary) as well as
 * inside (returns the point itself).
 */
export function closestPointOnTriangle(a: Vec3, b: Vec3, c: Vec3, p: Vec3): ClosestPointResult {
  const ab = sub(b, a)
  const ac = sub(c, a)
  const ap = sub(p, a)

  const d1 = dot(ab, ap)
  const d2 = dot(ac, ap)
  if (d1 <= 0 && d2 <= 0) {
    return { point: a, weights: [1, 0, 0], distanceSquared: dot(ap, ap) }
  }

  const bp = sub(p, b)
  const d3 = dot(ab, bp)
  const d4 = dot(ac, bp)
  if (d3 >= 0 && d4 <= d3) {
    return { point: b, weights: [0, 1, 0], distanceSquared: dot(bp, bp) }
  }

  const vc = d1 * d4 - d3 * d2
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3)
    const point = add(a, scale(ab, v))
    return { point, weights: [1 - v, v, 0], distanceSquared: dot(sub(p, point), sub(p, point)) }
  }

  const cp = sub(p, c)
  const d5 = dot(ab, cp)
  const d6 = dot(ac, cp)
  if (d6 >= 0 && d5 <= d6) {
    return { point: c, weights: [0, 0, 1], distanceSquared: dot(cp, cp) }
  }

  const vb = d5 * d2 - d1 * d6
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6)
    const point = add(a, scale(ac, w))
    return { point, weights: [1 - w, 0, w], distanceSquared: dot(sub(p, point), sub(p, point)) }
  }

  const va = d3 * d6 - d5 * d4
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6))
    const point = add(b, scale(sub(c, b), w))
    return { point, weights: [0, 1 - w, w], distanceSquared: dot(sub(p, point), sub(p, point)) }
  }

  const denom = 1 / (va + vb + vc)
  const v = vb * denom
  const w = vc * denom
  const point = add(a, add(scale(ab, v), scale(ac, w)))
  return { point, weights: [1 - v - w, v, w], distanceSquared: dot(sub(p, point), sub(p, point)) }
}
