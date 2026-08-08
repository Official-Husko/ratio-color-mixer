import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts: vitest bundles its own (older) Vite
// version, and sharing a Plugin array between the two causes a TS type
// clash against the project's very new `vite` release. Tests here are pure
// TS with no JSX, so no plugins are needed anyway.
export default defineConfig({
  test: {
    environment: 'node',
    // digitpaints_color_math_study/ ships its own node:test-based suite
    // (run separately via `npm test` inside that folder) — not compatible
    // with Vitest's collector, and not part of this app's test surface.
    exclude: ['**/node_modules/**', 'digitpaints_color_math_study/**'],
  },
})
