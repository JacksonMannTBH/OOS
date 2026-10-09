import type { FormEvent } from "react";
import { setTimeFormatAction, setContrastAction, type TimeFormat, type ContrastMode } from "./preferences";
import { SettingsCard } from "@/components/SettingsCard";
import { SS_TOKENS } from "@/lib/tokens";

// Keep the shared display choices while saving on-device, without Next server actions.
function submit(event: FormEvent<HTMLFormElement>, action: (data: FormData) => Promise<void>) {
  event.preventDefault();
  const button = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
  const data = new FormData(event.currentTarget);
  if (button?.name) data.set(button.name, button.value);
  void action(data);
}

export function TimeFormatSetting({ current }: { current: TimeFormat }) {
  return (
    <form
      onSubmit={event => submit(event, setTimeFormatAction)}
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

export function ContrastSetting({ current }: { current: ContrastMode }) {
  return (
    <SettingsCard title="Contrast" eyebrow="Visibility">
      <p style={copyStyle}>
        Out Of Sight stays dark. High contrast lifts secondary text and
        dividers for glare or low-vision conditions.
      </p>
      <form
        onSubmit={event => submit(event, setContrastAction)}
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
