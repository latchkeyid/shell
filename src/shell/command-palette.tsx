import * as React from "react"
import { ArrowRightIcon, Building2Icon, CornerDownLeftIcon, LayersIcon, ServerIcon } from "lucide-react"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem as CommandRow,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { useHotkey } from "@/shell/hotkeys"
import { useShell } from "@/shell/shell-context"
import type { CommandItem } from "@/shell/types"

const SEARCH_DEBOUNCE_MS = 250
/** Past this many entries the list is grouped by `group`. */
export const GROUPING_THRESHOLD = 30

/** Recognise a pasted internal URL: "/o/acme/issues" or the same origin with a path. */
export function internalPath(input: string, origin?: string): string | undefined {
  const value = input.trim()
  if (value.startsWith("/") && !value.startsWith("//")) return value
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : undefined)
  if (!base) return undefined
  try {
    const url = new URL(value)
    if (url.origin === base) return `${url.pathname}${url.search}${url.hash}`
  } catch {
    /* not a URL */
  }
  return undefined
}

export function filterCommands(items: CommandItem[], query: string): CommandItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) =>
    [item.label, item.secondary, item.group, ...(item.keywords ?? [])]
      .filter(Boolean)
      .some((text) => text!.toLowerCase().includes(q)),
  )
}

/** ⌘K palette fed by nav pages, async entity search and page-registered actions. */
export function CommandPalette() {
  const shell = useShell()
  const {
    palette,
    setPalette,
    nav,
    registry,
    contextCommands,
    navigate,
    scope,
    environment,
    setOrgSwitcher,
    setScopePicker,
    setEnvironmentPicker,
    session,
  } = shell
  const open = palette.open
  const [query, setQuery] = React.useState("")
  const [stack, setStack] = React.useState<CommandItem[]>([])
  const [results, setResults] = React.useState<CommandItem[]>([])
  const [searching, setSearching] = React.useState(false)

  useHotkey("mod+k", () => setPalette({ open: !open }), { allowInInputs: true, allowInDialogs: true })

  React.useEffect(() => {
    if (open) {
      setQuery(palette.query ?? "")
      setStack([])
    } else {
      setResults([])
    }
  }, [open, palette.query])

  const search = registry.search
  React.useEffect(() => {
    if (!open || !search || query.trim().length < 2 || stack.length > 0) {
      setResults([])
      setSearching(false)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearching(true)
      search(query.trim(), controller.signal)
        .then((found) => {
          if (!controller.signal.aborted) setResults(found)
        })
        .catch(() => {
          if (!controller.signal.aborted) setResults([])
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false)
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [open, search, query, stack.length])

  const close = React.useCallback(() => setPalette({ open: false }), [setPalette])

  const staticItems = React.useMemo<CommandItem[]>(() => {
    const switchers: CommandItem[] = []
    if (session.orgs.length > 1 || session.invitations.length > 0 || session.canCreateOrg || session.staff) {
      switchers.push({
        id: "switch:org",
        label: "Switch organisation…",
        group: "Switch",
        icon: Building2Icon,
        shortcut: "G O",
        keywords: ["org", "organization", "workspace"],
        run: () => setOrgSwitcher({ open: true, query }),
      })
    }
    if (scope) {
      switchers.push({
        id: "switch:scope",
        label: `Switch ${scope.noun}…`,
        group: "Switch",
        icon: LayersIcon,
        shortcut: "G P",
        run: () => setScopePicker({ open: true, query }),
      })
    }
    if (environment) {
      switchers.push({
        id: "switch:environment",
        label: "Switch environment…",
        group: "Switch",
        icon: ServerIcon,
        shortcut: "G E",
        run: () => setEnvironmentPicker({ open: true, query }),
      })
    }
    const pages: CommandItem[] = nav.flatMap((group) =>
      group.items.map((item) => ({
        id: `page:${item.id}`,
        label: `Go to ${item.label}`,
        group: "Pages",
        secondary: group.label,
        icon: item.icon,
        href: item.href,
        keywords: [item.label, group.label, ...(item.keywords ?? [])],
      })),
    )
    return [
      ...contextCommands.map((item) => ({ group: "Actions", ...item })),
      ...switchers,
      ...(registry.pages ?? []),
      ...pages,
    ]
  }, [contextCommands, environment, nav, query, registry.pages, scope, session, setEnvironmentPicker, setOrgSwitcher, setScopePicker])

  const page = stack[stack.length - 1]
  const jump = internalPath(query)
  const visible = React.useMemo(() => {
    if (page) return filterCommands(page.children ?? [], query)
    const list = [...filterCommands(staticItems, query), ...results.map((item) => ({ group: registry.searchGroup ?? "Results", ...item }))]
    if (jump) {
      list.unshift({ id: "jump", label: `Go to ${jump}`, group: "Navigate", icon: ArrowRightIcon, href: jump })
    }
    return list
  }, [page, staticItems, results, query, jump, registry.searchGroup])

  const grouped = React.useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    const groupAll = visible.length > GROUPING_THRESHOLD || results.length > 0 || contextCommands.length > 0
    for (const item of visible) {
      const key = groupAll ? (item.group ?? "Commands") : ""
      const bucket = map.get(key)
      if (bucket) bucket.push(item)
      else map.set(key, [item])
    }
    return [...map.entries()]
  }, [visible, results.length, contextCommands.length])

  const run = (item: CommandItem) => {
    if (item.children) {
      setStack((prev) => [...prev, item])
      setQuery("")
      return
    }
    close()
    if (item.run) item.run()
    else if (item.href) navigate(item.href)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => setPalette({ open: next })}
      title="Command palette"
      description="Search pages, entities and actions."
      className="max-w-xl"
    >
      <Command shouldFilter={false} loop label="Command palette">
        <CommandInput
          placeholder={page ? `${page.label}…` : (registry.placeholder ?? "Search or jump to…")}
          value={query}
          onValueChange={setQuery}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && query === "" && stack.length > 0) {
              event.preventDefault()
              setStack((prev) => prev.slice(0, -1))
            }
          }}
        />
        <CommandList className="max-h-96">
          {visible.length === 0 && !searching && (
            <CommandEmpty>{query ? `Nothing matches “${query.trim()}”` : "Type to search"}</CommandEmpty>
          )}
          {searching && visible.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground" aria-live="polite">
              Searching…
            </p>
          )}
          {grouped.map(([group, items]) => (
            <CommandGroup key={group || "all"} heading={group || undefined}>
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <CommandRow key={item.id} value={item.id} keywords={item.keywords} onSelect={() => run(item)}>
                    {Icon ? (
                      <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
                    ) : (
                      <CornerDownLeftIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.secondary && <span className="truncate text-xs text-muted-foreground">{item.secondary}</span>}
                    {item.shortcut && (
                      <CommandShortcut className="tracking-normal">
                        <Kbd>{item.shortcut}</Kbd>
                      </CommandShortcut>
                    )}
                  </CommandRow>
                )
              })}
            </CommandGroup>
          ))}
        </CommandList>
        <div className="flex items-center gap-3 border-t px-3 py-2 text-2xs text-muted-foreground">
          <span>
            <Kbd>↑↓</Kbd> move
          </span>
          <span>
            <Kbd>⏎</Kbd> select
          </span>
          {stack.length > 0 && (
            <span>
              <Kbd>⌫</Kbd> back
            </span>
          )}
          <span className="ml-auto">
            <Kbd>esc</Kbd> close
          </span>
        </div>
      </Command>
    </CommandDialog>
  )
}
