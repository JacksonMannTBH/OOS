export const PUBLIC_WEB_ORIGIN = "https://outofsight.live";

export function publicPageUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalized, PUBLIC_WEB_ORIGIN);
  if (url.origin !== PUBLIC_WEB_ORIGIN) throw new Error("Invalid OOS page path");
  return url.toString();
}
