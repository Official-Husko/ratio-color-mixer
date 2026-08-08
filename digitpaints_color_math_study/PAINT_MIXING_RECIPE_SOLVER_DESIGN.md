# Paint Mixing Recipe Solver — Technical Design, Sparse Color Selection, Volume Recipes, and ML Roadmap

> **Purpose:** A project-ready design document for building a practical reverse paint-mixing system on top of the color-math implementation already extracted and documented from the DigitPaints-style mixer.
>
> **Default batch size:** `200 mL`
>
> **Primary goals:** choose the most useful contributing paints, keep recipes simple, convert ratios into measurable milliliters, predict the rounded recipe result, and leave a clean path for future real-world ML correction.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What the Existing Color Solver Already Gives Us](#2-what-the-existing-color-solver-already-gives-us)
3. [Project Goals and Non-Goals](#3-project-goals-and-non-goals)
4. [Mathematical Model](#4-mathematical-model)
5. [Why Four Contributing Colors Are Enough in the Current 3D Model](#5-why-four-contributing-colors-are-enough-in-the-current-3d-model)
6. [Why Sparse Recipe Selection Should Not Use a Normal L1 Penalty](#6-why-sparse-recipe-selection-should-not-use-a-normal-l1-penalty)
7. [Recommended Sparse Recipe Algorithm](#7-recommended-sparse-recipe-algorithm)
8. [Finding the Most Important Paints](#8-finding-the-most-important-paints)
9. [Recipe Ranking: Best, Recommended, and Simplest](#9-recipe-ranking-best-recommended-and-simplest)
10. [Converting Percentages to a 200 mL Recipe](#10-converting-percentages-to-a-200-ml-recipe)
11. [Rounding to Real Measuring Equipment](#11-rounding-to-real-measuring-equipment)
12. [Minimum Measurable Paint Amount](#12-minimum-measurable-paint-amount)
13. [Re-Evaluating the Rounded Physical Recipe](#13-re-evaluating-the-rounded-physical-recipe)
14. [Color Error and Match Quality](#14-color-error-and-match-quality)
15. [Confidence Scoring](#15-confidence-scoring)
16. [Complete Recommended Solver Pipeline](#16-complete-recommended-solver-pipeline)
17. [Suggested JavaScript API](#17-suggested-javascript-api)
18. [Reference Implementation Sketches](#18-reference-implementation-sketches)
19. [Performance and Candidate Pruning](#19-performance-and-candidate-pruning)
20. [Machine Learning: Where It Actually Helps](#20-machine-learning-where-it-actually-helps)
21. [ML Dataset Design](#21-ml-dataset-design)
22. [ML Features and Targets](#22-ml-features-and-targets)
23. [Recommended ML Models](#23-recommended-ml-models)
24. [Training and Validation Strategy](#24-training-and-validation-strategy)
25. [Real-World Color Measurement](#25-real-world-color-measurement)
26. [Future Physical Pigment Model](#26-future-physical-pigment-model)
27. [Data Structures](#27-data-structures)
28. [Suggested Application Architecture](#28-suggested-application-architecture)
29. [Testing Strategy](#29-testing-strategy)
30. [UX Recommendations](#30-ux-recommendations)
31. [Development Roadmap](#31-development-roadmap)
32. [Important Limitations](#32-important-limitations)
33. [References](#33-references)

---

# 1. Executive Summary

The existing reverse color mixer can be treated as a **continuous ratio solver**.

Given:

- a list of available paint colors,
- a target RGB color,

it returns weights such as:

```text
White   0.486
Blue    0.345
Yellow  0.169
```

which correspond to:

```text
White   48.6%
Blue    34.5%
Yellow  16.9%
```

The next stage of the project should turn that mathematical result into a **practical paint recipe system**.

The recommended architecture is:

```text
Available paints
      │
      ▼
Color-space conversion
      │
      ▼
Continuous ratio optimization
      │
      ▼
Sparse subset search (1–4 paints)
      │
      ▼
Re-optimize each candidate subset
      │
      ▼
Rank by color quality + recipe simplicity
      │
      ▼
Measure paint importance
      │
      ▼
Convert fractions to requested volume
      │
      ▼
Round to physically measurable amounts
      │
      ▼
Recalculate predicted rounded result
      │
      ▼
Return recommended recipe + alternatives
```

For a default `200 mL` batch:

```text
48.6% white  -> 97.2 mL
34.5% blue   -> 69.0 mL
16.9% yellow -> 33.8 mL
```

The system should then round those values according to the user's measuring precision, for example `1 mL`, while keeping the total exactly `200 mL`.

A later ML layer should **not replace the mathematical solver**. Instead, it should learn the difference between:

```text
mathematically predicted result
```

and:

```text
physically measured result
```

for specific paint brands, pigments, ratios, and materials.

That gives the architecture:

```text
mathematical mixer
       +
learned physical correction
       =
improved real-world prediction
```

---

# 2. What the Existing Color Solver Already Gives Us

The existing calculation pipeline from the supplied DigitPaints production bundle contains the core pieces required for reverse mixing:

- HEX to RGB conversion,
- RGB formatting and clamping,
- a weighted 3-channel mixture,
- an RGB-to-painterly-RYB-like transformation,
- an inverse RYB-like-to-RGB transformation,
- squared color distance,
- probability-simplex projection,
- projected gradient descent,
- an adaptive optimization step,
- final mixture percentages.

The current DigitPaints Color Mixer publicly describes itself as a tool where users add paints they already own, enter a target RGB color, and receive estimated mixing percentages.

The extracted behavior can be summarized as:

```text
RGB source colors
      │
      ▼
approximate RGB -> RYB-like transform
      │
      ▼
optimize non-negative weights
whose sum is exactly 1
      │
      ▼
weighted transformed-space mixture
      │
      ▼
approximate RYB-like -> RGB conversion
      │
      ▼
estimated RGB + percentages
```

The important property for recipe generation is:

```text
weight_i >= 0
```

and:

```text
sum(weight_i) = 1
```

Therefore every solution already represents a valid percentage distribution.

For example:

```text
[0.50, 0.30, 0.20]
```

means:

```text
50%
30%
20%
```

and can immediately be scaled to any total batch volume.

---

# 3. Project Goals and Non-Goals

## 3.1 Goals

The improved solver should:

1. find a close approximation to a requested target color;
2. prefer a small number of paints;
3. normally use no more than four paints;
4. explain which paints are genuinely important;
5. convert ratios into a requested batch volume;
6. default to `200 mL`;
7. support practical measuring increments;
8. guarantee the rounded recipe still totals exactly the requested amount;
9. predict the color of the rounded recipe;
10. provide simpler alternative recipes where appropriate;
11. estimate confidence;
12. collect real-world observations for later ML correction.

## 3.2 Non-goals for the first version

The initial version should **not claim** to:

- perfectly simulate pigment chemistry,
- account for every paint brand automatically,
- predict transparent glaze behavior exactly,
- replace spectrophotometric paint formulation software,
- infer unknown pigment spectral curves from RGB without uncertainty,
- guarantee that a photographed color is accurate under arbitrary lighting.

The initial model is best treated as:

> a mathematically consistent, paint-like digital recipe estimator.

---

# 4. Mathematical Model

Assume there are `N` available paints.

After converting each paint into the solver's transformed 3-channel mixing space, let:

```text
C1, C2, ..., CN
```

be the paint vectors.

Let:

```text
T
```

be the transformed target.

Let:

```text
w1, w2, ..., wN
```

be the fractional paint amounts.

The predicted transformed mixture is:

```text
M = w1*C1 + w2*C2 + ... + wN*CN
```

The basic optimization problem is:

```text
minimize ||M - T||²
```

subject to:

```text
wi >= 0
```

and:

```text
sum(wi) = 1
```

These constraints are important because a recipe cannot contain negative paint and all percentages should total 100%.

In matrix form:

```text
minimize ||Cw - T||²
```

subject to:

```text
w >= 0
1ᵀw = 1
```

This is a constrained least-squares problem.

Once the colors are converted into fixed transformed-space vectors, the optimization in `w` is a convex quadratic problem over a convex feasible set.

That makes projected gradient descent a reasonable solver.

---

# 5. Why Four Contributing Colors Are Enough in the Current 3D Model

The current digital mixture lives in a **three-dimensional transformed color space**.

Every paint is represented by a point:

```text
C = (c1, c2, c3)
```

A mixture is a convex combination:

```text
M = Σ wi*Ci
```

with:

```text
wi >= 0
Σ wi = 1
```

This means all achievable mixtures lie inside the **convex hull** of the available paint points.

Carathéodory's theorem states:

> If a point lies in the convex hull of a set in `R^d`, that point can be written as a convex combination of at most `d + 1` points.

For `d = 3`:

```text
d + 1 = 4
```

Therefore, within this model:

> Any exactly reachable transformed color can be represented using at most four source paints.

Geometrically:

```text
1 paint  -> point
2 paints -> line segment
3 paints -> triangle
4 paints -> tetrahedron
```

A fifth paint may expand the overall reachable region, but a *specific point* inside the resulting 3D convex hull never requires more than four active vertices to represent it.

## 5.1 Important caveat

The existing projected-gradient solver may still output:

```text
6 non-zero weights
```

or:

```text
10 very small weights
```

because it is not explicitly optimizing for sparsity.

Carathéodory's theorem says that an equivalent solution using at most four points **exists** for an exactly reachable point. It does not automatically force a generic numerical solver to find that sparse representation.

That is why an explicit sparse recipe layer is useful.

## 5.2 Approximate targets

When a target lies outside the reachable convex hull, the closest achievable point frequently lies on a lower-dimensional boundary:

- face,
- edge,
- vertex.

A point on a triangular face can be represented with at most three paints.

A point on an edge needs only two.

A vertex needs one.

This is another reason practical optimal recipes will often naturally require fewer than four paints.

---

# 6. Why Sparse Recipe Selection Should Not Use a Normal L1 Penalty

A common ML/optimization technique for encouraging sparse coefficients is:

```text
loss + λ * ||w||₁
```

However, our weights satisfy:

```text
wi >= 0
```

and:

```text
Σ wi = 1
```

Therefore:

```text
||w||₁ = Σ |wi|
        = Σ wi
        = 1
```

for every feasible recipe.

So:

```text
λ * ||w||₁
```

is simply:

```text
λ
```

for every valid solution.

It cannot prefer two paints over ten paints.

This is a critical design detail.

## 6.1 Better sparsity strategies

Use one or more of:

### Explicit subset search

Search combinations containing:

```text
1 paint
2 paints
3 paints
4 paints
```

and solve each subset optimally.

This is the cleanest method for moderate palette sizes.

### Paint-count penalty

Use a score such as:

```text
score = colorError + λ * activePaintCount
```

where:

```text
activePaintCount = number of paints with amount > threshold
```

This approximates an `L0` penalty.

### Minimum contribution threshold

Discard candidates where a selected paint contributes less than a physically useful amount.

### Entropy penalty

A lower-entropy distribution tends to concentrate weight:

```text
H(w) = -Σ wi log(wi)
```

However, entropy is less interpretable than explicit subset selection and should not be the primary method.

### Mixed integer optimization

A future exact formulation can introduce binary variables:

```text
zi ∈ {0,1}
```

where:

```text
wi <= zi
Σ zi <= 4
```

This gives an explicit maximum number of active paints but requires a mixed-integer solver.

For a browser application, subset enumeration is usually much simpler.

---

# 7. Recommended Sparse Recipe Algorithm

The recommended first implementation is:

> enumerate useful paint subsets of size 1 through 4, solve each subset, and rank the results.

## 7.1 Basic algorithm

For each subset size:

```text
k = 1
k = 2
k = 3
k = 4
```

generate every combination of `k` paints.

For every subset:

1. run the existing ratio solver using only those paints;
2. calculate the predicted mixture;
3. calculate target error;
4. calculate practical recipe amounts;
5. optionally round them;
6. calculate rounded error;
7. store the candidate.

Then rank candidates.

Pseudo-code:

```js
for (let k = 1; k <= Math.min(4, paints.length); k++) {
    for (const subset of combinations(paints, k)) {
        const result = solvePaintMix(subset, target);

        candidates.push({
            subset,
            result,
            colorError: result.error,
        });
    }
}
```

## 7.2 Why re-optimize every subset?

Do **not** take the unrestricted result and simply keep its four largest weights.

Example:

```text
Unrestricted:
A = 40%
B = 30%
C = 15%
D = 10%
E = 5%
```

If we drop `E`, the optimal four-paint recipe is not necessarily:

```text
A = 42.1%
B = 31.6%
C = 15.8%
D = 10.5%
```

The best four-paint solution may involve a completely different combination of paints.

Therefore the correct procedure is:

```text
choose subset
    ↓
solve ratios again
```

not:

```text
solve once
    ↓
truncate weights
```

## 7.3 Complexity

Number of subsets up to four paints:

```text
C(N,1) + C(N,2) + C(N,3) + C(N,4)
```

Examples:

### 10 paints

```text
10 + 45 + 120 + 210 = 385 candidates
```

### 20 paints

```text
20 + 190 + 1,140 + 4,845 = 6,195 candidates
```

### 30 paints

```text
30 + 435 + 4,060 + 27,405 = 31,930 candidates
```

### 50 paints

```text
50 + 1,225 + 19,600 + 230,300 = 251,175 candidates
```

For normal personal palettes, exhaustive search is completely reasonable.

For larger libraries, use candidate pruning first.

---

# 8. Finding the Most Important Paints

Percentage contribution and importance are **not the same thing**.

A paint contributing only 2% may make a large hue correction.

A paint contributing 50% may mostly be acting as a neutral base.

The recommended importance measurement is **leave-one-out re-optimization**.

## 8.1 Removal importance

Let:

```text
Efull
```

be the error of the complete selected recipe.

For every active paint `i`:

1. remove paint `i`;
2. re-optimize the remaining paints;
3. measure the new error:

```text
Ewithout_i
```

4. calculate:

```text
importance_i = Ewithout_i - Efull
```

Interpretation:

```text
importance close to 0
    -> paint is mostly redundant

large importance
    -> paint is essential to reaching the target
```

Example:

| Paint | Contribution | Error if removed | Importance |
|---|---:|---:|---:|
| White | 48% | 7.2 | +2.1 |
| Blue | 33% | 23.8 | +18.7 |
| Yellow | 17% | 13.5 | +8.4 |
| Red | 2% | 21.0 | +15.9 |

Even though red contributes only `2%`, its removal causes a large error increase.

That means:

```text
Contribution: low
Importance: high
```

This distinction is extremely useful in a real recipe UI.

## 8.2 Normalized importance

Raw error differences can be normalized:

```text
normalizedImportance_i =
    max(Ewithout_i - Efull, 0)
    /
    sum_j max(Ewithout_j - Efull, 0)
```

This creates values that sum to 1.

For display:

```text
Blue    ████████████████████
Red     █████████████████
Yellow  █████████
White   ███
```

## 8.3 Importance labels

Suggested mapping:

```text
0.00–0.10 -> Low
0.10–0.30 -> Moderate
0.30–0.60 -> High
0.60–1.00 -> Critical
```

The exact boundaries should be treated as UX rules, not mathematical truths.

## 8.4 Sensitivity importance

A second optional metric is:

> how sensitive is the color to a small measurement error in this paint?

For each active paint:

1. perturb its amount slightly;
2. rebalance other paints;
3. recalculate color error.

A paint can be:

```text
high importance
high sensitivity
```

meaning it is both necessary and easy to over/under-dose.

That could trigger a warning such as:

> Measure the blue carefully; a 1 mL change produces a relatively large predicted shift.

---

# 9. Recipe Ranking: Best, Recommended, and Simplest

Returning only a single mathematical optimum is not always best for a painter.

A much better UX returns multiple categories.

## 9.1 Best Accuracy

The candidate with minimum predicted color error.

Example:

```text
4 paints
error = 2.85
```

## 9.2 Recommended

The best trade-off between:

- color match,
- number of paints,
- measurable quantities,
- sensitivity.

Example:

```text
2 paints
error = 3.10
```

If the visual difference between error `2.85` and `3.10` is negligible, the two-paint recipe is much easier to execute.

## 9.3 Simplest

The lowest paint-count solution that stays inside an acceptable quality threshold.

Example:

```text
1 paint
error = 8.2
```

or:

```text
2 paints
error = 3.1
```

## 9.4 Candidate score

A practical scoring function can be:

```text
score =
    normalizedColorError
    + complexityWeight * paintCount
    + tinyAmountPenalty
    + roundingPenalty
    + sensitivityPenalty
```

Example:

```js
score =
    colorError
    + 0.8 * paintCount
    + 2.0 * tinyAmountCount
    + 0.5 * roundedRecipeErrorIncrease;
```

The constants should eventually be tuned from user testing.

## 9.5 Pareto frontier

An even cleaner method is to preserve candidates that are **Pareto optimal**.

Candidate A dominates candidate B if A is:

- no worse in error,
- no more complex,
- and strictly better in at least one dimension.

Then the app can show only meaningful trade-offs.

Example:

```text
1 paint  error 12.3
2 paints error 3.1
3 paints error 2.9
4 paints error 2.85
```

The user can decide whether the last `0.25` error reduction is worth two extra paints.

---

# 10. Converting Percentages to a 200 mL Recipe

The mathematical solver should always work in normalized fractions.

Volume conversion happens afterward.

Let:

```text
V = requested total volume in mL
```

Default:

```text
V = 200
```

For each paint:

```text
mL_i = wi * V
```

Example:

```text
weights:
0.486
0.345
0.169
```

At:

```text
V = 200 mL
```

we obtain:

```text
White  = 0.486 * 200 = 97.2 mL
Blue   = 0.345 * 200 = 69.0 mL
Yellow = 0.169 * 200 = 33.8 mL
```

Total:

```text
97.2 + 69.0 + 33.8 = 200.0 mL
```

## 10.1 Volume should remain independent from color optimization

Changing:

```text
200 mL
```

to:

```text
1,000 mL
```

should not require solving the color again.

Ratios remain:

```text
48.6%
34.5%
16.9%
```

Only absolute amounts scale.

---

# 11. Rounding to Real Measuring Equipment

A mathematical recipe may produce:

```text
93.426 mL
68.791 mL
33.114 mL
4.669 mL
```

That is often unnecessarily precise.

The user should be able to choose a measuring increment:

```text
0.1 mL
0.5 mL
1 mL
2 mL
5 mL
```

## 11.1 Why independent rounding is wrong

Suppose:

```text
66.6 mL
66.6 mL
66.8 mL
```

Independent whole-mL rounding gives:

```text
67
67
67
```

Total:

```text
201 mL
```

That violates the requested `200 mL`.

## 11.2 Largest-remainder allocation

Convert the total batch into discrete units.

For:

```text
200 mL
```

with:

```text
1 mL increments
```

there are:

```text
200 units
```

For:

```text
200 mL
```

with:

```text
0.5 mL increments
```

there are:

```text
400 units
```

Procedure:

1. calculate exact units per paint;
2. floor each value;
3. count unallocated units;
4. rank paints by fractional remainder;
5. distribute remaining units to the largest remainders.

This guarantees:

```text
sum(rounded amounts) = requested total
```

---

# 12. Minimum Measurable Paint Amount

A recipe can be mathematically excellent but physically awkward.

Example:

```text
White  103.3 mL
Blue    71.8 mL
Yellow  24.4 mL
Red      0.5 mL
```

If the user can only measure whole milliliters, `0.5 mL` is problematic.

Define:

```text
minimumUsefulMl
```

For example:

```text
minimumUsefulMl = 1
```

## 12.1 Decision procedure

For every paint with:

```text
amount < minimumUsefulMl
```

evaluate two possibilities.

### Keep it

If removing it significantly worsens the color.

### Remove it

If it is nearly redundant.

The correct test is:

```text
remove paint
   ↓
re-optimize remaining subset
   ↓
compare error
```

not simply:

```text
amount is small -> delete it
```

## 12.2 Larger batch suggestion

If a crucial pigment requires:

```text
0.25 mL
```

in a:

```text
200 mL
```

batch, the system can recommend increasing the batch.

For example:

```text
At 200 mL:
0.25 mL

At 800 mL:
1.00 mL
```

This can make a sensitive ratio physically measurable.

---

# 13. Re-Evaluating the Rounded Physical Recipe

After rounding:

```text
97.2 -> 97 mL
69.0 -> 69 mL
33.8 -> 34 mL
```

the actual mathematical weights have changed.

Therefore, recalculate them:

```text
w'_i = roundedMl_i / totalMl
```

Then send those new weights through the mixture model.

This gives:

```text
predicted mathematical ideal
```

versus:

```text
predicted physically measurable recipe
```

The UI can show:

```text
Ideal mathematical recipe
97.2 mL / 69.0 mL / 33.8 mL

Practical 1 mL recipe
97 mL / 69 mL / 34 mL

Predicted rounded color difference:
Very small
```

This is substantially better than hiding the effect of rounding.

---

# 14. Color Error and Match Quality

The current compatibility solver uses transformed-space squared distance during optimization and ordinary RGB Euclidean distance for its final error.

For strict compatibility, preserve that behavior.

For a new project, consider separating:

```text
optimization metric
```

from:

```text
user-facing perceptual metric
```

## 14.1 Compatibility error

Use the existing transformed-space objective.

This makes your solver behave similarly to the reference algorithm.

## 14.2 Perceptual display metric

For UI ranking, consider:

- CIE Lab Delta E,
- OKLab distance.

These models are designed to better reflect perceived differences than raw 8-bit RGB Euclidean distance.

Do not silently change the optimizer until you have regression tests, because a different metric can change recommended ratios.

A safe architecture is:

```text
primary solve:
existing transformed-space objective

secondary ranking:
perceptual color difference
```

---

# 15. Confidence Scoring

A single percentage such as:

```text
92% confidence
```

can be misleading unless its meaning is defined.

A better design calculates separate confidence components.

## 15.1 Mathematical reachability

How close is the best digital mixture?

```text
high closeness -> high mathematical confidence
```

## 15.2 Recipe robustness

How much does a small measurement error change the predicted result?

```text
stable mixture -> high robustness
```

## 15.3 Rounding loss

How much worse is the rounded recipe than the ideal recipe?

```text
tiny difference -> high practical confidence
```

## 15.4 Physical-model confidence

If the system has no calibration data for these exact paints:

```text
physical confidence = lower
```

If it has many measured examples for the same products:

```text
physical confidence = higher
```

## 15.5 Suggested output

```text
Digital match:       Excellent
Measurement robustness: Good
Rounded recipe loss: Negligible
Physical calibration: Uncalibrated
Overall physical confidence: Medium
```

This is more honest and useful than pretending there is one universal certainty percentage.

---

# 16. Complete Recommended Solver Pipeline

```text
┌───────────────────────────────┐
│ Input available paints       │
│ RGB/HEX + metadata           │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Target color                 │
│ RGB/HEX                      │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Candidate pruning (optional) │
│ for very large palettes      │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Enumerate subsets of 1–4     │
│ paints                       │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Solve optimal weights for    │
│ every subset                 │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Calculate color error        │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Calculate paint importance   │
│ and sensitivity             │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Convert fractions -> mL      │
│ default 200 mL              │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Round to measurement step    │
│ while preserving total      │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Recalculate rounded mixture  │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Score practical candidate    │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Return                       │
│ - Recommended               │
│ - Best Accuracy             │
│ - Simplest                  │
└───────────────────────────────┘
```

Later:

```text
mathematical prediction
         │
         ▼
ML correction model
         │
         ▼
estimated real-world result
```

---

# 17. Suggested JavaScript API

A clean module layout could expose:

```js
solvePaintMix()
findBestSparseMix()
findCandidateRecipes()
rankRecipeCandidates()
calculatePaintImportance()
calculateRecipeSensitivity()
weightsToVolume()
roundRecipeVolumes()
evaluateRoundedRecipe()
estimateRecipeConfidence()
```

Future ML:

```js
predictPhysicalCorrection()
recordMixExperiment()
trainCorrectionModel()
```

Suggested high-level entry point:

```js
findPaintRecipe({
    paints,
    target,
    totalMl: 200,
    maxPaints: 4,
    measurementStepMl: 1,
    minimumUsefulMl: 1,
});
```

Return:

```js
{
    target,
    requestedVolumeMl: 200,

    recommended: { ... },

    bestAccuracy: { ... },

    simplest: { ... },

    alternatives: [ ... ],

    diagnostics: {
        candidatesEvaluated,
        solverTimeMs,
        physicalCalibrationAvailable,
    }
}
```

---

# 18. Reference Implementation Sketches

These snippets are intended to describe the new project layer on top of the already-created `color-math.js`.

---

## 18.1 Generate combinations

```js
export function* combinations(items, choose, start = 0, prefix = []) {
    if (prefix.length === choose) {
        yield [...prefix];
        return;
    }

    const remainingNeeded = choose - prefix.length;

    for (
        let i = start;
        i <= items.length - remainingNeeded;
        i += 1
    ) {
        prefix.push(items[i]);

        yield* combinations(
            items,
            choose,
            i + 1,
            prefix
        );

        prefix.pop();
    }
}
```

---

## 18.2 Find sparse candidate recipes

```js
import {
    solvePaintMix,
} from "./color-math.js";

export function findSparseCandidates(
    paints,
    targetRgb,
    {
        maxPaints = 4,
    } = {},
) {
    const candidates = [];

    const limit = Math.min(maxPaints, paints.length);

    for (let count = 1; count <= limit; count += 1) {
        for (const subset of combinations(paints, count)) {
            const subsetRgb = subset.map(p => p.rgb);

            const result = solvePaintMix(
                subsetRgb,
                targetRgb,
            );

            candidates.push({
                paints: subset,
                weights: result.weights,
                mixed: result.mixed,
                error: result.error,
                paintCount: subset.length,
            });
        }
    }

    return candidates;
}
```

---

## 18.3 Convert weights to volume

```js
export function weightsToVolume(
    weights,
    totalMl = 200,
) {
    return weights.map(weight => weight * totalMl);
}
```

---

## 18.4 Largest-remainder volume rounding

```js
export function roundRecipeVolumes(
    weights,
    totalMl = 200,
    stepMl = 1,
) {
    if (!(totalMl > 0)) {
        throw new Error("totalMl must be positive");
    }

    if (!(stepMl > 0)) {
        throw new Error("stepMl must be positive");
    }

    const totalUnits = Math.round(totalMl / stepMl);

    const exactUnits = weights.map(
        weight => weight * totalUnits
    );

    const allocatedUnits = exactUnits.map(Math.floor);

    let usedUnits = allocatedUnits.reduce(
        (sum, value) => sum + value,
        0
    );

    let remainingUnits = totalUnits - usedUnits;

    const priority = exactUnits
        .map((value, index) => ({
            index,
            remainder: value - Math.floor(value),
        }))
        .sort(
            (a, b) => b.remainder - a.remainder
        );

    for (
        let i = 0;
        i < remainingUnits;
        i += 1
    ) {
        allocatedUnits[priority[i].index] += 1;
    }

    return allocatedUnits.map(
        units => units * stepMl
    );
}
```

The result will sum to:

```text
totalUnits * stepMl
```

which should equal the requested total provided the total is compatible with the selected step.

---

## 18.5 Exact-total safety check

```js
export function sum(values) {
    return values.reduce(
        (total, value) => total + value,
        0
    );
}

export function validateRoundedTotal(
    volumes,
    expectedMl,
    epsilon = 1e-9,
) {
    const actual = sum(volumes);

    if (Math.abs(actual - expectedMl) > epsilon) {
        throw new Error(
            `Rounded recipe totals ${actual} mL, expected ${expectedMl} mL`
        );
    }
}
```

---

## 18.6 Re-evaluate rounded recipe

```js
import {
    weightedMix,
    rgbToApproxRyb,
    approxRybToRgb,
    colorDistance,
} from "./color-math.js";

export function evaluateFixedWeights(
    paintsRgb,
    weights,
    targetRgb,
) {
    const paintSpace = paintsRgb.map(
        rgbToApproxRyb
    );

    const mixedSpace = weightedMix(
        paintSpace,
        weights
    );

    const mixedRgb = approxRybToRgb(
        mixedSpace
    );

    return {
        weights,
        mixed: mixedRgb,
        error: colorDistance(
            mixedRgb,
            targetRgb
        ),
    };
}

export function evaluateRoundedRecipe(
    paintsRgb,
    roundedMl,
    targetRgb,
) {
    const totalMl = roundedMl.reduce(
        (sum, x) => sum + x,
        0
    );

    const weights = roundedMl.map(
        ml => ml / totalMl
    );

    return evaluateFixedWeights(
        paintsRgb,
        weights,
        targetRgb
    );
}
```

---

## 18.7 Paint removal importance

```js
import {
    solvePaintMix,
} from "./color-math.js";

export function calculatePaintImportance(
    paints,
    targetRgb,
    fullError,
) {
    if (paints.length <= 1) {
        return paints.map(() => ({
            rawImportance: Infinity,
            normalizedImportance: 1,
        }));
    }

    const rows = paints.map((paint, removeIndex) => {
        const remaining = paints.filter(
            (_, index) => index !== removeIndex
        );

        const result = solvePaintMix(
            remaining.map(p => p.rgb),
            targetRgb
        );

        return {
            paint,
            errorWithout: result.error,
            rawImportance: Math.max(
                result.error - fullError,
                0
            ),
        };
    });

    const importanceTotal = rows.reduce(
        (sum, row) =>
            sum + row.rawImportance,
        0
    );

    return rows.map(row => ({
        ...row,

        normalizedImportance:
            importanceTotal > 0
                ? row.rawImportance /
                  importanceTotal
                : 0,
    }));
}
```

### Important note

For best results, calculate importance on the **selected sparse subset**, not on the entire original palette.

Otherwise a removed paint might simply be replaced by one of many unused alternatives, which measures library redundancy rather than recipe importance.

Both metrics can be useful, but they answer different questions:

```text
recipe importance:
How necessary is this paint in this recipe?

library uniqueness:
How difficult is it to replace this paint from my whole collection?
```

---

## 18.8 Minimum-volume cleanup

```js
export function findTinyContributions(
    recipe,
    minimumUsefulMl = 1,
) {
    return recipe.amountsMl
        .map((ml, index) => ({
            index,
            ml,
        }))
        .filter(row =>
            row.ml > 0 &&
            row.ml < minimumUsefulMl
        );
}
```

Do not automatically remove them.

Instead:

```text
tiny paint detected
     │
     ▼
remove it
     │
     ▼
solve again
     │
     ▼
compare error increase
```

---

## 18.9 Practical candidate score

```js
export function scoreCandidate(
    candidate,
    {
        paintCountWeight = 0.8,
        tinyPaintWeight = 2.0,
        roundingLossWeight = 1.0,
    } = {},
) {
    const roundingLoss = Math.max(
        candidate.roundedError -
        candidate.idealError,
        0
    );

    return (
        candidate.idealError +
        paintCountWeight *
            candidate.paintCount +
        tinyPaintWeight *
            candidate.tinyPaintCount +
        roundingLossWeight *
            roundingLoss
    );
}
```

Do not assume these exact constants are correct.

Expose them as configuration while testing.

---

# 19. Performance and Candidate Pruning

For small palettes, exhaustive search is ideal.

For very large paint libraries, evaluate perhaps:

```text
12–20 promising candidate paints
```

before subset enumeration.

## 19.1 Candidate sources

Build a candidate pool from multiple strategies.

### Nearest individual paints

Select the closest colors to the target.

### Unrestricted optimizer

Run the original full-palette solver and include paints with meaningful weights.

### Geometric diversity

Include paints that lie in different directions around the target in transformed space.

This avoids keeping only individually similar colors.

For example, a target green can be created using:

```text
yellow + blue
```

even though neither source color is individually close to the target.

### High replacement value

Include unique paints that are difficult to reproduce with the rest of the library.

## 19.2 Avoid naive nearest-only pruning

This is dangerous:

```text
take 10 paints nearest target
```

because mixing often depends on colors that are far from the target individually but useful together.

A good candidate set should include both:

```text
near target
```

and:

```text
useful directional basis colors
```

## 19.3 Two-stage approach

Recommended for large libraries:

```text
Stage 1:
50–500 paints
      ↓
candidate heuristic
      ↓
15 paints

Stage 2:
enumerate all subsets <= 4
among those 15
```

Number of candidates for 15:

```text
15 + 105 + 455 + 1,365 = 1,940
```

Very manageable.

---

# 20. Machine Learning: Where It Actually Helps

ML should **not** be used merely because the problem contains colors.

The base ratio problem already has:

- a clear objective,
- known constraints,
- a deterministic optimizer.

Using a neural network to replace that solver would add:

- training requirements,
- nondeterminism,
- extrapolation risk,
- weaker interpretability,

without solving the main physical limitation.

The real weakness is that RGB/RYB-like mathematics does not know the physical behavior of specific pigments.

That is exactly where ML can help.

---

## 20.1 Residual correction model

Let:

```text
Cmath
```

be the base mathematical prediction.

Let:

```text
Cactual
```

be the measured physical result.

Define residual:

```text
ΔC = Cactual - Cmath
```

Train ML to predict:

```text
ΔC
```

from recipe information.

Then:

```text
Ccorrected = Cmath + ML(features)
```

This architecture has several advantages.

### It works with zero training data

Before ML exists:

```text
ML correction = 0
```

and the base solver still functions.

### It learns only the missing physics

The model does not need to relearn basic color geometry.

### It is debuggable

You can inspect:

```text
mathematical prediction
ML correction
final prediction
```

separately.

### It can be paint-specific

The model can learn:

> this ultramarine blue is stronger than its digital RGB suggests.

---

# 21. ML Dataset Design

A useful real-world observation should store more than just:

```text
input color -> output color
```

Recommended experiment record:

```json
{
  "experimentId": "mix_000123",

  "timestamp": "2026-08-08T12:00:00Z",

  "target": {
    "rgb": [123, 213, 213]
  },

  "paints": [
    {
      "paintId": "brandA-white-01",
      "amountMl": 97,
      "weight": 0.485
    },
    {
      "paintId": "brandA-blue-03",
      "amountMl": 69,
      "weight": 0.345
    },
    {
      "paintId": "brandA-yellow-02",
      "amountMl": 34,
      "weight": 0.170
    }
  ],

  "totalMl": 200,

  "basePrediction": {
    "rgb": [124, 208, 212]
  },

  "measuredResult": {
    "rgb": [118, 201, 205]
  },

  "conditions": {
    "paintType": "acrylic",
    "surface": "white-card",
    "dryState": "dry",
    "measurementMethod": "colorimeter"
  }
}
```

---

# 22. ML Features and Targets

## 22.1 Basic features

For each selected paint:

- paint identity,
- source RGB,
- transformed RYB coordinates,
- amount,
- normalized fraction.

Global features:

- total batch volume,
- target RGB,
- base predicted RGB,
- number of paints.

## 22.2 Better paint metadata

If available:

- manufacturer,
- product line,
- pigment code,
- opacity,
- finish,
- binder,
- viscosity,
- density,
- tint strength,
- measured spectral data.

## 22.3 Environmental features

Potentially useful:

- wet/dry state,
- substrate color,
- layer thickness,
- lighting/illuminant,
- measurement device.

Avoid adding weakly controlled variables until you can collect them reliably.

## 22.4 Target representation

Prefer training in a perceptual or approximately linear color representation rather than directly predicting sRGB bytes.

Possible targets:

```text
ΔLab
```

or:

```text
ΔOKLab
```

or spectral residuals if the system later has spectral measurements.

---

# 23. Recommended ML Models

## 23.1 Start simple

Before deep learning, test:

### Ridge regression

Good baseline.

Benefits:

- very interpretable,
- fast,
- low data requirement.

### Random forest

Can model nonlinear interactions.

### Gradient boosted trees

A strong practical choice for structured/tabular experiment data.

Tree boosting can model interactions such as:

```text
this blue behaves differently when mixed with this white
```

without needing a very large neural dataset.

## 23.2 Neural networks later

Consider an MLP only after collecting enough diverse real mix data.

Potential reason:

- many paint identities,
- nonlinear pigment interactions,
- larger metadata space.

Do not assume "neural network" automatically means more accurate.

## 23.3 Per-paint calibration before ML

An even simpler useful model is to learn per-paint correction parameters.

Example:

```text
effective strength multiplier
```

for each paint.

If blue repeatedly needs only 70% of the mathematically predicted amount, the system can learn that the paint has high tinting strength.

This may give a large improvement with little data.

---

# 24. Training and Validation Strategy

A color correction model can appear accurate while simply memorizing known recipes.

Validation must be designed carefully.

## 24.1 Normal random split

Useful first check, but can be overly optimistic.

## 24.2 Hold out recipes

Ensure test recipes are unseen combinations/ratios.

## 24.3 Hold out paint products

Train without one paint identity and test whether the system generalizes.

This is much harder.

## 24.4 Hold out brands

Useful if you want brand-independent behavior.

## 24.5 Metrics

Evaluate:

- RGB error for compatibility,
- perceptual Delta E,
- recipe ratio error if predicting ratios,
- before-vs-after correction improvement.

Most important:

```text
Does ML reduce real measured color error
compared with the base mathematical model?
```

If not, do not use it.

---

# 25. Real-World Color Measurement

Training data is only as good as its measurements.

## 25.1 Smartphone camera problems

Phone RGB varies with:

- auto white balance,
- exposure,
- HDR processing,
- camera sensor,
- lens,
- room lighting,
- shadows,
- reflections.

A phone photo can still be useful, but uncontrolled photographs are noisy labels.

## 25.2 Better setup

At minimum:

- fixed light source,
- fixed camera settings,
- neutral background,
- calibration card,
- dry paint samples,
- consistent distance and angle.

## 25.3 Best practical option

A colorimeter or spectrophotometer gives substantially better repeatability.

For advanced physical modeling, spectral reflectance measurements are much more valuable than only sRGB.

---

# 26. Future Physical Pigment Model

The current RYB-like system is an approximation designed around 3-channel colors.

Real subtractive paint mixing depends on spectral behavior.

A stronger physical roadmap is:

```text
RGB-only approximation
        ↓
per-paint learned correction
        ↓
measured Lab/OKLab calibration
        ↓
spectral reflectance data
        ↓
Kubelka-Munk style pigment model
```

## 26.1 Kubelka-Munk

Kubelka-Munk theory models absorption and scattering in diffuse materials.

Pigments can be characterized by wavelength-dependent parameters commonly described as:

```text
K = absorption
S = scattering
```

Mixtures can then be modeled from component properties and concentrations.

This is significantly more physically meaningful than ordinary RGB interpolation.

However, accurate use requires real pigment/material information.

That means the existing RGB/RYB solver remains useful because:

- it requires only colors,
- it is fast,
- it can run entirely in-browser,
- it provides reasonable starting recipes.

A future physical mode can be offered separately.

---

# 27. Data Structures

## 27.1 Paint

```ts
interface Paint {
    id: string;
    name: string;

    hex: string;

    rgb: {
        r: number;
        g: number;
        b: number;
    };

    metadata?: {
        brand?: string;
        productLine?: string;
        pigmentCode?: string;
        paintType?: string;
        opacity?: number;
        density?: number;
    };
}
```

## 27.2 Recipe line

```ts
interface RecipeLine {
    paintId: string;

    weight: number;
    percentage: number;

    idealMl: number;
    roundedMl: number;

    importance?: number;
    sensitivity?: number;
}
```

## 27.3 Recipe candidate

```ts
interface RecipeCandidate {
    paints: Paint[];

    lines: RecipeLine[];

    paintCount: number;

    idealMixedRgb: RGB;
    roundedMixedRgb: RGB;

    idealError: number;
    roundedError: number;

    score: number;

    tinyPaintCount: number;

    confidence?: RecipeConfidence;
}
```

## 27.4 Solver request

```ts
interface RecipeRequest {
    paints: Paint[];

    targetRgb: RGB;

    totalMl?: number;           // default: 200
    maxPaints?: number;         // default: 4

    measurementStepMl?: number; // default: 1
    minimumUsefulMl?: number;   // default: 1

    candidateLimit?: number;
}
```

---

# 28. Suggested Application Architecture

```text
src/
│
├── color/
│   ├── color-math.js
│   ├── color-distance.js
│   └── color-conversion.js
│
├── solver/
│   ├── continuous-solver.js
│   ├── combinations.js
│   ├── sparse-solver.js
│   ├── candidate-pruning.js
│   ├── recipe-ranking.js
│   └── importance.js
│
├── recipe/
│   ├── volume.js
│   ├── rounding.js
│   ├── sensitivity.js
│   └── confidence.js
│
├── ml/
│   ├── feature-builder.js
│   ├── physical-correction.js
│   └── experiment-store.js
│
└── tests/
    ├── color-math.test.js
    ├── sparse-solver.test.js
    ├── volume.test.js
    ├── rounding.test.js
    └── importance.test.js
```

The color solver should remain independent from UI code.

That allows reuse in:

- web app,
- server API,
- mobile app,
- CLI,
- testing tools.

---

# 29. Testing Strategy

## 29.1 Existing regression

Keep the known reference test:

```text
Available:
#FFFFFF
#000000
#FF0000
#FFFF00
#0000FF

Target:
#7BD5D5
```

Expected current-style result approximately:

```text
White  48.6%
Blue   34.5%
Yellow 16.9%

Estimated:
rgb(124, 208, 212)
```

## 29.2 Simplex invariants

For every solver result:

```text
wi >= 0
```

and:

```text
abs(sum(wi) - 1) < epsilon
```

## 29.3 Sparse constraint

For sparse recipe output:

```text
activePaintCount <= 4
```

## 29.4 Volume total

For every recipe:

```text
sum(idealMl) ≈ requestedMl
```

For rounded recipe:

```text
sum(roundedMl) == requestedMl
```

within floating-point tolerance.

## 29.5 Scaling test

A 100 mL and 200 mL recipe should have identical normalized fractions.

## 29.6 Rounding test

Test:

```text
200 mL at 1 mL
200 mL at 0.5 mL
50 mL at 0.1 mL
```

## 29.7 Importance test

Removing a truly essential paint should increase error.

## 29.8 Duplicate colors

Duplicate paint colors should not break the solver.

## 29.9 One paint

Result:

```text
100%
```

## 29.10 Exact reachable mixture

Construct a target directly from known weights and verify the sparse solver can recover an equivalent low-error recipe.

---

# 30. UX Recommendations

A practical result card could look like:

```text
TARGET
#81A6A0

RECOMMENDED RECIPE — 200 mL
────────────────────────────────
White             96 mL   48.0%
Blue              69 mL   34.5%
Yellow            35 mL   17.5%
────────────────────────────────
TOTAL             200 mL  100%

Predicted color
#80A4A1

Recipe complexity
3 paints

Measurement step
1 mL

Rounded recipe effect
Negligible
```

Then:

```text
IMPORTANCE

Blue    Critical  ███████████████████
Yellow  High      ████████████
White   Moderate  ███████
```

And alternatives:

```text
BEST ACCURACY
4 paints
Error: 2.85

RECOMMENDED
3 paints
Error: 2.94

SIMPLEST
2 paints
Error: 3.18
```

This gives the user control rather than pretending there is only one correct recipe.

---

# 31. Development Roadmap

## Phase 1 — Current mathematical engine

Already available:

- RGB parsing,
- RYB-like transform,
- inverse transform,
- constrained optimizer,
- percentage result.

## Phase 2 — Practical recipe layer

Implement:

- volume scaling,
- default 200 mL,
- exact-total rounding,
- configurable measurement increment.

## Phase 3 — Sparse solver

Implement:

- combinations 1–4,
- re-optimization per subset,
- candidate ranking.

## Phase 4 — Importance and sensitivity

Implement:

- leave-one-out importance,
- perturbation sensitivity,
- tiny-amount analysis.

## Phase 5 — UX and confidence

Implement:

- Best Accuracy,
- Recommended,
- Simplest,
- match diagnostics,
- practical warnings.

## Phase 6 — Experiment recording

Store:

- requested target,
- paint IDs,
- exact amounts,
- predicted result,
- actual measured result,
- measurement conditions.

## Phase 7 — ML calibration

Start with:

- ridge baseline,
- gradient boosted tree model,
- per-paint correction factors.

Compare all models against:

```text
base math without ML
```

## Phase 8 — Spectral / physical mode

If enough instrumentation and pigment data become available:

- spectral measurement,
- Kubelka-Munk model,
- paint-specific absorption/scattering calibration.

---

# 32. Important Limitations

## 32.1 RGB does not uniquely identify physical pigment behavior

Two paints can look identical in RGB but contain different pigments and mix differently.

This is a fundamental information limitation.

## 32.2 The current RYB-like transform is not a spectrophotometric model

It is a digital approximation.

It is useful for recipe estimation, not laboratory formulation.

## 32.3 Volume fraction may not perfectly correspond to optical mixing strength

Different paints have different:

- pigment load,
- density,
- tint strength.

Real recipes may require correction.

## 32.4 White and highly concentrated pigments can dominate mixtures

A small measured amount may have a disproportionately large physical effect.

This is exactly the kind of behavior the future calibration/ML layer should learn.

## 32.5 Camera measurements can be misleading

Do not treat an uncontrolled phone RGB reading as laboratory ground truth.

## 32.6 Four-color guarantee applies to the current 3D convex mixture model

The `<= 4` result comes from the dimensionality and convex-combination assumptions.

If a future physical model uses:

- full spectra,
- nonlinear concentration physics,
- extra material dimensions,

the same four-color guarantee does not necessarily apply in the same way.

---

# 33. References

## DigitPaints

### Paint Color Mixer

Public tool description and current reference example:

https://www.digitpaints.com/en/color-mixer

At the time this design was prepared, the page described adding owned paint colors, entering a target RGB color, and receiving estimated percentages. The default five-color example for target `#7BD5D5` produced approximately:

```text
White 48.6%
Blue 34.5%
Yellow 16.9%
```

with estimated RGB near:

```text
rgb(124, 208, 212)
```

## RYB color modeling

Junichi Sugita and Tokiichiro Takahashi:

**Computational RYB Color Model and its Applications**

IIEEJ Transactions on Image Electronics and Visual Computing, 2017.

https://doi.org/10.11371/tievciieej.5.2_110

The paper describes RYB as a subtractive model based on pigment color mixing and presents RGB/RYB conversion and compositing approaches.

## Convex combinations / four-color bound

**Carathéodory's theorem**

For points in `R^d`, a point in their convex hull can be represented as a convex combination of at most `d + 1` points.

Reference:

https://mathworld.wolfram.com/CaratheodorysFundamentalTheorem.html

For a three-dimensional mixing space:

```text
d = 3
d + 1 = 4
```

## Projection methods

John Duchi, Shai Shalev-Shwartz, Yoram Singer, and Tushar Chandra:

**Efficient Projections onto the l1-Ball for Learning in High Dimensions**

ICML 2008.

https://doi.org/10.1145/1390156.1390191

Probability-simplex projection is closely related to the projection techniques used in constrained gradient methods.

## RGB-only subtractive mixing limitation

Scott Allen Burns:

**Subtractive Color Mixture Computation**

2017.

https://arxiv.org/abs/1710.06364

This work discusses why RGB values alone are insufficient to uniquely determine physical subtractive mixture behavior and describes an RGB-to-representative-spectrum approach.

## Kubelka-Munk / pigment physics

For a later physically calibrated solver, Kubelka-Munk methods are relevant because they model absorption and scattering in pigment/coating systems.

One useful discussion of constrained paint formulation:

Paul Centore:

**Enforcing Kubelka–Munk constraints for opaque paints**

Coloration Technology, 2020.

DOI:

https://doi.org/10.1111/cote.12497

## Gradient boosting for future ML correction

Scikit-learn documentation:

https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.GradientBoostingRegressor.html

Gradient boosted trees are a reasonable candidate for structured paint-experiment data before moving to a neural network.

---

# Final Recommended Design

For the first serious version of the project, implement:

```text
1. Existing RGB -> RYB-like mixer
2. Sparse subset search <= 4 paints
3. Re-optimize every candidate subset
4. Leave-one-out importance
5. Default 200 mL scaling
6. Exact-total practical rounding
7. Minimum measurable amount handling
8. Re-evaluate rounded recipe
9. Rank Best / Recommended / Simplest
10. Record physical experiments
```

Then add ML **only after actual physical measurements exist**:

```text
base mathematical solver
        │
        ▼
predicted digital result
        │
        ▼
learned residual correction
        │
        ▼
better estimate of real paint result
```

That architecture preserves a deterministic, explainable baseline while allowing the system to become paint-brand- and pigment-aware over time.

The most important principle is:

> **Use optimization to solve the known mathematics, and use machine learning only to learn the physical behavior that the mathematical model does not know.**

