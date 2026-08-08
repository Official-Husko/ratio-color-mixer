import { describe, expect, it } from 'vitest'
import {
  formatVolumeExact,
  formatVolumeSmart,
  mlToUnit,
  unitToMl,
  volumePresetsFor,
  type VolumeUnit,
} from './units'

describe('mlToUnit / unitToMl round trip', () => {
  const units: VolumeUnit[] = ['ml', 'l', 'us_fl_oz', 'us_pint', 'us_quart', 'us_gallon']

  it('round-trips within floating-point tolerance for every unit', () => {
    for (const unit of units) {
      const ml = 1234.5
      const roundTripped = unitToMl(mlToUnit(ml, unit), unit)
      expect(roundTripped).toBeCloseTo(ml, 6)
    }
  })
})

describe('formatVolumeSmart', () => {
  it('matches known reference conversions', () => {
    expect(formatVolumeSmart(94.3, 'ml')).toBe('94 mL')
    expect(formatVolumeSmart(3.25 * 29.5735295625, 'us_fl_oz')).toBe('3.25 US fl oz')
    expect(formatVolumeSmart(0.75 * 946.352946, 'us_quart')).toBe('0.75 US qt')
    expect(formatVolumeSmart(1.25 * 3785.411784, 'us_gallon')).toBe('1.25 US gal')
  })

  it('never displays a nonzero amount as a bare "0" — falls back to more precision', () => {
    const text = formatVolumeSmart(1.4, 'us_gallon')
    expect(text).not.toBe('0 US gal')
    expect(text).toMatch(/^0\.0+\d+ US gal$/)
  })

  it('displays an exact zero as a plain "0", not extra decimals', () => {
    expect(formatVolumeSmart(0, 'us_gallon')).toBe('0 US gal')
  })
})

describe('formatVolumeExact', () => {
  it('gives more precision than formatVolumeSmart for the same amount', () => {
    expect(formatVolumeExact(97.54, 'ml')).toBe('97.54 mL')
  })
})

describe('volumePresetsFor', () => {
  it('returns metric presets for mL/L and US presets for US units', () => {
    expect(volumePresetsFor('ml').map((p) => p.label)).toContain('1 L')
    expect(volumePresetsFor('l').map((p) => p.label)).toContain('1 L')
    expect(volumePresetsFor('us_gallon').map((p) => p.label)).toContain('1 gal')
    expect(volumePresetsFor('us_fl_oz').map((p) => p.label)).toContain('1 gal')
  })

  it('every US preset converts back to a clean round number in its own unit', () => {
    const gallonPreset = volumePresetsFor('us_gallon').find((p) => p.label === '1 gal')!
    expect(mlToUnit(gallonPreset.ml, 'us_gallon')).toBeCloseTo(1, 9)
  })
})
