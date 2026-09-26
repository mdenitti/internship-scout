export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `worker` over `items` with a bounded number of parallel tasks.
 * Results keep the input order. The worker is never called for an index twice,
 * and a throwing worker does not stop the others.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const size = Math.max(1, Math.floor(limit) || 1);
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index] as T, index);
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * Serialises outbound calls so that two of them are never closer than `minDelayMs`.
 * Used to stay friendly with free-tier rate limits.
 */
export class Throttle {
  private lastStartedAt = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly minDelayMs: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release: () => void = () => {};
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    const wait = this.minDelayMs - (Date.now() - this.lastStartedAt);
    if (wait > 0) await sleep(wait);
    this.lastStartedAt = Date.now();
    try {
      return await task();
    } finally {
      release();
    }
  }
}
