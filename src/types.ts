import type { VolumeUnit } from './lib/units'

export type UnitMode = 'percentage' | 'ml'
export type SortMode = 'added' | 'percent-desc'
export type FeedbackKind = 'recipe' | 'link' | 'link-error' | 'image' | null
export type ShareCodeStatus = 'loading' | 'error' | null

export interface ColorItem {
  id: string
  hex: string
  name: string
}

export interface MixColorRow extends ColorItem {
  /** Rounded to the nearest whole percent — 0 only ever appears as "<1%" in displayValue, never bare "0%". */
  percent: number
  /** Unrounded percent contribution, e.g. 0.4 — used for sorting and shown exactly in exactLabel. */
  exactPercent: number
  /** Unrounded ml amount — Recipe always formats from this regardless of the %/volume toggle. */
  exactMl: number
  percentWidth: string
  /** Rounded for normal rows; "<1%" or an extra-precision fraction of the volume unit for a nonzero contribution that would otherwise round to 0. */
  displayValue: string
  /** Unrounded value formatted for the current unit mode, e.g. "0.4%" or "1.25 US fl oz" — meant for a tooltip. */
  exactLabel: string
  displayName: string
  hexUpper: string
}

export interface RecipeItem {
  stepNumber: number
  hex: string
  displayName: string
  recipeLine: string
  percent: number
}

export interface MatchBadge {
  bg: string
  text: string
}

export interface ViewModel {
  hasEnoughColors: boolean
  canSimplify: boolean
  mixedHex: string
  targetRgbLabel: string
  match: number
  matchBadge: MatchBadge
  colors: MixColorRow[]
  recipeItems: RecipeItem[]
  colorCountLabel: string
}

export interface SharePayload {
  v: 1
  target: string
  colors: Array<{ hex: string; name: string }>
  totalMl: number
  unitMode: UnitMode
  volumeUnit: VolumeUnit
}
