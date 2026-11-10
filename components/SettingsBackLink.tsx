import Link from "next/link";

export function SettingsBackLink({ href = "/settings", label = "Settings" }: { href?: string; label?: string } = {}) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={`Back to ${label}`}
      className="ss-settings-back"
    >
      <span className="ss-settings-back__icon" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
      </span>
      {label}
    </Link>
  );
}
