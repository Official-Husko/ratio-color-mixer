export type VolumeUnit = 'ml' | 'l' | 'us_fl_oz' | 'us_pint' | 'us_quart' | 'us_gallon'
export type VolumeSystem = 'metric' | 'us'

// mL is the canonical internal unit — every other unit is input/output
// formatting only. US customary units are explicit ("US gal", "US fl oz")
// since Imperial units differ and silently mixing the two is a real source
// of recipe errors.
const ML_PER_UNIT: Record<VolumeUnit, number> = {
  ml: 1,
  l: 1000,
  us_fl_oz: 29.5735295625,
  us_pint: 473.176473,
  us_quart: 946.352946,
  us_gallon: 3785.411784,
}

export const VOLUME_UNIT_LABELS: Record<VolumeUnit, string> = {
  ml: 'mL',
  l: 'L',
  us_fl_oz: 'US fl oz',
  us_pint: 'US pt',
  us_quart: 'US qt',
  us_gallon: 'US gal',
}

export const VOLUME_UNIT_SYSTEM: Record<VolumeUnit, VolumeSystem> = {
  ml: 'metric',
  l: 'metric',
  us_fl_oz: 'us',
  us_pint: 'us',
  us_quart: 'us',
  us_gallon: 'us',
}

// Normal display precision per unit — e.g. whole mL, but 2 decimals of a US
// gallon (which is what the earlier "parts" ratio system got wrong: rounding
// each amount independently without regard for what's actually measurable).
const DISPLAY_DECIMALS: Record<VolumeUnit, number> = {
  ml: 0,
  l: 2,
  us_fl_oz: 2,
  us_pint: 2,
  us_quart: 2,
  us_gallon: 2,
}

export const VOLUME_UNITS: VolumeUnit[] = ['ml', 'l', 'us_fl_oz', 'us_pint', 'us_quart', 'us_gallon']

export function isVolumeUnit(value: unknown): value is VolumeUnit {
  return typeof value === 'string' && (VOLUME_UNITS as string[]).includes(value)
}

export function mlToUnit(ml: number, unit: VolumeUnit): number {
  return ml / ML_PER_UNIT[unit]
}

export function unitToMl(value: number, unit: VolumeUnit): number {
  return value * ML_PER_UNIT[unit]
}

/**
 * Main display value for a volume amount: rounded to the unit's normal
 * precision, e.g. "3.25 US fl oz". A nonzero amount that would otherwise
 * round to a bare "0" (a real but trace contributor) instead gets enough
 * extra decimals to show ~2 significant figures, so it never misleadingly
 * reads as unused.
 */
export function formatVolumeSmart(ml: number, unit: VolumeUnit): string {
  const value = mlToUnit(ml, unit)
  const normalDecimals = DISPLAY_DECIMALS[unit]
  const rounded = Number(value.toFixed(normalDecimals))

  if (rounded !== 0 || value === 0) {
    return `${rounded} ${VOLUME_UNIT_LABELS[unit]}`
  }

  const extraDecimals = Math.min(6, Math.max(normalDecimals, 1 - Math.floor(Math.log10(value))))
  return `${value.toFixed(extraDecimals)} ${VOLUME_UNIT_LABELS[unit]}`
}

/** More precise version of the same amount, for an "exact value" tooltip/hint next to a rounded display value. */
export function formatVolumeExact(ml: number, unit: VolumeUnit): string {
  const value = mlToUnit(ml, unit)
  const decimals = DISPLAY_DECIMALS[unit] + 2
  return `${value.toFixed(decimals)} ${VOLUME_UNIT_LABELS[unit]}`
}

/** Rounds a raw (e.g. freshly-typed) amount in `unit` back to canonical mL. */
export function parseVolumeToMl(value: number, unit: VolumeUnit): number {
  return Math.max(0, unitToMl(value, unit))
}

/**
 * The measurement granularity (in canonical mL) implied by a unit's normal
 * display precision — e.g. 1mL for "mL" (0 decimals), or ~0.2957mL for
 * "US fl oz" (0.01 fl oz, its 2-decimal precision). Used to round recipe
 * volumes to amounts that are actually measurable in the selected unit,
 * consistently with what gets displayed.
 */
export function stepMlFor(unit: VolumeUnit): number {
  return unitToMl(10 ** -DISPLAY_DECIMALS[unit], unit)
}

export interface VolumePreset {
  label: string
  ml: number
}

export const METRIC_VOLUME_PRESETS: VolumePreset[] = [
  { label: '50 mL', ml: 50 },
  { label: '100 mL', ml: 100 },
  { label: '200 mL', ml: 200 },
  { label: '500 mL', ml: 500 },
  { label: '1 L', ml: 1000 },
]

export const US_VOLUME_PRESETS: VolumePreset[] = [
  { label: '4 fl oz', ml: unitToMl(4, 'us_fl_oz') },
  { label: '8 fl oz', ml: unitToMl(8, 'us_fl_oz') },
  { label: '1 pt', ml: unitToMl(1, 'us_pint') },
  { label: '1 qt', ml: unitToMl(1, 'us_quart') },
  { label: '1 gal', ml: unitToMl(1, 'us_gallon') },
  { label: '5 gal', ml: unitToMl(5, 'us_gallon') },
]

export function volumePresetsFor(unit: VolumeUnit): VolumePreset[] {
  return VOLUME_UNIT_SYSTEM[unit] === 'us' ? US_VOLUME_PRESETS : METRIC_VOLUME_PRESETS
}
