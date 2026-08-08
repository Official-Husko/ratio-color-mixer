import { describe, expect, it } from 'vitest'
import { solvePaintMixHex, type MixResult } from './color-math'
import { buildViewModel } from './recipe'
import type { ColorItem } from '../types'

function makeColors(entries: Array<{ hex: string; name?: string }>): ColorItem[] {
  return entries.map((c, i) => ({ id: String(i), hex: c.hex, name: c.name ?? '' }))
}

function fakeResult(weights: number[]): MixResult {
  return {
    weights,
    percentages: weights.map((w) => w * 100),
    mixed: { r: 0, g: 0, b: 0 },
    error: 0,
    transformedErrorSquared: 0,
    iterations: 0,
  }
}

describe('buildViewModel recipe (ml-only)', () => {
  it('recipe lines are always in ml, even in percentage unit mode', () => {
    const colors = makeColors([{ hex: '#1b3f8b' }, { hex: '#f2c230' }, { hex: '#f5f3ee' }])
    const result = solvePaintMixHex(colors.map((c) => c.hex), '#9d9a84')
    const vm = buildViewModel(colors, '#9d9a84', result, 250, 'percentage', 'added')

    expect(vm.recipeItems.length).toBeGreaterThan(0)
    for (const item of vm.recipeItems) {
      expect(item.recipeLine).toMatch(/^\d+(\.\d+)? ml — /)
    }
  })

  it('produces identical recipe lines in percentage mode and ml mode', () => {
    const colors = makeColors([{ hex: '#1b3f8b' }, { hex: '#f2c230' }, { hex: '#f5f3ee' }])
    const result = solvePaintMixHex(colors.map((c) => c.hex), '#9d9a84')
    const vmPercent = buildViewModel(colors, '#9d9a84', result, 250, 'percentage', 'added')
    const vmMl = buildViewModel(colors, '#9d9a84', result, 250, 'ml', 'added')

    expect(vmPercent.recipeItems.map((r) => r.recipeLine)).toEqual(vmMl.recipeItems.map((r) => r.recipeLine))
  })

  it('shows an exact decimal ml amount for a trace contributor instead of a bare "0 ml"', () => {
    const colors = makeColors([
      { hex: '#e3372f', name: 'Red' },
      { hex: '#2fb6c9', name: 'Cyan' },
      { hex: '#f2f2f2', name: 'White' },
    ])
    // Red dominates; Cyan is a small-but-real contributor; White is trace
    // enough that 250ml * weight rounds to 0ml.
    const result = fakeResult([0.997, 0.002, 0.001])
    const vm = buildViewModel(colors, '#e3372f', result, 250, 'percentage', 'added')

    const whiteLine = vm.recipeItems.find((r) => r.displayName === 'White')
    expect(whiteLine).toBeDefined()
    expect(whiteLine!.recipeLine).toBe('0.25 ml — White')
    expect(whiteLine!.recipeLine).not.toContain('0 ml —')

    const cyanLine = vm.recipeItems.find((r) => r.displayName === 'Cyan')
    expect(cyanLine!.recipeLine).toBe('1 ml — Cyan')
  })

  it('recipe includes exactly the same colors as the Mix ratio rows', () => {
    const colors = makeColors([{ hex: '#e3372f' }, { hex: '#2fb6c9' }, { hex: '#f2f2f2' }, { hex: '#0d0d0d' }])
    const result = fakeResult([0.997, 0.002, 0.001, 0])
    const vm = buildViewModel(colors, '#e3372f', result, 250, 'percentage', 'added')

    expect(vm.recipeItems.length).toBe(vm.colors.length)
  })
})
