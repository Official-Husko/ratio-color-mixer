import { createClient, type RedisClientType } from 'redis'

export interface Store {
  /** Reads a value and, if present, refreshes its TTL to `ttlSeconds` (sliding expiration). */
  getAndRefresh(key: string, ttlSeconds: number): Promise<string | null>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
}

export class RedisStore implements Store {
  private client: RedisClientType

  constructor(url: string) {
    this.client = createClient({ url })
    this.client.on('error', (err) => console.error('[redis] client error', err))
  }

  async connect(): Promise<void> {
    await this.client.connect()
  }

  async getAndRefresh(key: string, ttlSeconds: number): Promise<string | null> {
    return this.client.getEx(key, { EX: ttlSeconds })
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, { EX: ttlSeconds })
  }
}
