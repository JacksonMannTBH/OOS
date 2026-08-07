"use client";

import { usePathname } from "next/navigation";

export function SkipLink() {
  const pathname = usePathname();
  if (pathname === "/map" || pathname === "/home") {
    return null;
  }
  return (
    <a href="#main-content" className="ss-skip-link">
      Skip to main content
    </a>
  );
}
