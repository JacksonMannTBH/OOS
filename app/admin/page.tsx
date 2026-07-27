import {
  isAdminAuthed,
  isAdminPasscodeConfigured,
} from "@/lib/admin-auth";
import {
  getRegistry,
  listBackups,
  getAudit,
} from "@/lib/registry";
import { getRecentFlights } from "@/lib/flights";
import { getSpeedWarningEnabled } from "@/lib/flags";
import { SS_TOKENS } from "@/lib/tokens";
import { LoginForm } from "./LoginForm";
import { Editor } from "./Editor";
import { Logo } from "@/components/brand/Logo";
import { getTimeFormatPref, isHour12 } from "@/lib/user-prefs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

type SP = { error?: string; saved?: string; next?: string };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  if (!isAdminPasscodeConfigured()) {
    return <PasscodeMissing />;
  }
  if (!isAdminAuthed()) {
    return <LoginForm error={searchParams.error} next={searchParams.next} />;
  }

  const [registry, backups, audit, speedWarningEnabled, flights] =
    await Promise.all([
      getRegistry(),
      listBackups(),
      getAudit(20),
      getSpeedWarningEnabled(),
      getRecentFlights(20),
    ]);

  const hour12 = isHour12(getTimeFormatPref());

  return (
    <Editor
      registry={registry}
      backups={backups}
      audit={audit}
      flags={{ speedWarningEnabled }}
      flights={flights}
      flash={{ error: searchParams.error, saved: searchParams.saved }}
      hour12={hour12}
    />
  );
}

function PasscodeMissing() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: 32,
        maxWidth: 520,
        margin: "0 auto",
        color: SS_TOKENS.fg1,
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <h1
        style={{
          margin: 0,
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Logo size={20} wordmark />
        <span
          className="ss-mono"
          style={{
            fontSize: 9.5,
            color: SS_TOKENS.fg2,
            letterSpacing: ".12em",
            padding: "2px 6px",
            border: `.5px solid ${SS_TOKENS.hairline2}`,
            borderRadius: 4,
          }}
        >
          ADMIN
        </span>
      </h1>
      <p>
        <code className="ss-mono">ADMIN_PASSCODE</code> isn&rsquo;t set in this
        environment. Add it in Netlify environment variables as a secret and
        redeploy.
      </p>
    </main>
  );
}
