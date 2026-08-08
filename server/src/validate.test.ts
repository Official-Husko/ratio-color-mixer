import { describe, expect, it } from 'vitest'
import { bodyTooLarge, isValidShareId, validatePayload } from './validate'

function validPayload() {
  return {
    target: '#7bd5d5',
    colors: [
      { hex: '#ff0000', name: 'Red' },
      { hex: '#00ff00', name: '' },
    ],
    totalMl: 250,
    unitMode: 'percentage',
    volumeUnit: 'ml',
  }
}

describe('validatePayload', () => {
  it('accepts a well-formed payload', () => {
    expect(validatePayload(validPayload())).toBe(true)
  })

  it('rejects a non-hex target', () => {
    expect(validatePayload({ ...validPayload(), target: 'not-a-color' })).toBe(false)
  })

  it('rejects a non-positive totalMl', () => {
    expect(validatePayload({ ...validPayload(), totalMl: 0 })).toBe(false)
    expect(validatePayload({ ...validPayload(), totalMl: -5 })).toBe(false)
    expect(validatePayload({ ...validPayload(), totalMl: Number.NaN })).toBe(false)
  })

  it('rejects an unknown unitMode or volumeUnit', () => {
    expect(validatePayload({ ...validPayload(), unitMode: 'grams' })).toBe(false)
    expect(validatePayload({ ...validPayload(), volumeUnit: 'cups' })).toBe(false)
  })

  it('rejects an empty or oversized colors array', () => {
    expect(validatePayload({ ...validPayload(), colors: [] })).toBe(false)
    const tooMany = Array.from({ length: 101 }, () => ({ hex: '#ff0000', name: 'x' }))
    expect(validatePayload({ ...validPayload(), colors: tooMany })).toBe(false)
  })

  it('rejects a color with a bad hex or an over-long name', () => {
    expect(validatePayload({ ...validPayload(), colors: [{ hex: 'red', name: 'x' }] })).toBe(false)
    expect(validatePayload({ ...validPayload(), colors: [{ hex: '#ff0000', name: 'x'.repeat(33) }] })).toBe(false)
  })

  it('accepts names with common paint-name punctuation, rejects markup-like characters', () => {
    expect(validatePayload({ ...validPayload(), colors: [{ hex: '#ff0000', name: "Payne's Grey (Cool), No. 2" }] })).toBe(true)
    for (const bad of ['<script>', 'a"b', "a'; DROP TABLE--", 'a`b', 'a{b}', 'a/b', 'a\\b']) {
      expect(validatePayload({ ...validPayload(), colors: [{ hex: '#ff0000', name: bad }] })).toBe(false)
    }
  })

  it('rejects non-object input', () => {
    expect(validatePayload(null)).toBe(false)
    expect(validatePayload('a string')).toBe(false)
    expect(validatePayload(42)).toBe(false)
  })
})

describe('bodyTooLarge', () => {
  it('accepts small bodies and rejects bodies over the limit', () => {
    expect(bodyTooLarge('a'.repeat(100))).toBe(false)
    expect(bodyTooLarge('a'.repeat(10_001))).toBe(true)
  })
})

describe('isValidShareId', () => {
  it('accepts a canonical UUID string', () => {
    expect(isValidShareId('018f5a3c-1234-7abc-8def-0123456789ab')).toBe(true)
  })

  it('rejects malformed ids', () => {
    expect(isValidShareId('not-a-uuid')).toBe(false)
    expect(isValidShareId('../../etc/passwd')).toBe(false)
    expect(isValidShareId('')).toBe(false)
  })
})
