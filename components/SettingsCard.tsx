import type { ReactNode } from "react";

export function SettingsCard({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section className="ss-settings-card">
      <div className="ss-settings-card__header">
        {eyebrow && (
          <div className="ss-settings-card__eyebrow">{eyebrow}</div>
        )}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}
