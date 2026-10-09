import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
const mobile = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(mobile);
const frontend = path.join(mobile, "frontend");
const alias = (name: string, file: string) => ({ find: name, replacement: path.join(frontend, file) });

const packagedAssets: Plugin = {
  name: "oos-packaged-assets",
  enforce: "pre",
  resolveId(id) {
    if (id.startsWith(path.join(root, "public") + path.sep) && /\.(webp|png|jpe?g)$/.test(id)) return "\0oos-image:" + id;
    if (id === "server-only" || id.startsWith("next/headers") || id.startsWith("next/server") || id.startsWith("node:")) throw new Error("A server-only module entered the mobile interface: " + id);
  },
  load(id) { if (id.startsWith("\0oos-image:")) return `export default {src:${JSON.stringify("/" + path.relative(path.join(root, "public"), id.slice("\0oos-image:".length)).split(path.sep).join("/"))}}`; },
  generateBundle(_, bundle) {
    for (const file of Object.values(bundle)) {
      if (file.type !== "chunk") continue;
      for (const id of Object.keys(file.modules)) if (/\/lib\/(supabase\/|admin-auth|aircraft-data\.ts|registry\.ts|flights\.ts|learning\.ts|predictor\.ts)/.test(id) || id.includes("@supabase/")) throw new Error("Server data access must stay out of the mobile bundle: " + id);
    }
  },
};

export default defineConfig({
  root: frontend,
  publicDir: path.join(root, "public"),
  envDir: frontend,
  plugins: [packagedAssets],
  resolve: {
    dedupe: ["react", "react-dom", "@capacitor/core"],
    alias: [
      alias("next/navigation", "navigation.tsx"), alias("next/link", "navigation.tsx"),
      alias("next/image", "compat/image.tsx"), alias("next/dynamic", "compat/dynamic.tsx"),
      ...["aircraft-data", "registry", "snapshot", "flights", "learning", "predictor", "flags"].map(name => alias("@/lib/" + name, "data.ts")),
      alias("@/lib/user-prefs", "preferences.ts"), alias("@/app/(tabs)/settings/actions", "preferences.ts"),
      alias("@/components/TimeFormatSetting", "PreferenceSettings.tsx"), alias("@/components/ContrastSetting", "PreferenceSettings.tsx"),
      alias("@/lib/config", "config.ts"), { find: "@", replacement: root },
    ],
  },
  oxc: { jsx: { runtime: "automatic" } },
  css: { postcss: mobile },
  build: { outDir: path.join(mobile, "www"), emptyOutDir: true, manifest: true, target: "es2022", sourcemap: false },
});
