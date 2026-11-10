import fs from "node:fs/promises";
import path from "node:path";
import { getRegistry } from "@/lib/registry";
import { HelpContent } from "./HelpView";

export const metadata = {
  title: "Help",
  description:
    "What Out Of Sight shows you, where the data comes from, and how to read each screen.",
};

export default async function HelpPage() {
  const [md, registry] = await Promise.all([
    fs.readFile(path.join(process.cwd(), "content", "help.md"), "utf8"),
    getRegistry(),
  ]);
  // Templating placeholders so the registry size + operator list don't
  // go stale on every fleet expansion. Replace before passing to the
  // markdown renderer.
  const source = md.replace(/\{\{TAIL_COUNT\}\}/g, String(registry.length));

  return <HelpContent source={source} />;
}
