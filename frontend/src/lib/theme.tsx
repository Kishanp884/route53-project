"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { applyDensity, applyMode, Density, Mode } from "@cloudscape-design/global-styles";

type ThemeMode = "light" | "dark";
type DensityMode = "comfortable" | "compact";

interface ThemeState {
  mode: ThemeMode;
  density: DensityMode;
  setMode: (m: ThemeMode) => void;
  setDensity: (d: DensityMode) => void;
}

const Ctx = createContext<ThemeState | null>(null);

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [density, setDensityState] = useState<DensityMode>("comfortable");

  useEffect(() => {
    const m = read("r53.mode") as ThemeMode | null;
    const d = read("r53.density") as DensityMode | null;
    if (m) setModeState(m);
    if (d) setDensityState(d);
  }, []);

  useEffect(() => {
    applyMode(mode === "dark" ? Mode.Dark : Mode.Light);
    document.documentElement.dataset.theme = mode;
  }, [mode]);
  useEffect(() => {
    applyDensity(density === "compact" ? Density.Compact : Density.Comfortable);
  }, [density]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    write("r53.mode", m);
  }, []);
  const setDensity = useCallback((d: DensityMode) => {
    setDensityState(d);
    write("r53.density", d);
  }, []);

  const value = useMemo(() => ({ mode, density, setMode, setDensity }), [mode, density, setMode, setDensity]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
