/**
 * color-math.js
 *
 * Readable, behavior-compatible study implementation of the color-calculation
 * pipeline observed in the user-supplied DigitPaints production bundle.
 *
 * IMPORTANT:
 * - This is NOT copied minified production source.
 * - Names, structure, comments, validation, and public API are rewritten.
 * - The goal is to document the mathematics/behavior in a maintainable form.
 *
 * Pipeline:
 *   RGB/HEX -> approximate RYB mixing space
 *           -> solve non-negative weights whose sum is 1
 *           -> linearly mix in RYB space
 *           -> convert RYB back to RGB
 *
 * The optimizer is projected gradient descent on the probability simplex.
 */

const DEFAULT_ITERATIONS = 500;
const DEFAULT_INITIAL_STEP = 0.25;
const MIN_STEP = 0.0001;
const MAX_STEP = 1.0;
const STEP_GROWTH = 1.05;
const STEP_SHRINK = 0.5;

/**
 * Clamp a numeric color channel to an integer in [0, 255].
 *
 * This mirrors the observed behavior:
 * - non-finite -> 0
 * - round to nearest integer
 * - clamp to 0..255
 */
export function clampByte(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Convert a HEX color to { r, g, b }.
 *
 * Compatible behaviors:
 * - "#abc" -> "#aabbcc"
 * - missing leading "#" is accepted
 * - non-3-digit strings are left-padded with zeroes, then truncated to 6 chars
 *
 * NOTE:
 * This intentionally follows the observed site's permissive parsing behavior.
 * For production code, you may prefer strict validation.
 */
export function hexToRgb(hex) {
  let raw = String(hex).replace("#", "");

  if (raw.length === 3) {
    raw = raw
      .split("")
      .map((c) => c + c)
      .join("");
  } else {
    raw = raw.padStart(6, "0").slice(0, 6);
  }

  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

/** Convert {r,g,b} to "#rrggbb". */
export function rgbToHex(rgb) {
  return (
    "#" +
    [rgb.r, rgb.g, rgb.b]
      .map((channel) => clampByte(channel).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Human-readable RGB string, useful for UI/debug output. */
export function formatRgb(rgb) {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/**
 * Squared Euclidean distance between two 3-channel colors.
 *
 * Squared distance is used inside optimization because sqrt() is monotonic:
 * minimizing d^2 gives the same optimum as minimizing d, but is cheaper and
 * differentiable everywhere.
 */
export function squaredDistance(a, b) {
  return (
    (a.r - b.r) ** 2 +
    (a.g - b.g) ** 2 +
    (a.b - b.b) ** 2
  );
}

/** Ordinary Euclidean RGB distance. */
export function colorDistance(a, b) {
  return Math.sqrt(squaredDistance(a, b));
}

/**
 * Weighted linear combination of 3-channel vectors.
 *
 * The function does NOT normalize weights. The solver guarantees that weights
 * lie on the simplex (non-negative and summing to 1).
 */
export function weightedMix(colors, weights) {
  let r = 0;
  let g = 0;
  let b = 0;

  for (let i = 0; i < colors.length; i += 1) {
    const w = weights[i] ?? 0;
    r += colors[i].r * w;
    g += colors[i].g * w;
    b += colors[i].b * w;
  }

  return { r, g, b };
}

/**
 * Euclidean projection onto the probability simplex:
 *
 *   S = { w | w_i >= 0, sum(w_i) = 1 }
 *
 * Why this matters:
 * - negative paint amounts are impossible
 * - percentages should add to 100%
 *
 * This is the standard sort-and-threshold simplex projection:
 *   1. Sort candidate values descending.
 *   2. Find the active set size rho.
 *   3. Compute threshold theta.
 *   4. Return max(v_i - theta, 0).
 */
export function projectOntoSimplex(values) {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => b - a);

  let cumulative = 0;
  let activeCount = 0;

  for (let i = 0; i < sorted.length; i += 1) {
    cumulative += sorted[i];
    const threshold = (cumulative - 1) / (i + 1);

    if (sorted[i] - threshold > 0) {
      activeCount = i + 1;
    }
  }

  const activeSum = sorted
    .slice(0, activeCount)
    .reduce((sum, value) => sum + value, 0);

  const theta = (activeSum - 1) / activeCount;

  return values.map((value) => Math.max(value - theta, 0));
}

/**
 * Convert RGB (0..255) to an approximate painter-oriented RYB space (0..1).
 *
 * The observed algorithm follows this conceptual process:
 *
 * 1. Normalize RGB to 0..1.
 * 2. Pull out the common "white" component.
 * 3. Extract yellow from the shared red+green component.
 * 4. Correct the region where blue and green coexist.
 * 5. Rescale chroma so overall intensity is retained.
 * 6. Restore the removed white component.
 *
 * Returned keys are still {r,g,b} only so generic vector functions can be used,
 * but semantically they mean:
 *   r = Red
 *   g = Yellow
 *   b = Blue
 *
 * This is an approximate subtractive/painterly transform, NOT a spectral
 * reflectance model and NOT a physically exact paint simulation.
 */
export function rgbToApproxRyb(rgb) {
  let red = rgb.r / 255;
  let green = rgb.g / 255;
  let blue = rgb.b / 255;

  // Remove common neutral component.
  const white = Math.min(red, green, blue);
  red -= white;
  green -= white;
  blue -= white;

  // Remember chroma before the RGB -> RYB decomposition.
  const originalMax = Math.max(red, green, blue);

  // Yellow is the overlap between red and green.
  let yellow = Math.min(red, green);
  red -= yellow;
  green -= yellow;

  // A painterly correction: when blue and residual green coexist,
  // split their influence to better approximate RYB behavior.
  if (blue > 0 && green > 0) {
    blue *= 0.5;
    green *= 0.5;
  }

  // Residual green contributes to both yellow and blue.
  yellow += green;
  blue += green;

  // Preserve the original chroma magnitude.
  const convertedMax = Math.max(red, yellow, blue);
  if (convertedMax > 0) {
    const scale = originalMax / convertedMax;
    red *= scale;
    yellow *= scale;
    blue *= scale;
  }

  // Restore the neutral component.
  return {
    r: red + white,
    g: yellow + white,
    b: blue + white,
  };
}

/**
 * Convert the approximate RYB representation back to display RGB (0..255).
 *
 * This reverses the decomposition used by rgbToApproxRyb().
 * As with the forward transform, this is approximate rather than spectral.
 */
export function approxRybToRgb(ryb) {
  let red = ryb.r;
  let yellow = ryb.g;
  let blue = ryb.b;

  // Remove common neutral component.
  const white = Math.min(red, yellow, blue);
  red -= white;
  yellow -= white;
  blue -= white;

  const originalMax = Math.max(red, yellow, blue);

  // Recover green from overlap of yellow and blue.
  let green = Math.min(yellow, blue);
  yellow -= green;
  blue -= green;

  // Undo the painterly correction used by the forward transform.
  if (blue > 0 && green > 0) {
    blue *= 2;
    green *= 2;
  }

  // Residual yellow contributes to both red and green.
  red += yellow;
  green += yellow;

  // Preserve chroma magnitude.
  const convertedMax = Math.max(red, green, blue);
  if (convertedMax > 0) {
    const scale = originalMax / convertedMax;
    red *= scale;
    green *= scale;
    blue *= scale;
  }

  // Restore neutral component and quantize for display RGB.
  return {
    r: clampByte(255 * (red + white)),
    g: clampByte(255 * (green + white)),
    b: clampByte(255 * (blue + white)),
  };
}

/**
 * Find non-negative paint proportions that approximately reproduce a target.
 *
 * Mathematical problem in the transformed RYB-like space:
 *
 *   minimize_w  || Cw - t ||^2
 *
 *   subject to:
 *       w_i >= 0
 *       sum_i w_i = 1
 *
 * where:
 *   - columns/entries of C are the available paints in the transformed space
 *   - t is the transformed target
 *   - w contains the paint proportions
 *
 * Solver:
 *   projected gradient descent with adaptive step size.
 *
 * Initialization:
 *   100% of the single source paint closest to the target in ordinary RGB.
 *
 * Each iteration:
 *   1. Calculate current transformed-space mixture.
 *   2. Calculate residual from transformed target.
 *   3. Calculate gradient of squared error with respect to each weight.
 *   4. Gradient step.
 *   5. Project candidate weights onto simplex.
 *   6. Accept if transformed error did not worsen.
 *   7. Grow or shrink step size.
 *
 * @param {Array<{r:number,g:number,b:number}>} paints
 * @param {{r:number,g:number,b:number}} targetRgb
 * @param {object} [options]
 * @returns {{
 *   weights: number[],
 *   percentages: number[],
 *   mixed: {r:number,g:number,b:number},
 *   error: number,
 *   transformedErrorSquared: number,
 *   iterations: number
 * } | null}
 */
export function solvePaintMix(paints, targetRgb, options = {}) {
  if (paints.length === 0) return null;

  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  let step = options.initialStep ?? DEFAULT_INITIAL_STEP;

  // The one-paint case has no optimization degrees of freedom.
  if (paints.length === 1) {
    return {
      weights: [1],
      percentages: [100],
      mixed: paints[0],
      error: colorDistance(paints[0], targetRgb),
      transformedErrorSquared: squaredDistance(
        rgbToApproxRyb(paints[0]),
        rgbToApproxRyb(targetRgb),
      ),
      iterations: 0,
    };
  }

  const paintRyb = paints.map(rgbToApproxRyb);
  const targetRyb = rgbToApproxRyb(targetRgb);

  // Start at the RGB-nearest single paint.
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < paints.length; i += 1) {
    const d2 = squaredDistance(paints[i], targetRgb);
    if (d2 < nearestDistance) {
      nearestDistance = d2;
      nearestIndex = i;
    }
  }

  let weights = Array(paints.length).fill(0);
  weights[nearestIndex] = 1;

  let bestWeights = [...weights];
  let bestError = squaredDistance(weightedMix(paintRyb, bestWeights), targetRyb);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const currentMix = weightedMix(paintRyb, weights);

    const residual = {
      r: currentMix.r - targetRyb.r,
      g: currentMix.g - targetRyb.g,
      b: currentMix.b - targetRyb.b,
    };

    // For f(w)=||Cw-t||^2, each component of ∇f is:
    //   2 * c_i dot (Cw - t)
    const gradient = paintRyb.map(
      (paint) =>
        2 *
        (residual.r * paint.r +
          residual.g * paint.g +
          residual.b * paint.b),
    );

    // Gradient descent step followed by feasibility projection.
    const candidateWeights = projectOntoSimplex(
      weights.map((w, i) => w - step * gradient[i]),
    );

    const candidateError = squaredDistance(
      weightedMix(paintRyb, candidateWeights),
      targetRyb,
    );

    if (candidateError <= bestError) {
      weights = candidateWeights;
      bestWeights = candidateWeights;
      bestError = candidateError;
      step = Math.min(STEP_GROWTH * step, MAX_STEP);
    } else {
      // Keep the last accepted weights and try a smaller step next time.
      step = Math.max(STEP_SHRINK * step, MIN_STEP);
    }
  }

  // Final projection cleans up tiny numeric drift.
  const finalWeights = projectOntoSimplex(bestWeights);

  // Mix in painterly space, then convert back to display RGB.
  const mixedRyb = weightedMix(paintRyb, finalWeights);
  const mixedRgb = approxRybToRgb(mixedRyb);

  return {
    weights: finalWeights,
    percentages: finalWeights.map((w) => 100 * w),
    mixed: mixedRgb,

    // This is the same kind of final error exposed by the observed code:
    // Euclidean distance in ordinary 8-bit RGB after converting the mix back.
    error: colorDistance(mixedRgb, targetRgb),

    transformedErrorSquared: bestError,
    iterations,
  };
}

/**
 * Convenience wrapper for HEX inputs.
 */
export function solvePaintMixHex(paintHexes, targetHex, options = {}) {
  const paints = paintHexes.map(hexToRgb);
  const target = hexToRgb(targetHex);
  return solvePaintMix(paints, target, options);
}

/**
 * Convert raw solver output into the site's style of visible rows:
 * - round percentage to one decimal place for visibility test
 * - hide 0.0% rows
 * - sort largest contribution first
 *
 * IMPORTANT:
 * This is presentation logic, not optimization logic.
 */
export function visibleMixRows(paintHexes, result) {
  if (!result) return [];

  return paintHexes
    .map((hex, index) => ({
      index,
      hex,
      rgb: hexToRgb(hex),
      weight: result.weights[index] ?? 0,
      percentage: 100 * (result.weights[index] ?? 0),
    }))
    .filter((row) => Number(row.percentage.toFixed(1)) > 0)
    .sort((a, b) => b.weight - a.weight);
}
