export interface Rgb {
  r: number
  g: number
  b: number
}

export interface MixResult {
  weights: number[]
  percentages: number[]
  mixed: Rgb
  error: number
  transformedErrorSquared: number
  iterations: number
}

export interface VisibleMixRow {
  index: number
  hex: string
  rgb: Rgb
  weight: number
  percentage: number
}

const ITERATIONS = 500
const INITIAL_STEP = 0.25
const MIN_STEP = 0.0001
const MAX_STEP = 1
const STEP_GROWTH = 1.05
const STEP_SHRINK = 0.5

export function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function hexToRgb(hex: string): Rgb {
  let digits = String(hex).trim().replace(/^#/, '')
  digits = digits.length === 3 ? [...digits].map((c) => c + c).join('') : digits.padStart(6, '0').slice(0, 6)

  return {
    r: Number.parseInt(digits.slice(0, 2), 16),
    g: Number.parseInt(digits.slice(2, 4), 16),
    b: Number.parseInt(digits.slice(4, 6), 16),
  }
}

export function rgbToHex(rgb: Rgb): string {
  const channel = (value: number) => clampByte(value).toString(16).padStart(2, '0')
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`
}

export function formatRgb(rgb: Rgb): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
}

export function squaredDistance(a: Rgb, b: Rgb): number {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2
}

export function colorDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt(squaredDistance(a, b))
}

export function weightedMix(colors: Rgb[], weights: number[]): Rgb {
  const mix: Rgb = { r: 0, g: 0, b: 0 }
  colors.forEach((color, index) => {
    const w = weights[index] ?? 0
    mix.r += color.r * w
    mix.g += color.g * w
    mix.b += color.b * w
  })
  return mix
}

/**
 * Euclidean projection of a vector onto the probability simplex
 * { w : w_i >= 0, sum(w_i) = 1 }. Standard sort-and-threshold algorithm
 * (Duchi et al.) — needed because paint proportions can't be negative and
 * must add up to a whole batch.
 */
export function projectOntoSimplex(values: number[]): number[] {
  if (values.length === 0) return []

  const descending = [...values].sort((a, b) => b - a)

  let runningSum = 0
  let lastValidRank = 0
  for (let rank = 1; rank <= descending.length; rank += 1) {
    runningSum += descending[rank - 1]
    const candidateTheta = (runningSum - 1) / rank
    if (descending[rank - 1] - candidateTheta > 0) lastValidRank = rank
  }

  const activeSum = descending.slice(0, lastValidRank).reduce((sum, v) => sum + v, 0)
  const theta = (activeSum - 1) / lastValidRank

  return values.map((v) => Math.max(v - theta, 0))
}

/**
 * Approximate painter's RYB space from screen RGB. RGB mixing looks nothing
 * like paint mixing (blue+yellow should make green, not gray), so before
 * solving for proportions we move into a red/yellow/blue-ish space where
 * a straight weighted average behaves more like pigment mixing.
 *
 * The {r,g,b} keys are kept so this can flow through the same distance/mix
 * helpers as ordinary RGB — here they mean Red, Yellow, Blue respectively.
 */
export function rgbToApproxRyb(rgb: Rgb): Rgb {
  let red = rgb.r / 255
  let green = rgb.g / 255
  let blue = rgb.b / 255

  const white = Math.min(red, green, blue)
  red -= white
  green -= white
  blue -= white

  const chromaBefore = Math.max(red, green, blue)

  // Yellow lives where red and green overlap in RGB.
  const yellow0 = Math.min(red, green)
  red -= yellow0
  green -= yellow0

  // Remaining green competes with blue for influence; split it.
  let residualGreen = green
  let blueOut = blue
  if (blueOut > 0 && residualGreen > 0) {
    blueOut *= 0.5
    residualGreen *= 0.5
  }

  const yellowOut = yellow0 + residualGreen
  blueOut += residualGreen

  const chromaAfter = Math.max(red, yellowOut, blueOut)
  const scale = chromaAfter > 0 ? chromaBefore / chromaAfter : 1

  return {
    r: red * scale + white,
    g: yellowOut * scale + white,
    b: blueOut * scale + white,
  }
}

/** Inverse of {@link rgbToApproxRyb}, returning clamped 0-255 display RGB. */
export function approxRybToRgb(ryb: Rgb): Rgb {
  let red = ryb.r
  let yellow = ryb.g
  let blue = ryb.b

  const white = Math.min(red, yellow, blue)
  red -= white
  yellow -= white
  blue -= white

  const chromaBefore = Math.max(red, yellow, blue)

  const green0 = Math.min(yellow, blue)
  yellow -= green0
  blue -= green0

  let greenOut = green0
  if (blue > 0 && greenOut > 0) {
    blue *= 2
    greenOut *= 2
  }

  const redOut = red + yellow
  greenOut += yellow

  const chromaAfter = Math.max(redOut, greenOut, blue)
  const scale = chromaAfter > 0 ? chromaBefore / chromaAfter : 1

  return {
    r: clampByte(255 * (redOut * scale + white)),
    g: clampByte(255 * (greenOut * scale + white)),
    b: clampByte(255 * (blue * scale + white)),
  }
}

export interface SolveOptions {
  iterations?: number
  initialStep?: number
}

/**
 * Solve for non-negative paint proportions (summing to 1) that best
 * reproduce `targetRgb` when mixed, using projected gradient descent in
 * RYB space with an adaptive step size.
 *
 * This intentionally targets the same numeric behavior documented in
 * digitpaints_color_math_study/ALGORITHM.md (a fresh implementation of the
 * published RYB-approximation + simplex-projection technique, not a port
 * of that study's code — see its NOTICE.md).
 *
 * This is no longer the primary solver — see solve-paint-mix.ts, which
 * prefers the geometric solver (geometric-solver.ts) and falls back to this
 * one. Kept here as the legacy/validation/fallback implementation per
 * paint_mixer_optimization_docs/06_IMPLEMENTATION_ROADMAP.md ("Phase 11 —
 * Optimizer Fallback").
 */
export function solvePaintMixIterative(paints: Rgb[], targetRgb: Rgb, options: SolveOptions = {}): MixResult | null {
  if (paints.length === 0) return null

  if (paints.length === 1) {
    const only = paints[0]
    return {
      weights: [1],
      percentages: [100],
      mixed: only,
      error: colorDistance(only, targetRgb),
      transformedErrorSquared: squaredDistance(rgbToApproxRyb(only), rgbToApproxRyb(targetRgb)),
      iterations: 0,
    }
  }

  const iterations = options.iterations ?? ITERATIONS
  let step = options.initialStep ?? INITIAL_STEP

  const paintsRyb = paints.map(rgbToApproxRyb)
  const targetRyb = rgbToApproxRyb(targetRgb)

  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY
  paints.forEach((paint, index) => {
    const d2 = squaredDistance(paint, targetRgb)
    if (d2 < nearestDistance) {
      nearestDistance = d2
      nearestIndex = index
    }
  })

  let weights: number[] = paints.map((_, index) => (index === nearestIndex ? 1 : 0))
  let bestWeights: number[] = weights
  let bestError = squaredDistance(weightedMix(paintsRyb, weights), targetRyb)

  for (let step_i = 0; step_i < iterations; step_i += 1) {
    const mix = weightedMix(paintsRyb, weights)
    const residual: Rgb = { r: mix.r - targetRyb.r, g: mix.g - targetRyb.g, b: mix.b - targetRyb.b }

    // grad_i f(w) = 2 * dot(residual, paint_i) for f(w) = ||Cw - t||^2
    const gradient = paintsRyb.map(
      (paint) => 2 * (residual.r * paint.r + residual.g * paint.g + residual.b * paint.b),
    )

    const candidate = projectOntoSimplex(weights.map((w, i) => w - step * gradient[i]))
    const candidateError = squaredDistance(weightedMix(paintsRyb, candidate), targetRyb)

    if (candidateError <= bestError) {
      weights = candidate
      bestWeights = candidate
      bestError = candidateError
      step = Math.min(step * STEP_GROWTH, MAX_STEP)
    } else {
      step = Math.max(step * STEP_SHRINK, MIN_STEP)
    }
  }

  const finalWeights = projectOntoSimplex(bestWeights)
  const mixedRgb = approxRybToRgb(weightedMix(paintsRyb, finalWeights))

  return {
    weights: finalWeights,
    percentages: finalWeights.map((w) => 100 * w),
    mixed: mixedRgb,
    error: colorDistance(mixedRgb, targetRgb),
    transformedErrorSquared: bestError,
    iterations,
  }
}

/** Hex convenience wrapper for {@link solvePaintMixIterative} — mainly for tests exercising the fallback path directly. */
export function solvePaintMixIterativeHex(paintHexes: string[], targetHex: string, options: SolveOptions = {}): MixResult | null {
  return solvePaintMixIterative(paintHexes.map(hexToRgb), hexToRgb(targetHex), options)
}

/** Presentation helper: drop rows that round to 0.0%, sort largest-first. */
export function visibleMixRows(paintHexes: string[], result: MixResult | null): VisibleMixRow[] {
  if (!result) return []

  return paintHexes
    .map((hex, index) => ({
      index,
      hex,
      rgb: hexToRgb(hex),
      weight: result.weights[index] ?? 0,
      percentage: 100 * (result.weights[index] ?? 0),
    }))
    .filter((row) => Number(row.percentage.toFixed(1)) > 0)
    .sort((a, b) => b.weight - a.weight)
}
