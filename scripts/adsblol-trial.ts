import { createServer } from "node:http";
import { appendFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { AdsbLolTrial, type TrialState } from "../lib/adsblol-trial";

async function main() {
  const trial = new AdsbLolTrial();
  if (process.argv.includes("--once")) {
    await trial.poll();
    console.log(JSON.stringify(trial.snapshot(), null, 2));
    if (!trial.snapshot().healthy) process.exitCode = 1;
    return;
  }
  const port = Number(process.env.ADSBLOL_TRIAL_PORT ?? 3031);
  const logDirectory = resolve(process.env.ADSBLOL_TRIAL_LOG_DIR ?? ".local/adsblol-trial");
  await mkdir(logDirectory, { recursive: true });
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" }).end(JSON.stringify({ error: "Use GET" }));
      return;
    }
    const url = new URL(request.url ?? "/", "http://localhost");
    if (!["/", "/health", "/aircraft"].includes(url.pathname)) {
      response.writeHead(404).end(JSON.stringify({ error: "Not found" }));
      return;
    }
    const state = url.searchParams.get("state")?.toUpperCase();
    if (state && state !== "WA" && state !== "CA") {
      response.writeHead(400).end(JSON.stringify({ error: "State must be WA or CA" }));
      return;
    }
    const snapshot = trial.snapshot(state as TrialState | undefined);
    const { aircraft, ...health } = snapshot;
    response.writeHead(url.pathname === "/health" && !snapshot.healthy ? 503 : 200);
    response.end(JSON.stringify(url.pathname === "/health" ? health : snapshot, null, 2));
  });
  await new Promise<void>((ready, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", ready);
  });
  console.log(`ADSB.lol WA/CA trial: http://127.0.0.1:${port}/aircraft`);
  let stopping = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    if (stopping) return;
    try {
      if (await trial.poll()) {
        const { aircraft, ...summary } = trial.snapshot();
        console.log(JSON.stringify(summary));
        await appendFile(resolve(logDirectory, `${summary.generatedAt.slice(0, 10)}.jsonl`),
          JSON.stringify(summary) + "\n");
      }
    } catch (error) {
      console.error("Trial log write failed:", error);
    }
    if (!stopping) {
      const delay = Math.max(1, Date.parse(trial.snapshot().nextRequestAt) - Date.now());
      timer = setTimeout(() => { void tick(); }, delay);
    }
  };
  const stop = () => {
    stopping = true;
    clearTimeout(timer);
    server.close();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  void tick();
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
