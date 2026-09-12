import * as React from "react"

import { readJson, writeJson } from "@/lib/storage"

export type Density = "compact" | "normal" | "spacious"

export const densities: Density[] = ["compact", "normal", "spacious"]

export const densityLabels: Record<Density, string> = {
  compact: "Compact",
  normal: "Normal",
  spacious: "Spacious",
}

/** Row height at 13px type: 28 / 36 / 44px. */
export const densityRowHeight: Record<Density, number> = {
  compact: 28,
  normal: 36,
  spacious: 44,
}

export function densityKey(routeKey: string) {
  return `shell.density.${routeKey}`
}

export function isDensity(value: unknown): value is Density {
  return typeof value === "string" && (densities as string[]).includes(value)
}

/** Density chosen from the view options menu, persisted per route. */
export function useDensity(routeKey: string | undefined, fallback: Density = "normal") {
  const key = routeKey ? densityKey(routeKey) : undefined
  const [density, setDensityState] = React.useState<Density>(() => {
    if (!key) return fallback
    const stored = readJson<unknown>(key, undefined)
    return isDensity(stored) ? stored : fallback
  })

  React.useEffect(() => {
    if (!key) return
    const stored = readJson<unknown>(key, undefined)
    setDensityState(isDensity(stored) ? stored : fallback)
  }, [key, fallback])

  const setDensity = React.useCallback(
    (next: Density) => {
      setDensityState(next)
      if (key) writeJson(key, next)
    },
    [key],
  )

  return [density, setDensity] as const
}
