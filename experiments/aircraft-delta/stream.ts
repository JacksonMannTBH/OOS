/** Transport-injected prototype. Intentionally has no backend URL, key, or default connection. */
import type { StateCode } from "../../lib/app-states";
import type { LiveState } from "../../lib/live-data-protocol";
import { AircraftDeltaAssembler, type FullMessage } from "./protocol";

type Open = (receive: (frame: unknown) => void, joined: () => void) => () => void;
export class AircraftDeltaStream {
  private readonly assembler: AircraftDeltaAssembler;
  private readonly listeners = new Set<(value: LiveState) => void>();
  private close: (() => void) | null = null;
  private request: AbortController | null = null;
  private generation = 0;
  private lastData = 0;
  private lastRecovery = -Infinity;
  constructor(state: StateCode, private readonly open: Open,
    private readonly load: (signal: AbortSignal) => Promise<FullMessage>, private readonly now = Date.now) {
    this.assembler = new AircraftDeltaAssembler(state);
  }
  subscribe(listener: (value: LiveState) => void) {
    this.listeners.add(listener);
    if (this.assembler.value) listener(this.assembler.value);
    return () => { this.listeners.delete(listener); if (!this.listeners.size) this.suspend(); };
  }
  private deliver(value: LiveState | null) {
    if (!value) return;
    this.lastData = this.now();
    for (const listener of this.listeners) listener(value);
  }
  resume() {
    if (this.close || !this.listeners.size) return;
    this.lastRecovery = this.now();
    const generation = ++this.generation;
    this.close = this.open(frame => {
      if (generation !== this.generation) return;
      this.deliver(this.assembler.acceptFrame(frame));
      if (this.assembler.needsResync) void this.bootstrap();
    }, () => { if (generation === this.generation) void this.bootstrap(); });
  }
  private async bootstrap() {
    if (this.request) return;
    const controller = new AbortController(), generation = this.generation;
    this.request = controller;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const baseline = await this.load(controller.signal);
      if (!controller.signal.aborted && generation === this.generation && this.listeners.size) {
        this.deliver(this.assembler.acceptFull(baseline));
      }
    } catch { /* Keep last known data; reconnect/watchdog retries. */ }
    finally { clearTimeout(timeout); if (this.request === controller) this.request = null; }
  }
  suspend() {
    this.generation++;
    this.request?.abort(); this.request = null;
    this.close?.(); this.close = null;
  }
  checkHealth() {
    if (!this.listeners.size || this.now() - Math.max(this.lastData, this.lastRecovery) < 60_000) return;
    this.suspend(); this.resume(); void this.bootstrap();
  }
}
