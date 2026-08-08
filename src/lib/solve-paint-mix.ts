import { hexToRgb, solvePaintMixIterative, type MixResult, type Rgb, type SolveOptions } from './color-math'
import { solvePaintMixGeometric, MAX_GEOMETRIC_PAINTS } from './geometric-solver'

function isFiniteResult(result: MixResult): boolean {
  return (
    result.weights.every(Number.isFinite) &&
    Number.isFinite(result.mixed.r) &&
    Number.isFinite(result.mixed.g) &&
    Number.isFinite(result.mixed.b)
  )
}

/**
 * Public paint-mixing solver. Prefers the geometric solver
 * (geometric-solver.ts) — deterministic, naturally sparse (≤4 active
 * paints per Carathéodory's theorem), and far cheaper than iterative
 * descent — falling back to the legacy projected-gradient-descent solver
 * (color-math.ts) when the palette is too large for combinatorial search to
 * stay cheap (see MAX_GEOMETRIC_PAINTS) or when the geometric attempt hits
 * degenerate numerics (e.g. every paint collapsing to the same or collinear
 * transformed point, producing a non-finite result).
 *
 * See paint_mixer_optimization_docs/06_IMPLEMENTATION_ROADMAP.md — this is
 * the "Recommended First Upgrade" from that pack's README, implemented as a
 * drop-in replacement so every existing caller keeps working unchanged.
 */
export function solvePaintMix(paints: Rgb[], targetRgb: Rgb, options: SolveOptions = {}): MixResult | null {
  if (paints.length === 0) return null

  if (paints.length <= MAX_GEOMETRIC_PAINTS) {
    const geometric = solvePaintMixGeometric(paints, targetRgb)
    if (geometric && isFiniteResult(geometric)) return geometric
  }

  return solvePaintMixIterative(paints, targetRgb, options)
}

export function solvePaintMixHex(paintHexes: string[], targetHex: string, options: SolveOptions = {}): MixResult | null {
  return solvePaintMix(paintHexes.map(hexToRgb), hexToRgb(targetHex), options)
}
