import { colorDistance, hexToRgb, rgbToHex, type MixResult } from './color-math'
import { formatVolumeExact, formatVolumeSmart, stepMlFor, type VolumeUnit } from './units'
import { allocateRoundedVolumes, refineDiscreteRecipe } from './recipe-rounding'
import type { ColorItem, MatchBadge, RecipeItem, SortMode, UnitMode, ViewModel } from '../types'

const MAX_RGB_DISTANCE = Math.sqrt(3) * 255
const SIMPLIFY_KEEP_THRESHOLD = 0.05

function computeMatch(mixed: { r: number; g: number; b: number }, target: { r: number; g: number; b: number }): number {
  const distance = colorDistance(mixed, target)
  const match = Math.round(100 * (1 - distance / MAX_RGB_DISTANCE))
  return Math.max(0, Math.min(100, match))
}

function matchBadgeFor(match: number): MatchBadge {
  return match >= 90
    ? { bg: 'rgba(125,224,201,0.16)', text: '#7de0c9' }
    : { bg: 'rgba(255,255,255,0.06)', text: '#a0a0a0' }
}

/** Picks the best subset of colors to drop, keeping at least 2 with weight >= 5%. */
export function pickSimplifiedColors(colors: ColorItem[], weights: number[]): ColorItem[] {
  const ranked = colors
    .map((color, index) => ({ color, weight: weights[index] ?? 0 }))
    .sort((a, b) => b.weight - a.weight)

  let kept = ranked.filter((r) => r.weight >= SIMPLIFY_KEEP_THRESHOLD).map((r) => r.color)
  if (kept.length < 2) kept = ranked.slice(0, 2).map((r) => r.color)
  return kept
}

/**
 * Largest-remainder-rounds the continuous weights into practical, measurable
 * amounts for the current volume unit, then locally refines that discrete
 * recipe to minimize predicted color error (see recipe-rounding.ts). This is
 * the "practical recipe layer" from
 * paint_mixer_optimization_docs/04_PRACTICAL_VOLUME_AND_INTEGER_REFINEMENT.md —
 * distinct from, and layered on top of, the continuous ideal weights.
 */
function buildPracticalVolumes(colors: ColorItem[], weights: number[], targetRgb: { r: number; g: number; b: number }, totalMl: number, volumeUnit: VolumeUnit): number[] {
  if (colors.length === 0) return []

  const stepMl = stepMlFor(volumeUnit)
  const roundedVolumes = allocateRoundedVolumes(weights, totalMl, stepMl)

  const activeIndices = roundedVolumes.map((_, i) => i).filter((i) => roundedVolumes[i] > 0)
  if (activeIndices.length < 2) return roundedVolumes

  const activePaints = activeIndices.map((i) => hexToRgb(colors[i].hex))
  const activeVolumes = activeIndices.map((i) => roundedVolumes[i])
  const refinement = refineDiscreteRecipe(activePaints, activeVolumes, targetRgb, stepMl)

  const refinedVolumes = [...roundedVolumes]
  activeIndices.forEach((paintIndex, k) => {
    refinedVolumes[paintIndex] = refinement.volumes[k]
  })
  return refinedVolumes
}

export function buildViewModel(
  colors: ColorItem[],
  target: string,
  result: MixResult | null,
  totalMl: number,
  unitMode: UnitMode,
  volumeUnit: VolumeUnit,
  sortMode: SortMode,
): ViewModel {
  const weights = result?.weights ?? colors.map(() => 0)
  const mixedRgb = result?.mixed ?? hexToRgb(target)
  const targetRgb = hexToRgb(target)

  const practicalVolumes = buildPracticalVolumes(colors, weights, targetRgb, totalMl, volumeUnit)

  // A weight that rounds to 0.0% at one decimal is treated as a true zero and
  // dropped from the mix ratio entirely (matches the solver's own visible-row
  // convention). Anything above that threshold stays, even if it rounds to a
  // bare "0%" (or "0 <unit>") — those show as "<1%" / a precise fraction of
  // the unit instead, so a real (if small) contribution never reads as "not used".
  let rows = colors
    .map((color, index) => ({ color, index, weight: weights[index] ?? 0, practicalMl: practicalVolumes[index] ?? 0 }))
    .filter(({ weight }) => Number((weight * 100).toFixed(1)) > 0)
    .map(({ color, index, weight, practicalMl }) => {
      const exactPercent = weight * 100
      const exactMl = weight * totalMl
      const percent = Math.round(exactPercent)
      const belowOnePercent = percent === 0
      // The largest-remainder allocation can legitimately round a real but
      // sub-measurement-step contributor down to a literal 0 (there's
      // nothing to give it at this precision — e.g. 0.25mL when the step is
      // 1mL). Falling back to the continuous ideal there — which itself
      // expands to extra decimals instead of a bare "0" — keeps that
      // contribution visible instead of implying "not used".
      const displayMl = practicalMl > 0 ? practicalMl : exactMl

      return {
        ...color,
        percent,
        exactPercent,
        exactMl,
        practicalMl,
        displayMl,
        percentWidth: `${exactPercent}%`,
        displayValue: unitMode === 'ml' ? formatVolumeSmart(displayMl, volumeUnit) : belowOnePercent ? '<1%' : `${percent}%`,
        exactLabel: unitMode === 'ml' ? formatVolumeExact(exactMl, volumeUnit) : `${exactPercent.toFixed(1)}%`,
        displayName: color.name.trim() ? color.name.trim() : `Color ${index + 1}`,
        hexUpper: color.hex.toUpperCase(),
      }
    })

  if (sortMode === 'percent-desc') rows = [...rows].sort((a, b) => b.exactPercent - a.exactPercent)

  // Recipe mirrors exactly which colors Mix ratio shows (rows already
  // excludes true zeros), and always measures in volume regardless of the
  // %/volume toggle — a volume is something you can actually pour, whereas a
  // whole-number "part" ratio can't represent a small trace contributor at
  // all and drifts from the true proportions at a coarse scale. It uses the
  // same practical (largest-remainder + color-refined) amount as Mix ratio,
  // so the two sections always agree and the whole recipe sums to the batch.
  const recipeItems: RecipeItem[] = rows.map((row, index) => ({
    stepNumber: index + 1,
    hex: row.hex,
    displayName: row.displayName,
    percent: row.percent,
    recipeLine: `${formatVolumeSmart(row.displayMl, volumeUnit)} — ${row.displayName}`,
  }))

  const match = colors.length ? computeMatch(mixedRgb, targetRgb) : 0

  return {
    hasEnoughColors: colors.length >= 2,
    canSimplify: colors.length > 2,
    mixedHex: colors.length ? rgbToHex(mixedRgb) : '#ffffff',
    targetRgbLabel: `R ${targetRgb.r} · G ${targetRgb.g} · B ${targetRgb.b}`,
    match,
    matchBadge: matchBadgeFor(match),
    colors: rows,
    recipeItems,
    colorCountLabel: `${colors.length} color${colors.length === 1 ? '' : 's'}`,
  }
}
