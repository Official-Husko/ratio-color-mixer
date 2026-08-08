# DigitPaints Color-Math Study

A readable, documented implementation of the **color-calculation behavior** seen in the user-supplied production JavaScript for DigitPaints' Color Mixer.

This repository is intended as an **educational/reference implementation**. It focuses only on the math and data transformations involved in calculating mix percentages; it does not reproduce the site's UI, branding, analytics, storage, or other application code.

## What the live tool does

The current DigitPaints Color Mixer lets a user:

1. add paint colors they already have,
2. enter a target RGB color,
3. receive an **estimated** mixture,
4. receive a percentage for each contributing paint.

Live page:

- https://www.digitpaints.com/en/color-mixer

DigitPaints' own mixing article also treats those percentages as a **starting point** and notes that real paints vary by brand/material:

- https://www.digitpaints.com/en/blog/how-to-mix-paints

That caveat is important: this algorithm is a digital approximation of paint-like mixing, not a physical pigment/spectral model.

---

## Short version of the algorithm

The calculation is:

```text
available RGB colors
        |
        v
approximate RGB -> RYB transform
        |
        v
find non-negative weights summing to 1
that minimize target error
        |
        v
weighted average in RYB-like space
        |
        v
approximate RYB -> RGB transform
        |
        v
estimated RGB + percentages
```

The key idea is that it **does not optimize by directly averaging ordinary RGB values**.

Instead, it first maps colors into an approximate **RYB (red-yellow-blue)** painter-oriented space. RYB is historically associated with pigment/art mixing and is commonly used as a more painter-like digital model than additive RGB.

The optimizer then works in that transformed space.

---

## Files

```text
src/color-math.js
    All relevant color mathematics:
    - HEX <-> RGB helpers
    - RGB distance
    - approximate RGB <-> RYB conversion
    - weighted mixing
    - probability-simplex projection
    - projected-gradient solver
    - display-row formatting

test/color-math.test.mjs
    Regression and invariant tests.

examples/basic.mjs
    Minimal runnable example.

ALGORITHM.md
    Detailed mathematical explanation.

SOURCE_MAP.md
    Maps the opaque/minified functions in the user-supplied bundle
    to the readable names used here.

NOTICE.md
    Provenance and usage notes.
```

---

## Run it

Requires a recent Node.js version.

```bash
npm test
npm run example
```

No runtime dependencies are required.

---

## Example

```js
import {
  solvePaintMixHex,
  visibleMixRows,
  rgbToHex,
} from "./src/color-math.js";

const paints = [
  "#ffffff",
  "#000000",
  "#ff0000",
  "#ffff00",
  "#0000ff",
];

const result = solvePaintMixHex(paints, "#7BD5D5");

console.log("Estimated:", result.mixed, rgbToHex(result.mixed));

for (const row of visibleMixRows(paints, result)) {
  console.log(row.hex, row.percentage.toFixed(1) + "%");
}
```

Expected behavior for that example is approximately:

```text
Estimated: rgb(124, 208, 212)

#ffffff 48.6%
#0000ff 34.5%
#ffff00 16.9%
```

Those values match the current live DigitPaints example closely enough to serve as a useful regression check.

---

## The optimization problem

Let each available paint, after conversion to the approximate RYB space, be a 3-vector:

```text
c1, c2, ..., cn
```

Let the transformed target be:

```text
t
```

We want weights:

```text
w1, w2, ..., wn
```

such that the weighted mixture:

```text
m = w1*c1 + w2*c2 + ... + wn*cn
```

is close to `t`.

The objective is squared Euclidean error:

```text
minimize ||m - t||^2
```

with constraints:

```text
wi >= 0
sum(wi) = 1
```

The constraints are exactly what percentages need:

- no negative quantity of a paint,
- all quantities together equal 100%.

---

## Why simplex projection is necessary

A normal gradient-descent step can produce something invalid:

```text
[0.70, 0.40, -0.10]
```

Even though it sums to 1, `-10%` paint is impossible.

Or:

```text
[0.80, 0.50, 0.20]
```

which sums to 150%.

After every candidate step, the code projects the vector onto:

```text
S = { w : wi >= 0 and sum(wi) = 1 }
```

This set is called the **probability simplex**.

So every accepted candidate remains interpretable as paint percentages.

---

## Gradient derivation

Write the transformed paints as columns/vectors of `C`.

The objective is:

```text
f(w) = ||Cw - t||^2
```

Its gradient is:

```text
grad f(w) = 2 C^T (Cw - t)
```

For one paint vector `ci`, the corresponding weight derivative is:

```text
2 * ci dot (Cw - t)
```

That is exactly what `solvePaintMix()` calculates.

---

## Initialization

The observed behavior does not begin with equal percentages or random values.

It finds the single source paint with the smallest ordinary RGB squared distance from the target and initializes:

```text
that paint = 100%
all others = 0%
```

This gives the optimizer a reasonable feasible starting point.

---

## Adaptive step size

The initial step size is:

```text
0.25
```

