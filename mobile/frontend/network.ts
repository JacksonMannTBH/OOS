import backend from "../backend.json";

export function sameAppOrigin(left: URL, right: URL): boolean {
  return left.protocol === right.protocol && left.host === right.host;
}
export function backendUrl(input: string, localBase: string): string {
  const local = new URL(input, localBase);
  if (sameAppOrigin(local, new URL(localBase)) && local.pathname.startsWith("/api/")) {
    if (local.pathname === "/api/police") return `${backend.url.replace(/\/oos-app$/, "/oos-police")}${local.search}`;
    return `${backend.url}${local.pathname.slice(4)}${local.search}`;
  }
  return input;
}

// CapacitorHttp patches fetch before this module runs. Preserve that native
// transport, which allows the local app origin to reach the HTTPS backend.
export function connectBackend(): void {
  const transport = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const original = input instanceof Request ? input.url : String(input);
    const mapped = backendUrl(original, window.location.href);
    if (mapped === original) return transport(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set("apikey", backend.publishableKey);
    const options = { ...init, headers };
    if (input instanceof Request) {
      return transport(new Request(mapped, input), options);
    }
    return transport(mapped, options);
  };
}
