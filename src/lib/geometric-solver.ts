import {
  approxRybToRgb,
  colorDistance,
  rgbToApproxRyb,
  squaredDistance,
  weightedMix,
  type MixResult,
  type Rgb,
} from './color-math'
import {
  cleanupWeights,
  closestPointOnSegment,
  closestPointOnTriangle,
  isInsideSimplex,
  tetrahedronWeights,
  type Vec3,
} from './geometry/barycentric'

/**
 * Above this many paints, testing every 4-point combination for containment
 * (and every 3-point combination for closest-approach) stops being cheap —
 * C(40,4) is ~91k tiny linear solves, still comfortably interactive, but it
 * grows combinatorially from there. Callers should fall back to the
 * iterative solver beyond this size.
 */
export const MAX_GEOMETRIC_PAINTS = 40

export interface GeometricSolveResult extends MixResult {
  /** "trivial" = 0 or 1 paint, no geometry needed. "inside-hull" = target reproduced exactly (or within numerical epsilon). "outside-hull" = closest reachable approximation. */
  mode: 'trivial' | 'inside-hull' | 'outside-hull'
  activePaintIndices: number[]
  combinationsTried: number
}

const EXACT_MATCH_DISTANCE_SQUARED_EPS = 1e-6

function toVec3(rgb: Rgb): Vec3 {
  return { x: rgb.r, y: rgb.g, z: rgb.b }
}

/**
 * Lazily yields every k-combination of indices [0, n) in lexicographic
 * order. Yields a fresh array each time — the internal working array is
 * mutated in place between iterations, so callers that retain a yielded
 * value past the next `next()` call (as `consider()` below does for the
 * current best) need their own copy, not a reference into it.
 */
function* combinations(n: number, k: number): Generator<number[]> {
  if (k > n || k <= 0) return
  const indices = Array.from({ length: k }, (_, i) => i)
  while (true) {
    yield [...indices]
    let i = k - 1
    while (i >= 0 && indices[i] === n - k + i) i -= 1
    if (i < 0) return
    indices[i] += 1
    for (let j = i + 1; j < k; j += 1) indices[j] = indices[j - 1] + 1
  }
}

/**
 * Finds paint proportions that reproduce (or best approximate) a target
 * color, using the geometry of the problem instead of iterative descent:
 * every reachable mixture is a convex combination of the palette's
 * RYB-transformed points, so by Carathéodory's theorem any exactly
 * reachable target needs at most 4 of them (a tetrahedron), and the closest
 * approximation to an unreachable target lies on some 3-paint face of that
 * same convex region. See paint_mixer_optimization_docs/01_GEOMETRIC_SOLVER.md.
 *
 * Rather than computing the convex hull explicitly, this tests every
 * 4-combination for containment and (if none contains it) every
 * 3-combination for closest approach — provably equivalent to hull-face
 * testing here (a non-hull-face triangle is itself inside the hull, and the
 * closest point in a convex set to an external target always lies on the
 * boundary, so non-hull triangles can only ever lose, never win, the
 * search), without needing hull-construction code at all. See
 * MAX_GEOMETRIC_PAINTS for the size this stays practical up to.
 */
export function solvePaintMixGeometric(paints: Rgb[], targetRgb: Rgb): GeometricSolveResult | null {
  const n = paints.length
  if (n === 0) return null

  const targetRyb = rgbToApproxRyb(targetRgb)

  if (n === 1) {
    return {
      weights: [1],
      percentages: [100],
      mixed: paints[0],
      error: colorDistance(paints[0], targetRgb),
      transformedErrorSquared: squaredDistance(rgbToApproxRyb(paints[0]), targetRyb),
      iterations: 0,
      mode: 'trivial',
      activePaintIndices: [0],
      combinationsTried: 0,
    }
  }

  const paintsRyb = paints.map(rgbToApproxRyb)
  const points = paintsRyb.map(toVec3)
  const targetPoint = toVec3(targetRyb)

  let combinationsTried = 0
  let bestWeights: number[] | null = null
  let bestIndices: number[] = []
  let bestDistanceSquared = Number.POSITIVE_INFINITY

  function consider(indices: number[], activeWeights: number[], distanceSquared: number) {
    if (distanceSquared < bestDistanceSquared) {
      const fullWeights = new Array(n).fill(0)
      indices.forEach((paintIndex, i) => {
        fullWeights[paintIndex] = activeWeights[i]
      })
      bestWeights = fullWeights
      bestIndices = indices
      bestDistanceSquared = distanceSquared
    }
  }

  if (n === 2) {
    const result = closestPointOnSegment(points[0], points[1], targetPoint)
    consider([0, 1], result.weights, result.distanceSquared)
    combinationsTried = 1
  } else {
    let foundExact = false
    for (const indices of combinations(n, 4)) {
      combinationsTried += 1
      const weights = tetrahedronWeights(points[indices[0]], points[indices[1]], points[indices[2]], points[indices[3]], targetPoint)
      if (!weights || !isInsideSimplex(weights)) continue
      consider(indices, weights, 0)
      foundExact = true
      break // any exact-containing tetrahedron is equally accurate (error 0)
    }

    if (!foundExact) {
      for (const indices of combinations(n, 3)) {
        combinationsTried += 1
        const result = closestPointOnTriangle(points[indices[0]], points[indices[1]], points[indices[2]], targetPoint)
        consider(indices, result.weights, result.distanceSquared)
      }
    }
  }

  if (!bestWeights) return null

  const cleanedWeights = cleanupWeights(bestWeights)
  const mixedRgb = approxRybToRgb(weightedMix(paintsRyb, cleanedWeights))

  return {
    weights: cleanedWeights,
    percentages: cleanedWeights.map((w) => w * 100),
    mixed: mixedRgb,
    error: colorDistance(mixedRgb, targetRgb),
    transformedErrorSquared: bestDistanceSquared,
    iterations: combinationsTried,
    mode: bestDistanceSquared < EXACT_MATCH_DISTANCE_SQUARED_EPS ? 'inside-hull' : 'outside-hull',
    activePaintIndices: bestIndices.filter((idx) => cleanedWeights[idx] > 0),
    combinationsTried,
  }
}
