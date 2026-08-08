import { describe, expect, it } from 'vitest'
import { solve3x3 } from './solve3x3'

describe('solve3x3', () => {
  it('solves the identity system', () => {
    const x = solve3x3(
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      [2, 3, 4],
    )
    expect(x).not.toBeNull()
    expect(x![0]).toBeCloseTo(2)
    expect(x![1]).toBeCloseTo(3)
    expect(x![2]).toBeCloseTo(4)
  })

  it('solves a system requiring row pivoting (zero on the diagonal)', () => {
    // x has a zero coefficient in the first row/column, forcing a pivot swap.
    const x = solve3x3(
      [
        [0, 2, 1],
        [1, 0, 0],
        [0, 1, 3],
      ],
      [5, 2, 11],
    )
    expect(x).not.toBeNull()
    // Verify by substitution (against the original rows: [0,2,1], [1,0,0],
    // [0,1,3]) rather than hardcoding the expected solution.
    expect(2 * x![1] + x![2]).toBeCloseTo(5)
    expect(x![0]).toBeCloseTo(2)
    expect(x![1] + 3 * x![2]).toBeCloseTo(11)
  })

  it('returns null for a singular matrix', () => {
    const x = solve3x3(
      [
        [1, 2, 3],
        [2, 4, 6], // exact multiple of row 0
        [0, 1, 1],
      ],
      [1, 2, 1],
    )
    expect(x).toBeNull()
  })

  it('returns null for an all-zero matrix', () => {
    const x = solve3x3(
      [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
      [0, 0, 0],
    )
    expect(x).toBeNull()
  })
})
