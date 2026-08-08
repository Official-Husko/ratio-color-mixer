import { describe, expect, it } from 'vitest'
import {
  approxRybToRgb,
  hexToRgb,
  projectOntoSimplex,
  rgbToApproxRyb,
  solvePaintMixHex,
  visibleMixRows,
} from './color-math'

describe('projectOntoSimplex', () => {
  it('always returns non-negative weights that sum to 1', () => {
    const projected = projectOntoSimplex([0.8, 0.5, -0.1, 0.4])
    for (const value of projected) expect(value).toBeGreaterThanOrEqual(0)
    const sum = projected.reduce((a, b) => a + b, 0)
    expect(Math.abs(sum - 1)).toBeLessThan(1e-12)
  })
})

describe('RGB <-> RYB round trip', () => {
  it('recovers the original channel values within +/-1', () => {
    const hexes = ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#7bd5d5']
    for (const hex of hexes) {
      const original = hexToRgb(hex)
      const roundTripped = approxRybToRgb(rgbToApproxRyb(original))
      expect(Math.abs(roundTripped.r - original.r)).toBeLessThanOrEqual(1)
      expect(Math.abs(roundTripped.g - original.g)).toBeLessThanOrEqual(1)
      expect(Math.abs(roundTripped.b - original.b)).toBeLessThanOrEqual(1)
    }
  })
})

describe('solvePaintMixHex canonical regression', () => {
  it('matches the documented white/black/red/yellow/blue -> #7BD5D5 mix', () => {
    const paints = ['#ffffff', '#000000', '#ff0000', '#ffff00', '#0000ff']
    const result = solvePaintMixHex(paints, '#7BD5D5')

    expect(result).not.toBeNull()
    expect(result!.mixed).toEqual({ r: 124, g: 208, b: 212 })

    const rows = visibleMixRows(paints, result).map(
      (row) => [row.hex, row.percentage.toFixed(1)] as const,
    )
    expect(rows).toEqual([
      ['#ffffff', '48.6'],
      ['#0000ff', '34.5'],
      ['#ffff00', '16.9'],
    ])
  })
})

describe('solvePaintMixHex live-tool cross-check', () => {
  it('matches a mix independently recorded from the live DigitPaints tool', () => {
    // Paints/target/expected output copied from a real session against the
    // live tool (not from the study's fixtures) as an independent parity check.
    const paints = ['#D1001C', '#FFE800', '#FFFEFE', '#000000', '#2A92D0']
    const result = solvePaintMixHex(paints, '#624F4D')

    expect(result).not.toBeNull()
    expect(result!.mixed).toEqual({ r: 98, g: 79, b: 77 })

    const rows = visibleMixRows(paints, result).map(
      (row) => [row.hex, row.percentage.toFixed(1)] as const,
    )
    expect(rows).toEqual([
      ['#D1001C', '38.3'],
      ['#2A92D0', '31.9'],
      ['#FFE800', '17.8'],
      ['#000000', '12.0'],
    ])
  })
})

describe('solvePaintMixHex single paint', () => {
  it('returns the sole paint as a 100% weight with no optimization', () => {
    const result = solvePaintMixHex(['#123456'], '#abcdef')

    expect(result).not.toBeNull()
    expect(result!.weights).toEqual([1])
    expect(result!.percentages).toEqual([100])
    expect(result!.mixed).toEqual(hexToRgb('#123456'))
  })
})
