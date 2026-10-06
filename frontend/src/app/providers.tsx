"use client";

import { AuthProvider } from "@/lib/auth";
import { NotificationsProvider } from "@/lib/notifications";
import { ThemeProvider } from "@/lib/theme";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NotificationsProvider>
        <AuthProvider>{children}</AuthProvider>
      </NotificationsProvider>
    </ThemeProvider>
  );
}
