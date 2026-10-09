import { PUBLIC_WEB_ORIGIN } from "../../lib/public-url";

export function sameAppOrigin(left: URL, right: URL): boolean {
  return left.protocol === right.protocol && left.host === right.host;
}
export function backendUrl(input: string, localBase: string): string {
  const local = new URL(input, localBase);
  if (sameAppOrigin(local, new URL(localBase)) && local.pathname.startsWith("/api/")) {
    return `${PUBLIC_WEB_ORIGIN}${local.pathname}${local.search}`;
  }
  return input;
}

// CapacitorHttp patches fetch before this module runs. Preserve that native
// transport, which allows the local app origin to reach the HTTPS backend.
export function connectBackend(): void {
  const transport = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (input instanceof Request) {
      const mapped = backendUrl(input.url, window.location.href);
      return transport(mapped === input.url ? input : new Request(mapped, input), init);
    }
    return transport(backendUrl(String(input), window.location.href), init);
  };
}
