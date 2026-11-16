import assert from "node:assert/strict";
import { test } from "node:test";
import { proSnapshot, refreshPro, requirePro } from "./pro-access";

test("existing releases retain feature access without the native membership preview", async () => {
  assert.equal(proSnapshot().enabled, false);
  const status = await refreshPro();
  assert.equal(status.enabled, false);
  assert.equal(status.development, false);
  for (const feature of ["ride", "live", "notifications", "paths", "nationwide"] as const) {
    assert.equal(await requirePro(feature), true);
  }
});
