import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "system" | "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

/**
 * Theme mode store — drives the `mode` prop of the root <Theme> provider.
 * Persisted to localStorage so the choice survives reloads. The Settings page
 * exposes the toggle via `setMode`.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "light",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "astryx-theme-mode",
      // v1: default switched from "system" to "light"; migrate resets any
      // previously persisted mode so the new default takes effect.
      version: 1,
      migrate: () => ({ mode: "light" as ThemeMode }),
    }
  )
);
