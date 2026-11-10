import backend from "../../../mobile/backend.json";
export const dynamic = "force-dynamic";
async function forward(request: Request): Promise<Response> {
  const response = await fetch(`${backend.url.replace(/\/oos-app$/, "/oos-police")}${new URL(request.url).search}`, {
    method: request.method, headers: { apikey: backend.publishableKey, "Content-Type": "application/json" },
    body: request.method === "GET" ? undefined : await request.text(), cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
export const GET = forward;
export const POST = forward;
export const DELETE = forward;
