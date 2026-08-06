import assert from "node:assert";
import { test } from "node:test";
import { takeoffNotificationTag } from "./dispatcher";

test("takeoff notification tag is stable for same tail inside one window", () => {
  const first = takeoffNotificationTag("n67817", "2026-08-06T01:18:29.501Z");
  const second = takeoffNotificationTag("N67817", "2026-08-06T01:29:00.000Z");

  assert.equal(first, second);
});

test("takeoff notification tag changes for later windows", () => {
  const first = takeoffNotificationTag("N67817", "2026-08-06T01:18:29.501Z");
  const second = takeoffNotificationTag("N67817", "2026-08-06T01:34:00.000Z");

  assert.notEqual(first, second);
});
