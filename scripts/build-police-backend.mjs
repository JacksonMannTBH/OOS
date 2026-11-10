import { build } from "esbuild";
await build({ entryPoints: ["cloud-backend/src/police.ts"], outfile: ".local/cloud-functions/police.js", bundle: true, format: "esm", platform: "neutral", mainFields: ["module", "main"], target: "es2022" });
console.log("Built isolated police-reporting function.");
