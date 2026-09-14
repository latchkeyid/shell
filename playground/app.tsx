import * as React from "react"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import triplineCss from "../src/theme/tripline.css?url"
import runsheetCss from "../src/theme/runsheet.css?url"
import latchkeyCss from "../src/theme/latchkey.css?url"
import wardroomCss from "../src/theme/wardroom.css?url"
import purserCss from "../src/theme/purser.css?url"
import foghornCss from "../src/theme/foghorn.css?url"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ThemeProvider, useTheme } from "@/shell/theme-provider"
import { WelcomePage } from "@/shell/welcome"
import { toast } from "@/actions/toast"
import type { LinkProps, ShellCallbacks, ThemeMode } from "@/shell/types"

import { sessions, type SessionKey } from "./fixtures/sessions"
import { TriplineScreen } from "./screens/tripline"
import { LatchkeyScreen } from "./screens/latchkey"
import { RunsheetScreen } from "./screens/runsheet"

export type AppKey = "tripline" | "runsheet" | "latchkey" | "wardroom" | "purser" | "foghorn"

const accents: Record<AppKey, string> = {
  tripline: triplineCss,
  runsheet: runsheetCss,
  latchkey: latchkeyCss,
  wardroom: wardroomCss,
  purser: purserCss,
  foghorn: foghornCss,
}

const appLabels: Record<AppKey, string> = {
  tripline: "tripline",
  runsheet: "runsheet",
  latchkey: "latchkey",
  wardroom: "wardroom",
  purser: "purser",
  foghorn: "foghorn",
}

const defaultPaths: Record<AppKey, string> = {
  tripline: "/o/grapevine/p/mobile/issues?env=production",
  runsheet: "/o/runsheet/t/platform-sre/runbooks",
  latchkey: "/o/northcote-cafe/tenants/all/identities",
  // The three new consoles have no screens of their own yet; they borrow
  // one so the accent can be seen on a full layout.
  wardroom: "/o/grapevine/p/mobile/issues?env=production",
  purser: "/o/runsheet/t/platform-sre/runbooks",
  foghorn: "/o/grapevine/p/mobile/issues?env=production",
}

/** Playground state is driven by the query string so Playwright can address any screen. */
function readParams() {
  const params = new URLSearchParams(window.location.search)
  const app = (params.get("app") as AppKey | null) ?? "tripline"
  const session = (params.get("session") as SessionKey | null) ?? "multi"
  const theme = (params.get("theme") as ThemeMode | null) ?? undefined
  const controls = params.get("controls") !== "0"
  const rail = params.get("rail") === "1"
  // The shell reads the cookie on first render, so set it before mounting.
  if (rail) document.cookie = "sidebar_state=false; path=/"
  return {
    app: app in accents ? app : "tripline",
    session: session in sessions ? session : "multi",
    theme,
    controls,
    rail,
  }
}

/** A minimal in-memory router: the shell only needs a Link and a navigate callback. */
const RouterContext = React.createContext<{ path: string; navigate: (href: string) => void }>({
  path: "/",
  navigate: () => {},
})

function useMiniRouter(initial: string) {
  const [path, setPath] = React.useState(initial)
  const navigate = React.useCallback((href: string) => {
    setPath(href)
  }, [])
  return React.useMemo(() => ({ path, navigate }), [path, navigate])
}

export function Playground() {
  const initial = React.useMemo(readParams, [])
  const [app, setApp] = React.useState<AppKey>(initial.app)
  const [sessionKey, setSessionKey] = React.useState<SessionKey>(initial.session)
  const router = useMiniRouter(defaultPaths[initial.app])

  React.useEffect(() => {
    // Re-append so the accent file follows the injected base stylesheet in cascade order.
    const link = document.getElementById("accent-css") as HTMLLinkElement | null
    if (!link) return
    link.href = accents[app]
    document.head.appendChild(link)
  }, [app])

  const switchApp = (next: AppKey) => {
    setApp(next)
    router.navigate(defaultPaths[next])
  }

  return (
    <ThemeProvider defaultMode={initial.theme ?? (app === "latchkey" ? "light" : "system")} storageKey={`playground.theme`}>
      <ThemeSync theme={initial.theme} />
      <RouterContext.Provider value={router}>
        <PlaygroundBody
          key={`${app}-${sessionKey}`}
          app={app}
          sessionKey={sessionKey}
          path={router.path}
          navigate={router.navigate}
        />
      </RouterContext.Provider>
      {initial.controls && (
        <Controls app={app} onApp={switchApp} sessionKey={sessionKey} onSession={setSessionKey} />
      )}
    </ThemeProvider>
  )
}

