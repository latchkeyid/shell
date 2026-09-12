import * as React from "react"
import { StarIcon } from "lucide-react"

import { Kbd } from "../components/ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
} from "../components/ui/sidebar"
import { modKeyLabel } from "../lib/text"
import { cn } from "../lib/utils"
import { ShellLink } from "./link"
import { OrgSwitcher } from "./org-switcher"
import { usePins, useRecentNav } from "./pins"
import { useShell } from "./shell-context"
import type { NavGroup, NavItem } from "./types"

/** The nav item whose href best matches the current path. */
export function findActiveItem(groups: NavGroup[], path: string): NavItem | undefined {
  const pathname = path.split(/[?#]/)[0] ?? path
  let best: NavItem | undefined
  for (const group of groups) {
    for (const item of group.items) {
      const href = item.href.split(/[?#]/)[0] ?? item.href
      const hit = item.exact
        ? pathname === href
        : pathname === href || pathname.startsWith(href.endsWith("/") ? href : `${href}/`)
      if (hit && (!best || href.length > best.href.length)) best = item
    }
  }
  return best
}

export interface AppSidebarProps {
  loading?: boolean
  /** Nav item ids pinned for a user with no saved pins. */
  seedPins?: string[]
  /** Hide the Recent list under Pinned. */
  showRecent?: boolean
}

export function AppSidebar({ loading = false, seedPins = [], showRecent = true }: AppSidebarProps) {
  const { app, nav, session, currentPath } = useShell()
  const active = React.useMemo(() => findActiveItem(nav, currentPath), [nav, currentPath])
  const { pinned, isPinned, toggle } = usePins(app.id, session.user.id, seedPins)
  const recent = useRecentNav(app.id, session.user.id, active?.id)

  const byId = React.useMemo(() => {
    const map = new Map<string, NavItem>()
    for (const group of nav) for (const item of group.items) map.set(item.id, item)
    return map
  }, [nav])

  const pinnedItems = pinned.map((id) => byId.get(id)).filter((item): item is NavItem => Boolean(item))
  const recentItems = showRecent
    ? recent
        .filter((id) => !pinned.includes(id))
        .map((id) => byId.get(id))
        .filter((item): item is NavItem => Boolean(item))
    : []

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="gap-1.5">
        <div
          data-slot="wordmark"
          className="px-2 pt-1 text-xs font-medium tracking-wide text-muted-foreground group-data-[collapsible=icon]:hidden"
        >
          {app.name}
        </div>
        <OrgSwitcher loading={loading} />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {loading ? (
          <SidebarGroup>
            <SidebarMenu>
              {Array.from({ length: 8 }, (_, index) => (
                <SidebarMenuItem key={index}>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ) : (
          <>
            {(pinnedItems.length > 0 || recentItems.length > 0) && (
              <NavSection label="Pinned">
                {pinnedItems.map((item) => (
                  <NavRow
                    key={item.id}
                    item={item}
                    active={active?.id === item.id}
                    pinned
                    onTogglePin={() => toggle(item.id)}
                  />
                ))}
                {recentItems.map((item) => (
                  <NavRow
                    key={`recent-${item.id}`}
                    item={item}
                    active={active?.id === item.id}
                    pinned={false}
                    recent
                    onTogglePin={() => toggle(item.id)}
                  />
                ))}
              </NavSection>
            )}
            {nav.map((group) => (
              <NavSection key={group.id} label={group.label}>
                {group.items.map((item) => (
                  <NavRow
                    key={item.id}
                    item={item}
                    active={active?.id === item.id}
                    pinned={isPinned(item.id)}
                    onTogglePin={() => toggle(item.id)}
                  />
                ))}
              </NavSection>
            ))}
          </>
        )}
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <p className="flex items-center gap-1.5 px-2 text-2xs text-muted-foreground">
          <Kbd>{modKeyLabel()}B</Kbd> collapses to icons
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <SidebarGroup className="py-2 first:pt-1">
      <SidebarGroupLabel className="h-7 px-2 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-px">{children}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function NavRow({
  item,
  active,
  pinned,
  recent = false,
  onTogglePin,
}: {
  item: NavItem
  active: boolean
  pinned: boolean
  recent?: boolean
  onTogglePin: () => void
}) {
  const Icon = item.icon
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        size="sm"
        isActive={active}
        tooltip={item.label}
        className={cn(
          "h-7 rounded-md text-sm hover:bg-row-hover hover:text-sidebar-foreground data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground data-active:[&_svg]:text-primary [&_svg]:text-muted-foreground",
          recent && "text-muted-foreground",
        )}
      >
        <ShellLink href={item.href} aria-current={active ? "page" : undefined}>
          {Icon ? <Icon strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" /> : null}
          <span className="flex-1 truncate">{item.label}</span>
          {item.count != null && (
            <span className="ml-auto font-mono text-2xs text-muted-foreground tabular-nums group-data-[collapsible=icon]:hidden">
              {item.count}
            </span>
          )}
        </ShellLink>
      </SidebarMenuButton>
      <SidebarMenuAction
        showOnHover={!pinned}
        aria-label={pinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
        aria-pressed={pinned}
        onClick={onTogglePin}
        className="top-1 text-muted-foreground"
      >
        <StarIcon
          className={cn("size-3.5", pinned && "fill-current text-primary")}
          strokeWidth={1.5}
          absoluteStrokeWidth
          aria-hidden="true"
        />
      </SidebarMenuAction>
    </SidebarMenuItem>
  )
}
