export type ScreenWakeLease = {
  released: boolean;
  release(): Promise<void>;
};

// A request completing after Ride Mode closes must release its own lease,
// without touching a newer screen's lease.
export function createScreenWakeSession(request: () => Promise<ScreenWakeLease>, isVisible: () => boolean) {
  let stopped = false;
  let pending = false;
  let lease: ScreenWakeLease | null = null;
  const release = () => {
    const current = lease;
    lease = null;
    if (current && !current.released) void current.release().catch(() => undefined);
  };
  const sync = async () => {
    if (stopped || !isVisible()) { release(); return; }
    if (pending || (lease && !lease.released)) return;
    pending = true;
    try {
      const acquired = await request();
      if (stopped || !isVisible()) await acquired.release();
      else lease = acquired;
    } catch {
      // Screen wake is best effort; the OS may need to save battery.
    } finally {
      pending = false;
    }
  };
  return { sync, stop() { stopped = true; release(); } };
}
