const HEX_RE = /^#[0-9a-fA-F]{6}$/
const MAX_COLORS = 100
// Mirrors src/lib/sanitize.ts's client-side name rules — the client already
// filters as-you-type, but the server must not trust that a request actually
// came from this client, so it re-enforces the same charset/length here.
const MAX_NAME_LENGTH = 32
const NAME_RE = /^[a-zA-Z0-9 '&().,-]*$/
const MAX_BODY_BYTES = 10_000
const UNIT_MODES = new Set(['percentage', 'ml'])
const VOLUME_UNITS = new Set(['ml', 'l', 'us_fl_oz', 'us_pint', 'us_quart', 'us_gallon'])

export interface SharePayload {
  target: string
  colors: Array<{ hex: string; name: string }>
  totalMl: number
  unitMode: string
  volumeUnit: string
}

export function bodyTooLarge(raw: string): boolean {
  return Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES
}

export function validatePayload(value: unknown): value is SharePayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>

  if (typeof payload.target !== 'string' || !HEX_RE.test(payload.target)) return false
  if (typeof payload.totalMl !== 'number' || !Number.isFinite(payload.totalMl) || payload.totalMl <= 0) return false
  if (typeof payload.unitMode !== 'string' || !UNIT_MODES.has(payload.unitMode)) return false
  if (typeof payload.volumeUnit !== 'string' || !VOLUME_UNITS.has(payload.volumeUnit)) return false
  if (!Array.isArray(payload.colors) || payload.colors.length === 0 || payload.colors.length > MAX_COLORS) return false

  return payload.colors.every((c) => {
    if (!c || typeof c !== 'object') return false
    const color = c as Record<string, unknown>
    if (typeof color.hex !== 'string' || !HEX_RE.test(color.hex)) return false
    if (typeof color.name !== 'string' || color.name.length > MAX_NAME_LENGTH || !NAME_RE.test(color.name)) return false
    return true
  })
}

const ID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export function isValidShareId(id: string): boolean {
  return ID_RE.test(id)
}
