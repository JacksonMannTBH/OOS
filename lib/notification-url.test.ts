import assert from "node:assert/strict";
import { test } from "node:test";
import { notificationPath } from "./notification-url";

test("notification taps keep aircraft routes and state parameters", () => {
  assert.equal(notificationPath("/plane/N123?state=WA#details", "https://outofsight.live"), "/plane/N123?state=WA#details");
});

test("notification taps cannot navigate to another origin", () => {
  for (const value of ["//example.com", "/\\example.com", "https://example.com", "javascript:alert(1)", null, 123]) {
    assert.equal(notificationPath(value, "https://outofsight.live"), null);
  }
});
