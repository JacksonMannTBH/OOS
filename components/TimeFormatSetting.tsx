import { setTimeFormatAction } from "@/app/(tabs)/settings/actions";
import { SS_TOKENS } from "@/lib/tokens";
import { type TimeFormat } from "@/lib/user-prefs";

export function TimeFormatSetting({ current }: { current: TimeFormat }) {
  return (
    <form
      action={setTimeFormatAction}
      aria-label="Time format"
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
