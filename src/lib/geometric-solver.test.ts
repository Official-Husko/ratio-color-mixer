import { describe, expect, it } from 'vitest'
import { hexToRgb } from './color-math'
import { MAX_GEOMETRIC_PAINTS, solvePaintMixGeometric } from './geometric-solver'
import { solvePaintMix, solvePaintMixHex } from './solve-paint-mix'

function hexPaints(hexes: string[]) {
  return hexes.map(hexToRgb)
}

describe('solvePaintMixGeometric', () => {
  it('returns null for an empty palette', () => {
    expect(solvePaintMixGeometric([], { r: 0, g: 0, b: 0 })).toBeNull()
  })

  it('returns the trivial 100% result for a single paint', () => {
    const paint = hexToRgb('#123456')
    const result = solvePaintMixGeometric([paint], hexToRgb('#abcdef'))!
    expect(result.mode).toBe('trivial')
    expect(result.weights).toEqual([1])
    expect(result.mixed).toEqual(paint)
  })

  it('matches the converged gradient-descent answer for the canonical regression target, using at most 4 paints', () => {
    // #7BD5D5 turns out not to be an exactly-reachable point for this
    // palette (transformedErrorSquared is tiny but nonzero) — both this
    // solver and the legacy iterative one land on the same closest
    // reachable point, which rounds to the identical displayed RGB.
    const paints = hexPaints(['#ffffff', '#000000', '#ff0000', '#ffff00', '#0000ff'])
    const result = solvePaintMixGeometric(paints, hexToRgb('#7BD5D5'))!

    expect(result.mixed).toEqual({ r: 124, g: 208, b: 212 })
    expect(result.transformedErrorSquared).toBeLessThan(1e-3)
    expect(result.activePaintIndices.length).toBeLessThanOrEqual(4)
  })

  it('finds the closest reachable point (<=3 active paints) for a target outside the hull', () => {
    // A tightly clustered palette can't reach a target on the opposite side of the color cube.
    const paints = hexPaints(['#645a50', '#6a6050', '#645f5a', '#605a55'])
    const target = hexToRgb('#00ff00')
    const result = solvePaintMixGeometric(paints, target)!

    expect(result.mode).toBe('outside-hull')
    expect(result.error).toBeGreaterThan(0)
    expect(result.activePaintIndices.length).toBeLessThanOrEqual(3)
    // The weights actually used should match where the reported active indices are.
    result.activePaintIndices.forEach((i) => expect(result.weights[i]).toBeGreaterThan(0))
  })

  it('two-paint palettes fall back to a segment (line) solve', () => {
    const paints = hexPaints(['#000000', '#ffffff'])
    const result = solvePaintMixGeometric(paints, hexToRgb('#808080'))!
    expect(result.weights.length).toBe(2)
    expect(result.weights[0] + result.weights[1]).toBeCloseTo(1)
  })

  it('never returns a NaN/non-finite result, even for a degenerate (identical-color) palette', () => {
    const paints = hexPaints(['#808080', '#808080', '#808080', '#808080', '#808080'])
    const result = solvePaintMixGeometric(paints, hexToRgb('#ff0000'))
    if (result) {
      expect(Number.isFinite(result.mixed.r)).toBe(true)
      expect(Number.isFinite(result.mixed.g)).toBe(true)
      expect(Number.isFinite(result.mixed.b)).toBe(true)
      expect(result.weights.every(Number.isFinite)).toBe(true)
    }
    // If it returns something non-finite instead, the public dispatcher
    // (tested below) must catch it and fall back to the iterative solver.
  })
})

describe('solvePaintMix dispatcher', () => {
  it('produces a finite, valid result even for the degenerate identical-color case', () => {
    const paints = hexPaints(['#808080', '#808080', '#808080', '#808080', '#808080'])
    const result = solvePaintMix(paints, hexToRgb('#ff0000'))!
    expect(result).not.toBeNull()
    expect(Number.isFinite(result.mixed.r)).toBe(true)
    expect(result.weights.every(Number.isFinite)).toBe(true)
    expect(Math.abs(result.weights.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-6)
  })

  it('falls back to the iterative solver above MAX_GEOMETRIC_PAINTS', () => {
    const paints: ReturnType<typeof hexToRgb>[] = []
    for (let i = 0; i < MAX_GEOMETRIC_PAINTS + 5; i += 1) {
      paints.push({ r: (i * 37) % 256, g: (i * 59) % 256, b: (i * 83) % 256 })
    }
    const result = solvePaintMix(paints, { r: 130, g: 90, b: 160 })!
    expect(result).not.toBeNull()
    expect(result.weights.length).toBe(paints.length)
    expect(Number.isFinite(result.mixed.r)).toBe(true)
  })

  it('solvePaintMixHex matches solvePaintMix for the same inputs', () => {
    const hexes = ['#1b3f8b', '#f2c230', '#f5f3ee']
    const viaHex = solvePaintMixHex(hexes, '#9d9a84')!
    const viaRgb = solvePaintMix(hexPaints(hexes), hexToRgb('#9d9a84'))!
    expect(viaHex.mixed).toEqual(viaRgb.mixed)
  })
})
