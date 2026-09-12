import type * as React from "react"

export type OrgRole = "owner" | "admin" | "member" | "viewer"

export interface ShellUser {
  id: string
  email: string
  name?: string
  avatarUrl?: string
}

export interface ShellOrg {
  slug: string
  name: string
  role: OrgRole
  avatarUrl?: string
  suspended?: boolean
}

export interface ShellInvitation {
  id: string
  orgSlug: string
  orgName: string
  /** Who invited the user, when the identity provider exposes it. */
  invitedBy?: string
  role: string
}

export interface StaffActAs {
  org: string
  reason?: string
  /** ISO timestamp. */
  expiresAt?: string
}

/** The session model every console hands to the shell. */
export interface ShellSession {
  user: ShellUser
  orgs: ShellOrg[]
  currentOrg?: string
  invitations: ShellInvitation[]
  canCreateOrg: boolean
  /** Platform staff: sees the Platform group in the org switcher. */
  staff: boolean
  actAs?: StaffActAs
  recentOrgs?: string[]
}

export type ThemeMode = "system" | "light" | "dark"

/** Minimal prop contract a router's Link must satisfy. */
export interface LinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string
  ref?: React.Ref<HTMLAnchorElement>
}

export type LinkComponent = React.ComponentType<LinkProps>

export type IconComponent = React.ComponentType<{
  className?: string
  strokeWidth?: number
  absoluteStrokeWidth?: boolean
  "aria-hidden"?: boolean | "true" | "false"
}>

export interface NavItem {
  id: string
  label: string
  href: string
  icon?: IconComponent
  /** Trailing count, rendered in mono. */
  count?: number | string
  /** Match the href exactly instead of by prefix when deciding the active item. */
  exact?: boolean
  keywords?: string[]
}

export interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

export interface ShellApp {
  /** Stable id, used for storage keys: "tripline" | "runsheet" | "latchkey". */
  id: string
  /** Wordmark text shown above the org switcher. */
  name: string
}

/** Cross-app URL scheme. Apps may override any entry. */
export interface ShellPaths {
  orgHome: (orgSlug: string) => string
  orgSettings: (orgSlug: string) => string
  invitation: (invitationId: string) => string
  invitations: string
  createOrg: string
  platformOrgs: string
  welcome: string
}

export const defaultPaths: ShellPaths = {
  orgHome: (slug) => `/o/${slug}`,
  orgSettings: (slug) => `/o/${slug}/settings`,
  invitation: (id) => `/invitations/${id}`,
  invitations: "/invitations",
  createOrg: "/orgs/new",
  platformOrgs: "/platform/orgs",
  welcome: "/welcome",
}

export interface ShellCallbacks {
  /** Switch to another organisation. The app rewrites the path and clears caches. */
  onSwitch: (orgSlug: string) => void | Promise<void>
  onExitStaffView?: () => void | Promise<void>
  onCreateOrg?: () => void
  onSignOut?: () => void | Promise<void>
  onTheme?: (mode: ThemeMode) => void
  /** Platform directory search for non-member orgs (staff only). */
  searchOrgs?: (
    query: string,
    signal: AbortSignal,
  ) => Promise<Array<{ slug: string; name: string }>>
}

export interface ScopeItem {
  id: string
  label: string
  secondary?: string
  icon?: IconComponent
  /** Environment tag, e.g. "Prod" on a latchkey tenant. */
  tag?: string
  disabled?: boolean
}

/** The container sub-scope: tripline project, runsheet team/service, latchkey tenant. */
export interface ScopeConfig {
  /** Noun used in labels: "project" | "team" | "tenant". */
  noun: string
  items: ScopeItem[]
  /** Id of the current item; undefined renders `allLabel`. */
  current?: string
  /** Label used when nothing is selected, e.g. "all tenants". */
  allLabel?: string
  /** Where the crumb links; defaults to the org home. */
  href?: string
  recent?: string[]
  onSelect: (item: ScopeItem | null) => void
  onCreate?: () => void
  createLabel?: string
}

export interface EnvironmentOption {
  id: string
  label: string
  /** Production carries a warning-tone dot on the chip. */
  tone?: "warning" | "info" | "neutral"
}

export interface EnvironmentConfig {
  options: EnvironmentOption[]
  /** undefined means "all". */
  current?: string
  onSelect: (id: string | null) => void
}

export interface CommandItem {
  id: string
  label: string
  group?: string
  icon?: IconComponent
  shortcut?: string
  keywords?: string[]
  href?: string
  run?: () => void
  /** Nested page: selecting opens these items. Backspace pops. */
  children?: CommandItem[]
  secondary?: string
}

export interface CommandRegistry {
  /** Static entries beyond the nav pages (which are registered automatically). */
  pages?: CommandItem[]
  /** Async entity search, debounced 250ms; stale results are aborted. */
  search?: (query: string, signal: AbortSignal) => Promise<CommandItem[]>
  searchGroup?: string
  placeholder?: string
}
