import assert from "node:assert/strict";
import { test } from "node:test";
import { waitForRideCalibration } from "./ride-calibration";

const notReady = () => Object.assign(new Error("Waiting for the bike to stabilize."), { code: "CALIBRATION_NOT_READY" });

test("one calibration request waits through movement and resolves once stable without overlapping attempts", async () => {
  let attempts = 0;
  let inFlight = 0;
  const ready = { calibrated: true };
  const result = await waitForRideCalibration(async () => {
    assert.equal(++inFlight, 1);
    await new Promise(resolve => setTimeout(resolve, 5));
    inFlight--;
    if (++attempts < 3) throw notReady();
    return ready;
  }, new AbortController().signal);
  assert.equal(result, ready);
  assert.equal(attempts, 3);
});

test("leaving ride mode cancels a waiting calibration and stops further native attempts", async () => {
  const controller = new AbortController();
  let attempts = 0;
  const pending = waitForRideCalibration(async () => { attempts++; throw notReady(); }, controller.signal);
  const cancelled = assert.rejects(pending, { name: "AbortError" });
  await new Promise(resolve => setTimeout(resolve, 10));
  controller.abort();
  await cancelled;
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(attempts, 1);
});

test("sensor, permission, saving, and changed-ride errors fail without retrying", async () => {
  for (const message of ["Motion unavailable", "Permission denied", "Storage full", "Ride changed"]) {
    const failure = new Error(message);
    let attempts = 0;
    await assert.rejects(waitForRideCalibration(async () => {
      attempts++;
      throw failure;
    }, new AbortController().signal), error => error === failure);
    assert.equal(attempts, 1);
  }
});

test("a cancelled request cannot start or publish a late native response", async () => {
  const before = new AbortController();
  before.abort();
  let attempts = 0;
  await assert.rejects(waitForRideCalibration(async () => { attempts++; return true; }, before.signal), { name: "AbortError" });
  assert.equal(attempts, 0);

  const during = new AbortController();
  let finish!: (value: boolean) => void;
  const native = new Promise<boolean>(resolve => { finish = resolve; });
  const pending = waitForRideCalibration(() => native, during.signal);
  const cancelled = assert.rejects(pending, { name: "AbortError" });
  during.abort();
  finish(true);
  await cancelled;
});