/** Force the theme from the query string once (screenshots). */
function ThemeSync({ theme }: { theme?: ThemeMode }) {
  const { setMode } = useTheme()
  React.useEffect(() => {
    if (theme) setMode(theme)
  }, [theme, setMode])
  return null
}

/** The Link the playground hands to the shell; a real app passes its router's Link. */
export const PlaygroundLink = React.forwardRef<HTMLAnchorElement, LinkProps>(function PlaygroundLink(
  { href, onClick, ...props },
  ref,
) {
  const { navigate } = React.useContext(RouterContext)
  return (
    <a
      ref={ref}
      href={href}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        navigate(href)
      }}
      {...props}
    />
  )
})

function PlaygroundBody({
  app,
  sessionKey,
  path,
  navigate,
}: {
  app: AppKey
  sessionKey: SessionKey
  path: string
  navigate: (href: string) => void
}) {
  const [session, setSession] = React.useState(() => sessions[sessionKey].session)
  React.useEffect(() => setSession(sessions[sessionKey].session), [sessionKey])

  const callbacks = React.useMemo<ShellCallbacks>(
    () => ({
      onSwitch: async (slug: string) => {
        await new Promise((resolve) => setTimeout(resolve, 400))
        setSession((prev) => ({ ...prev, currentOrg: slug }))
        navigate(defaultPaths[app].replace(/\/o\/[^/]+/, `/o/${slug}`))
      },
      onExitStaffView: () => {
        setSession((prev) => ({ ...prev, actAs: undefined }))
        toast("Exited staff view")
      },
      onCreateOrg: () => {
        toast("Create organisation is a page in the real app")
      },
      onSignOut: () => {
        toast("Signed out")
      },
    }),
    [app, navigate],
  )

  if (session.orgs.length === 0) {
    return (
      <WelcomePage
        session={session}
        appName={appLabels[app]}
        onAccept={async (invitation) => {
          await new Promise((resolve) => setTimeout(resolve, 300))
          setSession((prev) => ({
            ...prev,
            orgs: [{ slug: invitation.orgSlug, name: invitation.orgName, role: "admin" }],
            currentOrg: invitation.orgSlug,
            invitations: prev.invitations.filter((inv) => inv.id !== invitation.id),
          }))
          navigate(defaultPaths[app].replace(/\/o\/[^/]+/, `/o/${invitation.orgSlug}`))
        }}
        onDecline={(invitation) =>
          setSession((prev) => ({ ...prev, invitations: prev.invitations.filter((inv) => inv.id !== invitation.id) }))
        }
        onCreateOrg={() => toast("Create organisation is a page in the real app")}
      />
    )
  }

  const screenProps = { session, path, navigate, callbacks, LinkComponent: PlaygroundLink }
  if (app === "tripline" || app === "wardroom" || app === "foghorn") return <TriplineScreen {...screenProps} />
  if (app === "runsheet" || app === "purser") return <RunsheetScreen {...screenProps} />
  return <LatchkeyScreen {...screenProps} />
}

function Controls({
  app,
  onApp,
  sessionKey,
  onSession,
}: {
  app: AppKey
  onApp: (app: AppKey) => void
  sessionKey: SessionKey
  onSession: (key: SessionKey) => void
}) {
  const { mode, setMode } = useTheme()
  const icons: Record<ThemeMode, typeof SunIcon> = { system: MonitorIcon, light: SunIcon, dark: MoonIcon }
  const next: Record<ThemeMode, ThemeMode> = { system: "light", light: "dark", dark: "system" }
  const Icon = icons[mode]
  return (
    <div
      data-slot="playground-controls"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-xl border bg-popover/90 p-2 text-sm shadow-lift backdrop-blur-sm"
    >
      <Select value={app} onValueChange={(value) => onApp(value as AppKey)}>
        <SelectTrigger size="sm" aria-label="App" className="h-8 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(appLabels) as AppKey[]).map((key) => (
            <SelectItem key={key} value={key}>
              {appLabels[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sessionKey} onValueChange={(value) => onSession(value as SessionKey)}>
        <SelectTrigger size="sm" aria-label="Session fixture" className="h-8 w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(sessions) as SessionKey[]).map((key) => (
            <SelectItem key={key} value={key}>
              {sessions[key].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="icon-sm" aria-label={`Theme: ${mode}. Switch to ${next[mode]}`} onClick={() => setMode(next[mode])}>
        <Icon strokeWidth={1.5} absoluteStrokeWidth />
      </Button>
    </div>
  )
}
