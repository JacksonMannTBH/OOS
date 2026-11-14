// Reveal the live destination map at its native scale; never enlarge a bitmap.
import { deferRideSummary } from "@/lib/ride-summary-transition";

let cancelCurrent: (() => void) | undefined;
export function cancelMapTransition() { cancelCurrent?.(); }

function copyScreen(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  const originals = source.querySelectorAll("canvas");
  clone.querySelectorAll("canvas").forEach((canvas, index) => {
    const original = originals[index];
    if (!original) return;
    canvas.width = original.width;
    canvas.height = original.height;
    try { canvas.getContext("2d")?.drawImage(original, 0, 0); }
    catch { /* The destination can still open if the preview has not drawn yet. */ }
  });
  clone.querySelectorAll("[id]").forEach(element => { if (element instanceof HTMLElement) element.removeAttribute("id"); });
  clone.removeAttribute("id");
  return clone;
}

type Screen = "home" | "map" | "ride";
const SCREEN_SELECTORS: Record<Screen, string> = { home: ".ss-home", map: ".ss-map-screen", ride: ".ss-ride-screen" };
const MAP_SELECTORS: Record<Screen, string> = {
  home: ".ss-home-map-preview", map: ":scope > .maplibregl-map", ride: ".ss-ride-map",
};

export function animateMapNavigation(update: () => void, fromRide: boolean) {
  animateScreenNavigation(update, fromRide ? "ride" : "home", "map");
}

export function animateRideNavigation(update: () => void, fromMap: boolean) {
  animateScreenNavigation(update, fromMap ? "map" : "home", "ride");
}

export function animateRideReturnNavigation(update: () => void) {
  const screen = document.querySelector<HTMLElement>(SCREEN_SELECTORS.ride);
  const stats = screen?.querySelector<HTMLElement>(".ss-ride-live-stats");
  const gForce = screen?.querySelector<HTMLElement>(".ss-gforce-view");
  if (screen && (stats || gForce)) animateRidePanelReturnNavigation(screen, update, stats ? "stats" : "gforce");
  else animateScreenNavigation(update, "ride", "home");
}

export function animateMapReturnNavigation(update: () => void) {
  animateScreenNavigation(update, "map", "home");
}

function surroundingContent(root: HTMLElement, renderer: HTMLElement): HTMLElement[] {
  return [...root.children].flatMap(element => {
    if (!(element instanceof HTMLElement) || element === renderer) return [];
    return element.contains(renderer) ? surroundingContent(element, renderer) : [element];
  });
}

function animateRidePanelReturnNavigation(screen: HTMLElement, update: () => void, kind: "stats" | "gforce") {
  const overlay = document.createElement("div");
  overlay.dataset.oosMapTransition = `${kind}-return`;
  overlay.dataset.oosScreenTransition = "home";
  overlay.setAttribute("aria-hidden", "true");
  overlay.inert = true;
  overlay.style.cssText = "position:fixed;inset:0;z-index:10000;overflow:hidden;pointer-events:auto";
  const background = copyScreen(screen);
  const panel = background.querySelector<HTMLElement>(kind === "stats" ? ".ss-ride-live-stats" : ".ss-gforce-view");
  if (panel) panel.style.animation = "none";
  overlay.append(background);
  document.body.append(overlay);
  background.scrollTop = screen.scrollTop;

  const animations: Animation[] = [];
  const releaseSummary = deferRideSummary();
  let frame: number | undefined;
  let destination: HTMLElement | null = null;
  let wasInert = false;
  let arrival: Animation | undefined;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (frame !== undefined) cancelAnimationFrame(frame);
    animations.forEach(animation => animation.cancel());
    if (destination) destination.inert = wasInert;
    overlay.remove();
    releaseSummary();
    if (cancelCurrent === dispose) cancelCurrent = undefined;
  };
  cancelCurrent = dispose;

  let navigated = false;
  try {
    // Start the visible panel's exit immediately, independently of Home's map.
    // Fade the screen once so its readings stay readable as it moves away.
    const exit = background.animate([
      { opacity: 1, offset: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 0, offset: 1 },
    ], { duration: 540, easing: "ease-in-out", fill: "both" });
    animations.push(exit);
    if (panel) animations.push(panel.animate([
      { transform: "translateY(0px) scale(1)" },
      { transform: "translateY(32px) scale(.94)" },
    ], { duration: 540, easing: "cubic-bezier(.22,.61,.36,1)", fill: "both" }));
    navigated = true;
    update();
    const revealHome = () => {
      if (disposed) return;
      destination = document.querySelector<HTMLElement>(SCREEN_SELECTORS.home);
      if (!destination) { frame = requestAnimationFrame(revealHome); return; }
      wasInert = destination.inert;
      destination.inert = true;
      try {
        arrival = destination.animate([
          { opacity: 0, transform: "translateY(16px)" },
          { opacity: 1, transform: "translateY(0px)" },
        ], { duration: 440, easing: "cubic-bezier(.22,.61,.36,1)", fill: "both" });
        animations.push(arrival);
      } catch { /* The panel's exit can finish even if Home cannot animate. */ }
    };
    frame = requestAnimationFrame(revealHome);
    void exit.finished.then(async () => { await arrival?.finished; }).catch(() => {}).finally(dispose);
  } catch (error) {
    dispose();
    if (!navigated) update();
    else throw error;
  }
}

