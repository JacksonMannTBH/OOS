const LIVE_DATA_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Netlify-CDN-Cache-Control": "no-store",
} as const;

export function liveDataHeaders(netlifyVary?: string): Record<string, string> {
  return netlifyVary
    ? { ...LIVE_DATA_HEADERS, "Netlify-Vary": netlifyVary }
    : { ...LIVE_DATA_HEADERS };
}
