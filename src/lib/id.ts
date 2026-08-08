/**
 * `crypto.randomUUID()` only exists in secure contexts (HTTPS, or
 * localhost/127.0.0.1) — it's simply undefined anywhere else, e.g. loading
 * the Vite dev server from another device over `http://<lan-ip>:5173`
 * (`vite --host`). Falling back keeps the app usable there instead of
 * throwing on mount before anything renders.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
