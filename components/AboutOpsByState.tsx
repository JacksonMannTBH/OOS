"use client";

import { useMemo, useState } from "react";
import {
  APP_STATES,
  DEFAULT_APP_STATE_ID,
  type AppStateId,
} from "@/lib/app-states";
import { OPS_AIRCRAFT } from "@/lib/aircraft-directory";
import { SS_TOKENS } from "@/lib/tokens";

export function AboutOpsByState() {
  const [stateId, setStateId] = useState<AppStateId>(DEFAULT_APP_STATE_ID);
  const selectedState =
    APP_STATES.find((state) => state.id === stateId) ?? APP_STATES[0];
  const aircraft = useMemo(
    () => OPS_AIRCRAFT.filter((row) => row.stateId === stateId),
    [stateId],
  );
  const hasFuelCapacity = aircraft.some((row) => row.fuelText);

  return (
    <div style={{ margin: "30px 0 20px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <h2 style={{ margin: 0 }}>Meet the Ops</h2>
        <label
          className="ss-mono"
          style={{
            display: "grid",
            gap: 6,
            color: SS_TOKENS.fg2,
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
          }}
        >
          State
          <select
            value={stateId}
            onChange={(e) => setStateId(e.target.value as AppStateId)}
            aria-label="State aircraft list"
            style={{
              minWidth: 210,
              height: 42,
              borderRadius: 8,
              border: `.5px solid ${SS_TOKENS.hairline2}`,
              background: SS_TOKENS.bg1,
              color: SS_TOKENS.fg0,
              padding: "0 12px",
              font: "inherit",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {APP_STATES.map((state) => (
              <option key={state.id} value={state.id}>
                {state.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <table>
        <thead>
          <tr>
            <th>Tail #</th>
            <th>Aircraft</th>
            {hasFuelCapacity && <th>Fuel capacity</th>}
            <th>Published top / max cruise speed</th>
            <th>Estimated full-fuel run time</th>
          </tr>
        </thead>
        <tbody>
          {aircraft.map((row) => (
            <tr key={row.tail}>
              <td>{row.tail}</td>
              <td>
                {row.model}
                <br />
                <small>{row.unit}</small>
              </td>
              {hasFuelCapacity && <td>{row.fuelText ?? "-"}</td>}
              <td>{row.speedText}</td>
              <td>{row.enduranceText}</td>
            </tr>
          ))}
          {aircraft.length === 0 && (
            <tr>
              <td colSpan={hasFuelCapacity ? 5 : 4}>
                No aircraft listed for {selectedState.label}.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
