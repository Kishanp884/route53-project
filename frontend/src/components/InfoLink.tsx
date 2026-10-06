"use client";

import Link from "@cloudscape-design/components/link";
import HelpPanel from "@cloudscape-design/components/help-panel";
import { useShell } from "./ConsoleShell";
import { HELP } from "./help";

export default function InfoLink({ topic }: { topic: keyof typeof HELP }) {
  const { openHelp } = useShell();
  const h = HELP[topic];
  return (
    <Link variant="info" onFollow={() => openHelp(<HelpPanel header={<h2>{h.title}</h2>}>{h.body}</HelpPanel>)}>
      Info
    </Link>
  );
}
