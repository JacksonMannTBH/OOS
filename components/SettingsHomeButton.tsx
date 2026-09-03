"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SETTINGS_DESTINATIONS = new Set([
  "/aircraft",
  "/about",
  "/legal",
  "/store",
]);

export function SettingsHomeButton() {
  const pathname = usePathname();
  const isSettingsPage =
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    SETTINGS_DESTINATIONS.has(pathname);

  if (!isSettingsPage) return null;

  return (
    <Link
      href="/home"
      prefetch={false}
      aria-label="Return home"
      className="ss-settings-home-button"
    >
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M3.2 11.2 12 3.6l8.8 7.6v8.3c0 .8-.7 1.5-1.5 1.5h-4.5v-6.2H9.2V21H4.7c-.8 0-1.5-.7-1.5-1.5v-8.3Z" />
      </svg>
    </Link>
  );
}
