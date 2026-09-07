import type { StateCode } from "./app-states";

/** A research gap is not a statement that a state has no aviation support. */
export const STATE_AIRCRAFT_COVERAGE_NOTES: Partial<Record<StateCode, string>> = {
  RI: "No verified crewed law enforcement aircraft are currently listed for Rhode Island. Aviation support may still be available from partner agencies.",
  VT: "No verified crewed law enforcement aircraft are currently listed for Vermont. Aviation support may still be available from partner agencies.",
};
