"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import Table from "@cloudscape-design/components/table";

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["?"], action: "Show keyboard shortcuts" },
  { keys: ["/"], action: "Focus the table filter" },
  { keys: ["Alt", "S"], action: "Focus the console search" },
  { keys: ["c"], action: "Create (hosted zone / record) on the current page" },
  { keys: ["r"], action: "Refresh the current table" },
  { keys: ["g", "d"], action: "Go to Dashboard" },
  { keys: ["g", "z"], action: "Go to Hosted zones" },
  { keys: ["g", "h"], action: "Go to Health checks" },
  { keys: ["g", "t"], action: "Go to Traffic policies" },
  { keys: ["g", "r"], action: "Go to Resolver" },
  { keys: ["["], action: "Toggle the navigation pane" },
  { keys: ["d"], action: "Toggle dark mode" },
  { keys: ["Esc"], action: "Close dialogs" },
];

export default function ShortcutsModal({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header="Keyboard shortcuts"
      footer={
        <Box float="right">
          <Button variant="primary" onClick={onDismiss}>
            Close
          </Button>
        </Box>
      }
    >
      <Table
        variant="embedded"
        items={SHORTCUTS}
        columnDefinitions={[
          {
            id: "keys",
            header: "Shortcut",
            cell: (s) => (
              <span>
                {s.keys.map((k, i) => (
                  <span key={k}>
                    {i > 0 && (s.keys[0] === "g" ? " then " : " + ")}
                    <span className="r53-kbd">{k}</span>
                  </span>
                ))}
              </span>
            ),
          },
          { id: "action", header: "Action", cell: (s) => s.action },
        ]}
      />
    </Modal>
  );
}
