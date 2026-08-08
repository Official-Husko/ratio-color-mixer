import { createServer, type Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHandler } from './index'
import { RateLimiter } from './rate-limit'
import type { Store } from './store'

class FakeStore implements Store {
  private data = new Map<string, { value: string; expiresAt: number }>()

  async getAndRefresh(key: string, ttlSeconds: number): Promise<string | null> {
    const entry = this.data.get(key)
    if (!entry || Date.now() >= entry.expiresAt) return null
    entry.expiresAt = Date.now() + ttlSeconds * 1000
    return entry.value
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.data.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
  }
}

function validPayload() {
  return {
    target: '#7bd5d5',
    colors: [{ hex: '#ff0000', name: 'Red' }],
    totalMl: 250,
    unitMode: 'percentage',
    volumeUnit: 'ml',
  }
}

let server: Server
let baseUrl: string
let store: FakeStore

beforeEach(async () => {
  store = new FakeStore()
  const handler = createHandler(store, { ttlSeconds: 2_592_000, rateLimiter: new RateLimiter(30, 60 * 60 * 1000) })
  server = createServer((req, res) => {
    handler(req, res).catch((err) => {
      res.writeHead(500)
      res.end(String(err))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('expected a bound port')
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe('GET /api/health', () => {
  it('returns 200', async () => {
    const res = await fetch(`${baseUrl}/api/health`)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/share + GET /api/share/:id', () => {
  it('creates a share code and reads it back unchanged', async () => {
    const createRes = await fetch(`${baseUrl}/api/share`, {
      method: 'POST',
      body: JSON.stringify(validPayload()),
    })
    expect(createRes.status).toBe(201)
    const { id } = (await createRes.json()) as { id: string }
    expect(id).toMatch(/^[0-9a-f-]{36}$/)

    const getRes = await fetch(`${baseUrl}/api/share/${id}`)
    expect(getRes.status).toBe(200)
    const body = await getRes.json()
    expect(body).toMatchObject({ v: 1, ...validPayload() })
  })

  it('returns 404 for an unknown (but well-formed) id', async () => {
    const res = await fetch(`${baseUrl}/api/share/018f5a3c-1234-7abc-8def-0123456789ab`)
    expect(res.status).toBe(404)
  })

  it('returns 400 for a malformed id', async () => {
    const res = await fetch(`${baseUrl}/api/share/not-a-uuid`)
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid payload', async () => {
    const res = await fetch(`${baseUrl}/api/share`, {
      method: 'POST',
      body: JSON.stringify({ target: 'nope' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 413 for an oversized payload', async () => {
    const oversized = { ...validPayload(), colors: [{ hex: '#ff0000', name: 'x'.repeat(20_000) }] }
    const res = await fetch(`${baseUrl}/api/share`, { method: 'POST', body: JSON.stringify(oversized) })
    expect(res.status).toBe(413)
  })
})

describe('rate limiting', () => {
  it('returns 429 once the per-IP limit is exceeded', async () => {
    const handler = createHandler(store, { ttlSeconds: 2_592_000, rateLimiter: new RateLimiter(2, 60 * 60 * 1000) })
    const limitedServer = createServer((req, res) => {
      handler(req, res).catch((err) => {
        res.writeHead(500)
        res.end(String(err))
      })
    })
    await new Promise<void>((resolve) => limitedServer.listen(0, resolve))
    const address = limitedServer.address()
    if (!address || typeof address === 'string') throw new Error('expected a bound port')
    const url = `http://127.0.0.1:${address.port}/api/share`

    const statuses: number[] = []
    for (let i = 0; i < 3; i++) {
      const res = await fetch(url, { method: 'POST', body: JSON.stringify(validPayload()) })
      statuses.push(res.status)
    }
    expect(statuses).toEqual([201, 201, 429])

    await new Promise<void>((resolve) => limitedServer.close(() => resolve()))
  })
})
