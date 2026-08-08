import test from "node:test";
import assert from "node:assert/strict";

import {
  approxRybToRgb,
  hexToRgb,
  projectOntoSimplex,
  rgbToApproxRyb,
  solvePaintMixHex,
  visibleMixRows,
} from "../src/color-math.js";

test("simplex projection returns non-negative weights summing to one", () => {
  const projected = projectOntoSimplex([0.8, 0.5, -0.1, 0.4]);

  assert.ok(projected.every((x) => x >= 0));

  const sum = projected.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-12);
});

test("RGB -> approximate RYB -> RGB is stable for key colors", () => {
  const colors = [
    "#ffffff",
    "#000000",
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
    "#7bd5d5",
  ];

  for (const hex of colors) {
    const rgb = hexToRgb(hex);
    const roundTrip = approxRybToRgb(rgbToApproxRyb(rgb));

    // The transform is approximate but these representative values should
    // round-trip closely.
    assert.ok(Math.abs(roundTrip.r - rgb.r) <= 1, `${hex}: red`);
    assert.ok(Math.abs(roundTrip.g - rgb.g) <= 1, `${hex}: green`);
    assert.ok(Math.abs(roundTrip.b - rgb.b) <= 1, `${hex}: blue`);
  }
});

test("regression: current DigitPaints five-basic-colors example", () => {
  const paints = [
    "#ffffff",
    "#000000",
    "#ff0000",
    "#ffff00",
    "#0000ff",
  ];

  const result = solvePaintMixHex(paints, "#7BD5D5");
  const visible = visibleMixRows(paints, result);

  assert.deepEqual(result.mixed, { r: 124, g: 208, b: 212 });

  // Compare one-decimal percentages shown by the live tool.
  assert.deepEqual(
    visible.map((row) => [row.hex.toLowerCase(), row.percentage.toFixed(1)]),
    [
      ["#ffffff", "48.6"],
      ["#0000ff", "34.5"],
      ["#ffff00", "16.9"],
    ],
  );
});

test("one source paint must receive 100%", () => {
  const result = solvePaintMixHex(["#123456"], "#abcdef");

  assert.deepEqual(result.weights, [1]);
  assert.deepEqual(result.percentages, [100]);
  assert.deepEqual(result.mixed, hexToRgb("#123456"));
});
