import * as React from "react"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { readCookie } from "@/lib/storage"
import { cn } from "@/lib/utils"
import { CommandPalette } from "@/shell/command-palette"
import { LiveRegionProvider } from "@/shell/live-region"
import { AnchorLink } from "@/shell/link"
import { AppSidebar } from "@/shell/sidebar-nav"
import { ShellContextProvider, type PickerRequest, type ShellContextValue } from "@/shell/shell-context"
import { StaffBanner } from "@/shell/staff-banner"
import { ThemeProvider, useResolvedTheme } from "@/shell/theme-provider"
import {
  defaultPaths,
  type CommandItem,
  type CommandRegistry,
  type EnvironmentConfig,
  type LinkComponent,
  type NavGroup,
  type ScopeConfig,
  type ShellApp,
  type ShellCallbacks,
  type ShellPaths,
  type ShellSession,
  type ThemeMode,
} from "@/shell/types"

export const SIDEBAR_COOKIE = "sidebar_state"

export interface AppShellProps {
  app: ShellApp
  session: ShellSession
  nav: NavGroup[]
  /** Container sub-scope: tripline project, runsheet team, latchkey tenant. */
  scope?: ScopeConfig
  /** tripline only: the environment filter chip. */
  environment?: EnvironmentConfig
  registry?: CommandRegistry
  paths?: Partial<ShellPaths>
  /** react-router Link, TanStack Link, … Defaults to an anchor that calls onNavigate. */
  LinkComponent?: LinkComponent
  currentPath: string
  onNavigate: (href: string) => void
  callbacks: ShellCallbacks
  /** True until the session and nav are known; renders skeletons. */
  loading?: boolean
  /** Nav item ids pinned by default for a user without saved pins. */
  seedPins?: string[]
  /** Only used when no ThemeProvider is mounted above the shell. */
  defaultTheme?: ThemeMode
  /** Mount the sonner Toaster. Default true. */
  toaster?: boolean
  className?: string
  children: React.ReactNode
}

const closed: PickerRequest = { open: false }

export function AppShell(props: AppShellProps) {
  const resolved = useResolvedTheme()
  if (resolved === "system") {
    return (
      <ThemeProvider defaultMode={props.defaultTheme ?? "system"}>
        <AppShellInner {...props} />
      </ThemeProvider>
    )
  }
  return <AppShellInner {...props} />
}

function AppShellInner({
  app,
  session,
  nav,
  scope,
  environment,
  registry,
  paths,
  LinkComponent,
  currentPath,
  onNavigate,
  callbacks,
  loading = false,
  seedPins,
  toaster = true,
  className,
  children,
}: AppShellProps) {
  const [orgSwitcher, setOrgSwitcher] = React.useState<PickerRequest>(closed)
  const [scopePicker, setScopePicker] = React.useState<PickerRequest>(closed)
  const [environmentPicker, setEnvironmentPicker] = React.useState<PickerRequest>(closed)
  const [palette, setPalette] = React.useState<PickerRequest>(closed)
  const [switching, setSwitching] = React.useState(false)
  const [commandSets, setCommandSets] = React.useState<Map<string, CommandItem[]>>(() => new Map())

  const registerCommands = React.useCallback((id: string, items: CommandItem[]) => {
    setCommandSets((prev) => new Map(prev).set(id, items))
    return () => {
      setCommandSets((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  const contextCommands = React.useMemo(() => [...commandSets.values()].flat(), [commandSets])
  const mergedPaths = React.useMemo(() => ({ ...defaultPaths, ...paths }), [paths])
  const mergedRegistry = React.useMemo(() => registry ?? {}, [registry])
  const currentOrg = React.useMemo(
    () => session.orgs.find((org) => org.slug === session.currentOrg),
    [session],
  )

  const value = React.useMemo<ShellContextValue>(
    () => ({
      app,
      session,
      currentOrg,
      nav,
      scope,
      environment,
      paths: mergedPaths,
      callbacks,
      registry: mergedRegistry,
      LinkComponent: LinkComponent ?? AnchorLink,
      currentPath,
      navigate: onNavigate,
      orgSwitcher,
      setOrgSwitcher,
      scopePicker,
      setScopePicker,
      environmentPicker,
      setEnvironmentPicker,
      palette,
      setPalette,
      switching,
      setSwitching,
      contextCommands,
      registerCommands,
    }),
    [
      app,
      session,
      currentOrg,
      nav,
      scope,
      environment,
      mergedPaths,
      callbacks,
      mergedRegistry,
      LinkComponent,
      currentPath,
      onNavigate,
      orgSwitcher,
      scopePicker,
      environmentPicker,
      palette,
      switching,
      contextCommands,
      registerCommands,
    ],
  )

  const defaultOpen = readCookie(SIDEBAR_COOKIE) !== "false"

  return (
    <ShellContextProvider value={value}>
      <LiveRegionProvider>
        <TooltipProvider>
          <SidebarProvider
            defaultOpen={defaultOpen}
            style={{ "--sidebar-width": "15rem", "--sidebar-width-icon": "3rem" } as React.CSSProperties}
            className={cn("min-h-svh", className)}
          >
            <AppSidebar loading={loading} seedPins={seedPins} />
            <SidebarInset className="min-w-0 overflow-hidden md:h-[calc(100svh-1rem)]">
              <StaffBanner />
              <div data-slot="page-scroll" className="flex min-h-0 flex-1 flex-col overflow-auto">
                {children}
              </div>
            </SidebarInset>
            <CommandPalette />
          </SidebarProvider>
          {toaster && <Toaster />}
        </TooltipProvider>
      </LiveRegionProvider>
    </ShellContextProvider>
  )
}
