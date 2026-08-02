import assert from "node:assert";
import { test } from "node:test";
import { withNoStore } from "./supabase/server";

test("Supabase server requests always bypass the Next.js data cache", () => {
  const headers = { authorization: "Bearer test" };
  const init = withNoStore({
    method: "GET",
    headers,
    cache: "force-cache",
  });

  assert.equal(init.cache, "no-store");
  assert.equal(init.method, "GET");
  assert.equal(init.headers, headers);
});
