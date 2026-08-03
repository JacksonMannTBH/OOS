/**
 * Role drives the home + radar status pill via lib/status.ts. Only fixed_wing
 * (speed-enforcement fixed-wing) and patrol (multi-role helicopters) trigger
 * the alert pill; sar / transport stay green; unknown is treated as alert
 * (conservative default for tails we haven't classified yet).
 */
export type FleetRole =
  | "fixed_wing"
  | "patrol"
  | "sar"
  | "transport"
  | "unknown";

export type RoleConfidence = "confirmed" | "tentative" | "unknown";

export type FleetEntry = {
  tail: string;
  /**
   * FAA-confirmed Mode S ICAO24 hex (uppercase, 6 chars). When omitted, the
   * value is computed deterministically from the N-number via lib/icao.ts at
   * module load time. The icao.test.ts assertion guards against typos here.
   */
  hex?: string | null;
  operator: string;
  model: string;
  nickname: string | null;
  /**
   * Free-text mission description (e.g. "Speed enforcement"). Surfaced in the
   * /about registry and on the plane detail page. Distinct from `role` /
   * `roleConfidence`, which drive the status-pill semantics.
   */
  roleDescription: string;
  /** Home airport: ICAO code + city. */
  base: string;
  /** Role classification driving the status pill. See lib/status.ts. */
  role: FleetRole;
  roleConfidence: RoleConfidence;
  /**
   * Optional 1-line note explaining the classification. Visible in the admin
   * editor and as a tooltip on /plane/[tail]. ≤120 chars.
   */
  roleNote?: string;
};

export type AircraftLive = {
  tail: string;
  icao24: string;
  /** True only when the current upstream sample contained this aircraft. */
  observed?: boolean;
  /** Timestamp of the upstream aircraft message, not the local fetch time. */
  observed_at?: string | null;
  /** Timestamp of the upstream position used for lat/lon. */
  position_observed_at?: string | null;
  airborne: boolean;
  observation_status?: "grounded" | "airborne_candidate" | "airborne" | "landing_candidate" | "unknown";
  home_state_code?: string;
  current_state_code?: string | null;
  flight_session_id?: string | null;
  detected_takeoff_at?: string | null;
  takeoff_confidence?: "low" | "medium" | "high" | null;
  starting_fuel_estimate_gal?: number;
  usable_fuel_gallons?: number;
  nominal_endurance_min?: number;
  low_burn_gph?: number;
  high_burn_gph?: number;
  reserve_min?: number;
  lat?: number;
  lon?: number;
  altitude_ft?: number;
  ground_speed_kt?: number;
  heading?: number;
  time_aloft_min?: number;
  last_seen_min?: number | null;
  /** Mode A squawk code (4 octal-ish digits as string) when reported. */
  squawk?: string | null;
};

export type Aircraft = FleetEntry & AircraftLive;

export type SnapshotSource = "adsbfi" | "opensky" | "mock";

/**
 * Internal feed-agnostic aircraft shape produced by both adsb.fi and OpenSky
 * adapters. Field names match adsb.fi's v2 API since that's the primary source.
 */
export type NormalizedAc = {
  hex: string;
  /** Registration / tail number, when the upstream feed provides it. */
  r?: string;
  lat?: number;
  lon?: number;
  /** Barometric altitude in feet, or "ground" when on the deck. */
  alt_baro?: number | "ground";
  /** Ground speed, knots. */
  gs?: number;
  /** True track, degrees. */
  track?: number;
  /** Mode A squawk code as 4-character string. */
  squawk?: string | null;
  /** Seconds since the upstream source last received any message. */
  seen_seconds?: number;
  /** Seconds since the upstream source last received a position. */
  seen_position_seconds?: number;
  /** Exact upstream timestamp for the last aircraft message. */
  observed_at_ms?: number;
  /** Exact upstream timestamp for the last position. */
  position_observed_at_ms?: number;
};

export type Snapshot = {
  fetched_at: number;
  source: SnapshotSource;
  source_ok?: boolean;
  source_error?: string;
  aircraft: Aircraft[];
  /**
   * Current tracked-fleet observations returned by the upstream feed before
   * they are joined back onto the complete state catalog.
   */
  live_seen_count: number;
};
