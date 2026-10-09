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

test("notification taps work from bundled app origins without permitting another host", () => {
  for (const base of ["capacitor://localhost/ride", "https://localhost/settings/alerts"]) {
    assert.equal(notificationPath("/plane/N123?state=WA#details", base), "/plane/N123?state=WA#details");
    for (const value of ["//example.com", "/\\example.com", "/\n/evil.com", "capacitor://other-host/ride", "https://outofsight.live/ride"]) assert.equal(notificationPath(value, base), null);
  }
});
