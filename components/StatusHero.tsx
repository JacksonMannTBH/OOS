import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";
import { fmtAloft, formatTsBare } from "@/lib/time";
import type { StatusState } from "@/lib/status";

type Props = {
  status: StatusState;
  lastSampleMs?: number | null;
  showPill?: boolean;
  frameless?: boolean;
};

export function StatusHero({
  status,
  lastSampleMs,
  showPill = true,
  frameless = false,
}: Props) {
  const isAlert = status.kind === "alert";
  const sampleTime = lastSampleMs ? formatTsBare(lastSampleMs, "hour-min") : null;

  return (
    <section
      className="ss-hero-bg"
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: frameless ? "clamp(240px, 66vw, 310px)" : "clamp(304px, 82vw, 370px)",
        padding: frameless ? "clamp(8px, 2.8vw, 12px) 4px" : "clamp(18px, 4.8vw, 24px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        color: SS_TOKENS.fg0,
        background: frameless
          ? "transparent"
          : "linear-gradient(145deg, rgba(20, 19, 13, 0.98), rgba(5, 6, 7, 0.98) 64%)",
        border: frameless ? 0 : "1px solid rgba(246, 196, 49, 0.44)",
        borderRadius: frameless ? 0 : 18,
        boxShadow: frameless
          ? "none"
          : "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 24px 60px rgba(0, 0, 0, 0.42)",
      }}
    >
      <div
        style={{
          position: "relative",
          zIndex: 1,
          marginTop: frameless ? "clamp(28px, 6vw, 40px)" : 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {showPill && <StatusPill label={status.pill} alert={isAlert} />}

        <h1
          style={{
            maxWidth: 330,
            width: "100%",
            margin: showPill ? "clamp(26px, 7.2vw, 44px) 0 0" : "0",
            color: "#ffe49a",
            fontFamily: "var(--font-brand)",
            fontSize: "clamp(48px, 13vw, 74px)",
            fontWeight: 800,
            letterSpacing: 0,
            lineHeight: 1.06,
            textShadow: "0 0 26px rgba(246, 196, 49, 0.18)",
          }}
        >
          {status.headline}
        </h1>

        {!frameless && (
          <div
            aria-hidden
            style={{
              width: "72%",
              height: 1,
              marginTop: 18,
              background:
                "linear-gradient(90deg, rgba(246, 196, 49, 0.95), rgba(246, 196, 49, 0.25) 16%, rgba(255, 255, 255, 0.10) 100%)",
            }}
          />
        )}

        <p
          style={{
            maxWidth: 330,
            width: "100%",
            margin: "14px 0 0",
            paddingTop: "clamp(32px, 7vw, 44px)",
            color: SS_TOKENS.fg1,
            fontSize: "clamp(20px, 5vw, 22px)",
            fontWeight: 700,
            lineHeight: 1.45,
          }}
        >
          {status.body}
        </p>

        {status.footnote && (
          <p
            style={{
              maxWidth: 330,
              width: "100%",
              margin: "8px 0 0",
              color: SS_TOKENS.fg2,
              fontSize: 13,
              fontStyle: "italic",
              lineHeight: 1.45,
            }}
          >
            {status.footnote}
          </p>
        )}

        {status.lead && isAlert && (
          <>
            <div
              style={{
                marginTop: 18,
                display: "flex",
                justifyContent: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {status.lead.aircraft.time_aloft_min != null && (
                <HeroMetricPill
                  label={fmtAloft(status.lead.aircraft.time_aloft_min)}
                  frameless={frameless}
                />
              )}
              {status.lead.aircraft.ground_speed_kt != null && (
                <HeroMetricPill
                  label={`${status.lead.aircraft.ground_speed_kt} kt`}
                  frameless={frameless}
                />
              )}
            </div>
            <LeadIdentity
              tail={status.lead.aircraft.tail}
              nickname={status.lead.entry.nickname}
              operator={status.lead.entry.operator}
            />
          </>
        )}
      </div>

      <div
        className="ss-mono"
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          color: SS_TOKENS.fg3,
          fontSize: "clamp(11.5px, 3vw, 13px)",
          fontWeight: 700,
          letterSpacing: 0,
          flexWrap: "wrap",
        }}
      >
        <span>Last sample</span>
        <span aria-hidden>{"\u00b7"}</span>
        <span>{sampleTime ? `${sampleTime} PT` : "Unknown"}</span>
      </div>
    </section>
  );
}

function StatusPill({ label, alert }: { label: string; alert: boolean }) {
  return (
    <div
      style={{
        minHeight: 52,
        width: "fit-content",
        maxWidth: "100%",
        padding: "8px clamp(16px, 4vw, 20px) 8px 10px",
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        color: SS_TOKENS.alert,
        background: "rgba(0, 0, 0, 0.30)",
        border: "1px solid rgba(255, 255, 255, 0.16)",
        borderRadius: 26,
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.07)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          color: "#050607",
          background: SS_TOKENS.alert,
          boxShadow: alert ? `0 0 18px ${SS_TOKENS.alert}` : undefined,
        }}
      >
        {alert ? <DotIcon /> : <CheckIcon />}
      </span>
      <span
        className="ss-mono"
        style={{
          fontSize: 15,
          fontWeight: 900,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function HeroMetricPill({
  label,
  frameless = false,
}: {
  label: string;
  frameless?: boolean;
}) {
  return (
    <span
      className="ss-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: frameless ? "0" : "6px 10px",
        borderRadius: frameless ? 0 : 999,
        background: frameless ? "transparent" : "rgba(246, 196, 49, 0.10)",
        border: frameless ? 0 : "1px solid rgba(246, 196, 49, 0.26)",
        color: SS_TOKENS.fg0,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: SS_TOKENS.alert,
        }}
      />
      <span>{label}</span>
    </span>
  );
}

function LeadIdentity({
  tail,
  nickname,
  operator,
}: {
  tail: string;
  nickname: string | null;
  operator: string;
}) {
  const separator = " \u00b7 ";
  const middle = nickname ? `${separator}"${nickname}"${separator}` : separator;
  return (
    <Link
      href={`/plane/${tail}`}
      prefetch={false}
      aria-label={`View ${nickname ?? tail} details`}
      className="ss-mono"
      style={{
        display: "inline-block",
        marginTop: 9,
        fontSize: 11.5,
        color: SS_TOKENS.fg1,
        letterSpacing: 0,
        textDecoration: "none",
      }}
    >
      {tail}
      {middle}
      {operator}
    </Link>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}
