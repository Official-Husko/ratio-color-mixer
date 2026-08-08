export type UnitMode = 'percentage' | 'ml'
export type SortMode = 'added' | 'percent-desc'
export type FeedbackKind = 'recipe' | 'link' | 'image' | null

export interface ColorItem {
  id: string
  hex: string
  name: string
}

export interface MixColorRow extends ColorItem {
  percent: number
  mlAmount: number
  parts: number
  percentWidth: string
  displayValue: string
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
  addDisabled: boolean
  addButtonLabel: string
  colorCountLabel: string
}

export interface SharePayload {
  v: 1
  target: string
  colors: Array<{ hex: string; name: string }>
  totalMl: number
  unitMode: UnitMode
}
