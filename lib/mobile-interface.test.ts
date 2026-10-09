import assert from "node:assert/strict";
import { test } from "node:test";
import { backendUrl, connectBackend } from "../mobile/frontend/network";
import { hrefString } from "../mobile/frontend/navigation";
import { parseMobileDataRequest } from "./mobile-data-request";
import { publicPageUrl } from "./public-url";

test("local iOS and Android API requests use the HTTPS backend", () => {
  for (const base of ["capacitor://localhost/ride", "https://localhost/plane/N123?state=WA"]) {
    assert.equal(backendUrl("/api/aircraft?state=WA&_=123", base), "https://outofsight.live/api/aircraft?state=WA&_=123");
    assert.equal(backendUrl(new URL("/api/mobile?kind=catalog", base).href, base), "https://outofsight.live/api/mobile?kind=catalog");
    for (const path of ["/assets/index.js", "/home", "https://tiles.example.com/api/tile", "https://outofsight.live/api/aircraft"]) assert.equal(backendUrl(path, base), path);
  }
});

test("native fetch remapping preserves alert POST bodies, headers, and overrides", async context => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  context.after(() => { if (original) Object.defineProperty(globalThis, "window", original); else Reflect.deleteProperty(globalThis, "window"); });
  const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
  const nativeTransport = async (input: RequestInfo | URL, init?: RequestInit) => { calls.push({ input, init }); return new Response("{}", { headers: { "Content-Type": "application/json" } }); };
  const localWindow = { location: { href: "capacitor://localhost/settings/alerts" }, fetch: nativeTransport };
  Object.defineProperty(globalThis, "window", { value: localWindow, configurable: true });
  connectBackend();
  const payload = JSON.stringify({ enabled: true, deviceId: "test-device" });
  const signal = new AbortController().signal;
  await localWindow.fetch("/api/aircraft-alerts/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, signal });
  assert.equal(calls[0]!.input, "https://outofsight.live/api/aircraft-alerts/subscription");
  assert.equal(calls[0]!.init?.body, payload);
  assert.equal(calls[0]!.init?.signal, signal);
  const request = new Request("capacitor://localhost/api/aircraft-alerts/test", { method: "POST", headers: { "Content-Type": "application/json", "X-Test": "preserved" }, body: payload });
  await localWindow.fetch(request, { cache: "no-store" });
  const sent = calls[1]!.input as Request;
  assert.equal(sent.url, "https://outofsight.live/api/aircraft-alerts/test");
  assert.equal(sent.method, "POST");
  assert.equal(sent.headers.get("X-Test"), "preserved");
  assert.equal(await sent.text(), payload);
  assert.equal(calls[1]!.init?.cache, "no-store");
});

test("mobile navigation and sharing retain aircraft state and flight identifiers", () => {
  const path = hrefString({ pathname: "/flight/N123/20261009T0015", query: { state: "WA", mock: undefined }, hash: "details" });
  assert.equal(path, "/flight/N123/20261009T0015?state=WA#details");
  assert.equal(publicPageUrl(path), "https://outofsight.live" + path);
  assert.throws(() => publicPageUrl("//example.com"), /Invalid OOS page path/);
});

test("the mobile public-data endpoint accepts only supported and bounded queries", () => {
  const parse = (query: string) => parseMobileDataRequest("https://outofsight.live/api/mobile?" + query);
  assert.deepEqual(parse("kind=catalog"), { kind: "catalog" });
  assert.deepEqual(parse("kind=recent-flight&tail=n123"), { kind: "recent-flight", tail: "N123" });
  assert.deepEqual(parse("kind=flight&tail=N123&flightId=20261009T0015"), { kind: "flight", tail: "N123", flightId: "20261009T0015" });
  for (const query of ["kind=admin", "kind=flight&tail=../../admin&flightId=20261009T0015", "kind=flight&tail=N123", "kind=flight&tail=N123&flightId=arbitrary", "kind=recent-flight&tail=" + "N".repeat(13)]) assert.equal(parse(query), null);
});
