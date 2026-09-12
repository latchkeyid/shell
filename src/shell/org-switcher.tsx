import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import {
  ArrowRightIcon,
  Building2Icon,
  CheckIcon,
  ChevronsUpDownIcon,
  EyeIcon,
  InfoIcon,
  Loader2Icon,
  LogOutIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react"

import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "../components/ui/command"
import { Kbd } from "../components/ui/kbd"
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/ui/sheet"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "../components/ui/sidebar"
import { Skeleton } from "../components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip"
import { readJson, writeJson } from "../lib/storage"
import { roleLabel } from "../lib/text"
import { cn } from "../lib/utils"
import { useChord } from "./hotkeys"
import { focusPageHeading, useAnnounce } from "./live-region"
import { OrgAvatar } from "./org-avatar"
import { useShell } from "./shell-context"
import type { ShellOrg, ShellSession } from "./types"

/** Above this many memberships the list asks for a query before rendering everything. */
export const SEARCH_HINT_THRESHOLD = 50
/** Rows rendered while the query is empty above the hint threshold. */
export const INITIAL_ROWS = 8
/** Hard cap on rendered rows; beyond it the list asks the user to keep typing. */
export const RENDER_CAP = 100
const RECENT_THRESHOLD = 8
const RECENT_COUNT = 3
const SEARCH_DEBOUNCE_MS = 250
const SKELETON_DELAY_MS = 1000

export interface CurrentScope {
  slug: string
  name: string
  role?: ShellOrg["role"]
  avatarUrl?: string
  staffView: boolean
}

/** The org the shell is currently showing: a membership, or the staff view-as target. */
export function resolveCurrentScope(session: ShellSession): CurrentScope | undefined {
  if (session.actAs) {
    const member = session.orgs.find((org) => org.slug === session.actAs?.org)
    return {
      slug: session.actAs.org,
      name: member?.name ?? session.actAs.org,
      role: member?.role,
      avatarUrl: member?.avatarUrl,
      staffView: true,
    }
  }
  const org = session.orgs.find((candidate) => candidate.slug === session.currentOrg)
  if (!org) return undefined
  return { ...org, staffView: false }
}

export function canSwitchOrgs(session: ShellSession): boolean {
  return (
    session.orgs.length > 1 ||
    session.invitations.length > 0 ||
    session.canCreateOrg ||
    session.staff
  )
}

export function recentOrgsKey(userId: string, appId: string) {
  return `shell.recentOrgs.${userId}.${appId}`
}

function matches(query: string, ...fields: Array<string | undefined>): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return fields.some((field) => field?.toLowerCase().includes(q))
}

/** Sections of the switcher list, computed from the session and query. Exported for tests. */
export interface SwitcherSections {
  invitations: ShellSession["invitations"]
  recent: ShellOrg[]
  active: ShellOrg[]
  inactive: ShellOrg[]
  showHint: boolean
  truncated: number
}

export function computeSections(
  session: ShellSession,
  query: string,
  recentSlugs: string[],
  currentSlug: string | undefined,
): SwitcherSections {
  const q = query.trim()
  const invitations = session.invitations.filter((inv) =>
    matches(q, inv.orgName, inv.orgSlug, inv.invitedBy),
  )
  const members = session.orgs.filter((org) => matches(q, org.name, org.slug))
  const current = members.find((org) => org.slug === currentSlug && !org.suspended)
  const rest = members
    .filter((org) => org.slug !== currentSlug && !org.suspended)
    .sort((a, b) => a.name.localeCompare(b.name))
  const inactive = members
    .filter((org) => org.suspended)
    .sort((a, b) => a.name.localeCompare(b.name))
  let active = current ? [current, ...rest] : rest

  const recent =
    session.orgs.length > RECENT_THRESHOLD
      ? recentSlugs
          .filter((slug) => slug !== currentSlug)
          .map((slug) => members.find((org) => org.slug === slug && !org.suspended))
          .filter((org): org is ShellOrg => Boolean(org))
          .slice(0, RECENT_COUNT)
      : []

  const showHint = session.orgs.length > SEARCH_HINT_THRESHOLD && q.length === 0
  let truncated = 0
  const cap = showHint ? INITIAL_ROWS : RENDER_CAP
  if (active.length > cap) {
    truncated = active.length - cap
    active = active.slice(0, cap)
  }
  return { invitations, recent, active, inactive, showHint, truncated }
}

interface PlatformResult {
  slug: string
  name: string
}

