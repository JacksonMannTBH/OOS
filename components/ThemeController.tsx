"use client";

import { useEffect } from "react";
import { applyColorMode, COLOR_MODE_EVENT, COLOR_MODE_KEY, readColorMode } from "@/lib/color-mode";
import { applyDistancePalette, DISTANCE_PALETTE_EVENT, DISTANCE_PALETTE_KEY, readDistancePalette } from "@/lib/distance-colors";
import {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

function applyTheme(): void {
  document.documentElement.dataset.theme = "dark";
  document.body.dataset.theme = "dark";
  document.documentElement.style.colorScheme = "dark";
  applyColorMode(readColorMode());
  applyDistancePalette(readDistancePalette());
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", "#050607");
}

export function ThemeController() {
  useEffect(() => {
    applyTheme();

    const onThemeChange = () => applyTheme();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === THEME_STORAGE_KEY || event.key === COLOR_MODE_KEY || event.key === DISTANCE_PALETTE_KEY) {
        applyTheme();
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    window.addEventListener(COLOR_MODE_EVENT, onThemeChange);
    window.addEventListener(DISTANCE_PALETTE_EVENT, onThemeChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
      window.removeEventListener(COLOR_MODE_EVENT, onThemeChange);
      window.removeEventListener(DISTANCE_PALETTE_EVENT, onThemeChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
