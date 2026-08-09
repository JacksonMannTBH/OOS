import { AIRCRAFT_DURATION_MINUTES, stateIdForOpsAircraftTail } from "./aircraft-directory";
import {
  DEFAULT_STATE_CODE,
  getAppState,
  stateCodeForId,
  type StateCode,
} from "./app-states";
import { fleetHex, FLEET } from "./seed";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase/server";
import type {
  Aircraft,
  AircraftGroundState,
  FleetEntry,
  Snapshot,
  SnapshotSource,
} from "./types";

type CurrentStateRow = {
  aircraft_id: string;
  flight_session_id: string | null;
  observation_status: Aircraft["observation_status"];
  consecutive_airborne: number;
  consecutive_grounded: number;
  observed_at: string | null;
  last_seen_at: string | null;
  last_grounded_at: string | null;
  last_airborne_at: string | null;
  airborne_candidate_started_at: string | null;
  landing_candidate_started_at: string | null;
};

type FlightSessionRow = {
  id: string;
  detected_takeoff_at: string | null;
  tracking_started_at: string | null;
  last_seen_at: string | null;
  closed_at: string | null;
};

type FlightSessionFinalization = {
  status: "landed" | "unknown";
  closedAt: string;
  endReason: "confirmed_landing" | "coverage_lost" | "stale_session";
  detectedLandingAt: string | null;
  landingConfirmedAt: string | null;
};

type CatalogRow = {
  id: string;
  tail: string;
  icao24: string;
  home_state_code: StateCode;
  operator: string;
  model: string;
  nickname: string | null;
  base: string;
  role: FleetEntry["role"];
  role_confidence: FleetEntry["roleConfidence"];
  role_description: string;
  role_note: string | null;
};

export type AircraftCatalogEntry = {
  aircraft: FleetEntry;
  homeStateCode: StateCode;
  nominalEnduranceMin: number | null;
  usableFuelGallons: number | null;
  lowBurnGph: number | null;
  highBurnGph: number | null;
  reserveMin: number | null;
};

export type IngestionSummary = {
  positionsInserted: number;
  takeoffsCreated: number;
  trackedAircraftCount: number;
  sourceHealthy: boolean;
  byState: Record<string, StateIngestionSummary>;
};

export type StateIngestionSummary = {
  positionsInserted: number;
  takeoffsCreated: number;
  trackedAircraftCount: number;
};

const TAKEOFF_CONFIRMATION_SAMPLES = 2;
const LANDING_CONFIRMATION_SAMPLES = 2;
const TAKEOFF_NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1_000;
const CURRENT_OBSERVATION_MAX_AGE_MS = 2 * 60 * 1_000;
export const FLIGHT_TRANSITION_MAX_GAP_MS = CURRENT_OBSERVATION_MAX_AGE_MS;
const FLIGHT_SESSION_LOST_GRACE_MS = 15 * 60 * 1_000;
const MAX_OPEN_FLIGHT_SESSION_MS = 18 * 60 * 60 * 1_000;

export async function ensureCatalogSeeded(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const db = getSupabaseAdmin();
  const { count, error } = await db
    .from("aircraft")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`Catalog count failed: ${error.message}`);
  if ((count ?? 0) > 0) return;
  await saveCatalog(FLEET, "seed");
}

export async function getCatalog(
  stateCode?: StateCode,
): Promise<FleetEntry[]> {
  if (!isSupabaseConfigured()) {
    return filterSeedByState(FLEET, stateCode);
  }

  let query = getSupabaseAdmin()
    .from("aircraft")
    .select(
      "tail,icao24,home_state_code,operator,model,nickname,base,role,role_confidence,role_description,role_note",
    )
    .eq("active", true)
    .order("tail");
  if (stateCode) query = query.eq("home_state_code", stateCode);
  const { data, error } = await query;
  if (error) throw new Error(`Catalog read failed: ${error.message}`);
  if (!data?.length) return filterSeedByState(FLEET, stateCode);
  return data.map(catalogRowToFleetEntry);
}

export async function getAircraftCatalogEntries(): Promise<
  AircraftCatalogEntry[]
> {
  if (!isSupabaseConfigured()) return seedCatalogEntries();

  const { data, error } = await getSupabaseAdmin()
    .from("aircraft_catalog_public")
    .select("*")
    .order("tail");
  if (error) throw new Error(`Public catalog read failed: ${error.message}`);
  if (!data?.length) return seedCatalogEntries();

  return data.map((row) => ({
    aircraft: catalogRowToFleetEntry(row),
    homeStateCode: String(row.home_state_code) as StateCode,
    nominalEnduranceMin: finiteNumber(row.nominal_endurance_min) ?? null,
    usableFuelGallons: finiteNumber(row.usable_fuel_gallons) ?? null,
    lowBurnGph: finiteNumber(row.low_burn_gph) ?? null,
    highBurnGph: finiteNumber(row.high_burn_gph) ?? null,
    reserveMin: finiteNumber(row.reserve_min) ?? null,
  }));
}

