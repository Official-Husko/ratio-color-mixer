import { describe, expect, it } from 'vitest'
import { MAX_COLOR_NAME_LENGTH, sanitizeColorName, sanitizeHexInput } from './sanitize'

describe('sanitizeColorName', () => {
  it('keeps letters, digits, spaces, and common paint-name punctuation', () => {
    expect(sanitizeColorName("Payne's Grey (Cool), No. 2")).toBe("Payne's Grey (Cool), No. 2")
  })

  it('strips markup-like and other disallowed characters', () => {
    expect(sanitizeColorName('<script>alert(1)</script>')).toBe('scriptalert(1)script')
    expect(sanitizeColorName('a"b`c{d}e/f\\g')).toBe('abcdefg')
  })

  it('truncates to the max length', () => {
    expect(sanitizeColorName('x'.repeat(100))).toHaveLength(MAX_COLOR_NAME_LENGTH)
  })
})

describe('sanitizeHexInput', () => {
  it('keeps hex digits and #', () => {
    expect(sanitizeHexInput('#1b3f8b')).toBe('#1b3f8b')
  })

  it('strips non-hex characters', () => {
    expect(sanitizeHexInput('#1b3f8b<script>')).toBe('#1b3f8b')
  })

  it('caps length at 7 (#RRGGBB)', () => {
    expect(sanitizeHexInput('#1b3f8bffffff')).toBe('#1b3f8b')
  })

  it('tolerates in-progress partial input while typing', () => {
    expect(sanitizeHexInput('#1')).toBe('#1')
    expect(sanitizeHexInput('')).toBe('')
  })
})
