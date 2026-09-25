export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** `Promise.all` over `items` with at most `limit` in flight, so a burst never trips the RPC's rate limit. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Event args and chain reads as JSON-safe values: bigints become decimal strings. */
export function plain(value: Record<string, unknown>): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] =
      typeof v === "boolean"
        ? v
        : typeof v === "object" && v !== null
          ? JSON.stringify(v, (_, inner) => (typeof inner === "bigint" ? inner.toString() : inner))
          : String(v);
  }
  return out;
}