export async function saveCatalog(
  entries: FleetEntry[],
  auditOperation: "seed" | "create" | "update" | "delete" | "restore" = "update",
): Promise<void> {
  const db = getSupabaseAdmin();
  const current = await getCatalog();
  const rows = entries.map((entry) => {
    const stateId = stateIdForOpsAircraftTail(entry.tail) ?? "washington";
    return {
      tail: entry.tail.trim().toUpperCase(),
      icao24: fleetHex(entry).toUpperCase(),
      home_state_code: stateCodeForId(stateId),
      operator: entry.operator,
      model: entry.model,
      nickname: entry.nickname,
      base: entry.base,
      role: entry.role,
      role_confidence: entry.roleConfidence,
      role_description: entry.roleDescription,
      role_note: entry.roleNote ?? null,
      active: true,
      updated_at: new Date().toISOString(),
    };
  });

  if (rows.length > 0) {
    const { error } = await db
      .from("aircraft")
      .upsert(rows, { onConflict: "tail" });
    if (error) throw new Error(`Catalog write failed: ${error.message}`);
  }

  const keep = new Set(rows.map((row) => row.tail));
  const removed = current.filter((entry) => !keep.has(entry.tail));
  if (removed.length > 0) {
    const { error } = await db
      .from("aircraft")
      .update({ active: false, updated_at: new Date().toISOString() })
      .in("tail", removed.map((entry) => entry.tail));
    if (error) throw new Error(`Catalog retire failed: ${error.message}`);
  }

  const { data: aircraftRows, error: aircraftError } = await db
    .from("aircraft")
    .select("id,tail")
    .in("tail", rows.map((row) => row.tail));
  if (aircraftError) {
    throw new Error(`Catalog performance lookup failed: ${aircraftError.message}`);
  }
  const durations = (aircraftRows ?? [])
    .map((row) => ({
      aircraft_id: String(row.id),
      nominal_endurance_min:
        AIRCRAFT_DURATION_MINUTES[String(row.tail).toUpperCase()] ?? null,
      reserve_min: 30,
      source_note: "Catalog endurance estimate; verify against an authoritative aircraft source.",
      updated_at: new Date().toISOString(),
    }))
    .filter((row) => row.nominal_endurance_min != null);
  if (durations.length > 0) {
    const { error } = await db
      .from("aircraft_performance_profiles")
      .upsert(durations, { onConflict: "aircraft_id" });
    if (error) throw new Error(`Performance profile write failed: ${error.message}`);
  }

  const { error: auditError } = await db.from("registry_audit").insert({
    operation: auditOperation,
    aircraft_tail: "(catalog)",
    previous_value: current,
    next_value: entries,
    actor: "admin",
  });
  if (auditError) {
    console.warn("[catalog] audit write failed:", auditError.message);
  }
}

