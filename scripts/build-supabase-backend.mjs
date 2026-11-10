import { build } from "esbuild";
import { mkdir, readFile } from "node:fs/promises";

await mkdir(".local/cloud-functions", { recursive: true });
for (const entry of ["ingest", "api", "app", "notifications"]) {
  await build({
    entryPoints: [`cloud-backend/src/${entry}.ts`],
    outfile: `.local/cloud-functions/${entry}.js`, bundle: true, format: "esm",
    platform: "node", target: "es2022", treeShaking: true,
    banner: { js: 'import process from "node:process";' },
    plugins: [{ name: "supabase-deno-import", setup(builder) {
      builder.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({
        path: "npm:@supabase/supabase-js@2.110.9", external: true,
      }));
      builder.onResolve({ filter: /^web-push$/ }, () => ({
        path: "npm:web-push@3.6.7", external: true,
      }));
    } }],
  });
}
console.log("Built Supabase ingestion, read API, native app API, and notification functions.");

// Guard the owner-selected supplier in the artifact that is actually deployed.
const ingestionBundle = await readFile(".local/cloud-functions/ingest.js", "utf8");
if (!ingestionBundle.includes("opendata.adsb.fi") || ingestionBundle.includes("api.adsb.lol")) {
  throw new Error("Ingestion must use ADSB.fi. Refusing to build a different supplier.");
}
