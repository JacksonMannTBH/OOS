import source from "../../content/help.md?raw";
import { FLEET } from "../../lib/seed";
import { HelpContent } from "../../app/help/HelpView";

export default function Help() {
  return <HelpContent source={source.replace(/\{\{TAIL_COUNT\}\}/g, String(FLEET.length))} />;
}
