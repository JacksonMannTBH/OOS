import { useEffect, useState } from "react";
import {
  STATE_CHANGE_EVENT,
  getSelectedStateCode,
  stateIdForCode,
  type AppStateId,
} from "../app-states";

export function useSelectedStateId(): AppStateId {
  const [stateId, setStateId] = useState<AppStateId>(
    () => stateIdForCode(getSelectedStateCode()),
  );
  useEffect(() => {
    const onChange = () => {
      setStateId(stateIdForCode(getSelectedStateCode()));
    };
    window.addEventListener(STATE_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(STATE_CHANGE_EVENT, onChange);
  }, []);
  return stateId;
}
