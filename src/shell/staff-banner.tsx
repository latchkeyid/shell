import * as React from "react"
import { EyeIcon } from "lucide-react"

import { Button } from "../components/ui/button"
import { minutesLeft } from "./org-switcher"
import { useShell } from "./shell-context"

const TITLE_PREFIX = "[Staff] "

/**
 * Amber strip above the action bar while acting as platform staff. Also
 * paints data-staff-view on <html> and prefixes document.title.
 */
export function StaffBanner() {
  const { session, callbacks } = useShell()
  const actAs = session.actAs
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    if (!actAs) return
    const root = document.documentElement
    root.setAttribute("data-staff-view", "")
    const original = document.title
    if (!original.startsWith(TITLE_PREFIX)) document.title = TITLE_PREFIX + original
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      root.removeAttribute("data-staff-view")
      if (document.title.startsWith(TITLE_PREFIX)) {
        document.title = document.title.slice(TITLE_PREFIX.length)
      }
      window.clearInterval(id)
    }
  }, [actAs])

  if (!actAs) return null
  const orgName = session.orgs.find((org) => org.slug === actAs.org)?.name ?? actAs.org
  const minutes = minutesLeft(actAs.expiresAt, now)
  const exit = () => void callbacks.onExitStaffView?.()

  return (
    <div
      data-slot="staff-banner"
      role="status"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") exit()
      }}
      className="flex h-7 shrink-0 items-center gap-2 border-b border-staff-border bg-staff-muted px-3 text-xs text-staff-foreground"
    >
      <EyeIcon className="size-3.5 shrink-0" strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      <span className="min-w-0 truncate">
        <span className="font-semibold">Viewing {orgName} as platform staff</span>
        {actAs.reason && <span> · reason: {actAs.reason}</span>}
        <span> · audited</span>
        {minutes !== undefined && (
          <span> · {minutes === 0 ? "expired" : `expires in ${minutes} min`}</span>
        )}
      </span>
      <Button
        size="xs"
        variant="ghost"
        onClick={exit}
        className="ml-auto h-5 shrink-0 bg-staff-foreground text-staff-muted hover:bg-staff-foreground/90 hover:text-staff-muted"
      >
        Exit staff view
      </Button>
    </div>
  )
}
