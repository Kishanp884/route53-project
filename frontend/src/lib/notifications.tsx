"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { FlashbarProps } from "@cloudscape-design/components/flashbar";

type Item = FlashbarProps.MessageDefinition;

interface NotificationsState {
  items: Item[];
  notify: (n: { type: Item["type"]; content: React.ReactNode; header?: React.ReactNode; loading?: boolean }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const Ctx = createContext<NotificationsState | null>(null);
let seq = 0;

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);

  const dismiss = useCallback((id: string) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);

  const notify = useCallback<NotificationsState["notify"]>(
    ({ type, content, header, loading }) => {
      const id = `flash-${++seq}`;
      const item: Item = {
        id,
        type,
        header,
        content,
        loading,
        dismissible: true,
        dismissLabel: "Dismiss message",
        onDismiss: () => dismiss(id),
      };
      // Route 53 keeps the most recent messages at the top; cap the stack.
      setItems((xs) => [item, ...xs].slice(0, 5));
      if (type === "success" || type === "info") setTimeout(() => dismiss(id), 10000);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ items, notify, dismiss, clear }), [items, notify, dismiss, clear]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationsProvider");
  return ctx;
}
