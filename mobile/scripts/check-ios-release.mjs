import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const mobile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = path.join(mobile, "ios/App/App");
const errors = [];
const requireSigning = process.argv.includes("--require-signing");
const readPlist = (file) => JSON.parse(execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", file], { encoding: "utf8" }));
const configPath = path.join(app, "capacitor.config.json");
if (!fs.existsSync(configPath)) {
  errors.push("Run npm run sync:ios first.");
} else {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (config.appId !== "live.outofsight.app") errors.push("Unexpected iOS app identifier.");
  if (config.server?.url || config.server?.cleartext !== false || config.plugins?.CapacitorHttp?.enabled !== true) {
    errors.push("Release builds must bundle their interface and enable native HTTPS data requests. Run npm run sync:ios.");
  }
  for (const file of ["index.html", "offline.html", ".vite/manifest.json", "bundle-info.json"]) {
    if (!fs.existsSync(path.join(app, "public", file))) errors.push(`Missing packaged interface file: ${file}. Run npm run sync:ios.`);
  }
}
const firebasePath = path.join(app, "Configuration/GoogleService-Info.plist");
if (!fs.existsSync(firebasePath)) {
  errors.push("Add the iOS Firebase configuration to ios/App/App/Configuration/GoogleService-Info.plist.");
} else {
  try {
    const firebase = readPlist(firebasePath);
    if (firebase.BUNDLE_ID !== "live.outofsight.app") errors.push("The Firebase configuration belongs to a different app identifier.");
    if (firebase.PROJECT_ID !== "out-of-sight-d3216" || !firebase.GOOGLE_APP_ID) errors.push("Use the iPhone configuration from Firebase project out-of-sight-d3216.");
  } catch {
    errors.push("The Firebase configuration is not a valid iOS app plist.");
  }
}
try {
  const project = readPlist(path.join(mobile, "ios/App/App.xcodeproj/project.pbxproj"));
  const objects = project.objects;
  const releaseSettings = (name) => {
    const target = Object.values(objects).find((entry) => entry.isa === "PBXNativeTarget" && entry.name === name);
    if (!target) throw new Error(`Missing ${name} target.`);
    const list = objects[target.buildConfigurationList];
    const release = list.buildConfigurations.map((id) => objects[id]).find((entry) => entry.name === "Release");
    if (!release) throw new Error(`Missing ${name} Release configuration.`);
    return release.buildSettings;
  };
  const main = releaseSettings("App");
  const widget = releaseSettings("LiveTrackingWidget");
  if (main.PRODUCT_BUNDLE_IDENTIFIER !== "live.outofsight.app" || widget.PRODUCT_BUNDLE_IDENTIFIER !== "live.outofsight.app.LiveTrackingWidget") errors.push("The app and widget must keep their OOS bundle identifiers.");
  if (String(main.MARKETING_VERSION) !== String(widget.MARKETING_VERSION) || String(main.CURRENT_PROJECT_VERSION) !== String(widget.CURRENT_PROJECT_VERSION)) errors.push("The app and widget version/build numbers must match before upload.");
  const entitlements = readPlist(path.join(mobile, "ios/App", main.CODE_SIGN_ENTITLEMENTS));
  const widgetEntitlements = readPlist(path.join(mobile, "ios/App", widget.CODE_SIGN_ENTITLEMENTS));
  const group = "group.live.outofsight.app";
  if (!entitlements["com.apple.security.application-groups"]?.includes(group) ||
      !widgetEntitlements["com.apple.security.application-groups"]?.includes(group)) {
    errors.push("The app and Home Screen widget must share the OOS App Group.");
  }
  if (readPlist(path.join(mobile, "ios/App", widget.INFOPLIST_FILE)).NSWidgetWantsLocation !== true) {
    errors.push("The Home Screen widget must declare its location use.");
  }
  if (main.APS_ENVIRONMENT !== "production" || entitlements["aps-environment"] !== "$(APS_ENVIRONMENT)") errors.push("The Release app must use production APNs entitlements.");
  if (requireSigning) {
    const inherited = objects[objects[project.rootObject].buildConfigurationList].buildConfigurations
      .map((id) => objects[id]).find((entry) => entry.name === "Release")?.buildSettings ?? {};
    const mainTeam = main.DEVELOPMENT_TEAM || inherited.DEVELOPMENT_TEAM;
    const widgetTeam = widget.DEVELOPMENT_TEAM || inherited.DEVELOPMENT_TEAM;
    if (!/^[A-Z0-9]{10}$/.test(mainTeam ?? "")) errors.push("Select your enrolled Apple development team for the App target in Xcode.");
    if (!widgetTeam || mainTeam !== widgetTeam) errors.push("Select the same Apple development team for LiveTrackingWidget.");
    if ((main.CODE_SIGN_STYLE || inherited.CODE_SIGN_STYLE) !== "Automatic" || (widget.CODE_SIGN_STYLE || inherited.CODE_SIGN_STYLE) !== "Automatic") errors.push("Use automatic signing for both OOS targets.");
  }
} catch (error) {
  errors.push(`Could not validate the iOS project: ${error.message}`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Local release checks passed${requireSigning ? ", including team settings" : ""}. Verify signed provisioning, APNs credentials, live delivery, and privacy disclosures before uploading.`);
}
