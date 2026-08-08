import {
  formatRgb,
  rgbToHex,
  solvePaintMixHex,
  visibleMixRows,
} from "../src/color-math.js";

const paints = [
  "#ffffff",
  "#000000",
  "#ff0000",
  "#ffff00",
  "#0000ff",
];

const target = "#7BD5D5";
const result = solvePaintMixHex(paints, target);

console.log(`Target:    ${target}`);
console.log(`Estimated: ${rgbToHex(result.mixed)} ${formatRgb(result.mixed)}`);
console.log(`RGB error: ${result.error.toFixed(4)}`);
console.log("");

for (const row of visibleMixRows(paints, result)) {
  console.log(
    `${row.hex.toUpperCase().padEnd(8)} ${row.percentage.toFixed(1).padStart(5)}%`,
  );
}
