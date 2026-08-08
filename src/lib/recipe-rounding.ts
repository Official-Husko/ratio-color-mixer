import { approxRybToRgb, colorDistance, rgbToApproxRyb, weightedMix, type Rgb } from './color-math'

/**
 * Largest-remainder (Hamilton) apportionment of continuous weights into
 * whole multiples of `stepMl`, guaranteeing the allocated amounts always
 * sum to exactly `totalMl` (rounded to the nearest step) — unlike rounding
 * each amount independently, which isn't guaranteed to (three colors at
 * 39/31/30% independently round to 98/78/74ml... which is fine, but at
 * 39/30.5/30.5% they'd round to 98/76/76 = 250, while other splits can
 * silently drift off the batch total by a step or more). See
 * paint_mixer_optimization_docs/04_PRACTICAL_VOLUME_AND_INTEGER_REFINEMENT.md §3.
 */
export function allocateRoundedVolumes(weights: number[], totalMl: number, stepMl: number): number[] {
  if (stepMl <= 0 || !Number.isFinite(stepMl)) return weights.map((w) => w * totalMl)

  const totalUnits = Math.round(totalMl / stepMl)
  const exactUnits = weights.map((w) => w * totalUnits)
  const units = exactUnits.map(Math.floor)
  const usedUnits = units.reduce((sum, v) => sum + v, 0)
  const remaining = totalUnits - usedUnits

  const byRemainderDesc = exactUnits
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder)

  for (let i = 0; i < remaining && i < byRemainderDesc.length; i += 1) {
    units[byRemainderDesc[i].index] += 1
  }

  return units.map((u) => u * stepMl)
}

export interface RecipeEvaluation {
  mixed: Rgb
  error: number
}

/** Predicted mixed color and color-distance-to-target for a discrete set of paint volumes (any consistent unit — only their ratios matter). */
export function evaluateRecipeColor(paints: Rgb[], volumes: number[], target: Rgb): RecipeEvaluation {
  const total = volumes.reduce((sum, v) => sum + v, 0)
  const weights = total > 0 ? volumes.map((v) => v / total) : volumes.map(() => 0)
  const mixed = approxRybToRgb(weightedMix(paints.map(rgbToApproxRyb), weights))
  return { mixed, error: colorDistance(mixed, target) }
}

export interface DiscreteRefinementResult {
  volumes: number[]
  evaluation: RecipeEvaluation
}

const MAX_REFINEMENT_PASSES = 25
const IMPROVEMENT_EPS = 1e-9

/**
 * Starting from a largest-remainder-rounded recipe, repeatedly tries moving
 * one measurement step from one paint to another (every ordered pair),
 * keeping any move that improves the predicted color match, until no single
 * transfer helps. Largest-remainder alone minimizes *volume* rounding
 * error; this instead directly minimizes *color* error, which is the
 * actual goal. Cheap because it only ever runs over the small active paint
 * set (typically ≤4 — see 01_GEOMETRIC_SOLVER.md's Carathéodory argument),
 * not the whole palette. See 04_PRACTICAL_VOLUME_AND_INTEGER_REFINEMENT.md §§6-8.
 */
export function refineDiscreteRecipe(
  paints: Rgb[],
  initialVolumes: number[],
  target: Rgb,
  stepMl: number,
): DiscreteRefinementResult {
  let bestVolumes = [...initialVolumes]
  let best = evaluateRecipeColor(paints, bestVolumes, target)

  if (stepMl <= 0 || !Number.isFinite(stepMl) || paints.length < 2) {
    return { volumes: bestVolumes, evaluation: best }
  }

  let improved = true
  let pass = 0
  while (improved && pass < MAX_REFINEMENT_PASSES) {
    improved = false
    pass += 1

    for (let from = 0; from < paints.length; from += 1) {
      if (bestVolumes[from] < stepMl) continue

      for (let to = 0; to < paints.length; to += 1) {
        if (from === to) continue

        const candidateVolumes = [...bestVolumes]
        candidateVolumes[from] -= stepMl
        candidateVolumes[to] += stepMl

        const candidate = evaluateRecipeColor(paints, candidateVolumes, target)
        if (candidate.error < best.error - IMPROVEMENT_EPS) {
          best = candidate
          bestVolumes = candidateVolumes
          improved = true
        }
      }
    }
  }

  return { volumes: bestVolumes, evaluation: best }
}
