import assert from "node:assert/strict";
import test from "node:test";
import { readAllCatalogPages, readCatalogKeyBatches } from "./catalog-pagination";

test("national catalog reads include rows beyond the API's 1000-row limit", async () => {
  const catalog = Array.from({ length: 1257 }, (_, id) => ({ id }));
  const read = await readAllCatalogPages(async (from, to) => ({
    data: catalog.slice(from, Math.min(from + 1000, to + 1)), error: null,
  }), "Test catalog");
  assert.deepEqual(read, catalog);
});

test("pagination tolerates lower project caps and does not return partial data after an error", async () => {
  const catalog = Array.from({ length: 850 }, (_, id) => id);
  const read = await readAllCatalogPages(async (from, to) => ({
    data: catalog.slice(from, Math.min(from + 80, to + 1)), error: null,
  }), "Test catalog");
  assert.deepEqual(read, catalog);
  await assert.rejects(readAllCatalogPages(async (from) => from === 0
    ? { data: [1, 2], error: null }
    : { data: null, error: { message: "connection failed" } }, "Test catalog"), /Test catalog: connection failed/);
});

test("national current-state reads bound key batches without losing or duplicating aircraft", async () => {
  const ids = Array.from({ length: 1205 }, (_, index) => `aircraft-${index}`);
  const read = await readCatalogKeyBatches([...ids, ids[0]!], async (batch) => {
    assert.ok(batch.length <= 100);
    return { data: batch, error: null };
  }, "Current states");
  assert.deepEqual(read, ids);
  let calls = 0;
  assert.deepEqual(await readCatalogKeyBatches([], async () => {
    calls++;
    return { data: [], error: null };
  }, "Empty"), []);
  assert.equal(calls, 0);
});
