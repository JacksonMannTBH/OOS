"use client";

import { useSyncExternalStore } from "react";

let pending = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const snapshot = () => pending > 0;

/** Let the return to Home finish before opening the saved-ride dialog. */
export function deferRideSummary(): () => void {
  pending++;
  listeners.forEach(listener => listener());
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pending--;
    listeners.forEach(listener => listener());
  };
}

export function useRideSummaryDeferred(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
