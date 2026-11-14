import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { AircraftDeltaStream } from "./stream.ts";

const output = process.argv[2] ?? ".local/oos-test-phone";
const config = JSON.parse(await readFile(`${output}/server-config.json`, "utf8"));
const base = `http://${config.host}:${config.port}`;
const reports = await Promise.all(["WA", "CA", "TX"].map(state => new Promise((resolve, reject) => {
  let reads = 0, messages = 0, delivered = 0, recovering = false, validating = false, stop;
  const timer = setTimeout(() => { stop?.(); reject(Error(`${state} timed out`)); }, 35_000);
  const stream = new AircraftDeltaStream(state, (receive, joined) => {
    const url = new URL(base.replace("http:", "ws:") + "/test/stream");
    url.searchParams.set("state", state); url.searchParams.set("key", config.key);
    const socket = new WebSocket(url);
    socket.onopen = joined;
    socket.onerror = () => { clearTimeout(timer); stop?.(); reject(Error(`${state} socket error`)); };
    socket.onmessage = event => {
      messages++;
      if (messages === 1) { recovering = true; return; }
      for (const frame of JSON.parse(event.data)) receive(frame);
    };
    return () => socket.close();
  }, async signal => {
    reads++;
    const response = await fetch(`${base}/test/baseline?state=${state}`, { signal, headers: { apikey: config.key } });
    assert.equal(response.status, 200); return response.json();
  });
  stop = stream.subscribe(async value => {
    delivered++;
    if (!recovering || reads < 2 || validating) return;
    validating = true;
    try {
      const reference = await (await fetch(`${base}/test/baseline?state=${state}`, { headers: { apikey: config.key } })).json();
      if (reference.data.revision !== value.revision) { validating = false; return; }
      assert.deepEqual(value, reference.data);
      clearTimeout(timer); stop(); resolve({ state, reads, messages, delivered, recovery: "passed", aircraft: value.snapshot.aircraft.length });
    } catch (error) { clearTimeout(timer); stop(); reject(error); }
  });
  stream.resume();
})));
await writeFile(`${output}/socket-checks.json`, JSON.stringify({ status: "passed", reports }, null, 2));
console.log(JSON.stringify({ status: "passed", reports }, null, 2));
