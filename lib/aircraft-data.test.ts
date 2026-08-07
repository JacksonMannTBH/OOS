import assert from "node:assert";
import { test } from "node:test";
import {
  isStaleAirborneCandidate,
  isStaleOpenFlightSession,
  isUnseenFlightSessionExpired,
  isNewerAircraftObservation,
  shouldSuppressTakeoffNotificationForTimes,
  shouldClearUnobservedState,
} from "./aircraft-data";

test("an already-unknown aircraft does not need another clearing write", () => {
  assert.equal(shouldClearUnobservedState(undefined), true);
  assert.equal(
    shouldClearUnobservedState({
      observation_status: "airborne",
      observed_at: "2026-08-02T12:00:00.000Z",
      flight_session_id: null,
    }),
    true,
  );
  assert.equal(
    shouldClearUnobservedState({
      observation_status: "unknown",
      observed_at: null,
      flight_session_id: null,
    }),
    false,
  );
  assert.equal(
    shouldClearUnobservedState({
      observation_status: "unknown",
      observed_at: null,
      flight_session_id: "stale-session",
    }),
    true,
  );
});

test("duplicate and out-of-order provider observations are ignored", () => {
  const previous = {
    observed_at: "2026-08-02T12:00:10.000Z",
    last_seen_at: "2026-08-02T12:00:10.000Z",
  };

  assert.equal(
    isNewerAircraftObservation(previous, "2026-08-02T12:00:10.000Z"),
    false,
  );
  assert.equal(
    isNewerAircraftObservation(previous, "2026-08-02T12:00:09.000Z"),
    false,
  );
  assert.equal(
    isNewerAircraftObservation(previous, "2026-08-02T12:00:11.000Z"),
    true,
  );
});

test("implausibly old open flight sessions are treated as stale", () => {
  assert.equal(
    isStaleOpenFlightSession(
      {
        detected_takeoff_at: "2026-08-02T12:00:00.000Z",
        tracking_started_at: "2026-08-02T11:59:00.000Z",
      },
      "2026-08-03T05:59:00.000Z",
    ),
    false,
  );
  assert.equal(
    isStaleOpenFlightSession(
      {
        detected_takeoff_at: "2026-08-02T12:00:00.000Z",
        tracking_started_at: "2026-08-02T11:59:00.000Z",
      },
      "2026-08-03T06:01:00.000Z",
    ),
    true,
  );
});

test("implausibly old airborne candidates are treated as stale", () => {
  assert.equal(
    isStaleAirborneCandidate(
      { airborne_candidate_started_at: "2026-08-02T12:00:00.000Z" },
      "2026-08-03T05:59:00.000Z",
    ),
    false,
  );
  assert.equal(
    isStaleAirborneCandidate(
      { airborne_candidate_started_at: "2026-08-02T12:00:00.000Z" },
      "2026-08-03T06:01:00.000Z",
    ),
    true,
  );
});

test("a missing provider row gets a recovery grace period before purging a flight", () => {
  const previous = {
    flight_session_id: "session-1",
    last_seen_at: "2026-08-02T12:00:00.000Z",
    observed_at: "2026-08-02T12:00:00.000Z",
  };

  assert.equal(
    isUnseenFlightSessionExpired(previous, "2026-08-02T12:14:59.999Z"),
    false,
  );
  assert.equal(
    isUnseenFlightSessionExpired(previous, "2026-08-02T12:15:00.000Z"),
    true,
  );
});

test("recent same-tail notification or landing suppresses duplicate takeoff alert", () => {
  assert.equal(
    shouldSuppressTakeoffNotificationForTimes(
      "2026-08-06T01:33:06.801Z",
      "2026-08-06T01:18:29.501Z",
      null,
    ),
    true,
  );
  assert.equal(
    shouldSuppressTakeoffNotificationForTimes(
      "2026-08-06T02:10:50.851Z",
      null,
      "2026-08-06T02:10:33.501Z",
    ),
    true,
  );
  assert.equal(
    shouldSuppressTakeoffNotificationForTimes(
      "2026-08-06T02:10:50.851Z",
      "2026-08-06T01:47:28.801Z",
      null,
    ),
    true,
  );
  assert.equal(
    shouldSuppressTakeoffNotificationForTimes(
      "2026-08-06T02:10:50.851Z",
      "2026-08-06T01:39:50.851Z",
      null,
    ),
    false,
  );
});
