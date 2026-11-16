import type { ReactNode } from "react";

// Release adapters exclude the membership dialog, labels and rider-sharing UI.
export function ProProvider({ children }: { children: ReactNode }) { return <>{children}</>; }
export const ProRideBoundary = ProProvider;
export const ProStatsBoundary = ProProvider;
export function ProFeatureGate({ children }: { children: ReactNode; feature?: unknown; title?: string }) { return <>{children}</>; }
export function ProBadge(_props: { className?: string }) { return null; }
export function EliteBadge() { return null; }
export function ProDetails() { return null; }
export function FreeAlertsSettings() { return null; }
export function RiderSharingSync() { return null; }
export function RiderLayer(_props: { map: unknown; enabled?: boolean }) { return null; }
