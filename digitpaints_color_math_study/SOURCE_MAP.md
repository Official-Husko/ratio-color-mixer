# Source Map: User-Supplied Production Bundle -> Readable Implementation

The attached production JavaScript is webpack/minified, so local function names are single letters.

This document maps the relevant calculation responsibilities to the rewritten names in `src/color-math.js`.

| Observed bundle function/region | Responsibility | Readable implementation |
|---|---|---|
| `m(...)` | finite check, round and clamp 0..255 | `clampByte()` |
| `p(...)` | HEX -> RGB | `hexToRgb()` |
| `h(...)` | RGB -> HEX | `rgbToHex()` |
| `x(...)` | RGB string formatting | `formatRgb()` |
| `g(...)` | weighted 3-channel sum | `weightedMix()` |
| `f(...)` | project weights to non-negative sum=1 simplex | `projectOntoSimplex()` |
| `b(...)` / `j(...)` | squared RGB/vector distance (duplicates) | `squaredDistance()` |
| `_(...)` | RGB -> painter-oriented RYB-like transform | `rgbToApproxRyb()` |
| inline transform inside solver | RYB-like -> RGB | `approxRybToRgb()` |
| solver block assigned to `M` | optimize paint weights | `solvePaintMix()` |
| percentage display block | multiply weight by 100, hide 0.0%, sort | `visibleMixRows()` |

## Important observation

The two distance helpers in the bundle are mathematically identical. They appear to be duplicated by bundling/minification or source organization, not because they use different metrics.

## Calculation-only boundary

Not included in the rewritten module because it is not color mathematics:

- React state,
- localStorage palette persistence,
- analytics events,
- translations,
- buttons and color inputs,
- SVG icons,
- cards/layout,
- cookie/consent code.

That separation is intentional: `src/color-math.js` contains the complete relevant calculation pipeline without unrelated application code.