export async function getDatabaseSnapshot(
  stateCode: StateCode = DEFAULT_STATE_CODE,
): Promise<Snapshot> {
  if (!isSupabaseConfigured()) {
    return {
      fetched_at: Date.now(),
      source: "mock",
      aircraft: filterSeedByState(FLEET, stateCode).map((entry) => ({
        ...entry,
        tail: entry.tail,
        icao24: fleetHex(entry),
        observed: false,
        airborne: false,
        observation_status: "unknown",
        home_state_code: stateCode,
        last_seen_min: null,
      })),
      live_seen_count: 0,
    };
  }

  const db = getSupabaseAdmin();
  const [liveResult, ingestionResult] = await Promise.all([
    db
      .from("aircraft_live_public")
      .select("*")
      .eq("home_state_code", stateCode)
      .order("tail"),
    db
      .from("ingestion_runs")
      .select("finished_at")
      .in("status", ["succeeded", "partial"])
      .not("finished_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (liveResult.error) {
    throw new Error(`Live aircraft read failed: ${liveResult.error.message}`);
  }
  const data = liveResult.data;

  const snapshotReadAt = Date.now();
  let fetchedAt = parseTime(ingestionResult.data?.finished_at) ?? 0;
  const aircraft = (data ?? []).map((row) => {
    const observedAt = parseTime(row.observed_at);
    const lastSeenAt = parseTime(row.last_seen_at);
    if (observedAt != null) fetchedAt = Math.max(fetchedAt, observedAt);
    const hasCurrentObservation =
      observedAt != null &&
      snapshotReadAt - observedAt <= CURRENT_OBSERVATION_MAX_AGE_MS;
    const status = row.observation_status as Aircraft["observation_status"];
    // Keep a confirmed flight visible through the first grounded candidate.
    // It stops being airborne only after the second grounded sample confirms
    // the landing, or when the provider ground state is unknown.
    const airborne =
      hasCurrentObservation &&
      (status === "airborne" ||
        status === "airborne_candidate" ||
        status === "landing_candidate");
    const takeoffAt = parseTime(row.detected_takeoff_at);
    const takeoffConfidence =
      (row.takeoff_confidence as Aircraft["takeoff_confidence"]) ?? null;
    const elapsedStart =
      takeoffAt != null &&
      (takeoffConfidence === "medium" || takeoffConfidence === "high")
        ? takeoffAt
        : null;
    return {
      tail: String(row.tail),
      icao24: String(row.icao24),
      operator: String(row.operator),
      model: String(row.model),
      nickname: row.nickname ? String(row.nickname) : null,
      roleDescription: String(row.role_description ?? "—"),
      base: String(row.base),
      role: row.role as FleetEntry["role"],
      roleConfidence: row.role_confidence as FleetEntry["roleConfidence"],
      roleNote: row.role_note ? String(row.role_note) : undefined,
      observed: hasCurrentObservation,
      observed_at: observedAt != null ? new Date(observedAt).toISOString() : null,
      position_observed_at:
        observedAt != null ? new Date(observedAt).toISOString() : null,
      airborne,
      observation_status: hasCurrentObservation ? status ?? "unknown" : "unknown",
      home_state_code: String(row.home_state_code),
      current_state_code: hasCurrentObservation && row.current_state_code
        ? String(row.current_state_code)
        : null,
      flight_session_id: hasCurrentObservation && row.flight_session_id
        ? String(row.flight_session_id)
        : null,
      detected_takeoff_at: hasCurrentObservation && row.detected_takeoff_at
        ? String(row.detected_takeoff_at)
        : null,
      takeoff_confidence:
        hasCurrentObservation ? takeoffConfidence : null,
      as_of: snapshotReadAt,
      starting_fuel_estimate_gal: finiteNumber(
        row.starting_fuel_estimate_gal,
      ),
      usable_fuel_gallons: finiteNumber(row.usable_fuel_gallons),
      nominal_endurance_min: finiteNumber(row.nominal_endurance_min),
      low_burn_gph: finiteNumber(row.low_burn_gph),
      high_burn_gph: finiteNumber(row.high_burn_gph),
      reserve_min: finiteNumber(row.reserve_min),
      lat: hasCurrentObservation ? finiteNumber(row.latitude) : undefined,
      lon: hasCurrentObservation ? finiteNumber(row.longitude) : undefined,
      altitude_ft: hasCurrentObservation
        ? finiteNumber(row.altitude_ft)
        : undefined,
      ground_speed_kt: hasCurrentObservation
        ? finiteNumber(row.ground_speed_kt)
        : undefined,
      heading: hasCurrentObservation ? finiteNumber(row.heading_deg) : undefined,
      squawk: hasCurrentObservation && row.squawk ? String(row.squawk) : null,
      time_aloft_min:
        airborne && elapsedStart != null
          ? Math.max(0, Math.floor((snapshotReadAt - elapsedStart) / 60_000))
          : undefined,
      last_seen_min: lastSeenAt
        ? Math.max(0, Math.floor((snapshotReadAt - lastSeenAt) / 60_000))
        : null,
    } satisfies Aircraft;
  });

  return {
    fetched_at: fetchedAt || snapshotReadAt,
    source: inferSnapshotSource(data),
    aircraft,
    live_seen_count: aircraft.filter((row) => row.observed).length,
  };
}

export async function ingestSnapshot(
  snapshot: Snapshot,
  workerId: string,
): Promise<IngestionSummary> {
  const db = getSupabaseAdmin();
  await ensureCatalogSeeded();
  const snapshotObservedAt = new Date(snapshot.fetched_at).toISOString();

  if (snapshot.source_ok === false) {
    const { error: healthError } = await db.from("data_source_health").upsert(
      {
        source: snapshot.source,
        last_attempt_at: snapshotObservedAt,
        last_failure_at: snapshotObservedAt,
        last_error: snapshot.source_error ?? "all live sources failed",
        metadata: { worker_id: workerId },
        updated_at: snapshotObservedAt,
      },
      { onConflict: "source" },
    );
    if (healthError) {
      throw new Error(`Source-health write failed: ${healthError.message}`);
    }
    return {
      positionsInserted: 0,
      takeoffsCreated: 0,
      trackedAircraftCount: 0,
      sourceHealthy: false,
      byState: {},
    };
  }

  const { data: catalogData, error: catalogError } = await db
    .from("aircraft")
    .select(
      "id,tail,icao24,home_state_code,operator,model,nickname,base,role,role_confidence,role_description,role_note",
    )
    .eq("active", true);
  if (catalogError) throw new Error(`Ingestion catalog read failed: ${catalogError.message}`);

  const catalog = (catalogData ?? []) as CatalogRow[];
  const catalogByTail = new Map(catalog.map((row) => [row.tail, row]));
  const catalogById = new Map(catalog.map((row) => [row.id, row]));
  const ids = catalog.map((row) => row.id);
  const { data: currentData, error: currentError } = ids.length
    ? await db.from("aircraft_current_state").select("*").in("aircraft_id", ids)
    : { data: [], error: null };
  if (currentError) throw new Error(`Current-state read failed: ${currentError.message}`);
  const currentByAircraft = new Map(
    ((currentData ?? []) as CurrentStateRow[]).map((row) => [row.aircraft_id, row]),
  );
  const openFlightSessionIds = [
    ...new Set(
      ((currentData ?? []) as CurrentStateRow[])
        .map((row) => row.flight_session_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const { data: sessionData, error: sessionError } = openFlightSessionIds.length
    ? await db
        .from("flight_sessions")
        .select("id,detected_takeoff_at,tracking_started_at,last_seen_at,closed_at")
        .in("id", openFlightSessionIds)
    : { data: [], error: null };
  if (sessionError) throw new Error(`Open-session read failed: ${sessionError.message}`);
  const openSessionById = new Map(
    ((sessionData ?? []) as FlightSessionRow[]).map((row) => [row.id, row]),
  );

  const stateRows: Record<string, unknown>[] = [];
  const positionRows: Record<string, unknown>[] = [];
  const newFlightSessionRows: Record<string, unknown>[] = [];
  const takeoffEventCandidates: Array<{
    flightSessionId: string;
    aircraftId: string;
    detectedTakeoffAt: string;
    catalogRow: CatalogRow;
  }> = [];
  const flightSessionsToFinalize = new Map<
    string,
    FlightSessionFinalization
  >();
  const byState: Record<string, StateIngestionSummary> = {};
  let takeoffsCreated = 0;

  for (const aircraft of snapshot.aircraft) {
    const catalogRow = catalogByTail.get(aircraft.tail.toUpperCase());
    if (!catalogRow) continue;
    const stateSummary = byState[catalogRow.home_state_code] ??= {
      positionsInserted: 0,
      takeoffsCreated: 0,
      trackedAircraftCount: 0,
    };
    stateSummary.trackedAircraftCount += 1;
    const previous = currentByAircraft.get(catalogRow.id);
    const wasObserved = aircraft.observed !== false;
    if (!wasObserved) {
      if (!shouldClearUnobservedState(previous)) continue;
      // A missing provider row is not a landing. Keep the active session
      // through transient coverage gaps; the public read path already hides
      // observations once they exceed CURRENT_OBSERVATION_MAX_AGE_MS.
      if (
        previous?.flight_session_id &&
        !isUnseenFlightSessionExpired(previous, snapshotObservedAt)
      ) {
        continue;
      }
      if (previous?.flight_session_id) {
        flightSessionsToFinalize.set(previous.flight_session_id, {
          status: "unknown",
          closedAt:
            previous.last_seen_at ?? previous.observed_at ?? snapshotObservedAt,
          endReason: "coverage_lost",
          detectedLandingAt: null,
          landingConfirmedAt: null,
        });
      }
      stateRows.push({
        aircraft_id: catalogRow.id,
        flight_session_id: null,
        observation_status: "unknown",
        consecutive_airborne: 0,
        consecutive_grounded: 0,
        current_state_code: null,
        observed_at: null,
        last_seen_at: previous?.last_seen_at ?? null,
        // A provider gap invalidates transition continuity. Retaining either
        // boundary would manufacture a takeoff/landing midpoint on reacquisition.
        last_grounded_at: null,
        last_airborne_at: null,
        airborne_candidate_started_at: null,
        landing_candidate_started_at: null,
        latitude: null,
        longitude: null,
        altitude_ft: null,
        ground_speed_kt: null,
        heading_deg: null,
        squawk: null,
        source: snapshot.source,
        updated_at: snapshotObservedAt,
      });
      continue;
    }

    const aircraftObservedAt = normalizedAircraftTimestamp(
      aircraft.observed_at,
      snapshot.fetched_at,
      snapshotObservedAt,
    );
    if (!isNewerAircraftObservation(previous, aircraftObservedAt)) continue;
    const positionObservedAt = normalizedAircraftTimestamp(
      aircraft.position_observed_at,
      snapshot.fetched_at,
      aircraftObservedAt,
    );

    const previousOpenSession = previous?.flight_session_id
      ? openSessionById.get(previous.flight_session_id)
      : undefined;
    const hasStaleOpenSession = isStaleOpenFlightSession(
      previousOpenSession,
      snapshotObservedAt,
    );
    const hasStaleAirborneCandidate = isStaleAirborneCandidate(
      previous,
      snapshotObservedAt,
    );
    const hasStaleLandingCandidate = isStaleLandingCandidate(
      previous,
      snapshotObservedAt,
    );
    if (hasStaleOpenSession && previous?.flight_session_id) {
      flightSessionsToFinalize.set(previous.flight_session_id, {
        status: "unknown",
        closedAt:
          previous.last_seen_at ??
          previousOpenSession?.last_seen_at ??
          previous.observed_at ??
          snapshotObservedAt,
        endReason: "stale_session",
        detectedLandingAt: null,
        landingConfirmedAt: null,
      });
    }
    const continuityPrevious =
      hasStaleOpenSession ||
      hasStaleAirborneCandidate ||
      hasStaleLandingCandidate
        ? undefined
        : previous;
    let flightSessionId = hasStaleOpenSession
      ? null
      : previous?.flight_session_id ?? null;
    const groundState = aircraftObservationGroundState(aircraft);

    if (groundState === "unknown") {
      stateRows.push({
        aircraft_id: catalogRow.id,
        flight_session_id: flightSessionId,
        observation_status: "unknown",
        consecutive_airborne: 0,
        consecutive_grounded: 0,
        current_state_code: await resolveCurrentStateCode(
          db,
          aircraft.lat,
          aircraft.lon,
          catalogRow.home_state_code,
        ),
        observed_at: aircraftObservedAt,
        last_seen_at: aircraftObservedAt,
        // An ambiguous provider sample breaks both transition intervals. It
        // updates contact/position without being evidence of air or ground.
        last_grounded_at: null,
        last_airborne_at: null,
        airborne_candidate_started_at: null,
        landing_candidate_started_at: null,
        latitude: aircraft.lat ?? null,
        longitude: aircraft.lon ?? null,
        altitude_ft: aircraft.altitude_ft ?? null,
        ground_speed_kt: aircraft.ground_speed_kt ?? null,
        heading_deg: aircraft.heading ?? null,
        squawk: aircraft.squawk ?? null,
        source: snapshot.source,
        updated_at: snapshotObservedAt,
      });
      continue;
    }

    const isAirborne = groundState === "airborne";
    const consecutiveAirborne = isAirborne
      ? (continuityPrevious?.consecutive_airborne ?? 0) + 1
      : 0;
    const consecutiveGrounded = !isAirborne
      ? (continuityPrevious?.consecutive_grounded ?? 0) + 1
      : 0;
    const lastGroundedAt = isAirborne
      ? continuityPrevious?.last_grounded_at ?? null
      : aircraftObservedAt;
    const airborneCandidateStartedAt = isAirborne
      ? continuityPrevious?.consecutive_airborne
        ? continuityPrevious.airborne_candidate_started_at ?? aircraftObservedAt
        : aircraftObservedAt
      : null;
    const lastAirborneAt = isAirborne
      ? aircraftObservedAt
      : continuityPrevious?.last_airborne_at ??
        (continuityPrevious?.observation_status === "airborne" ||
        continuityPrevious?.observation_status === "airborne_candidate"
          ? continuityPrevious.observed_at
          : null);
    let landingCandidateStartedAt =
      !isAirborne && flightSessionId
        ? continuityPrevious?.consecutive_grounded
          ? continuityPrevious.landing_candidate_started_at ?? aircraftObservedAt
          : aircraftObservedAt
        : null;
    let status: Aircraft["observation_status"] = isAirborne
      ? "airborne_candidate"
      : "grounded";

    if (
      isAirborne &&
      !flightSessionId &&
      consecutiveAirborne >= TAKEOFF_CONFIRMATION_SAMPLES
    ) {
      const detectedTakeoffAt = interpolateFlightTransition(
        continuityPrevious?.last_grounded_at,
        airborneCandidateStartedAt,
      );
      const trackingStartedAt = airborneCandidateStartedAt ?? aircraftObservedAt;
      flightSessionId = crypto.randomUUID();
      newFlightSessionRows.push({
        id: flightSessionId,
        aircraft_id: catalogRow.id,
        status: "airborne",
        tracking_started_at: trackingStartedAt,
        // First-seen-airborne is an observation boundary, not a takeoff.
        detected_takeoff_at: detectedTakeoffAt,
        last_seen_at: aircraftObservedAt,
        takeoff_time_source: detectedTakeoffAt
          ? "interpolated"
          : "tracking_started_airborne",
        confidence: detectedTakeoffAt ? "high" : "low",
        starting_fuel_estimate_gal: null,
      });
      if (detectedTakeoffAt) {
        takeoffEventCandidates.push({
          flightSessionId,
          aircraftId: catalogRow.id,
          detectedTakeoffAt,
          catalogRow,
        });
      }
    }

    if (isAirborne && flightSessionId) {
      status = "airborne";
    } else if (
      !isAirborne &&
      flightSessionId &&
      consecutiveGrounded >= LANDING_CONFIRMATION_SAMPLES
    ) {
      const detectedLandingAt =
        estimateLandingTransitionAt(
          lastAirborneAt,
          landingCandidateStartedAt,
        ) ?? aircraftObservedAt;
      flightSessionsToFinalize.set(flightSessionId, {
        status: "landed",
        closedAt: aircraftObservedAt,
        endReason: "confirmed_landing",
        detectedLandingAt,
        landingConfirmedAt: aircraftObservedAt,
      });
      flightSessionId = null;
      landingCandidateStartedAt = null;
      status = "grounded";
    } else if (!isAirborne && flightSessionId) {
      status = "landing_candidate";
    }

    stateRows.push({
      aircraft_id: catalogRow.id,
      flight_session_id: flightSessionId,
      observation_status: status,
      consecutive_airborne: consecutiveAirborne,
      consecutive_grounded: consecutiveGrounded,
      current_state_code: await resolveCurrentStateCode(
        db,
        aircraft.lat,
        aircraft.lon,
        catalogRow.home_state_code,
      ),
      observed_at: aircraftObservedAt,
      last_seen_at: aircraftObservedAt,
      last_grounded_at: lastGroundedAt,
      last_airborne_at: lastAirborneAt,
      airborne_candidate_started_at: flightSessionId
        ? null
        : airborneCandidateStartedAt,
      landing_candidate_started_at: landingCandidateStartedAt,
      latitude: aircraft.lat ?? null,
      longitude: aircraft.lon ?? null,
      altitude_ft: aircraft.altitude_ft ?? null,
      ground_speed_kt: aircraft.ground_speed_kt ?? null,
      heading_deg: aircraft.heading ?? null,
      squawk: aircraft.squawk ?? null,
      source: snapshot.source,
      updated_at: snapshotObservedAt,
    });

    if (
      isAirborne &&
      aircraft.lat != null &&
      aircraft.lon != null
    ) {
      positionRows.push({
        aircraft_id: catalogRow.id,
        flight_session_id: flightSessionId,
        observed_at: positionObservedAt,
        latitude: aircraft.lat,
        longitude: aircraft.lon,
        altitude_ft: aircraft.altitude_ft ?? null,
        ground_speed_kt: aircraft.ground_speed_kt ?? null,
        heading_deg: aircraft.heading ?? null,
        source: snapshot.source,
      });
    }
  }

  const finalizationRows = [...flightSessionsToFinalize].map(
    ([flightSessionId, finalState]) => ({
      flight_session_id: flightSessionId,
      status: finalState.status,
      closed_at: finalState.closedAt,
      end_reason: finalState.endReason,
      detected_landing_at: finalState.detectedLandingAt,
      landing_confirmed_at: finalState.landingConfirmedAt,
      updated_at: snapshotObservedAt,
    }),
  );
  const { data: lifecycleResult, error: lifecycleError } = await db.rpc(
    "apply_aircraft_lifecycle_batch",
    {
      input_sessions: newFlightSessionRows,
      input_state_rows: stateRows,
      input_position_rows: positionRows,
      input_finalizations: finalizationRows,
    },
  );
  if (lifecycleError) {
    throw new Error(`Aircraft lifecycle write failed: ${lifecycleError.message}`);
  }

  const lifecycleSummary = isRecord(lifecycleResult) ? lifecycleResult : {};
  const positionsInserted =
    finiteNumber(lifecycleSummary.positions_inserted) ?? 0;
  const insertedAircraftIds = Array.isArray(
    lifecycleSummary.inserted_aircraft_ids,
  )
    ? lifecycleSummary.inserted_aircraft_ids
    : [];
  for (const aircraftId of insertedAircraftIds) {
    const catalogRow = catalogById.get(String(aircraftId));
    if (catalogRow) {
      const stateSummary = byState[catalogRow.home_state_code];
      if (stateSummary) stateSummary.positionsInserted += 1;
    }
  }

  // Only a bounded, ground-to-air transition is eligible for a takeoff alert.
  // First-seen-airborne sessions intentionally have no detected takeoff event.
  for (const candidate of takeoffEventCandidates) {
    const suppressNotification = await shouldSuppressTakeoffNotification(
      db,
      candidate.aircraftId,
      candidate.flightSessionId,
      candidate.detectedTakeoffAt,
    );
    if (suppressNotification) continue;
    const { error: eventError } = await db.from("notification_events").upsert(
      {
        flight_session_id: candidate.flightSessionId,
        aircraft_id: candidate.aircraftId,
        state_code: candidate.catalogRow.home_state_code,
        event_type: "takeoff",
        occurred_at: candidate.detectedTakeoffAt,
        payload: {
          tail: candidate.catalogRow.tail,
          nickname: candidate.catalogRow.nickname,
          model: candidate.catalogRow.model,
          state_code: candidate.catalogRow.home_state_code,
        },
      },
      { onConflict: "flight_session_id,event_type", ignoreDuplicates: true },
    );
    if (eventError) {
      console.warn("[ingest] takeoff-event write failed:", eventError.message);
    } else {
      takeoffsCreated += 1;
      const stateSummary = byState[candidate.catalogRow.home_state_code];
      if (stateSummary) stateSummary.takeoffsCreated += 1;
    }
  }

  const { error: healthError } = await db.from("data_source_health").upsert(
    {
      source: snapshot.source,
      last_attempt_at: snapshotObservedAt,
      last_success_at: snapshotObservedAt,
      last_error: null,
      metadata: { worker_id: workerId, live_seen_count: snapshot.live_seen_count },
      updated_at: snapshotObservedAt,
    },
    { onConflict: "source" },
  );
  if (healthError) {
    throw new Error(`Source-health write failed: ${healthError.message}`);
  }

  return {
    positionsInserted,
    takeoffsCreated,
    trackedAircraftCount: snapshot.aircraft.length,
    sourceHealthy: true,
    byState,
  };
}

export function fleetEntryStateCode(entry: FleetEntry): StateCode {
  const id = stateIdForOpsAircraftTail(entry.tail) ?? "washington";
  return stateCodeForId(id);
}

function filterSeedByState(
  entries: FleetEntry[],
  stateCode?: StateCode,
): FleetEntry[] {
  if (!stateCode) return entries;
  return entries.filter((entry) => fleetEntryStateCode(entry) === stateCode);
}

function seedCatalogEntries(): AircraftCatalogEntry[] {
  return FLEET.map((aircraft) => ({
    aircraft,
    homeStateCode: fleetEntryStateCode(aircraft),
    nominalEnduranceMin: AIRCRAFT_DURATION_MINUTES[aircraft.tail] ?? null,
    usableFuelGallons: null,
    lowBurnGph: null,
    highBurnGph: null,
    reserveMin: 30,
  }));
}

function catalogRowToFleetEntry(row: Record<string, unknown>): FleetEntry {
  return {
    tail: String(row.tail),
    hex: String(row.icao24),
    operator: String(row.operator),
    model: String(row.model),
    nickname: row.nickname ? String(row.nickname) : null,
    base: String(row.base),
    role: row.role as FleetEntry["role"],
    roleConfidence: row.role_confidence as FleetEntry["roleConfidence"],
    roleDescription: String(row.role_description ?? "—"),
    roleNote: row.role_note ? String(row.role_note) : undefined,
  };
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Returns a provider-backed tri-state. An ambiguous message is contact, not
 * evidence of takeoff or landing, and therefore never advances counters.
 */
export function aircraftObservationGroundState(
  aircraft: Pick<Aircraft, "airborne" | "observation_status">,
): AircraftGroundState {
  switch (aircraft.observation_status) {
    case "airborne":
    case "airborne_candidate":
      return "airborne";
    case "grounded":
    case "landing_candidate":
      return "grounded";
    case "unknown":
      return "unknown";
    default:
      // Compatibility for explicitly constructed snapshots. Feed adapters
      // always set observation_status and therefore never use this fallback.
      return aircraft.airborne ? "airborne" : "grounded";
  }
}

/**
 * Midpoint-estimates a transition only when the two explicit observations are
 * contiguous. Coverage gaps intentionally return null rather than fabricating
 * a precise event timestamp.
 */
export function interpolateFlightTransition(
  beforeAt: string | null | undefined,
  afterAt: string | null | undefined,
  maxGapMs = FLIGHT_TRANSITION_MAX_GAP_MS,
): string | null {
  const beforeMs = parseTime(beforeAt);
  const afterMs = parseTime(afterAt);
  if (
    beforeMs == null ||
    afterMs == null ||
    afterMs < beforeMs ||
    afterMs - beforeMs > maxGapMs
  ) {
    return null;
  }
  return new Date(Math.floor((beforeMs + afterMs) / 2)).toISOString();
}

/**
 * A confirmed landing is anchored to the first grounded sample when a precise
 * midpoint cannot be justified. Confirmation time is stored separately.
 */
export function estimateLandingTransitionAt(
  lastAirborneAt: string | null | undefined,
  firstGroundedAt: string | null | undefined,
): string | null {
  const interpolated = interpolateFlightTransition(
    lastAirborneAt,
    firstGroundedAt,
  );
  if (interpolated) return interpolated;
  const firstGroundedMs = parseTime(firstGroundedAt);
  return firstGroundedMs == null
    ? null
    : new Date(firstGroundedMs).toISOString();
}

async function resolveCurrentStateCode(
  db: ReturnType<typeof getSupabaseAdmin>,
  latitude: number | undefined,
  longitude: number | undefined,
  fallbackStateCode: StateCode,
): Promise<string | null> {
  if (latitude == null || longitude == null) return null;
  const { data, error } = await db.rpc("resolve_state_code", {
    input_latitude: latitude,
    input_longitude: longitude,
  });
  if (error) {
    console.warn("[ingest] state-code resolution failed:", error.message);
    return fallbackStateCode;
  }
  return typeof data === "string" ? data : fallbackStateCode;
}

export function isStaleOpenFlightSession(
  session:
    | (Pick<FlightSessionRow, "detected_takeoff_at" | "tracking_started_at"> &
        Partial<Pick<FlightSessionRow, "closed_at">>)
    | undefined,
  nowIso: string,
): boolean {
  if (session?.closed_at) return true;
  const startedAt =
    parseTime(session?.detected_takeoff_at) ??
    parseTime(session?.tracking_started_at);
  const now = parseTime(nowIso);
  return startedAt != null &&
    now != null &&
    now - startedAt > MAX_OPEN_FLIGHT_SESSION_MS;
}

export function isUnseenFlightSessionExpired(
  previous: Pick<CurrentStateRow, "flight_session_id" | "last_seen_at" | "observed_at"> | undefined,
  nowIso: string,
): boolean {
  if (!previous?.flight_session_id) return false;
  const lastSeenAt = parseTime(previous.last_seen_at) ?? parseTime(previous.observed_at);
  const now = parseTime(nowIso);
  return lastSeenAt != null && now != null && now - lastSeenAt >= FLIGHT_SESSION_LOST_GRACE_MS;
}

export function isStaleAirborneCandidate(
  previous: Pick<CurrentStateRow, "airborne_candidate_started_at"> | undefined,
  nowIso: string,
): boolean {
  const startedAt = parseTime(previous?.airborne_candidate_started_at);
  const now = parseTime(nowIso);
  return startedAt != null &&
    now != null &&
    now - startedAt > FLIGHT_TRANSITION_MAX_GAP_MS;
}

export function isStaleLandingCandidate(
  previous: Pick<CurrentStateRow, "landing_candidate_started_at"> | undefined,
  nowIso: string,
): boolean {
  const startedAt = parseTime(previous?.landing_candidate_started_at);
  const now = parseTime(nowIso);
  return startedAt != null &&
    now != null &&
    now - startedAt > FLIGHT_TRANSITION_MAX_GAP_MS;
}

export function shouldClearUnobservedState(
  previous?: Pick<
    CurrentStateRow,
    "observation_status" | "observed_at" | "flight_session_id"
  >,
): boolean {
  return !previous ||
    previous.flight_session_id != null ||
    previous.observation_status !== "unknown" ||
    previous.observed_at != null;
}

export function isNewerAircraftObservation(
  previous: Pick<CurrentStateRow, "observed_at" | "last_seen_at"> | undefined,
  observedAt: string,
): boolean {
  const previousObservedAt =
    parseTime(previous?.last_seen_at) ?? parseTime(previous?.observed_at);
  const incomingObservedAt = parseTime(observedAt);
  return incomingObservedAt != null &&
    (previousObservedAt == null || incomingObservedAt > previousObservedAt);
}

export function shouldSuppressTakeoffNotificationForTimes(
  detectedTakeoffAt: string,
  previousNotificationAt?: string | null,
  previousLandingAt?: string | null,
): boolean {
  const takeoffMs = parseTime(detectedTakeoffAt);
  if (takeoffMs == null) return false;

  return [previousNotificationAt, previousLandingAt].some((value) => {
    const previousMs = parseTime(value);
    return previousMs != null &&
      previousMs <= takeoffMs &&
      takeoffMs - previousMs < TAKEOFF_NOTIFICATION_COOLDOWN_MS;
  });
}

function normalizedAircraftTimestamp(
  value: string | null | undefined,
  snapshotFetchedAt: number,
  fallback: string,
): string {
  const parsed = parseTime(value);
  if (parsed == null) return fallback;
  return new Date(Math.min(parsed, snapshotFetchedAt)).toISOString();
}

async function shouldSuppressTakeoffNotification(
  db: ReturnType<typeof getSupabaseAdmin>,
  aircraftId: string,
  flightSessionId: string,
  detectedTakeoffAt: string,
): Promise<boolean> {
  const takeoffMs = parseTime(detectedTakeoffAt);
  if (takeoffMs == null) return false;

  const cooldownStartedAt = new Date(
    takeoffMs - TAKEOFF_NOTIFICATION_COOLDOWN_MS,
  ).toISOString();
  const [
    { data: previousEvent, error: eventError },
    { data: previousSession, error: sessionError },
  ] = await Promise.all([
    db
      .from("notification_events")
      .select("occurred_at")
      .eq("aircraft_id", aircraftId)
      .eq("event_type", "takeoff")
      .gte("occurred_at", cooldownStartedAt)
      .lt("occurred_at", detectedTakeoffAt)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("flight_sessions")
      .select("detected_landing_at")
      .eq("aircraft_id", aircraftId)
      .neq("id", flightSessionId)
      .not("detected_landing_at", "is", null)
      .gte("detected_landing_at", cooldownStartedAt)
      .lt("detected_landing_at", detectedTakeoffAt)
      .order("detected_landing_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (eventError) {
    throw new Error(`Recent takeoff event read failed: ${eventError.message}`);
  }
  if (sessionError) {
    throw new Error(`Recent landing read failed: ${sessionError.message}`);
  }

  return shouldSuppressTakeoffNotificationForTimes(
    detectedTakeoffAt,
    typeof previousEvent?.occurred_at === "string"
      ? previousEvent.occurred_at
      : null,
    typeof previousSession?.detected_landing_at === "string"
      ? previousSession.detected_landing_at
      : null,
  );
}

function inferSnapshotSource(rows: Record<string, unknown>[] | null): SnapshotSource {
  const source = rows?.find((row) => row.source)?.source;
  return source === "opensky" ? "opensky" : "adsbfi";
}
