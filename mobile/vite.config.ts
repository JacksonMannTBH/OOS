import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
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
      for (const id of Object.keys(file.modules)) if (/\/lib\/(supabase\/|admin-auth|aircraft-data\.ts|registry\.ts|flights\.ts)/.test(id) || /@supabase\/(?!(?:realtime-js|phoenix)(?:\/|$))/.test(id)) throw new Error("Server data access must stay out of the mobile bundle: " + id);
    }
  },
};

export default defineConfig(({ mode }) => {
const membershipPreview = mode === "membership-preview";
const releaseAliases = membershipPreview ? [] : [
  { find: /^(?:@\/lib\/|\.\.?\/)pro-access$/, replacement: path.join(frontend, "release/pro-access.ts") },
  { find: "@/lib/rider-profile-client", replacement: path.join(frontend, "release/rider-profile-client.ts") },
  { find: /^(?:@\/components\/|\.\/)(?:ProAccess|RiderSharingSync|RiderLayer)$/, replacement: path.join(frontend, "release/access-ui.tsx") },
  { find: /^\.\/(?:Settings|Elite)$/, replacement: path.join(frontend, "release/Settings.tsx") },
];
const membershipRelease: Plugin = {
  name: "oos-membership-release",
  enforce: "pre",
  resolveId(id) {
    if (!membershipPreview && /(?:^|\/)content\/help\.md\?raw$/.test(id)) return "\0oos-release-help";
  },
  load(id) {
    if (id !== "\0oos-release-help") return;
    const help = fs.readFileSync(path.join(root, "content/help.md"), "utf8")
      .replace(/<!-- membership-preview:start -->[\s\S]*?<!-- membership-preview:end -->/g, "");
    return "export default " + JSON.stringify(help);
  },
  generateBundle(_, bundle) {
    const heldModules = /\/(?:components\/(?:ProAccess|EliteSettings|RiderSharingSync|RiderLayer|PixelRiderIcon)\.tsx|lib\/(?:pro-access|rider-(?:feed|profile-client|sharing))\.ts|frontend\/(?:Elite|Settings)\.tsx)$/;
    for (const file of Object.values(bundle)) {
      if (membershipPreview || file.type !== "chunk") continue;
      for (const id of Object.keys(file.modules)) {
        if (heldModules.test(id)) throw new Error("Membership preview entered the release: " + id);
      }
    }
    this.emitFile({ type: "asset", fileName: "release-features.json", source: JSON.stringify({ membershipPreview }) + "\n" });
  },
};
return {
  root: frontend,
  publicDir: path.join(root, "public"),
  envDir: frontend,
  plugins: [packagedAssets, membershipRelease],
  define: {
    "process.env.NEXT_PUBLIC_MAP_STYLE_URL": JSON.stringify(process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? ""),
    "process.env.NEXT_PUBLIC_OOS_MEMBERSHIP_PREVIEW": JSON.stringify(String(membershipPreview)),
  },
  resolve: {
    dedupe: ["react", "react-dom", "@capacitor/core"],
    alias: [
      ...releaseAliases,
      alias("next/navigation", "navigation.tsx"), alias("next/link", "navigation.tsx"),
      alias("next/image", "compat/image.tsx"), alias("next/dynamic", "compat/dynamic.tsx"),
      ...["aircraft-data", "registry", "snapshot", "flights", "flags"].map(name => alias("@/lib/" + name, "data.ts")),
      alias("@/lib/user-prefs", "preferences.ts"), alias("@/app/(tabs)/settings/actions", "preferences.ts"),
      alias("@/components/TimeFormatSetting", "PreferenceSettings.tsx"), alias("@/components/ContrastSetting", "PreferenceSettings.tsx"),
      alias("@/lib/config", "config.ts"), { find: "@", replacement: root },
    ],
  },
  oxc: { jsx: { runtime: "automatic" } },
  css: { postcss: mobile },
  build: {
    outDir: path.join(mobile, "www"), emptyOutDir: true, manifest: true, target: "es2022", sourcemap: false,
    rolldownOptions: { input: { main: path.join(frontend, "index.html"), offline: path.join(frontend, "offline.html") } },
  },
};
});
