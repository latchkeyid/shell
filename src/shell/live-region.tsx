import * as React from "react"

type Announce = (message: string) => void

const LiveRegionContext = React.createContext<Announce | null>(null)

/** The single shell-owned aria-live region. Mount once, near the root. */
export function LiveRegionProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = React.useState("")
  const timer = React.useRef<number | undefined>(undefined)

  const announce = React.useCallback<Announce>((next) => {
    // Clear first so an identical message is announced again.
    setMessage("")
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMessage(next), 50)
  }, [])

  React.useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <LiveRegionContext.Provider value={announce}>
      {children}
      <div
        data-slot="live-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {message}
      </div>
    </LiveRegionContext.Provider>
  )
}

/** Announce a polite message. A no-op outside a LiveRegionProvider. */
export function useAnnounce(): Announce {
  const announce = React.useContext(LiveRegionContext)
  return React.useMemo(() => announce ?? (() => {}), [announce])
}

/** Move focus to the page heading after a route or scope change. */
export function focusPageHeading(root: ParentNode = document) {
  const heading = root.querySelector<HTMLElement>("main h1, [data-slot='page-title']")
  if (!heading) return
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1")
  heading.focus({ preventScroll: false })
}
