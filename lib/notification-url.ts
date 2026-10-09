// Notification payloads may navigate only within this app's origin.
export function notificationPath(value: unknown, origin: string): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return null;
  try {
    const base = new URL(origin);
    const url = new URL(value, origin);
    return url.protocol === base.protocol && url.host === base.host ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}
