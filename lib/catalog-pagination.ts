type RowsResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export const CATALOG_PAGE_SIZE = 500;
export const CATALOG_KEY_BATCH_SIZE = 100;

/** Callers must supply a stable unique ordering (tail or id). */
export async function readAllCatalogPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<RowsResult<T>>,
  context: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await fetchPage(
      rows.length,
      rows.length + CATALOG_PAGE_SIZE - 1,
    );
    if (error) throw new Error(`${context}: ${error.message}`);
    if (!data?.length) return rows;
    rows.push(...data);
    // Request until empty, even if a project uses a cap below our page size.
  }
}

export function catalogBatches<T>(
  values: readonly T[],
  size = CATALOG_KEY_BATCH_SIZE,
): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error("Invalid catalog batch size");
  const batches: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}

/** For unique-key reads: each key yields at most one row. Bounds URL length. */
export async function readCatalogKeyBatches<T>(
  keys: string[],
  fetchBatch: (keys: string[]) => PromiseLike<RowsResult<T>>,
  context: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (const batch of catalogBatches([...new Set(keys)])) {
    const { data, error } = await fetchBatch(batch);
    if (error) throw new Error(`${context}: ${error.message}`);
    rows.push(...data ?? []);
  }
  return rows;
}
