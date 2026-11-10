import assert from "node:assert/strict";
import { test } from "node:test";
import { createNotificationsHandler } from "../src/notifications-handler";

const token = "a".repeat(64);
const request = (body: unknown = {}, credential: string = token) => new Request("https://example.com/oos-notifications", {
  method: "POST", headers: { "x-oos-notification-token": credential }, body: JSON.stringify(body),
});

test("notification worker rejects callers before dispatch and fails closed without credentials", async () => {
  let calls = 0;
  const dependencies = { authorize: async (value: string) => value === token, ready: () => true, run: async () => { calls++; } };
  const handler = createNotificationsHandler(dependencies);
  for (const value of ["", "bad", "b".repeat(64)]) assert.equal((await handler(request({}, value))).status, 401);
  assert.equal((await handler(new Request("https://example.com"))).status, 405);
  assert.equal((await createNotificationsHandler({ ...dependencies, ready: () => false })(request())).status, 503);
  assert.equal(calls, 0);
});

test("notification worker keeps dry-run mode explicit and rejects malformed payloads", async () => {
  const modes: boolean[] = [];
  const handler = createNotificationsHandler({ authorize: async () => true, ready: () => true, run: async dryRun => {
    modes.push(dryRun); return { ok: true, dry_run: dryRun };
  } });
  for (const body of [null, [], "true", { dryRun: "true" }]) assert.equal((await handler(request(body))).status, 400);
  for (const body of [{}, { dryRun: true }, { dryRun: false }]) {
    const response = await handler(request(body));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  assert.deepEqual(modes, [false, true, false]);
});

test("notification worker returns a sanitized error when dispatch fails", async () => {
  const handler = createNotificationsHandler({ authorize: async () => true, ready: () => true, run: async () => { throw new Error("private database failure"); } });
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "worker_failed" });
});
