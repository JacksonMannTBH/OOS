type NativeStorage = {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
};
type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const DEVICE_PREFERENCE_KEYS = [
  "oos_subscription_announcement_seen",
  "oos_nationwide_map_enabled",
  "oos_ride_angles_enabled",
  "oos_police_reporter_token",
  "oos_police_intro_seen",
  "oos_aircraft_tracking",
  "oos_aircraft_alert_device_id",
  "oos_aircraft_alert_opt_in",
  "oos_state_code",
  "oos_state_selection_source",
  "oos_california_region",
] as const;
const NATIVE_KEY = "oos_device_preferences_v1";

// One native snapshot keeps the identity and its preferences together. Nulls
// are intentional resets, not invitations to import an old web-storage copy.
export class DevicePreferenceStore {
  private values: Record<string, string | null> | null = null;
  private initialization: Promise<void> | null = null;
  private writes: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly browser: () => BrowserStorage,
    private readonly native: NativeStorage | null,
  ) {}

  initialize(): Promise<void> {
    if (!this.native || this.values) return Promise.resolve();
    if (!this.initialization) {
      this.initialization = this.restore().catch((error) => {
        this.initialization = null;
        throw error;
      });
    }
    return this.initialization;
  }

  private async restore(): Promise<void> {
    const { value } = await this.native!.get({ key: NATIVE_KEY });
    let values: Record<string, string | null>;
    if (value === null) {
      // Upgrade once from the existing web store; do not replace native values
      // on future launches, even when iOS has emptied web storage.
      values = Object.fromEntries(DEVICE_PREFERENCE_KEYS.map((key) => [key, this.browser().getItem(key)]));
      await this.native!.set({ key: NATIVE_KEY, value: JSON.stringify(values) });
    } else {
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("device_preferences_invalid");
      const record = parsed as Record<string, unknown>;
      values = {};
      for (const key of DEVICE_PREFERENCE_KEYS) {
        if (record[key] !== undefined && record[key] !== null && typeof record[key] !== "string") throw new Error("device_preferences_invalid");
        values[key] = (record[key] as string | null | undefined) ?? null;
      }
    }
    this.values = values;
    this.mirror(values);
  }

  get(key: string): string | null {
    if (!this.native) return this.browser().getItem(key);
    if (!this.values) throw new Error("device_preferences_not_ready");
    return this.values[key] ?? null;
  }

  update(changes: Record<string, string | null>): Promise<void> {
    const write = this.writes.catch(() => undefined).then(async () => {
      await this.initialize();
      if (!this.native) {
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) this.browser().removeItem(key);
          else this.browser().setItem(key, value);
        }
        return;
      }
      const next = { ...this.values, ...changes };
      await this.native.set({ key: NATIVE_KEY, value: JSON.stringify(next) });
      // Publish only after the native save succeeds. A failed write must not
      // appear successful in the UI or be sent to the notification server.
      this.values = next;
      this.mirror(changes);
    });
    this.writes = write;
    return write;
  }

  private mirror(values: Record<string, string | null>): void {
    for (const [key, value] of Object.entries(values)) {
      try {
        if (value === null) this.browser().removeItem(key);
        else this.browser().setItem(key, value);
      } catch { /* Native storage remains authoritative if web storage is unavailable. */ }
    }
  }
}
