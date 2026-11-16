"use client";
import { useEffect } from "react";
import { usePro } from "@/lib/hooks/usePro";
import { setRiderMembership } from "@/lib/rider-profile-client";
export function RiderSharingSync() {
  const plan=usePro();
  useEffect(()=>{ if (plan.ready) void setRiderMembership(plan.elite).catch(()=>{}); },[plan.ready,plan.elite]);
  return null;
}
