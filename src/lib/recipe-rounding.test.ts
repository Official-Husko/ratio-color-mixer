import { describe, expect, it } from 'vitest'
import { hexToRgb } from './color-math'
import { allocateRoundedVolumes, evaluateRecipeColor, refineDiscreteRecipe } from './recipe-rounding'

describe('allocateRoundedVolumes', () => {
  it('always sums to exactly the requested total, unlike independent rounding', () => {
    // Regression case: 39/30/31% independently rounded (Math.round) at
    // totalMl=250 gives 98/75/78 = 251, not 250.
    const volumes = allocateRoundedVolumes([0.39, 0.3, 0.31], 250, 1)
    expect(volumes.reduce((a, b) => a + b, 0)).toBeCloseTo(250)
    expect(volumes.every((v) => Number.isInteger(v))).toBe(true)
  })

  it('respects the measurement step (every amount is a whole multiple of it)', () => {
    const step = 5
    const volumes = allocateRoundedVolumes([0.6, 0.25, 0.15], 250, step)
    expect(volumes.reduce((a, b) => a + b, 0)).toBeCloseTo(250)
    for (const v of volumes) expect(Math.round(v / step)).toBeCloseTo(v / step)
  })

  it('never allocates a negative amount', () => {
    const volumes = allocateRoundedVolumes([0.001, 0.001, 0.998], 250, 1)
    expect(volumes.every((v) => v >= 0)).toBe(true)
  })

  it('handles a single-paint (100%) recipe', () => {
    expect(allocateRoundedVolumes([1], 250, 1)).toEqual([250])
  })
})

describe('evaluateRecipeColor', () => {
  it('gives zero error when mixing a single paint that equals the target', () => {
    const white = hexToRgb('#ffffff')
    const result = evaluateRecipeColor([white], [100], white)
    expect(result.error).toBeCloseTo(0)
    expect(result.mixed).toEqual(white)
  })

  it('normalizes by the volume total rather than requiring it to already be 1', () => {
    const paints = [hexToRgb('#ffffff'), hexToRgb('#000000')]
    const a = evaluateRecipeColor(paints, [50, 50], hexToRgb('#808080'))
    const b = evaluateRecipeColor(paints, [1, 1], hexToRgb('#808080')) // same ratio, different scale
    expect(a.mixed).toEqual(b.mixed)
  })
})

describe('refineDiscreteRecipe', () => {
  it('never makes the color match worse than the starting rounded recipe', () => {
    const paints = [hexToRgb('#1b3f8b'), hexToRgb('#f2c230'), hexToRgb('#f5f3ee')]
    const target = hexToRgb('#9d9a84')
    const initialVolumes = allocateRoundedVolumes([0.39, 0.3, 0.31], 250, 1)
    const initialEval = evaluateRecipeColor(paints, initialVolumes, target)

    const refined = refineDiscreteRecipe(paints, initialVolumes, target, 1)

    expect(refined.evaluation.error).toBeLessThanOrEqual(initialEval.error + 1e-9)
  })

  it('preserves the total volume across every transfer', () => {
    const paints = [hexToRgb('#1b3f8b'), hexToRgb('#f2c230'), hexToRgb('#f5f3ee')]
    const target = hexToRgb('#9d9a84')
    const initialVolumes = allocateRoundedVolumes([0.39, 0.3, 0.31], 250, 1)
    const totalBefore = initialVolumes.reduce((a, b) => a + b, 0)

    const refined = refineDiscreteRecipe(paints, initialVolumes, target, 1)
    const totalAfter = refined.volumes.reduce((a, b) => a + b, 0)

    expect(totalAfter).toBeCloseTo(totalBefore)
  })

  it('is a no-op for a single paint', () => {
    const paints = [hexToRgb('#ffffff')]
    const refined = refineDiscreteRecipe(paints, [250], hexToRgb('#ffffff'), 1)
    expect(refined.volumes).toEqual([250])
  })
})
