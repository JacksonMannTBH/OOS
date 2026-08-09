import { setContrastAction } from "@/app/(tabs)/settings/actions";
import { SettingsCard } from "@/components/SettingsCard";
import { SS_TOKENS } from "@/lib/tokens";
import { type ContrastMode } from "@/lib/user-prefs";

export function ContrastSetting({ current }: { current: ContrastMode }) {
  return (
    <SettingsCard title="Contrast" eyebrow="Visibility">
      <p style={copyStyle}>
        Out Of Sight stays dark. High contrast lifts secondary text and
        dividers for glare or low-vision conditions.
      </p>
      <form
        action={setContrastAction}
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        <Choice value="normal" current={current} label="Normal" />
        <Choice value="high" current={current} label="High" />
      </form>
    </SettingsCard>
  );
}

function Choice({
  value,
  current,
  label,
}: {
  value: ContrastMode;
  current: ContrastMode;
  label: string;
}) {
  const active = current === value;
  return (
    <button
      type="submit"
      name="contrast"
      value={value}
      aria-pressed={active}
      style={{
        flex: 1,
        minWidth: 140,
        minHeight: 50,
        padding: "10px 14px",
        borderRadius: 12,
        border: `1px solid ${active ? SS_TOKENS.alert : SS_TOKENS.hairline2}`,
        background: active ? SS_TOKENS.alertDim : SS_TOKENS.bg2,
        color: active ? SS_TOKENS.alert : SS_TOKENS.fg1,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: ".04em",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {label}
    </button>
  );
}

const copyStyle = {
  margin: 0,
  color: SS_TOKENS.fg1,
  fontSize: 13,
  lineHeight: 1.5,
} as const;
