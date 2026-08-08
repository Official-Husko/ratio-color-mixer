import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildShareCodeUrl,
  createShareCode,
  decodeShareState,
  fetchSharedPayload,
  getShareCodeFromUrl,
} from './share-link'
import type { SharePayload } from '../types'

function payload(): SharePayload {
  return {
    v: 1,
    target: '#7bd5d5',
    colors: [{ hex: '#ff0000', name: 'Red' }],
    totalMl: 250,
    unitMode: 'percentage',
    volumeUnit: 'ml',
  }
}

beforeEach(() => {
  vi.stubGlobal('location', { origin: 'https://ratio.example', pathname: '/', search: '' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('legacy ?s= link (decode-only)', () => {
  it('decodes a full-payload link', () => {
    const search = `?s=${encodeURIComponent(JSON.stringify(payload()))}`
    expect(decodeShareState(search)).toEqual(payload())
  })

  it('falls back to the default volume unit for pre-unit-selection links', () => {
    const { volumeUnit: _unused, ...legacy } = payload()
    const search = `?s=${encodeURIComponent(JSON.stringify(legacy))}`
    expect(decodeShareState(search)?.volumeUnit).toBe('ml')
  })

  it('returns null when the param is missing or malformed', () => {
    expect(decodeShareState('')).toBeNull()
    expect(decodeShareState('?s=not-json')).toBeNull()
    expect(decodeShareState('?s=' + encodeURIComponent(JSON.stringify({ target: '#fff' })))).toBeNull()
  })
})

describe('getShareCodeFromUrl', () => {
  it('reads the ?c= param', () => {
    expect(getShareCodeFromUrl('?c=abc-123')).toBe('abc-123')
  })

  it('returns null when absent', () => {
    expect(getShareCodeFromUrl('?s=whatever')).toBeNull()
  })
})

describe('buildShareCodeUrl', () => {
  it('builds a ?c= link against the current origin/pathname', () => {
    expect(buildShareCodeUrl('018f5a3c-1234-7abc-8def-0123456789ab')).toBe(
      'https://ratio.example/?c=018f5a3c-1234-7abc-8def-0123456789ab',
    )
  })
})

describe('createShareCode', () => {
  it('POSTs the payload and resolves the returned id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'the-id' }) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(createShareCode(payload())).resolves.toBe('the-id')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/share',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(payload()) }),
    )
  })

  it('throws when the server responds with a non-2xx status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
    await expect(createShareCode(payload())).rejects.toThrow()
  })
})

describe('fetchSharedPayload', () => {
  it('resolves the payload on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload() }))
    await expect(fetchSharedPayload('some-id')).resolves.toEqual(payload())
  })

  it('resolves null on a 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(fetchSharedPayload('missing')).resolves.toBeNull()
  })

  it('resolves null on a network error instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(fetchSharedPayload('some-id')).resolves.toBeNull()
  })

  it('resolves null when the server response is not a valid payload shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nope: true }) }))
    await expect(fetchSharedPayload('some-id')).resolves.toBeNull()
  })
})
