// Shared environment adapter lets the cloud worker use the app's existing
// database/lifecycle modules without a second copy of that logic.
export const runtime = (globalThis as unknown as {
  Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
}).Deno;
Object.assign(globalThis, { Netlify: { env: runtime.env } });
export const json = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store" },
});
