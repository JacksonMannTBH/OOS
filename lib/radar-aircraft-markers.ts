import { Marker, type Map as MaplibreMap } from "maplibre-gl";
import { HELICOPTER_ICON_SIZE, helicopterAnimatedSrc, helicopterFrameSrc } from "./brand/helicopter-sprite";

export type RadarMarkerFrame = {
  tail: string; position: [number, number]; heading: number;
  helicopter: boolean; label: string; color: string; order: number;
};
type Entry = { tag: Marker; image: HTMLImageElement; width: number; height: number; rotor?: Marker; order: number };

export function radarLabelDisplay(zoom: number) {
  const scale = zoom <= 6 ? .9 : zoom <= 10 ? .9 + (zoom - 6) * .0125
    : zoom <= 14 ? .95 + (zoom - 10) * .0125 : Math.min(1.05, 1 + (zoom - 14) * .0125);
  return { scale, opacity: Math.max(0, Math.min(1, zoom - 4.5)) };
}

// APNGs animate in small HTML markers, independently of the map's WebGL canvas.
// Keep every name tag above the icons, preserving opaque overlap and selection.
export class RadarAircraftMarkers {
  private entries = new Map<string, Entry>();
  private selected: string | null = null;
  constructor(private map: MaplibreMap, private labelPixels: (label: string, color: string) => ImageData,
    private onSelect: (tail: string) => void) {
    map.on("zoom", this.resize);
  }
  private button(tail: string, content: HTMLElement) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", `Select ${tail} aircraft`);
    button.style.cssText = "display:block;margin:0;padding:0;border:0;background:transparent;box-shadow:none;transform:none;cursor:pointer;line-height:0";
    button.append(content);
    button.onclick = event => { event.preventDefault(); event.stopPropagation(); this.onSelect(tail); };
    return button;
  }
  private resize = () => {
    const { scale, opacity } = radarLabelDisplay(this.map.getZoom());
    for (const entry of this.entries.values()) {
      entry.image.style.width = `${entry.width * scale}px`;
      entry.image.style.height = `${entry.height * scale}px`;
      entry.tag.getElement().style.opacity = String(opacity);
      entry.tag.getElement().style.pointerEvents = opacity ? "auto" : "none";
      entry.tag.setOffset([0, -30 * scale]);
    }
  };
  select(tail: string | null) {
    this.selected = tail;
    for (const [key, entry] of this.entries) {
      entry.tag.getElement().style.zIndex = String(key === tail ? 1500 : 10 + Math.round(entry.order * 1000));
    }
  }
  update(frames: RadarMarkerFrame[]) {
    const current = new Set(frames.map(frame => frame.tail));
    let orderChanged = false;
    for (const [tail, entry] of this.entries) {
      if (current.has(tail)) continue;
      entry.tag.remove();entry.rotor?.remove();this.entries.delete(tail);orderChanged = true;
    }
    for (const frame of frames) {
      let entry = this.entries.get(frame.tail);
      if (!entry) {
        const pixels = this.labelPixels(frame.label, frame.color);
        const canvas = document.createElement("canvas");
        canvas.width = pixels.width;canvas.height = pixels.height;
        canvas.getContext("2d")!.putImageData(pixels, 0, 0);
        const image = new Image();image.src = canvas.toDataURL();image.alt = "";image.draggable = false;
        const element = document.createElement("div");element.className = "ss-radar-aircraft-tag";element.dataset.tail = frame.tail;
        element.append(this.button(frame.tail, image));
        const tag = new Marker({ element, rotationAlignment: "viewport", pitchAlignment: "viewport" })
          .setLngLat(frame.position).addTo(this.map);
        entry = { tag, image, width: pixels.width / 3, height: pixels.height / 3, order: frame.order };
        this.entries.set(frame.tail, entry);
        this.resize();orderChanged = true;
      }
      if (entry.order !== frame.order) orderChanged = true;
      entry.order = frame.order;
      entry.tag.setLngLat(frame.position);
      if (frame.helicopter && !entry.rotor) {
        const icon = document.createElement("span");icon.className = "ss-helicopter-icon";
        const size = HELICOPTER_ICON_SIZE * .95;
        icon.style.cssText = `display:block;width:${size}px;height:${size}px;background-position:center;background-repeat:no-repeat;background-size:contain`;
        icon.style.setProperty("--ss-heli-animated-image", `url("${helicopterAnimatedSrc()}")`);
        icon.style.setProperty("--ss-heli-static-image", `url("${helicopterFrameSrc(0)}")`);
        const element = document.createElement("div");element.className = "ss-radar-helicopter";element.dataset.tail = frame.tail;element.style.zIndex = "1";
        element.append(this.button(frame.tail, icon));
        entry.rotor = new Marker({ element, rotationAlignment: "map", pitchAlignment: "map" })
          .setLngLat(frame.position).setRotation(frame.heading).addTo(this.map);
      } else if (!frame.helicopter && entry.rotor) { entry.rotor.remove();entry.rotor = undefined; }
      entry.rotor?.setLngLat(frame.position).setRotation(frame.heading);
    }
    if (orderChanged) this.select(this.selected);
  }
  remove() {
    this.map.off("zoom", this.resize);
    for (const entry of this.entries.values()) { entry.tag.remove();entry.rotor?.remove(); }
    this.entries.clear();
  }
}
