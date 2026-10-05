"use client";

import Link from "next/link";
import { getAppState } from "@/lib/app-states";
import type { AircraftCatalogEntry } from "@/lib/aircraft-data";
import { useSelectedStateId } from "@/lib/hooks/useSelectedStateId";
import { STATE_AIRCRAFT_COVERAGE_NOTES } from "@/lib/state-aircraft-coverage";
import { SettingsCard } from "./SettingsCard";
import { useState } from "react";
import { useAircraftTracking } from "@/lib/hooks/useAircraftTracking";
import { isAircraftTracked, readAircraftTrackingPreferences, saveAircraftTrackingPreferences, withAircraftTracked, withStateAircraftExclusions } from "@/lib/aircraft-tracking";

export function SelectedStateAircraftList({ catalog }: { catalog: AircraftCatalogEntry[] }) {
  const stateId = useSelectedStateId();
  const state = getAppState(stateId);
  const preferences = useAircraftTracking();
  const [error, setError] = useState<string | null>(null);
  const save = (tail: string | null, tracked = true) => {
    try {
      const current = readAircraftTrackingPreferences();
      saveAircraftTrackingPreferences(tail === null
        ? withStateAircraftExclusions(current, state.code, [])
        : withAircraftTracked(current, state.code, tail, tracked));
      setError(null);
    } catch {
      setError("Could not save aircraft selections on this device. Try again.");
    }
  };
  const aircraft = catalog
    .filter((entry) => entry.homeStateCode === state.code)
    .sort((a, b) => a.aircraft.tail.localeCompare(b.aircraft.tail));

  return (
    <SettingsCard title={`${state.label} aircraft`} eyebrow="Tracked fleet">
      <p style={{ margin: 0, color: "var(--ss-fg2)", fontSize: 13 }}>
        Choose which aircraft to track. Reset selects all aircraft in this state.
      </p>
      <button className="ss-aircraft-reset" type="button" onClick={() => save(null)} disabled={!(preferences[state.code]?.length)}>
        Reset
      </button>
      {error && <p role="alert">{error}</p>}
      {aircraft.length > 0 ? (
        <ul className="ss-settings-aircraft-list">
          {aircraft.map(({ aircraft: plane }) => (
            <li key={plane.tail}>
              <div className="ss-settings-aircraft-row">
                <input
                  type="checkbox"
                  aria-label={`Track ${plane.tail}`}
                  checked={isAircraftTracked(preferences, state.code, plane.tail)}
                  onChange={(event) => save(plane.tail, event.target.checked)}
                />
                <Link
                  className="ss-settings-aircraft-copy"
                  href={`/plane/${plane.tail}`}
                  prefetch={false}
                  aria-label={`View ${plane.tail} information`}
                >
                  <strong>{plane.tail}</strong>
                  <span>{plane.model}</span>
                  <small>{plane.operator}</small>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, color: "var(--ss-fg1)", fontSize: 13, lineHeight: 1.5 }}>
          {STATE_AIRCRAFT_COVERAGE_NOTES[state.code] ?? `No aircraft are currently listed for ${state.label}.`}
        </p>
      )}
    </SettingsCard>
  );
}
