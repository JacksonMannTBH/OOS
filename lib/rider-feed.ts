"use client";
import { RealtimeClient } from "@supabase/realtime-js";
import backend from "../mobile/backend.json";
import { ridersBackendURL } from "./rider-profile-client";
import { RiderCollection, riderTopics, type RiderBounds, type SharedRider } from "./rider-sharing";

/** Viewport-scoped subscriptions; no rider coordinates travel on aircraft topics. */
export function subscribeRiders(bounds: RiderBounds, listener: (riders: SharedRider[]) => void): () => void {
  const collection = new RiderCollection();
  const client = new RealtimeClient(`${new URL(backend.url).origin}/realtime/v1`, { params: { apikey: backend.publishableKey }, accessToken: async () => null });
  let disposed = false; let paused = document.visibilityState !== "visible"; let offset = 0; let inFlight = false;
  let readAgain = false;
  let channels: ReturnType<RealtimeClient["channel"]>[] = [];
  const controllers = new Set<AbortController>();
  let lastEvent = new Map<string, number>();
  const emit = () => listener(collection.list(Date.now() + offset).filter(r => r.lon >= bounds.west && r.lon <= bounds.east && r.lat >= bounds.south && r.lat <= bounds.north));
  async function snapshot() {
    if (disposed || paused) return;
    if (inFlight) { readAgain=true; return; }
    inFlight = true;
    const started = Date.now(); const controller = new AbortController(); controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${ridersBackendURL}/riders?${new URLSearchParams(Object.entries(bounds).map(([k,v])=>[k,String(v)]))}`, { headers: { apikey: backend.publishableKey }, signal: controller.signal, cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { riders: SharedRider[]; serverTime: number };
      if (disposed || paused || controller.signal.aborted || !Array.isArray(data.riders) || !Number.isFinite(data.serverTime)) return;
      offset = data.serverTime - Date.now();
      const ids = new Set(data.riders.map(r => r.id));
      collection.removeMissing(ids,id => (lastEvent.get(id) ?? 0) < started);
      for (const r of data.riders) collection.accept({ id: r.id, version: r.version, rider: r });
      emit();
    } catch { /* Expiry still removes old positions while offline. */ }
    finally { clearTimeout(timeout); controllers.delete(controller); inFlight = false; if(readAgain){readAgain=false;void snapshot();} }
  }
  function suspend() { for (const c of channels) void client.removeChannel(c); channels=[]; for (const c of controllers) c.abort(); if(!disposed)listener([]); }
  function resume() {
    if (disposed || paused || channels.length) return;
    let joined = 0;
    const topics = riderTopics(bounds);
    channels = topics.map(topic => client.channel(topic, { config: { private: true } })
      .on("broadcast", { event: "rider" }, ({ payload }) => {
        if (disposed || paused) return;
        if (collection.accept(payload)) { lastEvent.set(payload.id, Date.now()); emit(); }
      }).subscribe(status => { if (status === "SUBSCRIBED" && ++joined >= topics.length) void snapshot(); }));
    void snapshot();
  }
  function visibility() { paused=document.visibilityState !== "visible"; if (paused) suspend(); else resume(); }
  function pause() { paused=true; suspend(); }
  function unpause() { paused=false; resume(); }
  document.addEventListener("visibilitychange",visibility); document.addEventListener("pause",pause); document.addEventListener("resume",unpause);
  const expiry = setInterval(() => { if (!paused) emit(); },1_000);
  // A bounded reconciliation also repairs a missed privacy-change broadcast.
  const recovery = setInterval(() => { if (!paused) void snapshot(); },15_000);
  resume();
  return () => { disposed=true; suspend(); clearInterval(expiry); clearInterval(recovery); document.removeEventListener("visibilitychange",visibility); document.removeEventListener("pause",pause); document.removeEventListener("resume",unpause); client.disconnect(); lastEvent.clear(); };
}
