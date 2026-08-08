import { describe, expect, it } from 'vitest'
import {
  cleanupWeights,
  closestPointOnSegment,
  closestPointOnTriangle,
  isInsideSimplex,
  tetrahedronWeights,
  type Vec3,
} from './barycentric'

const A: Vec3 = { x: 0, y: 0, z: 0 }
const B: Vec3 = { x: 1, y: 0, z: 0 }
const C: Vec3 = { x: 0, y: 1, z: 0 }
const D: Vec3 = { x: 0, y: 0, z: 1 }

describe('tetrahedronWeights', () => {
  it('gives [1,0,0,0] at vertex A and matching one-hot weights at the other vertices', () => {
    const closeToOneHot = (weights: number[], index: number) =>
      weights.forEach((w, i) => expect(w).toBeCloseTo(i === index ? 1 : 0))

    closeToOneHot(tetrahedronWeights(A, B, C, D, A)!, 0)
    closeToOneHot(tetrahedronWeights(A, B, C, D, B)!, 1)
    closeToOneHot(tetrahedronWeights(A, B, C, D, C)!, 2)
    closeToOneHot(tetrahedronWeights(A, B, C, D, D)!, 3)
  })

  it('gives equal weights at the centroid', () => {
    const centroid: Vec3 = { x: 0.25, y: 0.25, z: 0.25 }
    const weights = tetrahedronWeights(A, B, C, D, centroid)!
    for (const w of weights) expect(w).toBeCloseTo(0.25)
  })

  it('reproduces the point exactly for a weighted-average interior point', () => {
    const weights = [0.1, 0.2, 0.3, 0.4]
    const p: Vec3 = {
      x: weights[0] * A.x + weights[1] * B.x + weights[2] * C.x + weights[3] * D.x,
      y: weights[0] * A.y + weights[1] * B.y + weights[2] * C.y + weights[3] * D.y,
      z: weights[0] * A.z + weights[1] * B.z + weights[2] * C.z + weights[3] * D.z,
    }
    const solved = tetrahedronWeights(A, B, C, D, p)!
    solved.forEach((w, i) => expect(w).toBeCloseTo(weights[i]))
  })

  it('reports a point outside the tetrahedron as not inside the simplex', () => {
    const outside: Vec3 = { x: 2, y: 2, z: 2 }
    const weights = tetrahedronWeights(A, B, C, D, outside)!
    expect(isInsideSimplex(weights)).toBe(false)
  })

  it('returns null for a degenerate (coplanar) tetrahedron', () => {
    const coplanarD: Vec3 = { x: 0.5, y: 0.5, z: 0 } // z=0 plane, same as A/B/C
    expect(tetrahedronWeights(A, B, C, coplanarD, { x: 0.2, y: 0.2, z: 0 })).toBeNull()
  })
})

describe('cleanupWeights', () => {
  it('clamps tiny negative noise and renormalizes to sum to 1', () => {
    const cleaned = cleanupWeights([0.5, 0.5000001, -0.0000001])
    expect(cleaned.every((w) => w >= 0)).toBe(true)
    expect(cleaned.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })
})

describe('closestPointOnSegment', () => {
  it('clamps to an endpoint when the projection falls outside the segment', () => {
    const result = closestPointOnSegment({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: -5, y: 0, z: 0 })
    expect(result.weights).toEqual([1, 0])
  })

  it('finds the interior projection for a point off the line', () => {
    const result = closestPointOnSegment({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 1, y: 1, z: 0 })
    expect(result.weights[0]).toBeCloseTo(0.5)
    expect(result.weights[1]).toBeCloseTo(0.5)
    expect(result.point).toEqual({ x: 1, y: 0, z: 0 })
  })
})

describe('closestPointOnTriangle', () => {
  const tri: [Vec3, Vec3, Vec3] = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  ]

  it('returns the point itself when it lies inside the triangle', () => {
    const p: Vec3 = { x: 0.2, y: 0.2, z: 0 }
    const result = closestPointOnTriangle(...tri, p)
    expect(result.point.x).toBeCloseTo(p.x)
    expect(result.point.y).toBeCloseTo(p.y)
    expect(result.point.z).toBeCloseTo(p.z)
    expect(result.distanceSquared).toBeCloseTo(0)
  })

  it('snaps to a vertex when the point is beyond it', () => {
    const result = closestPointOnTriangle(...tri, { x: -1, y: -1, z: 0 })
    expect(result.weights).toEqual([1, 0, 0])
  })

  it('projects onto an edge when the point is beyond that edge but not a vertex', () => {
    // Beyond the AB edge (y<0), roughly above its midpoint in x.
    const result = closestPointOnTriangle(...tri, { x: 0.5, y: -1, z: 0 })
    expect(result.point.y).toBeCloseTo(0)
    expect(result.point.x).toBeCloseTo(0.5)
  })

  it('projects out of plane onto the face for a point directly above the centroid', () => {
    const result = closestPointOnTriangle(...tri, { x: 0.25, y: 0.25, z: 5 })
    expect(result.point.x).toBeCloseTo(0.25)
    expect(result.point.y).toBeCloseTo(0.25)
    expect(result.point.z).toBeCloseTo(0)
  })
})
