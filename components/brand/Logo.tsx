import { SS_TOKENS } from "@/lib/tokens";
import Image from "next/image";
import type { CSSProperties } from "react";

type LogoProps = {
  /** Pixel height of the rendered mark. Wordmark scales accordingly. */
  size?: number;
  /** Pixel size of the mark when it should differ from the wordmark scale. */
  markSize?: number;
  /** Retained for older call sites; the new mark is already compact-safe. */
  compact?: boolean;
  /** Retained for older call sites; color follows the selected mode. */
  mono?: boolean;
  /** Render the wordmark "Out Of Sight" alongside the mark. */
  wordmark?: boolean;
  className?: string;
  /** Retained for compatibility with older call sites. */
  color?: string;
  /** Override the wordmark text color (defaults to current text color). */
  textColor?: string;
};

type LogoMarkProps = {
  height: number | string;
  width?: number | string;
  variant?: "open" | "closed";
  className?: string;
  style?: CSSProperties;
};

export function LogoMark({
  height,
  width,
  variant = "open",
  className,
  style,
}: LogoMarkProps) {
  const renderedWidth =
    width ?? (typeof height === "number" ? Math.round(height * 1.5) : undefined);
  const markClassName = `ss-eye-mark${className ? ` ${className}` : ""}`;
  const frameStyle: CSSProperties = {
    display: "block",
    width: renderedWidth,
    height,
    flexShrink: 0,
    ...style,
  };

  if (variant === "closed") {
    return (
      <span
        className={`${markClassName} ss-eye-mark--closed`}
        aria-hidden="true"
        style={{
          ...frameStyle,
          position: "relative",
          overflow: "hidden",
          background: "transparent",
        }}
      >
        <Image
          src="/icons/no-aircraft-logo.png"
          alt=""
          fill
          sizes={typeof renderedWidth === "number" ? `${renderedWidth}px` : "63px"}
          priority
          style={{
            objectFit: "cover",
            transform: "scale(1.35)",
          }}
        />
        <svg className="ss-eye-themed-closed" viewBox="6 12 52 40" width="100%" height="100%" focusable="false">
          <EyeShape />
          <path d="M 17 49 L 52 15" stroke="#000" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M 17 49 L 52 15" stroke="var(--ss-logo-sclera, #fff)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  return (
    <svg
      className={markClassName}
      viewBox="8 16 48 32"
      aria-hidden="true"
      focusable="false"
      style={frameStyle}
    >
      <EyeShape />
    </svg>
  );
}

function EyeShape() {
  return <>
    <path d="M 8 32 C 14 21 23 16 32 16 C 41 16 50 21 56 32 C 50 43 41 48 32 48 C 23 48 14 43 8 32 Z"
      fill="var(--ss-logo-sclera, #ffffff)" />
    <circle cx="32" cy="32" r="9.5" fill="var(--ss-logo-iris, #f6c431)" />
    <circle cx="32" cy="32" r="4.1" fill="#000000" />
  </>;
}

export function Logo({
  size = 24,
  markSize,
  wordmark = false,
  className,
  textColor,
}: LogoProps) {
  const renderedMarkSize = markSize ?? size;
  const mark = (
    <LogoMark height={renderedMarkSize} />
  );

  if (!wordmark) {
    return (
      <span
        className={className}
        aria-label="Out Of Sight"
        role="img"
        style={{ display: "inline-flex", lineHeight: 0 }}
      >
        {mark}
      </span>
    );
  }

  return (
    <span
      className={className}
      aria-label="Out Of Sight"
      role="img"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.max(8, Math.round(size * 0.24)),
        lineHeight: 1,
        color: textColor ?? SS_TOKENS.fg0,
        whiteSpace: "nowrap",
      }}
    >
      {mark}
      <span
        style={{
          fontFamily: "var(--font-brand)",
          fontSize: Math.max(18, Math.round(size * 0.68)),
          fontWeight: 800,
          letterSpacing: 0,
        }}
      >
        Out Of Sight
      </span>
    </span>
  );
}
