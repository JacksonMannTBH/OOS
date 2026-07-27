import type { Config, Context } from "@netlify/functions";

export default async function aircraftIngest(
  _request: Request,
  context: Context,
): Promise<Response> {
  const secret = Netlify.env.get("CRON_SECRET");
  if (!secret) {
    return Response.json({ ok: false, error: "missing_cron_secret" }, { status: 500 });
  }
  const baseUrl = context.site.url || Netlify.env.get("URL");
  if (!baseUrl) {
    return Response.json({ ok: false, error: "missing_site_url" }, { status: 500 });
  }

  const response = await fetch(
    new URL("/.netlify/functions/aircraft-ingest-background", baseUrl),
    {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
    },
  );
  return Response.json(
    { ok: response.ok, background_status: response.status },
    { status: response.ok ? 202 : response.status },
  );
}

export const config: Config = {
  schedule: "* * * * *",
};
