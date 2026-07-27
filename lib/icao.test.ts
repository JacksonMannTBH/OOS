// Run: npx tsx --test lib/icao.test.ts
//
// Reference values verified against the canonical Python implementation
// (icao-nnumber-converter-us, MIT) on 2026-04-30.
import { test } from "node:test";
import assert from "node:assert";
import { nNumberToIcao } from "./icao";
import { FLEET } from "./seed";

test("N1 → a00001 (first US registration)", () => {
  assert.equal(nNumberToIcao("N1"), "a00001");
});

test("N99999 → adf7c7 (last US registration)", () => {
  assert.equal(nNumberToIcao("N99999"), "adf7c7");
});

test("N305DK → a3323a", () => {
  assert.equal(nNumberToIcao("N305DK"), "a3323a");
});

test("N907SP → ac8acb", () => {
  assert.equal(nNumberToIcao("N907SP"), "ac8acb");
});

test("invalid inputs return null", () => {
  assert.equal(nNumberToIcao(""), null);
  assert.equal(nNumberToIcao("X305DK"), null);
  assert.equal(nNumberToIcao("N0"), null); // leading 0 not allowed
  assert.equal(nNumberToIcao("N123ABC"), null); // > 2 trailing letters
  assert.equal(nNumberToIcao("N999999"), null); // body too long
});

// FAA-verified seed: every entry's hex must match what the FAA algorithm
// produces. Catches transcription typos in lib/seed.ts.
//
// Federal military airframes (USCG, etc.) aren't in the civilian FAA
// registry — they have military serials (CGNR####) instead of N-numbers,
// so the FAA N-number algorithm doesn't apply. For those entries the
// supplied hex is authoritative and the algorithm check is skipped.
// Recognized by the absence of an `^N\d` prefix.
test("seed hexes match FAA algorithm (FAA-registered tails only)", () => {
  const mismatches: string[] = [];
  for (const f of FLEET) {
    if (!f.hex) continue; // skip the omitted ones
    if (!/^N\d/.test(f.tail)) continue; // skip non-FAA tails
    const computed = nNumberToIcao(f.tail);
    if (computed?.toLowerCase() !== f.hex.toLowerCase()) {
      mismatches.push(
        `${f.tail}: seed=${f.hex.toLowerCase()} algo=${computed ?? "null"}`,
      );
    }
  }
  assert.deepEqual(
    mismatches,
    [],
    `seed/algorithm hex mismatches:\n  ${mismatches.join("\n  ")}`,
  );
});
