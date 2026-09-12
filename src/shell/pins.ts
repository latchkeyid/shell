import * as React from "react"

import { readJson, writeJson } from "../lib/storage"

export const MAX_RECENT_NAV = 5

export function pinsKey(appId: string, userId: string) {
  return `shell.pins.${appId}.${userId}`
}

export function recentNavKey(appId: string, userId: string) {
  return `shell.recent.${appId}.${userId}`
}

/** Per-user pinned nav item ids, seeded by the app on first use. */
export function usePins(appId: string, userId: string, seed: string[] = []) {
  const key = pinsKey(appId, userId)
  // Compared by content so a new array literal on each render does not reset pins.
  const seedKey = seed.join("|")
  const [pinned, setPinned] = React.useState<string[]>(() => readJson<string[] | null>(key, null) ?? seed)

  React.useEffect(() => {
    setPinned(readJson<string[] | null>(key, null) ?? (seedKey ? seedKey.split("|") : []))
  }, [key, seedKey])

  const toggle = React.useCallback(
    (id: string) => {
      setPinned((prev) => {
        const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        writeJson(key, next)
        return next
      })
    },
    [key],
  )

  const isPinned = React.useCallback((id: string) => pinned.includes(id), [pinned])
  return { pinned, isPinned, toggle }
}

/** Last five nav items visited, most recent first. */
export function useRecentNav(appId: string, userId: string, activeId: string | undefined) {
  const key = recentNavKey(appId, userId)
  const [recent, setRecent] = React.useState<string[]>(() => readJson<string[]>(key, []))

  React.useEffect(() => {
    if (!activeId) return
    setRecent((prev) => {
      if (prev[0] === activeId) return prev
      const next = [activeId, ...prev.filter((id) => id !== activeId)].slice(0, MAX_RECENT_NAV)
      writeJson(key, next)
      return next
    })
  }, [activeId, key])

  return recent
}
