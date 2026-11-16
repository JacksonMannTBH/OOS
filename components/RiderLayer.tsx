"use client";
import { useEffect } from "react";
import maplibregl, { type Map as MaplibreMap } from "maplibre-gl";
import { DINKIE_RIDER_ICONS } from "@/lib/elite-rider-icons";
import { subscribeRiders } from "@/lib/rider-feed";
import { ownRiderID } from "@/lib/rider-profile-client";
import type { SharedRider } from "@/lib/rider-sharing";

export function RiderLayer({ map, enabled = true }: { map: MaplibreMap | null; enabled?: boolean }) {
  useEffect(() => {
    if (!map || !enabled) return;
    const entries = new Map<string, { marker: maplibregl.Marker; popup: maplibregl.Popup; button: HTMLButtonElement; name: HTMLElement; speed: HTMLElement; icon: HTMLElement }>();
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastBounds = "";
    function clear() { for (const e of entries.values()) { e.popup.remove(); e.marker.remove(); } entries.clear(); }
    function render(riders: SharedRider[]) {
      const keep = new Set(riders.filter(r => r.id !== ownRiderID()).map(r => r.id));
      for (const [id,e] of entries) if (!keep.has(id)) { e.popup.remove(); e.marker.remove(); entries.delete(id); }
      for (const r of riders) {
        if (!keep.has(r.id)) continue;
        let e = entries.get(r.id);
        if (!e) {
          const button = document.createElement("button"); button.type="button"; button.className="ss-rider-marker";
          const icon = document.createElement("span"); icon.className="ss-rider-marker__icon"; button.append(icon);
          const details = document.createElement("div"); details.className="ss-rider-popup";
          const name = document.createElement("strong"); const speed = document.createElement("span"); details.append(name,speed);
          const popup = new maplibregl.Popup({ offset: 22, closeButton: true, maxWidth: "220px", className: "ss-rider-popup-shell" }).setDOMContent(details);
          const marker = new maplibregl.Marker({ element: button }).setLngLat([r.lon,r.lat]).addTo(map!);
          button.addEventListener("click", event => { event.stopPropagation(); if (popup.isOpen()) popup.remove(); else { for (const other of entries.values()) other.popup.remove(); popup.setLngLat(marker.getLngLat()).addTo(map!); } });
          e={ marker,popup,button,name,speed,icon }; entries.set(r.id,e);
        }
        e.marker.setLngLat([r.lon,r.lat]); e.popup.setLngLat([r.lon,r.lat]); e.name.textContent=r.username;
        e.speed.textContent=r.speedMps === undefined ? "" : `${Math.round(r.speedMps*2.236936)} MPH`;
        e.speed.hidden=r.speedMps === undefined;
        e.button.setAttribute("aria-label",`Rider ${r.username}${r.speedMps === undefined ? "" : `, ${Math.round(r.speedMps*2.236936)} miles per hour`}`);
        if (e.icon.dataset.icon !== r.icon) {
          const sprite=DINKIE_RIDER_ICONS.find(i=>i.id===r.icon)!;
          const svg=document.createElementNS("http://www.w3.org/2000/svg","svg"); svg.setAttribute("viewBox",`0 0 ${sprite.width} ${sprite.height}`); svg.setAttribute("shape-rendering","crispEdges"); svg.setAttribute("aria-hidden","true");
          const path=document.createElementNS("http://www.w3.org/2000/svg","path"); path.setAttribute("d",sprite.path); path.setAttribute("fill","currentColor"); svg.append(path);
          e.icon.replaceChildren(svg); e.icon.dataset.icon=r.icon;
        }
      }
    }
    function update() {
      if (map!.getZoom()<6) { unsubscribe?.(); unsubscribe=undefined; lastBounds=""; clear(); return; }
      const b=map!.getBounds(), c=map!.getCenter();
      // Pad and quantize interest bounds so GPS-follow camera movement does
      // not reconnect every second while riding.
      const cx=Math.round(c.lng*10)/10,cy=Math.round(c.lat*10)/10;
      const bounds={ west: Math.max(-180,cx-4,Math.floor((b.getWest()-.05)*10)/10), east: Math.min(180,cx+4,Math.ceil((b.getEast()+.05)*10)/10), south: Math.max(-90,cy-4,Math.floor((b.getSouth()-.05)*10)/10), north: Math.min(90,cy+4,Math.ceil((b.getNorth()+.05)*10)/10) };
      const key=JSON.stringify(Object.values(bounds).map(n=>Math.round(n*1000)/1000));
      if (key===lastBounds) return;
      lastBounds=key; unsubscribe?.(); unsubscribe=subscribeRiders(bounds,render);
    }
    const moved=()=>{ clearTimeout(timer); timer=setTimeout(update,300); };
    map.on("moveend",moved); update();
    return ()=>{ clearTimeout(timer); map.off("moveend",moved); unsubscribe?.(); clear(); };
  },[map,enabled]);
  return null;
}
