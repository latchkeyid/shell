import * as React from "react"
import { SearchIcon } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb"
import { Button } from "../components/ui/button"
import { Kbd } from "../components/ui/kbd"
import { Separator } from "../components/ui/separator"
import { SidebarTrigger } from "../components/ui/sidebar"
import { modKeyLabel } from "../lib/text"
import { cn } from "../lib/utils"
import { AccountMenu } from "./account-menu"
import { ShellLink } from "./link"
import { ScopeChain } from "./scope-chain"
import { useShell } from "./shell-context"

export interface Crumb {
  label: string
  href?: string
}

export interface PageActionBarProps extends Omit<React.ComponentProps<"header">, "title"> {
  /** Page breadcrumbs rendered after the scope chain; the last one is the current page. */
  breadcrumbs?: Crumb[]
  /** Tabs for entity sub-views (Overview / Sessions / …). */
  tabs?: React.ReactNode
  /** Page actions, left of the ⌘K chip and the account menu. */
  actions?: React.ReactNode
  /** Placeholder for the ⌘K chip; apps narrow it to their entities. */
  searchPlaceholder?: string
}

/** Sticky 48px glassy bar at the top of the content pane. */
export function PageActionBar({
  breadcrumbs = [],
  tabs,
  actions,
  searchPlaceholder = "Search or jump to…",
  className,
  children,
  ...props
}: PageActionBarProps) {
  const { setPalette, switching } = useShell()

  return (
    <header
      data-slot="page-action-bar"
      className={cn(
        "sticky top-0 z-(--z-action-bar) flex h-12 shrink-0 items-center gap-2 border-b px-3",
        className,
      )}
      {...props}
    >
      <SidebarTrigger aria-label="Toggle sidebar" className="-ml-1 text-muted-foreground" />
      <Separator orientation="vertical" className="h-4" />
      <ScopeChain />
      {breadcrumbs.length > 0 && (
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap gap-1 sm:gap-1">
            {breadcrumbs.map((crumb, index) => {
              const last = index === breadcrumbs.length - 1
              return (
                <React.Fragment key={`${crumb.label}-${index}`}>
                  <BreadcrumbSeparator className="text-muted-foreground/60 [&>svg]:size-3">/</BreadcrumbSeparator>
                  <BreadcrumbItem className="min-w-0">
                    {last || !crumb.href ? (
                      <BreadcrumbPage className="truncate text-sm font-medium">{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild className="truncate text-sm">
                        <ShellLink href={crumb.href}>{crumb.label}</ShellLink>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      {tabs && (
        <div data-slot="page-tabs" className="ml-2 flex min-w-0 items-center">
          {tabs}
        </div>
      )}
      {children}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {actions}
        <Button
          variant="outline"
          size="sm"
          aria-label={searchPlaceholder}
          aria-keyshortcuts="Meta+K Control+K"
          data-slot="command-chip"
          onClick={() => setPalette({ open: true })}
          className="hidden h-8 w-56 justify-start gap-2 pr-1.5 pl-2.5 font-normal text-muted-foreground shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] hover:text-muted-foreground md:flex"
        >
          <SearchIcon className="size-3.5" strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
          <span className="flex-1 truncate text-left text-xs">{searchPlaceholder}</span>
          <Kbd>{modKeyLabel()}K</Kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={searchPlaceholder}
          onClick={() => setPalette({ open: true })}
          className="md:hidden"
        >
          <SearchIcon strokeWidth={1.5} absoluteStrokeWidth />
        </Button>
        <AccountMenu />
      </div>
      {switching && (
        <div
          role="progressbar"
          aria-label="Switching organisation"
          aria-valuetext="Loading"
          className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-primary/20"
        >
          <div className="h-full w-1/3 animate-[shell-indeterminate_1.2s_ease-in-out_infinite] bg-primary motion-reduce:w-full motion-reduce:animate-none" />
        </div>
      )}
    </header>
  )
}

/** Page title for the content area; the shell moves focus here after a switch. */
export function PageTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="page-title"
      tabIndex={-1}
      className={cn("text-base font-semibold tracking-tight outline-none", className)}
      {...props}
    />
  )
}
