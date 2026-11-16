import assert from "node:assert/strict";
import { test } from "node:test";
import { proTrialAvailable } from "./pro-access";

const cases = [
  { name: "new eligible account", ready: true, pro: false, trialEligible: true, expected: true },
  { name: "trial already used", ready: true, pro: false, trialEligible: false, expected: false },
  { name: "eligibility unavailable", ready: true, pro: false, trialEligible: undefined, expected: false },
  { name: "eligibility still loading", ready: false, pro: false, trialEligible: true, expected: false },
  { name: "current member", ready: true, pro: true, trialEligible: true, expected: false },
];
for (const entry of cases) {
  test(`Pro trial: ${entry.name}`, () => {
    for (const development of [false, true]) {
      const status = { ...entry, development };
      assert.equal(proTrialAvailable(status), entry.expected);
    }
  });
}
