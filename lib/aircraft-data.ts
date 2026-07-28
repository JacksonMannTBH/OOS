import { AIRCRAFT_DURATION_MINUTES, stateIdForOpsAircraftTail } from "./aircraft-directory";
import {
  DEFAULT_STATE_CODE,
  getAppState,
  stateCodeForId,
  type StateCode,
} from "./app-states";
import { fleetHex, FLEET } from "./seed";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase/server";
import type { Aircraft, FleetEntry, Snapshot, SnapshotSource } from "./types";

type CurrentStateRow = {
  aircraft_id: string;
  flight_session_id: string | null;
  observation_status: Aircraft["observation_status"];
  consecutive_airborne: number;
  consecutive_grounded: number;
  observed_at: string | null;
  last_seen_at: string | null;
  last_grounded_at: string | null;
  airborne_candidate_started_at: string | null;
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
};

const TAKEOFF_CONFIRMATION_SAMPLES = 2;
const LANDING_CONFIRMATION_SAMPLES = 2;
const CURRENT_OBSERVATION_MAX_AGE_MS = 2 * 60 * 1_000;

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

  const { data, error } = await getSupabaseAdmin()
    .from("aircraft_live_public")
    .select("*")
    .eq("home_state_code", stateCode)
    .order("tail");
  if (error) throw new Error(`Live aircraft read failed: ${error.message}`);

  const snapshotReadAt = Date.now();
  let fetchedAt = 0;
  const aircraft = (data ?? []).map((row) => {
    const observedAt = parseTime(row.observed_at);
    const lastSeenAt = parseTime(row.last_seen_at);
    const hasCurrentObservation =
      observedAt != null &&
      snapshotReadAt - observedAt <= CURRENT_OBSERVATION_MAX_AGE_MS;
    if (hasCurrentObservation) fetchedAt = Math.max(fetchedAt, observedAt);
    const status = row.observation_status as Aircraft["observation_status"];
    const airborne =
      hasCurrentObservation &&
      (status === "airborne" || status === "airborne_candidate");
    const takeoffAt = parseTime(row.detected_takeoff_at);
    const trackingStartedAt = parseTime(row.tracking_started_at);
    const elapsedStart = takeoffAt ?? trackingStartedAt;
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
        hasCurrentObservation
          ? (row.takeoff_confidence as Aircraft["takeoff_confidence"]) ?? null
          : null,
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
  const observedAt = new Date(snapshot.fetched_at).toISOString();

  if (snapshot.source_ok === false) {
    await db.from("data_source_health").upsert(
      {
        source: snapshot.source,
        last_attempt_at: observedAt,
        last_failure_at: observedAt,
        last_error: snapshot.source_error ?? "all live sources failed",
        metadata: { worker_id: workerId },
        updated_at: observedAt,
      },
      { onConflict: "source" },
    );
    return {
      positionsInserted: 0,
      takeoffsCreated: 0,
      trackedAircraftCount: 0,
      sourceHealthy: false,
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
  const ids = catalog.map((row) => row.id);
  const { data: performanceData, error: performanceError } = ids.length
    ? await db
        .from("aircraft_performance_profiles")
        .select("aircraft_id,usable_fuel_gallons")
        .in("aircraft_id", ids)
    : { data: [], error: null };
  if (performanceError) {
    throw new Error(`Performance-profile read failed: ${performanceError.message}`);
  }
  const performanceByAircraft = new Map(
    (performanceData ?? []).map((row) => [
      String(row.aircraft_id),
      finiteNumber(row.usable_fuel_gallons),
    ]),
  );
  const { data: currentData, error: currentError } = ids.length
    ? await db.from("aircraft_current_state").select("*").in("aircraft_id", ids)
    : { data: [], error: null };
  if (currentError) throw new Error(`Current-state read failed: ${currentError.message}`);
  const currentByAircraft = new Map(
    ((currentData ?? []) as CurrentStateRow[]).map((row) => [row.aircraft_id, row]),
  );

  const stateRows: Record<string, unknown>[] = [];
  const positionRows: Record<string, unknown>[] = [];
  let takeoffsCreated = 0;

  for (const aircraft of snapshot.aircraft) {
    const catalogRow = catalogByTail.get(aircraft.tail.toUpperCase());
    if (!catalogRow) continue;
    const previous = currentByAircraft.get(catalogRow.id);
    const wasObserved = aircraft.observed !== false;
    if (!wasObserved) {
      stateRows.push({
        aircraft_id: catalogRow.id,
        flight_session_id: previous?.flight_session_id ?? null,
        observation_status: "unknown",
        consecutive_airborne: 0,
        consecutive_grounded: 0,
        current_state_code: null,
        observed_at: null,
        last_seen_at: previous?.last_seen_at ?? null,
        last_grounded_at: previous?.last_grounded_at ?? null,
        airborne_candidate_started_at: null,
        latitude: null,
        longitude: null,
        altitude_ft: null,
        ground_speed_kt: null,
        heading_deg: null,
        squawk: null,
        source: snapshot.source,
        updated_at: observedAt,
      });
      continue;
    }

    const isAirborne = aircraft.airborne;
    const consecutiveAirborne = isAirborne
      ? (previous?.consecutive_airborne ?? 0) + 1
      : 0;
    const consecutiveGrounded = !isAirborne
      ? (previous?.consecutive_grounded ?? 0) + 1
      : 0;
    const lastGroundedAt = isAirborne
      ? previous?.last_grounded_at ?? null
      : observedAt;
    const airborneCandidateStartedAt = isAirborne
      ? previous?.consecutive_airborne
        ? previous.airborne_candidate_started_at ?? observedAt
        : observedAt
      : null;
    let flightSessionId = previous?.flight_session_id ?? null;
    let status: Aircraft["observation_status"] = isAirborne
      ? "airborne_candidate"
      : "grounded";

    if (
      isAirborne &&
      !flightSessionId &&
      consecutiveAirborne >= TAKEOFF_CONFIRMATION_SAMPLES
    ) {
      const lastGroundedMs = parseTime(previous?.last_grounded_at);
      const firstAirborneMs = parseTime(
        previous?.airborne_candidate_started_at,
      );
      const interpolatedTakeoffAt =
        lastGroundedMs && firstAirborneMs
          ? new Date(
              Math.floor((lastGroundedMs + firstAirborneMs) / 2),
            ).toISOString()
          : null;
      const detectedTakeoffAt =
        interpolatedTakeoffAt ?? airborneCandidateStartedAt ?? observedAt;
      const { data: session, error: sessionError } = await db
        .from("flight_sessions")
        .insert({
          aircraft_id: catalogRow.id,
          status: "airborne",
          tracking_started_at: previous?.observed_at ?? observedAt,
          detected_takeoff_at: detectedTakeoffAt,
          last_seen_at: observedAt,
          takeoff_time_source: interpolatedTakeoffAt
            ? "interpolated"
            : "tracking_started_airborne",
          confidence: interpolatedTakeoffAt ? "high" : "low",
          starting_fuel_estimate_gal:
            performanceByAircraft.get(catalogRow.id) ?? null,
        })
        .select("id")
        .single();
      if (sessionError) {
        const { data: openSession } = await db
          .from("flight_sessions")
          .select("id")
          .eq("aircraft_id", catalogRow.id)
          .is("detected_landing_at", null)
          .maybeSingle();
        flightSessionId = openSession?.id ? String(openSession.id) : null;
      } else {
        flightSessionId = String(session.id);
      }

      if (flightSessionId) {
        const { error: eventError } = await db.from("notification_events").upsert(
          {
            flight_session_id: flightSessionId,
            aircraft_id: catalogRow.id,
            state_code: catalogRow.home_state_code,
            event_type: "takeoff",
            occurred_at: detectedTakeoffAt,
            payload: {
              tail: catalogRow.tail,
              nickname: catalogRow.nickname,
              model: catalogRow.model,
              state_code: catalogRow.home_state_code,
            },
          },
          { onConflict: "flight_session_id,event_type", ignoreDuplicates: true },
        );
        if (!eventError) takeoffsCreated += 1;
      }
    }

    if (isAirborne && flightSessionId) {
      status = "airborne";
      await db
        .from("flight_sessions")
        .update({ status: "airborne", last_seen_at: observedAt, updated_at: observedAt })
        .eq("id", flightSessionId);
    } else if (
      !isAirborne &&
      flightSessionId &&
      consecutiveGrounded >= LANDING_CONFIRMATION_SAMPLES
    ) {
      await db
        .from("flight_sessions")
        .update({
          status: "landed",
          detected_landing_at: observedAt,
          last_seen_at: observedAt,
          updated_at: observedAt,
        })
        .eq("id", flightSessionId);
      flightSessionId = null;
      status = "grounded";
    } else if (!isAirborne && flightSessionId) {
      status = "landing_candidate";
    }

    let currentStateCode: string | null = null;
    if (aircraft.lat != null && aircraft.lon != null) {
      const { data: resolvedState } = await db.rpc("resolve_state_code", {
        input_latitude: aircraft.lat,
        input_longitude: aircraft.lon,
      });
      currentStateCode =
        typeof resolvedState === "string" ? resolvedState : catalogRow.home_state_code;
    }

    stateRows.push({
      aircraft_id: catalogRow.id,
      flight_session_id: flightSessionId,
      observation_status: status,
      consecutive_airborne: consecutiveAirborne,
      consecutive_grounded: consecutiveGrounded,
      current_state_code: currentStateCode,
      observed_at: observedAt,
      last_seen_at: observedAt,
      last_grounded_at: lastGroundedAt,
      airborne_candidate_started_at: airborneCandidateStartedAt,
      latitude: aircraft.lat ?? null,
      longitude: aircraft.lon ?? null,
      altitude_ft: aircraft.altitude_ft ?? null,
      ground_speed_kt: aircraft.ground_speed_kt ?? null,
      heading_deg: aircraft.heading ?? null,
      squawk: aircraft.squawk ?? null,
      source: snapshot.source,
      updated_at: observedAt,
    });

    if (
      isAirborne &&
      aircraft.lat != null &&
      aircraft.lon != null
    ) {
      positionRows.push({
        aircraft_id: catalogRow.id,
        flight_session_id: flightSessionId,
        observed_at: observedAt,
        latitude: aircraft.lat,
        longitude: aircraft.lon,
        altitude_ft: aircraft.altitude_ft ?? null,
        ground_speed_kt: aircraft.ground_speed_kt ?? null,
        heading_deg: aircraft.heading ?? null,
        source: snapshot.source,
      });
    }
  }

  if (stateRows.length > 0) {
    const { error } = await db
      .from("aircraft_current_state")
      .upsert(stateRows, { onConflict: "aircraft_id" });
    if (error) throw new Error(`Current-state write failed: ${error.message}`);
  }
  if (positionRows.length > 0) {
    const { error } = await db
      .from("aircraft_positions")
      .upsert(positionRows, {
        onConflict: "aircraft_id,observed_at",
        ignoreDuplicates: true,
      });
    if (error) throw new Error(`Position write failed: ${error.message}`);
  }

  await db.from("data_source_health").upsert(
    {
      source: snapshot.source,
      last_attempt_at: observedAt,
      last_success_at: observedAt,
      last_error: null,
      metadata: { worker_id: workerId, live_seen_count: snapshot.live_seen_count },
      updated_at: observedAt,
    },
    { onConflict: "source" },
  );

  return {
    positionsInserted: positionRows.length,
    takeoffsCreated,
    trackedAircraftCount: snapshot.aircraft.length,
    sourceHealthy: true,
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

function parseTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferSnapshotSource(rows: Record<string, unknown>[] | null): SnapshotSource {
  const source = rows?.find((row) => row.source)?.source;
  return source === "opensky" ? "opensky" : "adsbfi";
}
