import * as React from "react"

import type {
  CommandItem,
  CommandRegistry,
  EnvironmentConfig,
  LinkComponent,
  NavGroup,
  ScopeConfig,
  ShellApp,
  ShellCallbacks,
  ShellPaths,
  ShellSession,
} from "./types"

export interface PickerRequest {
  open: boolean
  /** Query carried over from the command palette. */
  query?: string
}

export interface ShellContextValue {
  app: ShellApp
  session: ShellSession
  currentOrg: ShellSession["orgs"][number] | undefined
  nav: NavGroup[]
  scope?: ScopeConfig
  environment?: EnvironmentConfig
  paths: ShellPaths
  callbacks: ShellCallbacks
  registry: CommandRegistry
  LinkComponent: LinkComponent
  currentPath: string
  navigate: (href: string) => void
  /** Pickers the shell owns; opened from triggers, chords, or the palette. */
  orgSwitcher: PickerRequest
  setOrgSwitcher: (next: PickerRequest) => void
  scopePicker: PickerRequest
  setScopePicker: (next: PickerRequest) => void
  environmentPicker: PickerRequest
  setEnvironmentPicker: (next: PickerRequest) => void
  palette: PickerRequest
  setPalette: (next: PickerRequest) => void
  /** True while onSwitch is in flight; the action bar shows an indeterminate bar. */
  switching: boolean
  setSwitching: (next: boolean) => void
  /** Context actions registered by the current page via useCommands. */
  contextCommands: CommandItem[]
  registerCommands: (id: string, items: CommandItem[]) => () => void
}

const ShellContext = React.createContext<ShellContextValue | null>(null)

export const ShellContextProvider = ShellContext.Provider

export function useShell(): ShellContextValue {
  const ctx = React.useContext(ShellContext)
  if (!ctx) {
    throw new Error("useShell must be used within an AppShell.")
  }
  return ctx
}

export function useShellOptional(): ShellContextValue | null {
  return React.useContext(ShellContext)
}

/** Register context actions for the command palette while the caller is mounted. */
export function useCommands(items: CommandItem[]) {
  const shell = useShellOptional()
  const id = React.useId()
  const register = shell?.registerCommands
  React.useEffect(() => {
    if (!register) return
    return register(id, items)
    // Items are compared by identity; memoise them in the caller.
  }, [register, id, items])
}
