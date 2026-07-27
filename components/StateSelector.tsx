"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  APP_STATES,
  STATE_CHANGE_EVENT,
  getSelectedStateCode,
  setSelectedStateCode,
  type StateCode,
} from "@/lib/app-states";
import { SS_TOKENS } from "@/lib/tokens";

export function StateSelector({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const [current, setCurrent] = useState<StateCode>(
    () => getSelectedStateCode(),
  );

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ code?: StateCode }>).detail;
      setCurrent(detail?.code ?? getSelectedStateCode());
    };
    window.addEventListener(STATE_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(STATE_CHANGE_EVENT, onChange);
  }, []);

  return (
    <select
      className={className}
      value={current}
      onChange={(event) => setSelectedStateCode(event.target.value as StateCode)}
      aria-label="State"
      style={{
        minHeight: 42,
        borderRadius: 10,
        border: `.5px solid ${SS_TOKENS.hairline2}`,
        background: SS_TOKENS.bg1,
        color: SS_TOKENS.fg0,
        padding: "0 12px",
        font: "inherit",
        fontWeight: 700,
        ...style,
      }}
    >
      {APP_STATES.map((state) => (
        <option key={state.code} value={state.code}>
          {state.label}
        </option>
      ))}
    </select>
  );
}
