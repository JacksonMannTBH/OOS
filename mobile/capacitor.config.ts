import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "live.outofsight.app",
  appName: "Out Of Sight",
  webDir: "www",
  server: {
    cleartext: false,
    errorPath: "offline.html",
  },
  backgroundColor: "#050607",
  ios: {
    contentInset: "never",
    backgroundColor: "#050607",
  },
  plugins: {
    CapacitorHttp: { enabled: true },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert", "banner", "list"],
    },
  },
};

export default config;