export function OrgSwitcher({ loading = false }: { loading?: boolean }) {
  const shell = useShell()
  const { session, callbacks, paths, navigate, app, orgSwitcher, setOrgSwitcher, switching: busy, setSwitching: setBusy } = shell
  const { state, isMobile } = useSidebar()
  const collapsed = state === "collapsed" && !isMobile
  const announce = useAnnounce()

  const current = React.useMemo(() => resolveCurrentScope(session), [session])
  const switchable = canSwitchOrgs(session)
  const open = orgSwitcher.open && switchable
  const setOpen = React.useCallback(
    (next: boolean) => setOrgSwitcher({ open: next }),
    [setOrgSwitcher],
  )

  useChord("g", "o", () => setOpen(true), { enabled: switchable && !loading })

  const [recentSlugs, setRecentSlugs] = React.useState<string[]>(() => [
    ...(session.recentOrgs ?? []),
    ...readJson<string[]>(recentOrgsKey(session.user.id, app.id), []),
  ])

  const select = React.useCallback(
    async (org: ShellOrg) => {
      setOpen(false)
      if (org.slug === current?.slug && !current.staffView) return
      setBusy(true)
      try {
        await callbacks.onSwitch(org.slug)
        const next = [org.slug, ...recentSlugs.filter((slug) => slug !== org.slug)].slice(0, 10)
        setRecentSlugs(next)
        writeJson(recentOrgsKey(session.user.id, app.id), next)
        announce(`Switched to ${org.name}`)
        window.requestAnimationFrame(() => focusPageHeading())
      } finally {
        setBusy(false)
      }
    },
    [announce, app.id, callbacks, current, recentSlugs, session.user.id, setBusy, setOpen],
  )

  if (loading || !current) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuSkeleton showIcon className="h-12" />
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const inviteCount = session.invitations.length
  const roleText = current.staffView
    ? "Staff view"
    : current.role
      ? roleLabel(current.role)
      : "Member"
  const ariaLabel = [
    `Organisation: ${current.name}.`,
    current.staffView ? "Staff view, not a member." : `Your role: ${roleText}.`,
    inviteCount > 0
      ? `${inviteCount} pending ${inviteCount === 1 ? "invitation" : "invitations"}.`
      : null,
    switchable ? "Switch organisation" : null,
  ]
    .filter(Boolean)
    .join(" ")

  const renderTrigger = (extra: { onClick?: () => void } = {}) => (
    <SidebarMenuButton
      size="lg"
      type="button"
      aria-label={ariaLabel}
      aria-busy={busy || undefined}
      aria-haspopup={switchable ? "dialog" : undefined}
      aria-expanded={switchable ? open : undefined}
      aria-controls={switchable ? "org-switcher" : undefined}
      title={switchable ? `${current.name} · ${roleText} (G then O)` : `${current.name} · ${roleText}`}
      data-slot="org-switcher-trigger"
      data-staff={current.staffView || undefined}
      disabled={!switchable}
      onClick={extra.onClick}
      onKeyDown={(event) => {
        if (switchable && event.key === "ArrowDown") {
          event.preventDefault()
          setOpen(true)
        }
      }}
      className={cn(
        "gap-2.5 rounded-lg border border-foreground/10 bg-[color-mix(in_srgb,var(--card)_60%,var(--background))] shadow-xs disabled:opacity-100 data-open:bg-sidebar-accent/60 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none",
        current.staffView &&
          "bg-staff-muted/60 ring-2 ring-staff ring-offset-1 ring-offset-sidebar group-data-[collapsible=icon]:bg-transparent",
      )}
    >
      <span className="relative shrink-0">
        {busy ? (
          <span className="flex size-8 items-center justify-center rounded-md bg-foreground/10">
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          </span>
        ) : (
          <OrgAvatar name={current.name} src={current.avatarUrl} size={32} />
        )}
        {inviteCount > 0 && (
          <span
            data-slot="invite-badge"
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground ring-2 ring-sidebar group-data-[collapsible=icon]:top-0 group-data-[collapsible=icon]:right-0 group-data-[collapsible=icon]:size-2 group-data-[collapsible=icon]:min-w-0 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:text-[0]"
          >
            {inviteCount}
          </span>
        )}
      </span>
      <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate text-sm font-medium" title={current.name}>
          {current.name}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 truncate text-xs text-muted-foreground",
            current.staffView && "text-staff-foreground",
          )}
        >
          {current.staffView && <EyeIcon className="size-3" aria-hidden="true" />}
          {current.staffView ? (
            <StaffCountdown expiresAt={session.actAs?.expiresAt} prefix="Staff view" />
          ) : (
            roleText
          )}
        </span>
      </span>
      {switchable && (
        <ChevronsUpDownIcon
          className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden"
          aria-hidden="true"
        />
      )}
    </SidebarMenuButton>
  )

  const withTooltip = (node: React.ReactNode) =>
    collapsed ? (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right" align="center" hidden={open}>
          {current.name} · {roleText}
          {switchable && !current.staffView && <Kbd>G O</Kbd>}
        </TooltipContent>
      </Tooltip>
    ) : (
      node
    )

  if (!switchable) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>{withTooltip(renderTrigger())}</SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const panel = (
    <SwitcherPanel
      session={session}
      current={current}
      recentSlugs={recentSlugs}
      initialQuery={orgSwitcher.query ?? ""}
      onSelect={select}
      onInvitation={(id) => {
        setOpen(false)
        navigate(paths.invitation(id))
      }}
      onSettings={() => {
        setOpen(false)
        navigate(paths.orgSettings(current.slug))
      }}
      onDirectory={() => {
        setOpen(false)
        navigate(paths.platformOrgs)
      }}
      onCreate={() => {
        setOpen(false)
        if (callbacks.onCreateOrg) callbacks.onCreateOrg()
        else navigate(paths.createOrg)
      }}
      onExitStaffView={() => {
        setOpen(false)
        void callbacks.onExitStaffView?.()
      }}
      onViewAsStaff={(slug) => {
        setOpen(false)
        navigate(paths.orgHome(slug))
      }}
      searchOrgs={session.staff ? callbacks.searchOrgs : undefined}
      announce={announce}
    />
  )

  if (isMobile) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Sheet open={open} onOpenChange={setOpen}>
            {renderTrigger({ onClick: () => setOpen(!open) })}
            <SheetContent
              id="org-switcher"
              side="bottom"
              aria-label="Switch organisation"
              className="max-h-[85vh] gap-0 p-0"
              showCloseButton={false}
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Switch organisation</SheetTitle>
                <SheetDescription>Choose an organisation to work in.</SheetDescription>
              </SheetHeader>
              {panel}
            </SheetContent>
          </Sheet>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover open={open} onOpenChange={setOpen}>
          {withTooltip(<PopoverTrigger asChild>{renderTrigger()}</PopoverTrigger>)}
          <PopoverContent
            id="org-switcher"
            aria-label="Switch organisation"
            side={collapsed ? "right" : "bottom"}
            align="start"
            sideOffset={collapsed ? 8 : 4}
            className="w-72 gap-0 overflow-hidden rounded-lg p-0"
          >
            {panel}
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function minutesLeft(expiresAt: string | undefined, now = Date.now()): number | undefined {
  if (!expiresAt) return undefined
  const ms = new Date(expiresAt).getTime() - now
  if (Number.isNaN(ms)) return undefined
  return Math.max(0, Math.ceil(ms / 60_000))
}

