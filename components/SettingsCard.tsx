import { SS_TOKENS } from "@/lib/tokens";
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
    <section
      style={{
        display: "grid",
        gap: 14,
        padding: 18,
        borderRadius: 16,
        background: SS_TOKENS.surface,
        border: `1px solid ${SS_TOKENS.hairline}`,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      <div>
        {eyebrow && (
          <div
            className="ss-eyebrow"
            style={{ marginBottom: 7, color: SS_TOKENS.alert }}
          >
            {eyebrow}
          </div>
        )}
        <h2
          style={{
            margin: 0,
            color: SS_TOKENS.fg0,
            fontSize: 18,
            fontWeight: 800,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
