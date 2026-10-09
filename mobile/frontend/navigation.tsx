import { forwardRef, useMemo, useSyncExternalStore, type AnchorHTMLAttributes } from "react";
import { sameAppOrigin } from "./network";

const EVENT = "oos:navigation";
let revision = 0;
const subscribe = (callback: () => void) => {
  window.addEventListener(EVENT, callback);
  window.addEventListener("popstate", callback);
  window.addEventListener("hashchange", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("popstate", callback);
    window.removeEventListener("hashchange", callback);
  };
};
const location = () => window.location.pathname + window.location.search + window.location.hash;
export function useLocation() { return useSyncExternalStore(subscribe, location, () => "/home"); }
export function useRevision() { return useSyncExternalStore(subscribe, () => revision, () => 0); }
export function refresh() { revision += 1; window.dispatchEvent(new Event(EVENT)); }

export type Href = string | { pathname?: string; query?: Record<string, string | number | boolean | undefined>; hash?: string };
export function hrefString(href: Href): string {
  if (typeof href === "string") return href;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(href.query ?? {})) if (value !== undefined) q.set(key, String(value));
  return (href.pathname ?? "/") + (q.size ? `?${q}` : "") + (href.hash ? `#${href.hash.replace(/^#/, "")}` : "");
}
export function navigate(href: Href, replace = false, scroll = true) {
  const target = new URL(hrefString(href), window.location.href);
  if (!sameAppOrigin(target, new URL(window.location.href))) { window.location.assign(target.href); return; }
  window.history[replace ? "replaceState" : "pushState"]({}, "", target.href);
  window.dispatchEvent(new Event(EVENT));
  if (target.hash) requestAnimationFrame(() => document.getElementById(decodeURIComponent(target.hash.slice(1)))?.scrollIntoView());
  else if (scroll) window.scrollTo(0, 0);
}
const router = { push: (href: string, options?: { scroll?: boolean }) => navigate(href, false, options?.scroll !== false), replace: (href: string, options?: { scroll?: boolean }) => navigate(href, true, options?.scroll !== false), back: () => window.history.back(), forward: () => window.history.forward(), refresh, prefetch: () => {} };
export function useRouter() { return router; }
export function usePathname() { return new URL(useLocation(), "https://local.oos").pathname; }
export function useSearchParams() {
  const current = useLocation();
  return useMemo(() => new URLSearchParams(new URL(current, "https://local.oos").search), [current]);
}
export function notFound(): never { throw new Error("This aircraft or flight could not be found."); }
export function redirect(href: string): never { navigate(href, true); throw new Error("Navigation changed"); }

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: Href; prefetch?: boolean; replace?: boolean; scroll?: boolean };
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, prefetch, replace, scroll, onClick, ...props }, ref) {
  return <a {...props} ref={ref} href={hrefString(href)} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (props.target && props.target !== "_self") || props.download) return;
    const target = new URL(hrefString(href), window.location.href);
    if (!sameAppOrigin(target, new URL(window.location.href))) return;
    event.preventDefault();
    navigate(href, replace, scroll);
  }} />;
});
export default Link;

// Map popups and Markdown contain ordinary anchors as well as React links.
export function connectNavigation() {
  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const anchor = event.target instanceof Element ? event.target.closest("a") : null;
    if (!(anchor instanceof HTMLAnchorElement) || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href);
    if (!sameAppOrigin(url, new URL(window.location.href))) return;
    event.preventDefault();
    navigate(url.href);
  });
}
