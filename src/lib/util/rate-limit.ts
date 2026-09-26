/**
 * Small in-memory rate limiter / concurrency guard.
 *
 * This is intentionally dependency free. On Vercel every warm serverless instance keeps
 * its own counters, so this is a "best effort, per-instance" guard: it stops a single
 * browser tab (or a loop) from hammering our routes and the free upstream APIs, which is
 * exactly the abuse case we care about. A shared store (Redis) can be dropped in later
 * behind the same interface.
 */

export interface RateLimitRule {
  /** Max number of allowed hits inside the window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5000;

function prune(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size > MAX_TRACKED_KEYS) buckets.clear();
}

export function checkRateLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  prune(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, remaining: rule.limit - existing.count, retryAfterSeconds: 0 };
}

/**
 * Global concurrency gate: bounds how many expensive upstream calls (LLM evaluations)
 * may be in flight inside this server instance at the same time.
 */
export class Semaphore {
  private available: number;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly capacity: number) {
    this.available = Math.max(1, capacity);
  }

  async acquire(): Promise<() => void> {
    if (this.available > 0) {
      this.available -= 1;
      return () => this.release();
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    return () => this.release();
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      next();
      return;
    }
    this.available = Math.min(this.capacity, this.available + 1);
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await task();
    } finally {
      release();
    }
  }
}

const evaluationGate = new Semaphore(3);

/** Shared gate for LLM calls (max 3 in flight per server instance). */
export function withEvaluationSlot<T>(task: () => Promise<T>): Promise<T> {
  return evaluationGate.run(task);
}
