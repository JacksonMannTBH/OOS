import { initializeDevicePreferences } from "@/lib/device-preferences";
import { readColorMode } from "@/lib/color-mode";
import { COLOR_MODE_OPTIONS } from "@/lib/color-mode-palette";

void initializeDevicePreferences().then(() => {
  const selected = COLOR_MODE_OPTIONS.find(option => option.value === readColorMode())!;
  document.documentElement.style.setProperty("--offline-accent", selected.swatch);
}).catch(() => { /* Keep neutral accents when saved preferences cannot be restored. */ });
