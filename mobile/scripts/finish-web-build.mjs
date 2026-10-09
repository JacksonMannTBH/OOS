import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const mobile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(mobile, "www");
fs.copyFileSync(path.join(mobile, "frontend/offline.html"), path.join(output, "offline.html"));
const manifest = fs.readFileSync(path.join(output, ".vite/manifest.json"));
fs.writeFileSync(path.join(output, "bundle-info.json"), JSON.stringify({
  interface: "bundled", backend: "https://outofsight.live",
  manifestSha256: createHash("sha256").update(manifest).digest("hex"),
}, null, 2) + "\n");
console.log("Packaged OOS screens, Help, and assets. Live data uses the HTTPS backend.");
