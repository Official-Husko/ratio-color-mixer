import { DEFAULT_VOLUME_UNIT, SHARE_CODE_PARAM, SHARE_PARAM } from './constants'
import { isVolumeUnit } from './units'
import type { SharePayload } from '../types'

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

function normalizePayload(parsed: SharePayload): SharePayload {
  return {
    v: 1,
    target: parsed.target,
    totalMl: parsed.totalMl,
    unitMode: parsed.unitMode,
    // Optional/absent on links generated before unit selection existed —
    // fall back rather than rejecting the whole link.
    volumeUnit: isVolumeUnit(parsed.volumeUnit) ? parsed.volumeUnit : DEFAULT_VOLUME_UNIT,
    colors: parsed.colors.map((c) => ({ hex: c.hex, name: typeof c.name === 'string' ? c.name : '' })),
  }
}

/**
 * Creates a short-lived (30 days, refreshed on every visit) server-stored
 * share code for the given palette. Throws on network failure or a non-2xx
 * response — callers decide how to surface that.
 */
export async function createShareCode(payload: SharePayload): Promise<string> {
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to create share link (${res.status})`)
  const body = (await res.json()) as { id: string }
  return body.id
}

/** Resolves a short code from the server. Returns null if it's expired, unknown, or unreachable. */
export async function fetchSharedPayload(id: string): Promise<SharePayload | null> {
  try {
    const res = await fetch(`/api/share/${encodeURIComponent(id)}`)
    if (!res.ok) return null
    const parsed = await res.json()
    if (!isValidPayload(parsed)) return null
    return normalizePayload(parsed)
  } catch {
    return null
  }
}

export function buildShareCodeUrl(id: string): string {
  const params = new URLSearchParams()
  params.set(SHARE_CODE_PARAM, id)
  return `${location.origin}${location.pathname}?${params.toString()}`
}

export function getShareCodeFromUrl(search: string): string | null {
  return new URLSearchParams(search).get(SHARE_CODE_PARAM)
}

/** Legacy: links generated before short codes existed embedded the full
 * palette as JSON in `?s=`. Decoding (but no longer generating) these keeps
 * already-shared links working. */
export function decodeShareState(search: string): SharePayload | null {
  const raw = new URLSearchParams(search).get(SHARE_PARAM)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!isValidPayload(parsed)) return null
    return normalizePayload(parsed)
  } catch {
    return null
  }
}
