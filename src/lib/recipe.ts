import { colorDistance, hexToRgb, rgbToHex, type MixResult } from './color-math'
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

export function buildViewModel(
  colors: ColorItem[],
  target: string,
  result: MixResult | null,
  totalMl: number,
  unitMode: UnitMode,
  sortMode: SortMode,
): ViewModel {
  const weights = result?.weights ?? colors.map(() => 0)
  const mixedRgb = result?.mixed ?? hexToRgb(target)
  const targetRgb = hexToRgb(target)

  // A weight that rounds to 0.0% at one decimal is treated as a true zero and
  // dropped from the mix ratio entirely (matches the solver's own visible-row
  // convention). Anything above that threshold stays, even if it rounds to a
  // bare "0%" at whole-percent precision — those show as "<1%"/"<1 ml"
  // instead, so a real (if small) contribution never reads as "not used".
  let rows = colors
    .map((color, index) => ({ color, index, weight: weights[index] ?? 0 }))
    .filter(({ weight }) => Number((weight * 100).toFixed(1)) > 0)
    .map(({ color, index, weight }) => {
      const exactPercent = weight * 100
      const exactMl = weight * totalMl
      const percent = Math.round(exactPercent)
      const mlAmount = Math.round(exactMl)
      const belowOnePercent = percent === 0
      const belowOneMl = mlAmount === 0

      return {
        ...color,
        percent,
        exactPercent,
        mlAmount,
        exactMl,
        percentWidth: `${exactPercent}%`,
        displayValue:
          unitMode === 'ml' ? (belowOneMl ? '<1 ml' : `${mlAmount} ml`) : belowOnePercent ? '<1%' : `${percent}%`,
        exactLabel: unitMode === 'ml' ? `${exactMl.toFixed(2)} ml` : `${exactPercent.toFixed(1)}%`,
        displayName: color.name.trim() ? color.name.trim() : `Color ${index + 1}`,
        hexUpper: color.hex.toUpperCase(),
      }
    })

  if (sortMode === 'percent-desc') rows = [...rows].sort((a, b) => b.exactPercent - a.exactPercent)

  // Recipe mirrors exactly which colors Mix ratio shows (rows already
  // excludes true zeros), and always measures in ml regardless of the %/ml
  // toggle — a volume is something you can actually pour, whereas a
  // whole-number "part" ratio can't represent a small trace contributor at
  // all and drifts from the true proportions at a coarse scale.
  const recipeItems: RecipeItem[] = rows.map((row, index) => ({
    stepNumber: index + 1,
    hex: row.hex,
    displayName: row.displayName,
    percent: row.percent,
    recipeLine: `${row.mlAmount > 0 ? `${row.mlAmount} ml` : `${row.exactMl.toFixed(2)} ml`} — ${row.displayName}`,
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
