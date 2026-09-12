import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { Button } from "../components/ui/button"
import { Separator } from "../components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/ui/sheet"
import { useIsMobile } from "../hooks/use-mobile"
import { cn } from "../lib/utils"
import { useChord } from "./hotkeys"
import { ShellLink } from "./link"
import { OrgAvatar } from "./org-avatar"
import { resolveCurrentScope } from "./org-switcher"
import { ScopePicker } from "./scope-picker"
import { useShell } from "./shell-context"
import type { EnvironmentOption, ScopeItem } from "./types"

const toneDot: Record<NonNullable<EnvironmentOption["tone"]>, string> = {
  warning: "bg-warning",
  info: "bg-info",
  neutral: "bg-muted-foreground",
}

/**
 * Org crumb → sub-scope crumb (switchable) → optional environment chip.
 * Chords: G then P opens the sub-scope picker, G then E the environment.
 */
export function ScopeChain({ className }: { className?: string }) {
  const shell = useShell()
  const { session, paths, scope, environment, scopePicker, setScopePicker, environmentPicker, setEnvironmentPicker } = shell
  const current = React.useMemo(() => resolveCurrentScope(session), [session])
  const isMobile = useIsMobile()
  const [compound, setCompound] = React.useState(false)

  useChord("g", "p", () => (isMobile ? setCompound(true) : setScopePicker({ open: true })), { enabled: Boolean(scope) })
  useChord("g", "e", () => (isMobile ? setCompound(true) : setEnvironmentPicker({ open: true })), {
    enabled: Boolean(environment),
  })

  if (!current) return null

  const scopeItem = scope?.items.find((item) => item.id === scope.current)
  const scopeLabel = scopeItem?.label ?? scope?.allLabel ?? (scope ? `Choose ${scope.noun}` : "")
  const envOption = environment?.options.find((option) => option.id === environment.current)
  const envLabel = envOption?.label ?? "all"
  const envItems: ScopeItem[] = environment?.options.map((option) => ({ id: option.id, label: option.label })) ?? []

  if (isMobile) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          aria-haspopup="dialog"
          aria-label="Change scope"
          onClick={() => setCompound(true)}
          className={cn("min-w-0 gap-1.5", className)}
        >
          <OrgAvatar name={current.name} src={current.avatarUrl} size={16} />
          <span className="truncate">
            {current.name}
            {scope && ` / ${scopeLabel}`}
            {environment && ` / ${envLabel}`}
          </span>
          <ChevronDownIcon className="size-3" aria-hidden="true" />
        </Button>
        <Sheet open={compound} onOpenChange={setCompound}>
          <SheetContent side="bottom" className="gap-4 p-4">
            <SheetHeader className="p-0">
              <SheetTitle>Scope</SheetTitle>
              <SheetDescription>{current.name}</SheetDescription>
            </SheetHeader>
            {scope && (
              <ScopeList
                label={`${capitalize(scope.noun)}`}
                items={scope.items}
                current={scope.current}
                allLabel={scope.allLabel}
                onSelect={(item) => {
                  setCompound(false)
                  scope.onSelect(item)
                }}
              />
            )}
            {environment && (
              <ScopeList
                label="Environment"
                items={envItems}
                current={environment.current}
                allLabel="All environments"
                onSelect={(item) => {
                  setCompound(false)
                  environment.onSelect(item?.id ?? null)
                }}
              />
            )}
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <nav aria-label="Scope" className={cn("flex h-8 min-w-0 items-center gap-1", className)}>
      <ShellLink
        href={paths.orgHome(current.slug)}
        className="flex h-7 max-w-40 items-center gap-1.5 rounded-md px-1.5 text-sm text-muted-foreground hover:bg-row-hover hover:text-foreground"
        title={current.name}
      >
        <OrgAvatar name={current.name} src={current.avatarUrl} size={16} />
        <span className="truncate">{current.name}</span>
      </ShellLink>

      {scope && (
        <>
          <span className="text-muted-foreground/60" aria-hidden="true">
            /
          </span>
          <span className="flex h-7 max-w-52 items-center rounded-md border bg-card shadow-xs">
            <ShellLink
              href={scope.href ?? paths.orgHome(current.slug)}
              className="min-w-0 truncate py-1 pl-2 text-sm font-medium hover:text-primary"
              title={scopeLabel}
            >
              {scopeLabel}
            </ShellLink>
            {scopeItem?.tag && (
              <span className="ml-1.5 rounded-sm border px-1 text-2xs text-muted-foreground">{scopeItem.tag}</span>
            )}
            <ScopePicker
              noun={scope.noun}
              items={scope.items}
              current={scope.current}
              allLabel={scope.allLabel}
              recent={scope.recent}
              open={scopePicker.open}
              onOpenChange={(open) => setScopePicker({ open })}
              onSelect={scope.onSelect}
              onCreate={scope.onCreate}
              createLabel={scope.createLabel}
              initialQuery={scopePicker.query}
            >
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={`Switch ${scope.noun}`}
                title={`Switch ${scope.noun} (G then P)`}
                className="flex size-6 shrink-0 items-center justify-center rounded-r-md text-muted-foreground outline-none hover:bg-row-hover hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ChevronDownIcon className="size-3" aria-hidden="true" />
              </button>
            </ScopePicker>
          </span>
        </>
      )}

      {environment && (
        <>
          <Separator orientation="vertical" className="mx-1 h-4" />
          <ScopePicker
            noun="environment"
            items={envItems}
            current={environment.current}
            allLabel="All environments"
            open={environmentPicker.open}
            onOpenChange={(open) => setEnvironmentPicker({ open })}
            onSelect={(item) => environment.onSelect(item?.id ?? null)}
            initialQuery={environmentPicker.query}
            searchable={environment.options.length > 6}
          >
            <Button
              variant="outline"
              size="sm"
              aria-haspopup="dialog"
              aria-label={`Environment: ${envLabel}. Change environment`}
              title="Change environment (G then E)"
              className="h-7 gap-1.5 font-normal"
            >
              {envOption && (
                <span
                  aria-hidden="true"
                  className={cn("size-1.5 rounded-full", toneDot[envOption.tone ?? "neutral"])}
                  data-slot="status-dot-glyph"
                />
              )}
              <span className="text-muted-foreground">Env:</span> {envLabel}
              <ChevronDownIcon className="size-3 text-muted-foreground" aria-hidden="true" />
            </Button>
          </ScopePicker>
        </>
      )}
    </nav>
  )
}

function ScopeList({
  label,
  items,
  current,
  allLabel,
  onSelect,
}: {
  label: string
  items: ScopeItem[]
  current?: string
  allLabel?: string
  onSelect: (item: ScopeItem | null) => void
}) {
  return (
    <div className="grid gap-1">
      <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="grid gap-px">
        {allLabel && (
          <Button variant={current === undefined ? "secondary" : "ghost"} size="sm" className="justify-start" onClick={() => onSelect(null)}>
            {allLabel}
          </Button>
        )}
        {items.map((item) => (
          <Button
            key={item.id}
            variant={item.id === current ? "secondary" : "ghost"}
            size="sm"
            className="justify-start"
            disabled={item.disabled}
            onClick={() => onSelect(item)}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
