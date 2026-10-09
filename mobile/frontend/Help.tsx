import source from "../../content/help.md?raw";
import { FLEET } from "../../lib/seed";
import { HelpMarkdown, HelpScrollTopButton } from "../../app/help/HelpView";
import Link from "./navigation";
export default function Help() {
  return <main style={{ minHeight: "100dvh", color: "var(--ss-fg1)", padding: "24px 18px 100px", maxWidth: 720, margin: "0 auto" }}>
    <Link href="/settings" style={{ color: "var(--ss-alert)", display: "inline-flex", minHeight: 44, alignItems: "center" }}>← Settings</Link>
    <HelpMarkdown source={source.replace(/\{\{TAIL_COUNT\}\}/g, String(FLEET.length))} />
    <HelpScrollTopButton />
  </main>;
}
