/** Bound in-flight work, preserving input order and attempting every item on failure. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  map: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("Concurrency must be a positive integer");
  }
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  let firstError: unknown;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = await map(items[index]!, index);
      } catch (error) {
        if (!failed) firstError = error;
        failed = true;
      }
    }
  }));
  if (failed) throw firstError;
  return results;
}
