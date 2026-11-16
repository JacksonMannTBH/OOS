import { SettingsBackLink } from "./SettingsBackLink";
import type { ReactNode } from "react";

export function SettingsPageShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="ss-settings-page">
      <header className="ss-settings-page__header">
        <SettingsBackLink />
        <div className="ss-settings-page__intro">
          {eyebrow && <span className="ss-settings-kicker">{eyebrow}</span>}
          <h1>{title}</h1>
        </div>
      </header>
      <div className="ss-settings-page__content">{children}</div>
    </main>
  );
}
