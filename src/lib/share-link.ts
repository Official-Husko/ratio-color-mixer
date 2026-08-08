import { DEFAULT_VOLUME_UNIT, SHARE_PARAM } from './constants'
import { isVolumeUnit } from './units'
import type { SharePayload, UnitMode } from '../types'

function isValidPayload(value: unknown): value is SharePayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>

  if (typeof payload.target !== 'string') return false
  if (typeof payload.totalMl !== 'number') return false
  if (payload.unitMode !== 'percentage' && payload.unitMode !== 'ml') return false
  if (!Array.isArray(payload.colors)) return false

  return payload.colors.every(
    (c) => c && typeof c === 'object' && typeof (c as { hex?: unknown }).hex === 'string',
  )
}

export function encodeShareState(payload: SharePayload): string {
  const params = new URLSearchParams()
  params.set(SHARE_PARAM, JSON.stringify(payload))
  return params.toString()
}

export function buildShareUrl(payload: SharePayload): string {
  return `${location.origin}${location.pathname}?${encodeShareState(payload)}`
}

export function decodeShareState(search: string): SharePayload | null {
  const raw = new URLSearchParams(search).get(SHARE_PARAM)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!isValidPayload(parsed)) return null

    return {
      v: 1,
      target: parsed.target,
      totalMl: parsed.totalMl,
      unitMode: parsed.unitMode as UnitMode,
      // Optional/absent on links generated before unit selection existed —
      // fall back rather than rejecting the whole link.
      volumeUnit: isVolumeUnit(parsed.volumeUnit) ? parsed.volumeUnit : DEFAULT_VOLUME_UNIT,
      colors: parsed.colors.map((c) => ({ hex: c.hex, name: typeof c.name === 'string' ? c.name : '' })),
    }
  } catch {
    return null
  }
}
