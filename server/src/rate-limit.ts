interface Window {
  count: number
  resetAt: number
}

/** In-memory per-key fixed-window limiter. Fine for a single process; would need a
 * shared (Redis-backed) counter if this service ever runs as multiple replicas. */
export class RateLimiter {
  private windows = new Map<string, Window>()
  private callsSinceSweep = 0

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    // Bounds the map's growth (otherwise every distinct IP ever seen stays
    // in memory forever) without needing a separate timer.
    if (++this.callsSinceSweep >= 1000) {
      this.callsSinceSweep = 0
      for (const [k, w] of this.windows) if (now >= w.resetAt) this.windows.delete(k)
    }

    const existing = this.windows.get(key)
    if (!existing || now >= existing.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs })
      return true
    }
    if (existing.count >= this.max) return false
    existing.count += 1
    return true
  }
}
