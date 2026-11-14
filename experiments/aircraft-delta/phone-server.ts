/** Recorded-flight server for the isolated OOS Test build. Never connects to Supabase. */
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFile, appendFile, mkdir, writeFile } from "node:fs/promises";
import { buildDatabaseSnapshot } from "../../lib/aircraft-data";
import { SUPPORTED_STATE_CODES, isStateCode, type StateCode } from "../../lib/app-states";
import { deltaMessage, encodeMessage, fullMessage, type FullMessage } from "./protocol";
import type { LiveState } from "../../lib/live-data-protocol";

globalThis.fetch = async () => { throw new Error("The phone test server cannot call external services"); };
type Row = Record<string, unknown>;
async function main() {
  const output = process.argv[2] ?? ".local/oos-test-phone";
  const config = JSON.parse(await readFile(`${output}/server-config.json`, "utf8"));
  const capture = JSON.parse(await readFile(".local/incremental-live-20261113/data-savings-snapshot.json", "utf8"));
  const positions = new Map<string, Row[]>();
  for (const p of capture.positions as Row[]) {
    const id = String(p.flight_session_id); if (!positions.has(id)) positions.set(id, []); positions.get(id)!.push(p);
  }
  for (const values of positions.values()) values.sort((a, b) => Date.parse(String(a.observed_at)) - Date.parse(String(b.observed_at)));
  const epoch = randomUUID(), baseline = new Map<StateCode, FullMessage>();
  const clients = new Map<any, StateCode>();
  let tick = 0;
  await mkdir(output, { recursive: true });
  const log = (name: string, event: object) => appendFile(`${output}/${name}.jsonl`, JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n");
  function advance() {
    const now = Date.now(), shifted = now - Date.parse(capture.captured_at), grouped = new Map<string, Row[]>();
    const trails: LiveState["trails"] = {};
    for (const captured of capture.rows as Row[]) {
      const row = { ...captured }, id = String(row.flight_session_id ?? "");
      for (const k of ["observed_at", "last_seen_at", "tracking_started_at", "detected_takeoff_at"]) {
        if (row[k]) row[k] = new Date(Date.parse(String(row[k])) + shifted).toISOString();
      }
      const history = positions.get(id);
      if (history?.length) {
        const index = (Math.floor(history.length / 2) + tick) % history.length, point = history[index]!;
        Object.assign(row, { observation_status: "airborne", observed_at: new Date(now).toISOString(), last_seen_at: new Date(now).toISOString(),
          latitude: point.latitude, longitude: point.longitude, altitude_ft: point.altitude_ft, ground_speed_kt: point.ground_speed_kt, heading_deg: point.heading_deg });
        // Playback repeats the recorded route. Keep point times stable within each loop.
        const loop = Math.floor((Math.floor(history.length / 2) + tick) / history.length);
        row.flight_session_id = `${id}-replay-${loop}`;
        const origin = Math.floor((now - tick * 5_000) / 1000) + loop * history.length * 5 - Math.floor(history.length / 2) * 5;
        trails[String(row.tail)] = history.slice(0, index + 1).map((p, i) => ({ lat: Number(p.latitude), lon: Number(p.longitude), ts: origin + i * 5 }));
      }
      const code = String(row.home_state_code); if (!grouped.has(code)) grouped.set(code, []); grouped.get(code)!.push(row);
    }
    for (const code of SUPPORTED_STATE_CODES) {
      const snapshot = buildDatabaseSnapshot(grouped.get(code) ?? [], { finished_at: new Date(now).toISOString(), source: "adsbfi" }, now);
      const sessions = Object.fromEntries(snapshot.aircraft.filter(a => a.airborne && a.flight_session_id).map(a => [a.tail, a.flight_session_id!]));
      const full: LiveState = { version: 1, state: code, revision: now, cursor: now, snapshot, sessions,
        trails: Object.fromEntries(Object.keys(sessions).map(t => [t, trails[t] ?? []])) };
      const previous = baseline.get(code), next = fullMessage(full, `${epoch}:${code}`, (previous?.sequence ?? 0) + 1);
      baseline.set(code, next);
      if (previous) {
        const subscribed = [...clients].filter(([, s]) => s === code);
        if (subscribed.length) {
          const frames = encodeMessage(deltaMessage(previous, next.data));
          const body = JSON.stringify(frames);
          for (const [socket] of subscribed) if (socket.readyState === 1) socket.send(body);
        }
      }
    }
    tick++;
  }
  advance();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://local.test");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type,apikey");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
    if (req.headers.apikey !== config.key) { res.writeHead(401).end(); return; }
    res.setHeader("Content-Type", "application/json");
    const send = (value: unknown) => res.end(JSON.stringify(value));
    try {
      if (url.pathname === "/test/telemetry" && req.method === "POST") {
        let body = ""; for await (const chunk of req) { body += chunk; if (body.length > 100_000) throw new Error("Report too large"); }
        await log("phone-events", { peer: req.socket.remoteAddress, event: JSON.parse(body) }); send({ ok: true }); return;
      }
      if (req.method !== "GET") { res.writeHead(405); send({ error: "This build uses recorded test data" }); return; }
      const requested = url.searchParams.get("state") ?? "WA", code: StateCode = isStateCode(requested) ? requested : "WA";
      const current = baseline.get(code)!;
      if (url.pathname === "/test/baseline") {
        await log("server-events", { event: "baseline", state: code, sequence: current.sequence, peer: req.socket.remoteAddress }); send(current); return;
      }
      if (url.pathname === "/aircraft") { send(current.data.snapshot); return; }
      if (url.pathname === "/live") { send(current.data); return; }
      if (url.pathname === "/map-aircraft") { send({ ...current.data.snapshot, aircraft: [...baseline.values()].flatMap(b => b.data.snapshot.aircraft).filter(a => a.airborne) }); return; }
      if (url.pathname === "/police") { send({ sightings: [], generatedAt: new Date().toISOString() }); return; }
      if (url.pathname === "/mobile") {
        const kind = url.searchParams.get("kind");
        if (kind === "settings") { send({ speedWarningEnabled: false }); return; }
        if (kind === "catalog") {
          send([...baseline.values()].flatMap(b => b.data.snapshot.aircraft.map(a => ({ aircraft: a, homeStateCode: b.state,
            nominalEnduranceMin: a.nominal_endurance_min ?? null, usableFuelGallons: a.usable_fuel_gallons ?? null,
            lowBurnGph: a.low_burn_gph ?? null, highBurnGph: a.high_burn_gph ?? null, reserveMin: a.reserve_min ?? null })))); return;
        }
        send(null); return;
      }
      res.writeHead(404); send({ error: "Unavailable in local test" });
    } catch (error) { res.writeHead(500); send({ error: String(error) }); }
  });
  const { WebSocketServer } = createRequire(`${process.cwd()}/package.json`)("next/dist/compiled/ws");
  const sockets = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://local.test"), code = url.searchParams.get("state");
    if (url.pathname !== "/test/stream" || url.searchParams.get("key") !== config.key || !isStateCode(code)) { socket.destroy(); return; }
    sockets.handleUpgrade(req, socket, head, (ws: any) => {
      clients.set(ws, code); void log("server-events", { event: "connected", state: code, peer: req.socket.remoteAddress });
      ws.on("close", () => { clients.delete(ws); void log("server-events", { event: "disconnected", state: code }); });
      ws.on("error", () => clients.delete(ws));
    });
  });
  const timer = setInterval(advance, 5_000);
  server.listen(config.port, config.host, async () => {
    await writeFile(`${output}/server.pid`, String(process.pid));
    console.log(`OOS Test recorded-flight feed listening on ${config.host}:${config.port}`);
  });
  process.on("SIGTERM", () => { clearInterval(timer); for (const ws of clients.keys()) ws.close(); server.close(() => process.exit(0)); });
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
