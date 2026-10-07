const NEXON_BASE_URL = 'https://open.api.nexon.com'

interface NexonErrorBody {
  error?: { name?: string; message?: string }
}

/** Mirrors the backend's `NexonApiError` shape/name so error handling reads
 * the same way on both sides, even though this client never talks to our
 * backend. */
export class NexonDirectApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'NexonDirectApiError'
    this.status = status
    this.code = code
  }
}

/** Nexon's documented Open API limit is 500 requests/second, but a
 * sliding-window limiter capped just under that (480/s) still produced
 * real 429s mid-sweep in practice (confirmed live, 2026-09-21 —
 * "Try again later"/OPENAPI00007). Our own unthrottled concurrency testing
 * (see docs/planning/features/probability.md's "날짜 구간 조회") never
 * sustained above ~260 req/s anyway, so there was no real throughput cost
 * to backing off hard: 200/s leaves roughly 2.5x headroom under the
 * documented limit for whatever undocumented burst-sensitivity or
 * per-key/per-window nuance is actually causing the 429s, without slowing
 * real-world sweeps down noticeably. If 429s still occur, retrying (below)
 * is the actual safety net — this cap is a preventive measure, not a
 * guarantee. */
const NEXON_RATE_LIMIT_PER_SECOND = 200

/** A wide-capacity bucket still lets requests clump — refilling at
 * `NEXON_RATE_LIMIT_PER_SECOND` already permits a burst that size every
 * second even with a small capacity, but keeping the *idle-bucket* burst
 * small forces requests to spread out close to evenly over time instead of
 * firing in one clump whenever the bucket's been sitting full. Kept below
 * `DATE_FETCH_CONCURRENCY` (`nexon-history-range.ts`) so the concurrency
 * pool, not this cap, is the steady-state bottleneck. */
const BURST_CAPACITY = 20

class TokenBucketRateLimiter {
  private tokens: number
  private lastRefillAt: number
  private readonly capacity: number
  private readonly refillPerMs: number

  constructor(ratePerSecond: number, capacity: number) {
    this.capacity = capacity
    this.tokens = capacity
    this.refillPerMs = ratePerSecond / 1000
    this.lastRefillAt = Date.now()
  }

  private refill(): void {
    const now = Date.now()
    const elapsedMs = now - this.lastRefillAt
    if (elapsedMs <= 0) return
    this.tokens = Math.min(this.capacity, this.tokens + elapsedMs * this.refillPerMs)
    this.lastRefillAt = now
  }

  async acquire(): Promise<void> {
    for (;;) {
      this.refill()
      if (this.tokens >= 1) {
        this.tokens -= 1
        return
      }
      const waitMs = (1 - this.tokens) / this.refillPerMs
      await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 1)))
    }
  }
}

/** Module-level singleton, not one per fetch call/hook — every
 * `nexonDirectGet` call funnels through this same limiter regardless of
 * which hook or how many concurrent categories triggered it (e.g.
 * 모아보기 fetches 스타포스/잠재능력/큐브 concurrently via `Promise.all`;
 * without a *shared* limiter each would independently allow up to the cap,
 * summing to several times Nexon's real limit). This is the single
 * chokepoint all Probability-domain Nexon traffic passes through, so
 * putting the limiter here caps it globally without every caller needing
 * to know about it. */
const rateLimiter = new TokenBucketRateLimiter(NEXON_RATE_LIMIT_PER_SECOND, BURST_CAPACITY)

const MAX_RATE_LIMIT_RETRIES = 4

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Calls `open.api.nexon.com` directly from the browser using a
 * user-supplied API key — deliberately not built on `api-client.ts`
 * (`openapi-fetch`), which points at our own backend. Used only by the
 * Probability domain; see `docs/planning/features/probability.md`. The key
 * never reaches our server.
 *
 * A 429 (`OPENAPI00007`, "API 호출량 초과") retries with exponential
 * backoff (500ms/1s/2s/4s) up to `MAX_RATE_LIMIT_RETRIES` times before
 * giving up — the rate limiter above is a *preventive* measure, not a
 * guarantee, so a transient 429 slipping through still needs to be
 * recoverable rather than aborting whatever multi-date sweep triggered it.
 * Any other error (e.g. `OPENAPI00004` on a request Nexon genuinely
 * rejects) is not retried — retrying a fundamentally invalid request just
 * wastes the same number of calls for the same failure. */
export async function nexonDirectGet<T>(
  path: string,
  apiKey: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value != null) query.set(key, String(value))
  }
  const queryString = query.toString()
  const url = `${NEXON_BASE_URL}${path}${queryString ? `?${queryString}` : ''}`

  for (let attempt = 0; ; attempt++) {
    await rateLimiter.acquire()
    const response = await fetch(url, { headers: { 'x-nxopen-api-key': apiKey } })
    const body: unknown = await response.json().catch(() => ({}))

    if (response.ok) return body as T

    const errorBody = body as NexonErrorBody
    const code = errorBody.error?.name ?? 'UNKNOWN'
    const message = errorBody.error?.message ?? response.statusText

    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      await sleep(500 * 2 ** attempt)
      continue
    }

    throw new NexonDirectApiError(response.status, code, message)
  }
}
