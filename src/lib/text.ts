/** Two-letter initials from the first letters of the first two words. */
export function initials(name: string): string {
  const words = name
    .replace(/[-_.]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const first = words[0]?.[0] ?? ""
  const second = words[1]?.[0] ?? ""
  return (first + second).toUpperCase() || "?"
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1)
}

export function isMac(): boolean {
  if (typeof navigator === "undefined") return false
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent)
}

/** "⌘" on Apple platforms, "Ctrl" elsewhere. */
export function modKeyLabel(): string {
  return isMac() ? "⌘" : "Ctrl"
}
