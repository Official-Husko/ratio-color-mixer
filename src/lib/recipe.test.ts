import { describe, expect, it } from 'vitest'
import { approxRybToRgb, hexToRgb, rgbToHex, weightedMix, rgbToApproxRyb, type MixResult } from './color-math'
import { solvePaintMixHex } from './solve-paint-mix'
import { buildViewModel } from './recipe'
import type { ColorItem } from '../types'

function makeColors(entries: Array<{ hex: string; name?: string }>): ColorItem[] {
  return entries.map((c, i) => ({ id: String(i), hex: c.hex, name: c.name ?? '' }))
}

/** The RGB (as hex) that these weights actually mix to, via the real RYB pipeline — for building test fixtures that are internally consistent (so refinement has nothing to "correct"). */
function mixToHex(hexes: string[], weights: number[]): string {
  const rybMix = weightedMix(hexes.map(hexToRgb).map(rgbToApproxRyb), weights)
  return rgbToHex(approxRybToRgb(rybMix))
}

function fakeResult(weights: number[], mixed: { r: number; g: number; b: number }): MixResult {
  return {
    weights,
    percentages: weights.map((w) => w * 100),
    mixed,
    error: 0,
    transformedErrorSquared: 0,
    iterations: 0,
  }
}

describe('buildViewModel recipe (volume-only, unit-aware)', () => {
  it('recipe lines are always a volume, even in percentage unit mode', () => {
    const colors = makeColors([{ hex: '#1b3f8b' }, { hex: '#f2c230' }, { hex: '#f5f3ee' }])
    const result = solvePaintMixHex(colors.map((c) => c.hex), '#9d9a84')
    const vm = buildViewModel(colors, '#9d9a84', result, 250, 'percentage', 'ml', 'added')

    expect(vm.recipeItems.length).toBeGreaterThan(0)
    for (const item of vm.recipeItems) {
      expect(item.recipeLine).toMatch(/^\d+(\.\d+)? mL — /)
    }
  })

  it('produces identical recipe lines in percentage mode and volume mode', () => {
    const colors = makeColors([{ hex: '#1b3f8b' }, { hex: '#f2c230' }, { hex: '#f5f3ee' }])
    const result = solvePaintMixHex(colors.map((c) => c.hex), '#9d9a84')
    const vmPercent = buildViewModel(colors, '#9d9a84', result, 250, 'percentage', 'ml', 'added')
    const vmVolume = buildViewModel(colors, '#9d9a84', result, 250, 'ml', 'ml', 'added')

    expect(vmPercent.recipeItems.map((r) => r.recipeLine)).toEqual(vmVolume.recipeItems.map((r) => r.recipeLine))
  })

  it('shows a trace-precision fallback when a real contributor rounds to 0 discrete units', () => {
    const hexes = ['#e3372f', '#2fb6c9', '#f2f2f2']
    const colors = makeColors([
      { hex: hexes[0], name: 'Red' },
      { hex: hexes[1], name: 'Cyan' },
      { hex: hexes[2], name: 'White' },
    ])
    // Red dominates; Cyan is a small-but-real contributor; White is trace
    // enough that 250ml * weight rounds to 0ml — the fixture's target is
    // derived from these exact weights so it's internally consistent (no
    // improving move exists for the refinement pass to find).
    const weights = [0.997, 0.002, 0.001]
    const targetHex = mixToHex(hexes, weights)
    const result = fakeResult(weights, hexToRgb(targetHex))
    const vm = buildViewModel(colors, targetHex, result, 250, 'percentage', 'ml', 'added')

    const whiteLine = vm.recipeItems.find((r) => r.displayName === 'White')
    expect(whiteLine).toBeDefined()
    // Largest-remainder rounding may legitimately give White's single spare
    // unit to Cyan instead (both have the same 0.25/0.5 remainder profile) —
    // either way, White must never render as a bare "0 mL" that erases its
    // real (if tiny) contribution.
    expect(whiteLine!.recipeLine).not.toContain('0 mL —')
  })

  it('recipe includes exactly the same colors as the Mix ratio rows', () => {
    const hexes = ['#e3372f', '#2fb6c9', '#f2f2f2', '#0d0d0d']
    const weights = [0.997, 0.002, 0.001, 0]
    const colors = makeColors(hexes.map((hex) => ({ hex })))
    const targetHex = mixToHex(hexes, weights)
    const result = fakeResult(weights, hexToRgb(targetHex))
    const vm = buildViewModel(colors, targetHex, result, 250, 'percentage', 'ml', 'added')

    expect(vm.recipeItems.length).toBe(vm.colors.length)
  })

  it('recipe re-formats in the chosen volume unit (US gallon) instead of mL, still summing to the batch', () => {
    const hexes = ['#e3372f', '#2fb6c9']
    const weights = [0.75, 0.25]
    const colors = makeColors([
      { hex: hexes[0], name: 'Red' },
      { hex: hexes[1], name: 'Cyan' },
    ])
    const targetHex = mixToHex(hexes, weights)
    const result = fakeResult(weights, hexToRgb(targetHex))
    // 3785.41mL batch (~1 US gallon)
    const totalMl = 3785.411784
    const vm = buildViewModel(colors, targetHex, result, totalMl, 'percentage', 'us_gallon', 'added')

    for (const item of vm.recipeItems) expect(item.recipeLine).toMatch(/US gal — /)

    // The two practical amounts should still add up to the full batch.
    const totalGallons = vm.recipeItems.reduce((sum, item) => sum + Number(item.recipeLine.split(' ')[0]), 0)
    expect(totalGallons).toBeCloseTo(totalMl / 3785.411784, 1)
  })
})
