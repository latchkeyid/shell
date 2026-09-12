import type { LinkComponent, ShellCallbacks, ShellSession } from "@/shell/types"

export interface ScreenProps {
  session: ShellSession
  path: string
  navigate: (href: string) => void
  callbacks: ShellCallbacks
  LinkComponent: LinkComponent
}

/** Split "/o/acme/p/mobile/issues?env=production" into segments and query. */
export function parsePath(path: string) {
  const [pathname = "", search = ""] = path.split("?")
  const segments = pathname.split("/").filter(Boolean)
  return { pathname, segments, query: new URLSearchParams(search) }
}

export function withQuery(pathname: string, query: URLSearchParams) {
  const qs = query.toString()
  return qs ? `${pathname}?${qs}` : pathname
}
