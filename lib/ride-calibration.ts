function aborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException("Calibration cancelled", "AbortError");
}

function waitForNextReading(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      reject(signal.reason ?? new DOMException("Calibration cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, 200);
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
  });
}

// Movement is a waiting condition. Permission, sensor, ride, and saving errors
// end the attempt. Only one native request is outstanding at a time.
export async function waitForRideCalibration<T>(attempt: () => Promise<T>, signal: AbortSignal): Promise<T> {
  for (;;) {
    aborted(signal);
    try {
      const result = await attempt();
      aborted(signal);
      return result;
    } catch (error) {
      aborted(signal);
      if ((error as { code?: unknown } | null)?.code !== "CALIBRATION_NOT_READY") throw error;
    }
    await waitForNextReading(signal);
  }
}
