import Link from "next/link";

export function SettingsBackLink() {
  return (
    <Link
      href="/settings"
      prefetch={false}
      aria-label="Back to Settings"
      className="ss-settings-back"
    >
      <span aria-hidden>‹</span>
      Settings
    </Link>
  );
}
