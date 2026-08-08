const SINGULAR_EPS = 1e-9

/**
 * Solves a 3x3 linear system `matrix * x = rhs` via Gaussian elimination with
 * partial pivoting. Returns null if the matrix is singular (or too close to
 * it to trust numerically) — e.g. the paints defining a tetrahedron/triangle
 * are collinear or coplanar and don't actually span 3D.
 */
export function solve3x3(matrix: number[][], rhs: number[]): number[] | null {
  const n = 3
  const a = matrix.map((row) => [...row])
  const b = [...rhs]

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col
    let maxAbs = Math.abs(a[col][col])
    for (let row = col + 1; row < n; row += 1) {
      const abs = Math.abs(a[row][col])
      if (abs > maxAbs) {
        maxAbs = abs
        pivotRow = row
      }
    }

    if (maxAbs < SINGULAR_EPS) return null

    if (pivotRow !== col) {
      ;[a[col], a[pivotRow]] = [a[pivotRow], a[col]]
      ;[b[col], b[pivotRow]] = [b[pivotRow], b[col]]
    }

    for (let row = col + 1; row < n; row += 1) {
      const factor = a[row][col] / a[col][col]
      for (let k = col; k < n; k += 1) a[row][k] -= factor * a[col][k]
      b[row] -= factor * b[col]
    }
  }

  const x = new Array(n).fill(0)
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = b[row]
    for (let col = row + 1; col < n; col += 1) sum -= a[row][col] * x[col]
    x[row] = sum / a[row][row]
  }

  return x
}
