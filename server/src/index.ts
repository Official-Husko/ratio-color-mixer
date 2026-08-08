import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { uuidv7 } from 'uuidv7'
import { RedisStore, type Store } from './store.js'
import { RateLimiter } from './rate-limit.js'
import { bodyTooLarge, isValidShareId, validatePayload } from './validate.js'

const SHARE_KEY_PREFIX = 'share:'
const MAX_BODY_BYTES = 10_000

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim()
  return req.socket.remoteAddress ?? 'unknown'
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) })
  res.end(json)
}

async function readBody(req: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) return null
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export interface HandlerOptions {
  ttlSeconds: number
  rateLimiter: RateLimiter
}

export function createHandler(store: Store, options: HandlerOptions) {
  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (req.method === 'GET' && url.pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok')
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/share') {
      if (!options.rateLimiter.allow(clientIp(req))) {
        sendJson(res, 429, { error: 'Too many share links created — try again later.' })
        return
      }

      const raw = await readBody(req)
      if (raw === null || bodyTooLarge(raw)) {
        sendJson(res, 413, { error: 'Payload too large.' })
        return
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        sendJson(res, 400, { error: 'Invalid JSON.' })
        return
      }

      if (!validatePayload(parsed)) {
        sendJson(res, 400, { error: 'Invalid share payload.' })
        return
      }

      const id = uuidv7()
      await store.set(SHARE_KEY_PREFIX + id, JSON.stringify({ v: 1, ...parsed }), options.ttlSeconds)
      sendJson(res, 201, { id })
      return
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/share/')) {
      const id = url.pathname.slice('/api/share/'.length)
      if (!isValidShareId(id)) {
        sendJson(res, 400, { error: 'Malformed share id.' })
        return
      }

      const stored = await store.getAndRefresh(SHARE_KEY_PREFIX + id, options.ttlSeconds)
      if (stored === null) {
        sendJson(res, 404, { error: 'Share link expired or does not exist.' })
        return
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(stored)
      return
    }

    sendJson(res, 404, { error: 'Not found.' })
  }
}

async function main() {
  const port = Number(process.env.PORT ?? 3000)
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
  const ttlSeconds = Number(process.env.SHARE_TTL_SECONDS ?? 60 * 60 * 24 * 30)
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 30)
  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60 * 60 * 1000)

  const store = new RedisStore(redisUrl)
  await store.connect()

  const handler = createHandler(store, {
    ttlSeconds,
    rateLimiter: new RateLimiter(rateLimitMax, rateLimitWindowMs),
  })

  createServer((req, res) => {
    handler(req, res).catch((err) => {
      console.error('[server] unhandled error', err)
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error.' })
    })
  }).listen(port, () => {
    console.log(`[server] listening on :${port}`)
  })
}

// Only bootstrap when run directly (not when imported by tests).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[server] fatal startup error', err)
    process.exit(1)
  })
}
