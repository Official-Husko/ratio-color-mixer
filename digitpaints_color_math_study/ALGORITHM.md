# Algorithm Walkthrough

This document explains the solver at a lower level than the README.

## 1. Input representation

Each paint starts as 8-bit RGB:

```text
R, G, B in [0,255]
```

HEX is only an input/output encoding.

The solver itself works with numeric triples.

---

## 2. Convert source paints and target to a painterly space

For each RGB color:

```js
rgbToApproxRyb(rgb)
```

returns normalized approximate RYB coordinates in roughly `[0,1]`.

The transform separates:

- a common neutral/white amount,
- red,
- yellow generated from red+green overlap,
- blue,
- a correction for green/blue interaction.

The inverse function reconstructs ordinary RGB for display.

This step is why the method differs from simply solving a weighted average in screen RGB.

---

## 3. Define the objective

For N paints, let:

```text
Ci = transformed paint i
T  = transformed target
wi = percentage weight as a fraction
```

The predicted transformed mixture is:

```text
M(w) = sum_i wi * Ci
```

Loss:

```text
L(w) = ||M(w) - T||^2
```

Constraints:

```text
wi >= 0
sum_i wi = 1
```

---

## 4. Initial point

Compute ordinary RGB squared distance:

```text
(Ri-Rt)^2 + (Gi-Gt)^2 + (Bi-Bt)^2
```

Choose the closest paint.

Set:

```text
wclosest = 1
all other weights = 0
```

This is guaranteed to be a valid simplex point.

---

## 5. Gradient

Let:

```text
E = M(w) - T
```

For paint vector `Ci`, the derivative is:

```text
dL/dwi = 2 * dot(E, Ci)
```

So one unconstrained descent step would be:

```text
wi' = wi - alpha * dL/dwi
```

where `alpha` is the step size.

---

## 6. Projection

The unconstrained candidate can contain negative values or fail to sum to one.

Project it onto:

```text
{ w | wi >= 0, sum(wi) = 1 }
```

The implementation uses a sort/threshold algorithm:

1. sort values descending into `u`,
2. find the largest active set where `u_j - theta > 0`,
3. compute `theta`,
4. output `max(v_i - theta, 0)`.

This is Euclidean projection onto the simplex.

---

## 7. Candidate acceptance

Compute transformed-space loss for the projected candidate.

If:

```text
candidateLoss <= bestLoss
```

accept it.

Then:

```text
alpha = min(alpha * 1.05, 1.0)
```

Otherwise reject it and use:

```text
alpha = max(alpha * 0.5, 0.0001)
```

The loop runs 500 times.

---

## 8. Final mixture

Project the best weights one final time.

Then:

```text
mixedRYB = sum_i wi * RYBi
mixedRGB = approxRybToRgb(mixedRYB)
```

Final reported color error:

```text
sqrt(
  (mixedR-targetR)^2 +
  (mixedG-targetG)^2 +
  (mixedB-targetB)^2
)
```

---

## 9. UI percentages

Internally:

```text
0.4862745
```

means:

```text
48.62745%
```

Visible percentage:

```text
48.6%
```

Rows whose one-decimal percentage rounds to zero are hidden.

Rows are sorted from largest contribution to smallest.

---

## 10. Complexity

Let:

```text
N = number of available paints
I = number of iterations (500)
```

Most iteration work is O(N).

Simplex projection sorts N values, making each iteration O(N log N).

Total:

```text
O(I * N log N)
```

For a normal paint palette, N is small enough that this is trivial in a browser.

---

## 11. Convexity nuance

Once every paint and the target have been transformed into fixed 3D vectors, the objective in weight-space is a convex quadratic:

```text
||Cw - t||^2
```

and the simplex is convex.

Therefore the *weight optimization* is convex.

However, the complete RGB -> RYB -> optimization -> RGB pipeline is not equivalent to a physical pigment model, and the nonlinear coordinate conversion changes what "closest" means.

---

## 12. Degenerate cases

### No paints

Return `null`.

### One paint

Only possible weight:

```text
[1]
```

No optimization needed.

### Duplicate paint colors

Valid but redundant. The optimum may distribute weight among duplicates in ways that are not unique.

### Target outside reachable region

The solver returns the closest convex combination it can find in the transformed space.

### Very small contributions

They may remain internally but be omitted from visible rows if they display as `0.0%`.
