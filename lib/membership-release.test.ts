import assert from "node:assert/strict";
import { test } from "node:test";
import { Capacitor } from "@capacitor/core";
import { assertPro, openPro, proSnapshot, refreshPro, requirePro, purchasePro, restorePro, setProTestingPlan } from "../mobile/frontend/release/pro-access";

test("release access ignores the development membership bridge and preserves existing features", async t => {
  t.mock.method(Capacitor, "isPluginAvailable", () => true);
  const status = await refreshPro();
  assert.equal(status.enabled, false);
  assert.equal(status.ready, true);
  assert.equal(status.elite, false);
  for (const feature of ["ride", "stats", "live", "notifications", "paths", "nationwide"] as const) {
    assert.equal(await requirePro(feature), true);
    await assertPro(feature);
  }
  openPro("live");
  assert.equal(proSnapshot(), status);
});

test("release adapters cannot activate Elite or purchases through old links and saved testing plans", async () => {
  assert.equal(await requirePro("elite"), false);
  await assert.rejects(() => assertPro("elite"));
  for (const action of [purchasePro, restorePro, () => setProTestingPlan("elite")]) {
    await assert.rejects(action);
  }
  assert.equal(proSnapshot().elite, false);
});
