/** Safe wrappers around localStorage and document.cookie: every read and write
 *  is guarded so private windows, SSR and blocked storage never throw. */

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

export function removeKey(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}

export function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`))
  return match?.slice(name.length + 1)
}
