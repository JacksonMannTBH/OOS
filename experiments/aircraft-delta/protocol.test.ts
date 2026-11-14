import { test } from "node:test";
import { scenarios } from "./scenarios";

// A local protocol test must never contact an API or send a real notification.
globalThis.fetch = async () => { throw new Error("Network disabled in local aircraft-delta tests"); };
for (const scenario of scenarios) test(scenario.name, scenario.run);
