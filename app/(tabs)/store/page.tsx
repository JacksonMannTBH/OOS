import { SettingsBackLink } from "@/components/SettingsBackLink";
import { SS_TOKENS } from "@/lib/tokens";

export const metadata = {
  title: "Store",
};

export default function StorePage() {
  return (
    <main
      style={{
        maxWidth: 560,
        minHeight: "calc(100svh - 72px)",
        margin: "0 auto",
        padding: "34px 18px 132px",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
      }}
    >
      <SettingsBackLink />
      <section
        style={{
          width: "100%",
          alignSelf: "center",
          textAlign: "center",
          border: `.5px solid ${SS_TOKENS.hairline2}`,
          borderRadius: 8,
          padding: "34px 18px",
          background: SS_TOKENS.surface,
          boxShadow: SS_TOKENS.shadowSm,
        }}
      >
        <h1
          style={{
            margin: 0,
            color: SS_TOKENS.fg0,
            fontSize: 24,
            lineHeight: 1.15,
            fontWeight: 900,
            letterSpacing: 0,
          }}
        >
          Under Development. Check back for updates.
        </h1>
      </section>
    </main>
  );
}
