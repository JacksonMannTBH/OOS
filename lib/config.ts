// Single source of truth for the canonical user-facing URL.
//
// Resolution order:
//   1. NEXT_PUBLIC_BASE_URL (explicit canonical origin)
//   2. URL (Netlify's production URL)
//   3. DEPLOY_PRIME_URL (Netlify deploy-preview fallback)
//   4. http://localhost:3000 (local development)
//
// NEXT_PUBLIC_* vars are inlined at build time, so this resolves once at
// build for any client-side bundle and at module load for the server.
export const BASE_URL = (() => {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicit) return stripTrailingSlash(explicit);
  const netlifyUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  if (netlifyUrl) return stripTrailingSlash(netlifyUrl);
  return "http://localhost:3000";
})();

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
