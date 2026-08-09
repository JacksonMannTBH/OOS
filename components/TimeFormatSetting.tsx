import { setTimeFormatAction } from "@/app/(tabs)/settings/actions";
import { SettingsCard } from "@/components/SettingsCard";
import { SS_TOKENS } from "@/lib/tokens";
import { type TimeFormat } from "@/lib/user-prefs";

export function TimeFormatSetting({ current }: { current: TimeFormat }) {
  return (
    <SettingsCard title="Time format" eyebrow="Time">
      <p style={copyStyle}>
        Choose the clock used wherever Out Of Sight shows a timestamp. Times
        remain in Pacific Time.
      </p>
      <form
        action={setTimeFormatAction}
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        <FormatChoice
          value="24"
          current={current}
          label="24-hour"
          sample="15:42 PT"
        />
        <FormatChoice
          value="12"
          current={current}
          label="12-hour"
          sample="3:42 PM PT"
        />
      </form>
    </SettingsCard>
  );
}

function FormatChoice({
  value,
  current,
  label,
  sample,
}: {
  value: TimeFormat;
  current: TimeFormat;
  label: string;
  sample: string;
}) {
  const active = current === value;
  return (
    <button
      type="submit"
      name="format"
      value={value}
      aria-pressed={active}
      style={{
        flex: 1,
        minWidth: 140,
        minHeight: 60,
        padding: "10px 14px",
        borderRadius: 12,
        border: `1px solid ${active ? SS_TOKENS.alert : SS_TOKENS.hairline2}`,
        background: active ? SS_TOKENS.alertDim : SS_TOKENS.bg2,
        color: SS_TOKENS.fg0,
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 4,
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        className="ss-mono"
        style={{
          fontSize: 12,
          letterSpacing: ".04em",
          color: active ? SS_TOKENS.alert : SS_TOKENS.fg1,
          fontWeight: 800,
        }}
      >
        {label}
      </span>
      <span
        className="ss-mono"
        style={{ fontSize: 13, color: SS_TOKENS.fg0 }}
      >
        {sample}
      </span>
    </button>
  );
}

const copyStyle = {
  margin: 0,
  color: SS_TOKENS.fg1,
  fontSize: 13,
  lineHeight: 1.5,
} as const;
