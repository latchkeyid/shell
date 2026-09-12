import * as React from "react"

import { readJson, writeJson } from "@/lib/storage"
import type { ThemeMode } from "@/shell/types"

export type ResolvedTheme = "light" | "dark"

interface ThemeContextValue {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

const MEDIA = "(prefers-color-scheme: dark)"

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light"
  return window.matchMedia(MEDIA).matches ? "dark" : "light"
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle("dark", resolved === "dark")
  root.style.colorScheme = resolved
  root.dataset.theme = resolved
}

export interface ThemeProviderProps {
  children: React.ReactNode
  /** "system" for tripline and runsheet, "light" for latchkey. */
  defaultMode?: ThemeMode
  storageKey?: string
  onChange?: (mode: ThemeMode) => void
}

export function ThemeProvider({
  children,
  defaultMode = "system",
  storageKey = "shell.theme",
  onChange,
}: ThemeProviderProps) {
  const [mode, setModeState] = React.useState<ThemeMode>(() =>
    readJson<ThemeMode>(storageKey, defaultMode),
  )
  const [system, setSystem] = React.useState<ResolvedTheme>(systemTheme)

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mql = window.matchMedia(MEDIA)
    const onMedia = () => setSystem(mql.matches ? "dark" : "light")
    mql.addEventListener("change", onMedia)
    return () => mql.removeEventListener("change", onMedia)
  }, [])

  const resolved: ResolvedTheme = mode === "system" ? system : mode

  React.useLayoutEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  const setMode = React.useCallback(
    (next: ThemeMode) => {
      setModeState(next)
      writeJson(storageKey, next)
      onChange?.(next)
    },
    [storageKey, onChange],
  )

  const value = React.useMemo(
    () => ({ mode, resolved, setMode }),
    [mode, resolved, setMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider.")
  }
  return ctx
}

/** Resolved theme, or "system" when no ThemeProvider is mounted. */
export function useResolvedTheme(): ResolvedTheme | "system" {
  return React.useContext(ThemeContext)?.resolved ?? "system"
}
