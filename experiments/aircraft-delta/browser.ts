import { scenarios, equal, check } from "./scenarios";
import { AircraftDeltaAssembler, deltaMessage, encodeMessage, type FullMessage } from "./protocol";
import { AircraftDeltaStream } from "./stream";
import type { LiveState } from "../../lib/live-data-protocol";

async function main() {
  const results: { name: string; passed: boolean; ms: number; error?: string }[] = [];
  const run = async (name: string, fn: () => void | Promise<void>) => {
    const start = performance.now();
    try { await fn(); results.push({ name, passed: true, ms: performance.now() - start }); }
    catch (error) { results.push({ name, passed: false, ms: performance.now() - start, error: String(error) }); }
    document.querySelector("#status")!.textContent = `${results.length} checks completed`;
  };
  for (const scenario of scenarios) await run(scenario.name, scenario.run);
  const pairs: { before: FullMessage; after: LiveState }[] = await (await fetch("/pairs.json")).json();
  let decodeMs = 0;
  for (const [index, pair] of pairs.entries()) await run(`Saved ${pair.after.state} aircraft data, sample ${index + 1}`, async () => {
    const assembler = new AircraftDeltaAssembler(pair.after.state);
    // Receive server-encoded JSON frames over loopback HTTP, in reverse order.
    const baseline = await (await fetch(`/baseline/${index}`)).json();
    assembler.acceptFull(baseline);
    const frames = await (await fetch(`/frames/${index}`)).json();
    let result: LiveState | null = null;
    const start = performance.now();
    for (const frame of frames.reverse()) result = assembler.acceptFrame(frame) ?? result;
    decodeMs += performance.now() - start;
    equal(result, pair.after);
  });
  await run("Browser stream automatically recovers an update that arrived before its baseline", async () => {
    const pair = pairs[0]!;
    let receive: (frame: unknown) => void = () => {}, joined = () => {}, reads = 0;
    let resolveDelivered: (s: LiveState) => void = () => {};
    const delivered = new Promise<LiveState>(resolve => { resolveDelivered = resolve; });
    const stream = new AircraftDeltaStream(pair.after.state, (r, j) => { receive = r; joined = j; return () => {}; }, async signal => {
      reads++; return (await fetch("/baseline/0", { signal })).json();
    });
    const stop = stream.subscribe(s => resolveDelivered(s));
    try {
      stream.resume(); joined();
      for (const frame of encodeMessage(deltaMessage(pair.before, pair.after))) receive(frame);
      equal(await delivered, pair.after); check(reads === 1);
    } finally { stop(); }
  });
  const report = { status: results.every(r => r.passed) ? "passed" : "failed", userAgent: navigator.userAgent,
    checks: results.length, passed: results.filter(r => r.passed).length, decodeMsForRecordedPairs: decodeMs, results };
  document.querySelector("#status")!.textContent = report.status === "passed" ? `All ${report.checks} checks passed` : "A check failed";
  document.querySelector("#details")!.textContent = `Local aircraft update prototype\n${pairs.length} recorded-data comparisons\n${decodeMs.toFixed(1)} ms total decoding\nLive backend unchanged`;
  await fetch("/result", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(report) });
}
void main().catch(async error => {
  document.querySelector("#status")!.textContent = `Failed: ${String(error)}`;
  await fetch("/result", { method: "POST", body: JSON.stringify({ status: "failed", error: String(error) }) });
});