function animateScreenNavigation(update: () => void, from: Screen, to: Screen) {
  const screen = document.querySelector<HTMLElement>(SCREEN_SELECTORS[from]);
  const preview = screen?.querySelector<HTMLElement>(MAP_SELECTORS[from]);
  const bounds = preview?.getBoundingClientRect();
  if (!screen || !preview || !bounds?.width || !bounds.height) { update(); return; }

  const overlay = document.createElement("div");
  overlay.dataset.oosMapTransition = "preparing";
  overlay.dataset.oosScreenTransition = to;
  overlay.setAttribute("aria-hidden", "true");
  overlay.inert = true;
  overlay.style.cssText = "position:fixed;inset:0;z-index:10000;overflow:hidden;background:#000;pointer-events:auto";
  const background = copyScreen(screen);
  background.style.pointerEvents = "none";
  overlay.append(background);
  document.body.append(overlay);

  let disposed = false;
  let timer: ReturnType<typeof setTimeout>;
  let ready: () => void;
  let resolveReady: (loaded: boolean) => void;
  const readyEvent = to === "home" ? "oos:home-map-ready" : to === "ride" ? "oos:ride-map-ready" : "oos:map-ready";
  const mapReady = new Promise<boolean>(resolve => {
    resolveReady = resolve;
    ready = () => resolve(true);
    window.addEventListener(readyEvent, ready, { once: true });
    timer = setTimeout(() => resolve(false), 1800);
  });
  const animations: Animation[] = [];
  const restore: Array<() => void> = [];
  const releaseSummary = to === "home" ? deferRideSummary() : () => {};
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(timer!);
    window.removeEventListener(readyEvent, ready!);
    resolveReady!(false);
    animations.forEach(animation => animation.cancel());
    restore.forEach(reset => reset());
    overlay.remove();
    releaseSummary();
    if (cancelCurrent === dispose) cancelCurrent = undefined;
  };
  cancelCurrent = dispose;

  let navigated = false;
  try {
    // Give immediate feedback while the destination reuses the preview's tiles.
    animations.push(background.animate([{ opacity: 1 }, { opacity: 0.96 }], { duration: 120, fill: "forwards" }));
    navigated = true;
    update();
    void mapReady.then(async loaded => {
      if (disposed) return;
      clearTimeout(timer!);
      window.removeEventListener(readyEvent, ready!);
      const destination = document.querySelector<HTMLElement>(SCREEN_SELECTORS[to]);
      const renderer = destination?.querySelector<HTMLElement>(to === "home" ? ".ss-home-map-preview" : to === "ride" ? ".ss-ride-map-link" : ":scope > .maplibregl-map");
      if (!loaded || !destination || !renderer) {
        overlay.dataset.oosMapTransition = "fading";
        const fade = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" });
        animations.push(fade);
        await fade.finished;
        return;
      }

      if (from === "map" && to === "home") {
        const sourceRenderer = background.querySelector<HTMLElement>(":scope > .maplibregl-map");
        if (sourceRenderer) {
          const target = renderer.getBoundingClientRect();
          const source = background.getBoundingClientRect();
          const viewport = sourceRenderer.getBoundingClientRect();
          const offsetX = target.left + target.width / 2 - (viewport.left + viewport.width / 2);
          const offsetY = target.top + target.height / 2 - (viewport.top + viewport.height / 2);
          const scroll = renderer.closest<HTMLElement>(".ss-home-scroll")?.getBoundingClientRect();
          const targetTop = Math.max(target.top, scroll?.top ?? 0, 0);
          const targetBottom = Math.min(target.bottom, scroll?.bottom ?? innerHeight, innerHeight);
          const clip = `inset(${Math.max(0, targetTop - source.top)}px ${Math.max(0, source.right - target.right)}px ${Math.max(0, source.bottom - targetBottom)}px ${Math.max(0, target.left - source.left)}px round 18px)`;
          overlay.style.background = "transparent";
          overlay.dataset.oosMapTransition = "contracting";
          destination.dataset.oosMapReveal = "live";
          restore.push(() => { delete destination.dataset.oosMapReveal; });
          const timing = { duration: 420, easing: "cubic-bezier(.2,.72,.25,1)", fill: "forwards" as const };
          // Crop and move the full-resolution map; its labels never stretch.
          const contraction = background.animate([
            { clipPath: "inset(0px round 0px)" }, { clipPath: clip },
          ], timing);
          animations.push(contraction, sourceRenderer.animate([
            { transform: "translate(0px, 0px)" }, { transform: `translate(${offsetX}px, ${offsetY}px)` },
          ], timing));
          surroundingContent(background, sourceRenderer).forEach(element => animations.push(element.animate([
            { opacity: getComputedStyle(element).opacity }, { opacity: 0 },
          ], { duration: 120, fill: "forwards" })));
          surroundingContent(destination, renderer).forEach(element => animations.push(element.animate([
            { opacity: 0 }, { opacity: getComputedStyle(element).opacity },
          ], { duration: 220, delay: 100, fill: "both" })));
          animations.push(background.animate([{ opacity: 0.96 }, { opacity: 0 }], { duration: 120, delay: 300, fill: "forwards" }));
          await contraction.finished;
          return;
        }
      }

      const original = { clipPath: destination.style.clipPath, zIndex: destination.style.zIndex,
        pointerEvents: destination.style.pointerEvents, inert: destination.inert, transform: renderer.style.transform,
        transition: renderer.style.transition };
      restore.push(() => {
        Object.assign(destination.style, { clipPath: original.clipPath, zIndex: original.zIndex, pointerEvents: original.pointerEvents });
        destination.inert = original.inert;
        renderer.style.transform = original.transform;
        // Settle before restoring link hover/press transitions; otherwise the
        // global transform transition replays the starting offset on cleanup.
        renderer.getBoundingClientRect();
        renderer.style.transition = original.transition;
        delete destination.dataset.oosMapReveal;
      });
      const frame = renderer.getBoundingClientRect();
      const destinationBounds = destination.getBoundingClientRect();
      const offsetX = bounds.left + bounds.width / 2 - (frame.left + frame.width / 2);
      const offsetY = bounds.top + bounds.height / 2 - (frame.top + frame.height / 2);
      const clip = `inset(${Math.max(0, bounds.top - destinationBounds.top)}px ${Math.max(0, destinationBounds.right - bounds.right)}px ${Math.max(0, destinationBounds.bottom - bounds.bottom)}px ${Math.max(0, bounds.left - destinationBounds.left)}px round ${from === "ride" ? "50%" : from === "map" ? "0px" : "18px"})`;
      destination.style.zIndex = "10001";
      destination.style.pointerEvents = "none";
      destination.inert = true;
      destination.style.clipPath = clip;
      destination.dataset.oosMapReveal = "live";
      renderer.style.transition = "none";
      renderer.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

      const chrome = surroundingContent(destination, renderer);
      overlay.dataset.oosMapTransition = "expanding";
      const timing = { duration: 420, easing: "cubic-bezier(.2,.72,.25,1)", fill: "forwards" as const };
      const expansion = destination.animate([{ clipPath: clip }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], timing);
      const movement = renderer.animate([{ transform: renderer.style.transform }, { transform: original.transform || "translate(0px, 0px)" }], timing);
      const fade = background.animate([{ opacity: 0.96 }, { opacity: 0 }], { duration: 340, fill: "forwards" });
      animations.push(expansion, movement, fade);
      if (to !== "map") {
        // Move between Home's rectangle and Ride's circle while the live map
        // keeps its native scale and each screen's intended framing.
        const circle = to === "home" ? renderer : renderer.querySelector<HTMLElement>(".ss-ride-map");
        if (circle) animations.push(circle.animate([
          { borderRadius: from === "ride" ? "50%" : from === "home" ? "18px" : "0px" }, { borderRadius: to === "home" ? "18px" : "50%" },
        ], timing));
        animations.push(renderer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, fill: "forwards" }));
      }
      chrome.forEach(element => animations.push(element.animate([{ opacity: 0 }, { opacity: getComputedStyle(element).opacity }], { duration: 160, delay: 260, fill: "both" })));
      await expansion.finished;
    }).catch(() => {}).finally(dispose);
  } catch (error) {
    dispose();
    if (!navigated) update();
    else throw error;
  }
}