For each of 500 iterations:

- if the candidate improves or preserves the transformed-space error:
  - accept it,
  - grow the step by about 5%,
  - cap it at 1.0;

- otherwise:
  - reject it,
  - halve the step,
  - floor it at 0.0001.

This is a simple line-search-like heuristic.

It is not a sophisticated convex optimizer, but the underlying weight problem in a fixed linear transformed space is a convex quadratic problem over a convex simplex, so projected gradient descent is a sensible approach.

---

## RGB -> approximate RYB

The transform is best understood as a painterly decomposition, not as a color-management standard.

Conceptually:

1. normalize 0..255 RGB into 0..1,
2. remove the common neutral/white component,
3. extract yellow from red+green overlap,
4. compensate for blue+green coexistence,
5. preserve the original chroma magnitude,
6. restore the neutral component.

This produces three channels that are semantically:

```text
red, yellow, blue
```

They are stored in `{r, g, b}` fields only so all generic 3-vector math stays simple.

### Why RYB?

Ordinary screen RGB is an **additive** model: it describes emitted light.

Paint mixing is broadly **subtractive**. A digital RYB model can often give more painter-intuitive interpolation than direct RGB averaging.

Academic work also describes RYB as a subtractive model used in art and discusses RGB/RYB conversion and compositing:

- Sugita & Takahashi, "Computational RYB Color Model and its Applications" (2017)
- https://doi.org/10.11371/tievciieej.5.2_110

Do not interpret this implementation as a claim that it exactly reproduces that paper. The source-study conclusion is narrower: the supplied bundle clearly performs an RGB-to-RYB-like transform, mixes/optimizes in that transformed 3-channel space, then converts back.

---

## What "error" means

There are effectively two useful errors:

### 1. Optimization error

The optimizer compares:

```text
squared distance in transformed RYB-like space
```

This is what determines whether a candidate step is accepted.

### 2. Final display error

After obtaining the final proportions:

1. mix in transformed space,
2. convert the mix back to 8-bit RGB,
3. calculate ordinary Euclidean RGB distance from the target.

That final RGB distance is returned as `error`.

The live UI does not currently appear to display the numeric error; it displays the target and estimated colors instead.

---

## Why an exact target may still not be reached

Even with many source colors, exact matching is not guaranteed.

Reasons include:

- the target may lie outside the convex hull of the available colors in transformed space,
- the RGB<->RYB mapping is approximate,
- output RGB is rounded to 8-bit integers,
- real paint behavior is not encoded,
- 500 optimization iterations may stop short of a numerically perfect optimum,
- the algorithm minimizes transformed-space Euclidean error, not perceptual Delta E.

---

## Physical-paint limitation

This is the most important practical limitation.

Real paints depend on:

- pigment chemistry,
- spectral reflectance,
- opacity/transparency,
- pigment concentration,
- binder,
- undertone,
- tinting strength,
- wet vs. dry appearance,
- surface and lighting.

Two tubes with visually similar RGB swatches can mix very differently.

A physically stronger implementation would need measured spectral data or a pigment model such as Kubelka-Munk, plus per-paint calibration.

So percentages from this algorithm should be treated as **starting ratios**, consistent with DigitPaints' own practical guidance.

---

## Potential improvements

If you are building your own mixer rather than reproducing behavior, consider:

### Perceptual target metric

Optimize or rank using CIE Lab / OKLab and Delta E rather than raw RGB Euclidean distance.

### Better stopping criterion

Instead of always doing exactly 500 iterations, stop when:

```text
abs(previousError - currentError) < epsilon
```

for several consecutive iterations.

### Active-set / quadratic programming solver

The mathematical core is a constrained least-squares problem. A dedicated non-negative least squares or quadratic-programming solver could converge more predictably.

### Calibrated paints

Allow a user to make physical swatches and learn corrections for a particular brand/set.

### Spectral model

For genuine pigment prediction, measure reflectance spectra and use a physically motivated mixing model.

---

## API summary

### `hexToRgb(hex)`

HEX -> `{r,g,b}`.

### `rgbToHex(rgb)`

`{r,g,b}` -> HEX.

### `rgbToApproxRyb(rgb)`

Display RGB -> painter-oriented RYB-like coordinates.

### `approxRybToRgb(ryb)`

RYB-like coordinates -> display RGB.

### `weightedMix(colors, weights)`

Linear weighted 3-vector mixture.

### `projectOntoSimplex(values)`

Makes weights legal percentages.

### `solvePaintMix(paints, targetRgb)`

Main reverse-mixing solver.

### `solvePaintMixHex(paints, targetHex)`

HEX convenience wrapper.

### `visibleMixRows(paints, result)`

Applies the same style of display filtering:
hide values that round to 0.0%, and sort descending.

---

## Bottom line

The reverse mixer is essentially:

> **approximate RYB conversion + constrained least-squares optimization via projected gradient descent**

It is compact, clever, and appropriate for an estimate-oriented hobby paint tool, while still being much simpler than a true physical pigment simulator.
