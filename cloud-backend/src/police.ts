import { runtime } from "./runtime";
import { createPoliceHandler } from "./police-handler";

runtime.serve(createPoliceHandler(name => runtime.env.get(name), async (name, args) => {
  const key = runtime.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${runtime.env.get("SUPABASE_URL")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key ?? "", Authorization: `Bearer ${key}` },
    body: JSON.stringify(args), signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("police_database_unavailable");
  return response.json();
}));
