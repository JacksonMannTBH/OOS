import type { Config } from "@netlify/functions";
import { refreshPrediction } from "../../lib/predictor";

export default async function refreshPredictor(): Promise<Response> {
  const result = await refreshPrediction();
  return Response.json({
    ok: true,
    window_count: result.windows.length,
    total_events: result.total_events,
    generated_at: result.generated_at,
  });
}

export const config: Config = {
  schedule: "17 * * * *",
};