export function StaffCountdown({
  expiresAt,
  prefix,
}: {
  expiresAt?: string
  prefix?: string
}) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (!expiresAt) return
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [expiresAt])
  const minutes = minutesLeft(expiresAt, now)
  const text =
    minutes === undefined
      ? "not a member"
      : minutes === 0
        ? "expired"
        : `${minutes} min left`
  return (
    <>
      {prefix ? `${prefix} · ` : ""}
      {text}
    </>
  )
}

interface SwitcherPanelProps {
  session: ShellSession
  current: CurrentScope
  recentSlugs: string[]
  initialQuery: string
  onSelect: (org: ShellOrg) => void
  onInvitation: (id: string) => void
  onSettings: () => void
  onDirectory: () => void
  onCreate: () => void
  onExitStaffView: () => void
  onViewAsStaff: (slug: string) => void
  searchOrgs?: (query: string, signal: AbortSignal) => Promise<PlatformResult[]>
  announce: (message: string) => void
}

function orgValue(slug: string) {
  return `org:${slug}`
}

export function SwitcherPanel({
  session,
  current,
  recentSlugs,
  initialQuery,
  onSelect,
  onInvitation,
  onSettings,
  onDirectory,
  onCreate,
  onExitStaffView,
  onViewAsStaff,
  searchOrgs,
  announce,
}: SwitcherPanelProps) {
  const [query, setQuery] = React.useState(initialQuery)
  const [highlighted, setHighlighted] = React.useState(orgValue(current.slug))
  const sections = React.useMemo(
    () => computeSections(session, query, recentSlugs, current.slug),
    [session, query, recentSlugs, current.slug],
  )

  const memberSlugs = React.useMemo(
    () => new Set(session.orgs.map((org) => org.slug)),
    [session.orgs],
  )
  const platform = usePlatformSearch(searchOrgs, query, memberSlugs, announce)

  const trimmed = query.trim()
  const canManage = !current.staffView && (current.role === "owner" || current.role === "admin")
  const rowCount =
    sections.invitations.length +
    sections.recent.length +
    sections.active.length +
    sections.inactive.length +
    platform.results.length
  const showEmpty = trimmed.length > 0 && rowCount === 0 && !platform.loading && !platform.error
  const singleOrgIdentity =
    session.orgs.length === 1 && session.invitations.length === 0 && !session.staff

  return (
    <Command
      shouldFilter={false}
      loop
      label="Switch organisation"
      value={highlighted}
      onValueChange={setHighlighted}
      className="rounded-none bg-transparent p-0"
    >
      <div
        data-slot="org-switcher-header"
        className={cn(
          "flex h-14 items-center gap-2.5 px-3",
          current.staffView && "bg-staff-muted text-staff-foreground",
        )}
      >
        <OrgAvatar name={current.name} src={current.avatarUrl} size={32} />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate text-sm font-medium" title={current.name}>
            {current.name}
          </span>
          <span>
            {current.staffView ? (
              <Badge variant="outline" className="border-staff-border text-staff-foreground">
                Staff view
              </Badge>
            ) : (
              <Badge variant="secondary">{current.role ? roleLabel(current.role) : "Member"}</Badge>
            )}
          </span>
        </div>
        <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {current.staffView ? (
          <Button variant="outline" size="xs" onClick={onExitStaffView}>
            Exit staff view
          </Button>
        ) : (
          canManage && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Organisation settings"
              onClick={onSettings}
            >
              <SettingsIcon />
            </Button>
          )
        )}
      </div>

      <div className="flex h-9 items-center gap-2 border-y px-3">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <CommandPrimitive.Input
          autoFocus
          data-slot="org-switcher-input"
          placeholder="Find organisation…"
          value={query}
          onValueChange={setQuery}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <CommandShortcut className="ml-0 tracking-normal">
          <Kbd>G O</Kbd>
        </CommandShortcut>
      </div>

      <CommandList className="max-h-[calc(70vh-8rem)]">
        <div className="sr-only" aria-live="polite">
          {platform.loading ? "Searching…" : `${rowCount} results`}
        </div>

        {sections.showHint && (
          <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground">
            Type to search {session.orgs.length} organisations
          </p>
        )}

        {showEmpty && (
          <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">
            No organisations match “{trimmed}”
          </p>
        )}

        {sections.invitations.length > 0 && (
          <CommandGroup heading={`Invitations (${sections.invitations.length})`}>
            {sections.invitations.map((invitation) => (
              <CommandItem
                key={invitation.id}
                value={`inv:${invitation.id}`}
                onSelect={() => onInvitation(invitation.id)}
                className="h-[42px] gap-2.5"
              >
                <OrgAvatar name={invitation.orgName} size={20} tone="neutral" />
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate" title={invitation.orgName}>
                    {invitation.orgName}
                  </span>
                  <span className="truncate text-2xs text-muted-foreground">
                    Invited by {invitation.invitedBy} as {roleLabel(invitation.role)}
                  </span>
                </span>
                <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {sections.recent.length > 0 && (
          <CommandGroup heading="Recent">
            {sections.recent.map((org) => (
              <OrgRow key={`recent-${org.slug}`} org={org} valuePrefix="recent:" onSelect={onSelect} />
            ))}
          </CommandGroup>
        )}

        {sections.active.length > 0 && (
          <CommandGroup heading={`Your organisations (${session.orgs.length})`}>
            {sections.active.map((org) => (
              <OrgRow
                key={org.slug}
                org={org}
                current={org.slug === current.slug && !current.staffView}
                onSelect={onSelect}
              />
            ))}
            {sections.truncated > 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                {sections.truncated} more · keep typing to narrow
              </p>
            )}
          </CommandGroup>
        )}

        {sections.inactive.length > 0 && (
          <CommandGroup heading="Inactive">
            {sections.inactive.map((org) => (
              <CommandItem
                key={org.slug}
                value={orgValue(org.slug)}
                disabled
                aria-disabled="true"
                className="h-9 gap-2.5"
              >
                <OrgAvatar name={org.name} src={org.avatarUrl} size={20} tone="neutral" />
                <span className="min-w-0 flex-1 truncate" title={org.name}>
                  {org.name}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  Suspended
                  <InfoIcon className="size-3" aria-hidden="true" />
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {session.staff && (
          <CommandGroup heading="Platform">
            {platform.results.map((result) => (
              <CommandItem
                key={`platform:${result.slug}`}
                value={`platform:${result.slug}`}
                onSelect={() => onViewAsStaff(result.slug)}
                className="h-9 gap-2.5"
              >
                <OrgAvatar name={result.name} size={20} tone="neutral" />
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate" title={result.name}>
                    {result.name}
                  </span>
                  <span className="truncate text-2xs text-muted-foreground">{result.slug}</span>
                </span>
                <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                  <EyeIcon className="size-3" aria-hidden="true" />
                  Not a member
                </span>
              </CommandItem>
            ))}
            {platform.loading && (
              <div role="group" aria-busy="true" aria-label="Loading organisations" className="grid gap-1 px-2 py-1">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="flex h-9 items-center gap-2.5">
                    <Skeleton className="size-5 rounded-[5px]" />
                    <Skeleton className="h-3 flex-1" />
                  </div>
                ))}
              </div>
            )}
            {platform.error && (
              <CommandItem value="platform:retry" onSelect={platform.retry} className="text-destructive">
                Couldn't load organisations — Retry
              </CommandItem>
            )}
            {(trimmed.length === 0 || platform.results.length > 0) && (
              <CommandItem value="platform:directory" onSelect={onDirectory}>
                <Building2Icon />
                All organisations…
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {trimmed.length === 0 && (
          <>
            <CommandSeparator alwaysRender />
            <CommandGroup>
              {current.staffView && (
                <CommandItem
                  value="action:exit-staff"
                  onSelect={onExitStaffView}
                  className="font-medium text-staff-foreground"
                >
                  <LogOutIcon />
                  Exit staff view
                </CommandItem>
              )}
              {session.canCreateOrg && (
                <CommandItem value="action:create" onSelect={onCreate}>
                  <PlusIcon />
                  Create organisation
                </CommandItem>
              )}
              {singleOrgIdentity && session.canCreateOrg && (
                <CommandItem value="action:invitations" disabled aria-disabled="true">
                  Invitations (0)
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}
      </CommandList>

      <p className="border-t px-3 py-2 text-2xs text-muted-foreground">
        ↑↓ to move · ⏎ to switch · esc to close
      </p>
    </Command>
  )
}

function OrgRow({
  org,
  current = false,
  valuePrefix = "",
  onSelect,
}: {
  org: ShellOrg
  current?: boolean
  valuePrefix?: string
  onSelect: (org: ShellOrg) => void
}) {
  return (
    <CommandItem
      value={`${valuePrefix}${orgValue(org.slug)}`}
      onSelect={() => onSelect(org)}
      aria-current={current ? "true" : undefined}
      data-current={current || undefined}
      className={cn("h-9 gap-2.5", current && "bg-accent-soft/70")}
    >
      <OrgAvatar name={org.name} src={org.avatarUrl} size={20} tone={current ? "accent" : "neutral"} />
      <span className="min-w-0 flex-1 truncate" title={org.name}>
        {org.name}
      </span>
      <span
        className={cn(
          "flex items-center gap-1 text-xs text-muted-foreground",
          current && "font-medium text-primary",
        )}
      >
        {roleLabel(org.role)}
        {current && <CheckIcon className="size-3.5" aria-hidden="true" />}
      </span>
    </CommandItem>
  )
}

function usePlatformSearch(
  searchOrgs: SwitcherPanelProps["searchOrgs"],
  query: string,
  memberSlugs: Set<string>,
  announce: (message: string) => void,
) {
  const [results, setResults] = React.useState<PlatformResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [attempt, setAttempt] = React.useState(0)
  const announced = React.useRef(false)
  const trimmed = query.trim()

  React.useEffect(() => {
    if (!searchOrgs || trimmed.length < 2) {
      setResults([])
      setLoading(false)
      setError(false)
      return
    }
    const controller = new AbortController()
    let skeleton: number | undefined
    const timer = window.setTimeout(() => {
      skeleton = window.setTimeout(() => {
        setLoading(true)
        if (!announced.current) {
          announced.current = true
          announce("Loading organisations")
        }
      }, SKELETON_DELAY_MS)
      searchOrgs(trimmed, controller.signal)
        .then((found) => {
          if (controller.signal.aborted) return
          setResults(found.filter((org) => !memberSlugs.has(org.slug)))
          setError(false)
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setResults([])
          setError(true)
        })
        .finally(() => {
          window.clearTimeout(skeleton)
          if (!controller.signal.aborted) setLoading(false)
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
      window.clearTimeout(skeleton)
    }
  }, [searchOrgs, trimmed, memberSlugs, announce, attempt])

  const retry = React.useCallback(() => setAttempt((n) => n + 1), [])
  return { results, loading, error, retry }
}
