import { colorDistance, hexToRgb, rgbToHex, type MixResult } from './color-math'
import { MAX_COLORS } from './constants'
import type { ColorItem, MatchBadge, RecipeItem, SortMode, UnitMode, ViewModel } from '../types'

const MAX_RGB_DISTANCE = Math.sqrt(3) * 255
const PARTS_SCALE = 12
const PARTS_MIN_WEIGHT = 0.02
const SIMPLIFY_KEEP_THRESHOLD = 0.05

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  return b === 0 ? a : gcd(b, a % b)
}

/** Reduce solved weights to a small whole-number ratio, e.g. "3 parts : 2 parts : 1 part". */
export function simplifyRatio(weights: number[]): number[] {
  const scaled = weights.map((w) => (w > PARTS_MIN_WEIGHT ? Math.max(1, Math.round(w * PARTS_SCALE)) : 0))
  const positives = scaled.filter((v) => v > 0)
  if (positives.length === 0) return scaled

  const divisor = positives.reduce((a, b) => gcd(a, b))
  return divisor > 1 ? scaled.map((v) => (v > 0 ? v / divisor : 0)) : scaled
}

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
  const parts = simplifyRatio(weights)

  let rows = colors.map((color, index) => {
    const percent = Math.round((weights[index] ?? 0) * 100)
    const mlAmount = Math.round((percent / 100) * totalMl)
    return {
      ...color,
      percent,
      mlAmount,
      parts: parts[index] ?? 0,
      percentWidth: `${percent}%`,
      displayValue: unitMode === 'ml' ? `${mlAmount} ml` : `${percent}%`,
      displayName: color.name.trim() ? color.name.trim() : `Color ${index + 1}`,
      hexUpper: color.hex.toUpperCase(),
    }
  })

  if (sortMode === 'percent-desc') rows = [...rows].sort((a, b) => b.percent - a.percent)

  const recipeItems: RecipeItem[] = rows
    .filter((row) => row.parts > 0)
    .map((row, index) => ({
      stepNumber: index + 1,
      hex: row.hex,
      displayName: row.displayName,
      percent: row.percent,
      recipeLine:
        unitMode === 'ml'
          ? `${row.mlAmount} ml — ${row.displayName}`
          : `${row.parts} part${row.parts === 1 ? '' : 's'} — ${row.displayName}`,
    }))

  const match = colors.length ? computeMatch(mixedRgb, targetRgb) : 0
  const addDisabled = colors.length >= MAX_COLORS

  return {
    hasEnoughColors: colors.length >= 2,
    canSimplify: colors.length > 2,
    mixedHex: colors.length ? rgbToHex(mixedRgb) : '#ffffff',
    targetRgbLabel: `R ${targetRgb.r} · G ${targetRgb.g} · B ${targetRgb.b}`,
    match,
    matchBadge: matchBadgeFor(match),
    colors: rows,
    recipeItems,
    addDisabled,
    addButtonLabel: addDisabled ? 'Max colors reached' : 'Custom color',
    colorCountLabel: `${colors.length} color${colors.length === 1 ? '' : 's'}`,
  }
}
