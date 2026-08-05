"use client";

import Link from "next/link";
import { useState } from "react";
import { SS_TOKENS } from "@/lib/tokens";
import type { FleetEntry } from "@/lib/types";
import type { AuditEntry, BackupInfo } from "@/lib/registry";
import type { FlightSession } from "@/lib/flights";
import { flightIdFromTs } from "@/lib/flights";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { formatTs, formatTsBare } from "@/lib/time";
import {
  addTailAction,
  updateTailAction,
  deleteTailAction,
  restoreBackupAction,
  setSpeedWarningFlagAction,
  syncSeedRegistryAction,
  logoutAction,
} from "./actions";
import { Logo } from "@/components/brand/Logo";

const OPERATORS = [
  "WSP",
  "KCSO",
  "Pierce SO",
  "Snohomish SO",
  "Spokane SO",
  "State of WA",
  "Other",
] as const;

type Flash = { error?: string; saved?: string };
type Flags = { speedWarningEnabled: boolean };

export function Editor({
  registry,
  backups,
  audit,
  flags,
  flights,
  flash,
  hour12,
}: {
  registry: FleetEntry[];
  backups: BackupInfo[];
  audit: AuditEntry[];
  flags: Flags;
  flights: FlightSession[];
  flash: Flash;
  hour12: boolean;
}) {
  const [editingTail, setEditingTail] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "16px 18px 60px",
        maxWidth: 880,
        margin: "0 auto",
        color: SS_TOKENS.fg0,
      }}
    >
      <AdminNav active="registry" />

      {flash.error && <FlashMsg kind="error" code={flash.error} />}
      {flash.saved && <FlashMsg kind="ok" code={flash.saved} />}

      <RecentFlights flights={flights} hour12={hour12} />

      <Section title="Registry" subtitle={`${registry.length} tails`}>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 10,
          }}
        >
          <form action={syncSeedRegistryAction}>
            <button type="submit" style={smallButtonStyle}>
              Sync seed tails
            </button>
          </form>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>TAIL</Th>
                <Th>HEX</Th>
                <Th>OPERATOR</Th>
                <Th>MODEL</Th>
                <Th>NICKNAME</Th>
                <Th>BASE</Th>
                <Th>MISSION</Th>
                <Th>CLASS</Th>
                <Th>ACTIONS</Th>
              </tr>
            </thead>
            <tbody>
              {registry.map((entry) =>
                entry.tail === editingTail ? (
                  <EditRow
                    key={entry.tail}
                    entry={entry}
                    onCancel={() => setEditingTail(null)}
                  />
                ) : (
                  <ReadRow
                    key={entry.tail}
                    entry={entry}
                    onEdit={() => setEditingTail(entry.tail)}
                  />
                ),
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Add tail">
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            style={addButtonStyle}
          >
            + Add tail
          </button>
        ) : (
          <AddForm onCancel={() => setShowAdd(false)} />
        )}
      </Section>

      <Section title="Settings">
        <FlagsForm enabled={flags.speedWarningEnabled} />
      </Section>

      <Section title="Backups" subtitle={`${backups.length} most recent`}>
        {backups.length === 0 ? (
          <Empty>No backups yet â€” they&rsquo;re created automatically on every save.</Empty>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {backups.map((b) => (
              <li
                key={b.key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderTop: `.5px solid ${SS_TOKENS.hairline}`,
                }}
              >
                <div>
                  <div className="ss-mono" style={{ fontSize: 12, color: SS_TOKENS.fg0 }}>
                    {b.timestamp}
                  </div>
                  <div className="ss-mono" style={{ fontSize: 10.5, color: SS_TOKENS.fg2 }}>
                    {b.tailCount} tails
                  </div>
                </div>
                <form
                  action={restoreBackupAction}
                  onSubmit={(e) => {
                    if (
                      !confirm(
                        `Restore registry from ${b.timestamp}?\nThe current registry will be backed up first.`,
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="key" value={b.key} />
                  <button type="submit" style={smallButtonStyle}>
                    Restore
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Audit log" subtitle={`last ${audit.length}`}>
        {audit.length === 0 ? (
          <Empty>No registry changes yet.</Empty>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {audit.map((a, i) => (
              <li
                key={i}
                className="ss-mono"
                style={{
                  fontSize: 11,
                  color: SS_TOKENS.fg2,
                  padding: "6px 0",
                  borderTop: `.5px solid ${SS_TOKENS.hairline}`,
                  display: "grid",
                  gridTemplateColumns: "180px 60px 1fr",
                  gap: 8,
                }}
              >
                <span>{a.ts}</span>
                <span style={{ color: opColor(a.op) }}>{a.op.toUpperCase()}</span>
                <span style={{ color: SS_TOKENS.fg1 }}>{a.tail}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}

// â”€â”€â”€ shared admin nav â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AdminNav({ active }: { active: "registry" | "flights" | "spots" }) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 18,
        gap: 12,
      }}
    >
      <h1
        style={{
          margin: 0,
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
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <NavLink href="/admin" active={active === "registry"}>
          REGISTRY
        </NavLink>
        <NavLink href="/admin/tracks" active={active === "flights"}>
          FLIGHTS
        </NavLink>
        <NavLink href="/admin/spots" active={active === "spots"}>
          SPOTS
        </NavLink>
        <form action={logoutAction}>
          <button
            type="submit"
            className="ss-mono"
            style={{
              fontSize: 11,
              color: SS_TOKENS.fg2,
              letterSpacing: ".08em",
              background: "transparent",
              border: 0,
              padding: 0,
              cursor: "pointer",
            }}
          >
            LOG OUT
          </button>
        </form>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="ss-mono"
      style={{
        fontSize: 11,
        color: active ? SS_TOKENS.alert : SS_TOKENS.fg1,
        letterSpacing: ".08em",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

// â”€â”€â”€ recent flights â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function RecentFlights({ flights, hour12 }: { flights: FlightSession[]; hour12: boolean }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <h2
          className="ss-mono"
          style={{
            fontSize: 11,
            letterSpacing: ".12em",
            color: SS_TOKENS.fg2,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Recent flights
        </h2>
        <span
          className="ss-mono"
          style={{ fontSize: 10.5, color: SS_TOKENS.fg3 }}
        >
          {flights.length} session{flights.length === 1 ? "" : "s"} Â· last 7 days
        </span>
      </div>
      {flights.length === 0 ? (
        <FlightsEmpty />
      ) : (
        <FlightsList flights={flights} hour12={hour12} />
      )}
    </section>
  );
}

function FlightsEmpty() {
  return (
    <div
      style={{
        padding: "28px 16px",
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        color: SS_TOKENS.fg1,
      }}
    >
      <RadarPulse />
      <div style={{ fontSize: 13 }}>
        No flights logged yet â€” system is watching.
      </div>
    </div>
  );
}

function RadarPulse() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      style={{ color: SS_TOKENS.alert, opacity: 0.85 }}
      aria-hidden
    >
      <circle
        cx="16"
        cy="16"
        r="14"
        fill="none"
        stroke="currentColor"
        strokeWidth=".75"
        opacity="0.4"
      />
      <circle
        cx="16"
        cy="16"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth=".75"
        opacity="0.6"
      />
      <circle cx="16" cy="16" r="3" fill="currentColor">
        <animate
          attributeName="opacity"
          values="1;0.3;1"
          dur="1.6s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

function FlightsList({ flights, hour12 }: { flights: FlightSession[]; hour12: boolean }) {
  return (
    <div
      style={{
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {flights.map((f, i) => (
        <FlightRow
          key={`${f.tail}-${f.start_ts}`}
          flight={f}
          first={i === 0}
          hour12={hour12}
        />
      ))}
    </div>
  );
}

function FlightRow({
  flight,
  first,
  hour12,
}: {
  flight: FlightSession;
  first: boolean;
  hour12: boolean;
}) {
  const sharePath = `/flight/${flight.tail}/${flightIdFromTs(flight.start_ts)}`;
  return (
    <div
      className="ss-flight-row"
      style={{
        display: "grid",
        gridTemplateColumns:
          "minmax(120px, 1.2fr) minmax(160px, 1.6fr) minmax(120px, 1fr) auto",
        gap: 12,
        padding: "12px 14px",
        alignItems: "center",
        borderTop: first ? "0" : `.5px solid ${SS_TOKENS.hairline}`,
      }}
    >
      <Link
        href={`/admin/tracks/${flight.tail}/${flight.date}`}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div
          className="ss-mono"
          style={{ fontSize: 14, fontWeight: 600, color: SS_TOKENS.fg0 }}
        >
          {flight.tail}
        </div>
        {flight.nickname && (
          <div style={{ fontSize: 11, color: SS_TOKENS.fg1, marginTop: 2 }}>
            {flight.nickname}
          </div>
        )}
      </Link>
      <Link
        href={`/admin/tracks/${flight.tail}/${flight.date}`}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div style={{ fontSize: 12.5, color: SS_TOKENS.fg0 }}>
          {formatTs(flight.start_ts, "date-short")} Â·{" "}
          {formatTsBare(flight.start_ts, "time", { hour12 })} â€“{" "}
          {formatTs(flight.end_ts, "time", { hour12 })}
        </div>
        <div
          className="ss-mono"
          style={{ fontSize: 11, color: SS_TOKENS.fg2, marginTop: 2 }}
        >
          {fmtDuration(flight.duration_s)}
        </div>
      </Link>
      <Link
        href={`/admin/tracks/${flight.tail}/${flight.date}`}
        style={{ textDecoration: "none", color: "inherit", textAlign: "right" }}
      >
        <div
          className="ss-mono"
          style={{ fontSize: 13, fontWeight: 600, color: SS_TOKENS.fg0 }}
        >
          {flight.max_alt_ft.toLocaleString()} ft
        </div>
        <div
          className="ss-mono"
          style={{
            fontSize: 10,
            color: SS_TOKENS.fg2,
            marginTop: 2,
            letterSpacing: ".06em",
          }}
        >
          {flight.sample_count} samples
        </div>
      </Link>
      <ShareLinkButton path={sharePath} label="Share" size="sm" />
    </div>
  );
}

function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m}m ${String(sec).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${String(mm).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

// â”€â”€â”€ pieces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <h2
          className="ss-mono"
          style={{
            fontSize: 11,
            letterSpacing: ".12em",
            color: SS_TOKENS.fg2,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <span
            className="ss-mono"
            style={{ fontSize: 10.5, color: SS_TOKENS.fg3 }}
          >
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function FlagsForm({ enabled }: { enabled: boolean }) {
  return (
    <div
      style={{
        padding: 14,
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: SS_TOKENS.fg0 }}>
            Speed warning overlay
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: SS_TOKENS.fg2,
              marginTop: 2,
              lineHeight: 1.45,
            }}
          >
            Fullscreen alert when rider is speeding inside 5nm of an airborne tail.
            Off = never shown.
          </div>
        </div>
        <form
          action={setSpeedWarningFlagAction}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          {/* Hidden form control so the toggle posts whether currently on or off */}
          {enabled && <input type="hidden" name="enabled" value="off" />}
          {!enabled && <input type="hidden" name="enabled" value="on" />}
          <button
            type="submit"
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: enabled ? SS_TOKENS.clear : SS_TOKENS.bg2,
              color: enabled ? "#0b0d10" : SS_TOKENS.fg1,
              border: `.5px solid ${enabled ? SS_TOKENS.clear : SS_TOKENS.hairline}`,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: ".06em",
              cursor: "pointer",
              minWidth: 56,
            }}
          >
            {enabled ? "ON" : "OFF"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 14,
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 10,
        color: SS_TOKENS.fg2,
        fontSize: 12.5,
      }}
    >
      {children}
    </div>
  );
}

function ReadRow({
  entry,
  onEdit,
}: {
  entry: FleetEntry;
  onEdit: () => void;
}) {
  return (
    <tr style={{ borderTop: `.5px solid ${SS_TOKENS.hairline}` }}>
      <Td mono>{entry.tail}</Td>
      <Td mono dim>{(entry.hex ?? "â€”").toUpperCase()}</Td>
      <Td>{entry.operator}</Td>
      <Td>{entry.model}</Td>
      <Td dim>{entry.nickname ?? "â€”"}</Td>
      <Td>{entry.base}</Td>
      <Td dim>{entry.roleDescription}</Td>
      <Td dim>
        {entry.role}
        {entry.roleConfidence !== "confirmed" && (
          <span style={{ color: SS_TOKENS.fg2 }}> ({entry.roleConfidence})</span>
        )}
      </Td>
      <Td>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onEdit} style={smallButtonStyle}>
            Edit
          </button>
          <form
            action={deleteTailAction}
            onSubmit={(e) => {
              if (
                !confirm(
                  `Delete ${entry.tail}? This cannot be undone except via backup restore.`,
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="tail" value={entry.tail} />
            <button type="submit" style={dangerButtonStyle}>
              Del
            </button>
          </form>
        </div>
      </Td>
    </tr>
  );
}

function EditRow({
  entry,
  onCancel,
}: {
  entry: FleetEntry;
  onCancel: () => void;
}) {
  const isCustomOperator = !OPERATORS.slice(0, -1).includes(entry.operator as (typeof OPERATORS)[number]);
  return (
    <tr
      style={{
        borderTop: `1px solid color-mix(in srgb, ${SS_TOKENS.alert} 34%, transparent)`,
        background: "rgba(245,184,64,0.04)",
      }}
    >
      <td colSpan={9} style={{ padding: 10 }}>
        <form
          action={updateTailAction}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 8,
          }}
        >
          <input type="hidden" name="original_tail" value={entry.tail} />
          <Field label="Tail" name="tail" defaultValue={entry.tail} mono required />
          <Field label="Hex (auto if blank)" name="hex" defaultValue={entry.hex ?? ""} mono />
          <OperatorSelect
            defaultValue={isCustomOperator ? "Other" : entry.operator}
            otherDefault={isCustomOperator ? entry.operator : ""}
          />
          <Field label="Model" name="model" defaultValue={entry.model} required />
          <Field label="Nickname" name="nickname" defaultValue={entry.nickname ?? ""} />
          <Field label="Base" name="base" defaultValue={entry.base} required />
          <Field label="Mission (free text)" name="roleDescription" defaultValue={entry.roleDescription} />
          <RoleSelect
            label="Mission class"
            name="role"
            defaultValue={entry.role}
            required
          />
          <RoleConfidenceSelect
            label="Confidence"
            name="roleConfidence"
            defaultValue={entry.roleConfidence}
            required
          />
          <Field
            label="Class note (â‰¤120 chars, optional)"
            name="roleNote"
            defaultValue={entry.roleNote ?? ""}
            maxLength={120}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <button type="submit" style={primaryButtonStyle}>
              Save
            </button>
            <button type="button" onClick={onCancel} style={smallButtonStyle}>
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function AddForm({ onCancel }: { onCancel: () => void }) {
  return (
    <form
      action={addTailAction}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 8,
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <Field label="Tail (e.g. N12345 or N12AB)" name="tail" mono required />
      <Field label="Hex (auto if blank)" name="hex" mono />
      <OperatorSelect />
      <Field label="Model (e.g. Cessna 182T)" name="model" required />
      <Field label="Nickname (optional)" name="nickname" />
      <Field label="Base (e.g. KOLM Olympia)" name="base" required />
      <Field label="Mission (free text, optional)" name="roleDescription" />
      <RoleSelect label="Mission class" name="role" required />
      <RoleConfidenceSelect label="Confidence" name="roleConfidence" required />
      <Field label="Class note (â‰¤120 chars, optional)" name="roleNote" maxLength={120} />
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <button type="submit" style={primaryButtonStyle}>
          Save tail
        </button>
        <button type="button" onClick={onCancel} style={smallButtonStyle}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function OperatorSelect({
  defaultValue,
  otherDefault,
}: {
  defaultValue?: string;
  otherDefault?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? OPERATORS[0]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={fieldLabelStyle}>OPERATOR</label>
      <select
        name="operator"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={inputStyle}
      >
        {OPERATORS.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>
      {value === "Other" && (
        <input
          name="operator_other"
          defaultValue={otherDefault ?? ""}
          placeholder="Other operator"
          required
          style={{ ...inputStyle, marginTop: 4 }}
        />
      )}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  mono,
  required,
  maxLength,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  mono?: boolean;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={fieldLabelStyle}>{label.toUpperCase()}</label>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        style={{
          ...inputStyle,
          fontFamily: mono ? "var(--font-mono)" : undefined,
        }}
      />
    </div>
  );
}

const ROLE_OPTIONS: Array<{ value: import("@/lib/types").FleetRole; label: string }> = [
  { value: "fixed_wing", label: "bird â€” fixed-wing speed enforcement" },
  { value: "patrol", label: "patrol â€” multi-role helicopter" },
  { value: "sar", label: "sar â€” search & rescue" },
  { value: "transport", label: "transport â€” exec / multi-mission" },
  { value: "unknown", label: "unknown â€” default to alert" },
];

const CONFIDENCE_OPTIONS: Array<{
  value: import("@/lib/types").RoleConfidence;
  label: string;
}> = [
  { value: "confirmed", label: "confirmed" },
  { value: "tentative", label: "tentative" },
  { value: "unknown", label: "unknown" },
];

function RoleSelect({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: import("@/lib/types").FleetRole;
  required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={fieldLabelStyle}>{label.toUpperCase()}</label>
      <select
        name={name}
        defaultValue={defaultValue ?? "unknown"}
        required={required}
        style={inputStyle}
      >
        {ROLE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function RoleConfidenceSelect({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: import("@/lib/types").RoleConfidence;
  required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={fieldLabelStyle}>{label.toUpperCase()}</label>
      <select
        name={name}
        defaultValue={defaultValue ?? "unknown"}
        required={required}
        style={inputStyle}
      >
        {CONFIDENCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FlashMsg({ kind, code }: { kind: "error" | "ok"; code: string }) {
  const color = kind === "error" ? SS_TOKENS.danger : SS_TOKENS.clear;
  const message =
    kind === "error" ? errorMessage(code) : savedMessage(code);
  return (
    <div
      style={{
        marginBottom: 14,
        padding: "8px 12px",
        borderRadius: 8,
        background: SS_TOKENS.bg1,
        border: `.5px solid ${color}55`,
        color,
        fontSize: 12,
      }}
    >
      {message}
    </div>
  );
}

function savedMessage(code: string): string {
  if (code.startsWith("seed_sync_")) {
    const count = Number(code.slice("seed_sync_".length));
    return count > 0
      ? `Seed registry synced. Added ${count} tail${count === 1 ? "" : "s"}.`
      : "Seed registry already matches the live registry.";
  }

  switch (code) {
    case "warn_on":
      return "Speed warning enabled.";
    case "warn_off":
      return "Speed warning disabled.";
    case "restored":
      return "Backup restored. The pre-restore registry was backed up first.";
    default:
      return `Saved Â· ${code}`;
  }
}

function errorMessage(code: string): string {
  switch (code) {
    case "invalid":
      return "Invalid passcode.";
    case "bad_tail":
      return "Tail must match N + 1â€“5 digits + 0â€“2 letters (e.g. N305DK).";
    case "bad_hex":
      return "Hex must be 6 hex characters (or blank to auto-compute).";
    case "bad_operator":
      return "Operator is required.";
    case "bad_model":
      return "Model is required.";
    case "bad_base":
      return "Base is required.";
    case "duplicate":
      return "A tail with that number already exists.";
    case "not_found":
      return "Tail not found in the current registry.";
    case "bad_backup":
      return "Backup key invalid or missing.";
    default:
      return `Error: ${code}`;
  }
}

function opColor(op: string): string {
  switch (op) {
    case "create":
      return SS_TOKENS.clear;
    case "delete":
      return SS_TOKENS.danger;
    case "restore":
      return SS_TOKENS.warn;
    default:
      return SS_TOKENS.alert;
  }
}

// â”€â”€â”€ styling primitives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};

const fieldLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9.5,
  letterSpacing: ".1em",
  color: SS_TOKENS.fg2,
};

const inputStyle: React.CSSProperties = {
  background: SS_TOKENS.bg0,
  border: `.5px solid ${SS_TOKENS.hairline2}`,
  borderRadius: 6,
  padding: "8px 10px",
  color: SS_TOKENS.fg0,
  fontFamily: "var(--font-brand)",
  fontSize: 12.5,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 6,
  background: SS_TOKENS.fg0,
  color: "#000",
  border: 0,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

const smallButtonStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  background: SS_TOKENS.bg2,
  color: SS_TOKENS.fg1,
  border: `.5px solid ${SS_TOKENS.hairline}`,
  fontSize: 11,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  ...smallButtonStyle,
  color: SS_TOKENS.danger,
  borderColor: `color-mix(in srgb, ${SS_TOKENS.danger} 34%, transparent)`,
};

const addButtonStyle: React.CSSProperties = {
  ...smallButtonStyle,
  padding: "10px 14px",
  fontSize: 12,
  fontWeight: 600,
  background: SS_TOKENS.bg1,
};

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="ss-mono"
      style={{
        textAlign: "left",
        padding: "10px 8px 8px",
        fontSize: 9.5,
        letterSpacing: ".1em",
        color: SS_TOKENS.fg2,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  mono,
  dim,
}: {
  children: React.ReactNode;
  mono?: boolean;
  dim?: boolean;
}) {
  return (
    <td
      style={{
        padding: "8px 8px",
        fontSize: 12,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-brand)",
        color: dim ? SS_TOKENS.fg2 : SS_TOKENS.fg0,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}
