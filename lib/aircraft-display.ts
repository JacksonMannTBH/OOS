import { ageAircraftSnapshot, retainAircraftSnapshot } from "./aircraft-freshness";
import type { Snapshot } from "./types";

/** The last rendered result stays on screen until a connection refresh finishes. */
export class AircraftDisplay {
  private raw: Snapshot | null;
  private shown: Snapshot | null;
  private waiting = true;

  constructor(raw: Snapshot | null, shown: Snapshot | null = null) {
    this.raw = raw && raw.fetched_at > 0 ? raw : null;
    this.shown = shown ?? (this.raw ? ageAircraftSnapshot(this.raw, this.raw.fetched_at) : null);
  }

  get snapshot(): Snapshot | null { return this.shown; }
  get rawSnapshot(): Snapshot | null { return this.raw; }

  hold(): void { this.waiting = true; }

  receive(incoming: Snapshot, live: boolean, now: number): void {
    this.raw = retainAircraftSnapshot(this.raw, incoming);
    if (live) {
      this.waiting = false;
      this.shown = ageAircraftSnapshot(this.raw, now);
    } else if (!this.shown && this.raw.fetched_at > 0) {
      this.shown = ageAircraftSnapshot(this.raw, this.raw.fetched_at);
    }
  }

  tick(now: number): void {
    if (!this.waiting && this.raw) this.shown = ageAircraftSnapshot(this.raw, now);
  }
}
