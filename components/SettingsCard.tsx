import type { ReactNode } from "react";

export function SettingsCard({
  title,
  eyebrow,
  headerAccessory,
  children,
}: {
  title: string;
  eyebrow?: string;
  headerAccessory?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ss-settings-card">
      <div className="ss-settings-card__header" style={headerAccessory ? { gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "start", gap: 12 } : undefined}>
        <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
          {eyebrow && (
            <div className="ss-settings-card__eyebrow">{eyebrow}</div>
          )}
          <h2>{title}</h2>
        </div>
        {headerAccessory}
      </div>
      {children}
    </section>
  );
}
