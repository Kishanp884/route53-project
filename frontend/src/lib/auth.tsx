"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, setUnauthorizedHandler, tokenStore } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, accountId?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Restore the session from the persisted token on first load.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    });
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route guard
  useEffect(() => {
    if (loading) return;
    const isLogin = pathname?.startsWith("/login");
    if (!user && !isLogin) router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
  }, [loading, user, pathname, router]);

  const login = useCallback(async (username: string, password: string, accountId?: string) => {
    const res = await api.login(username, password, accountId);
    tokenStore.set(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* token may already be invalid */
    }
    tokenStore.clear();
    setUser(null);
    router.replace("/login?signedout=1");
  }, [router]);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
