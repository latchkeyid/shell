import * as React from "react"
import { CheckIcon, PlusIcon } from "lucide-react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ScopeItem } from "@/shell/types"

export interface ScopePickerProps {
  /** Noun used in copy: "project", "team", "tenant", "environment". */
  noun: string
  items: ScopeItem[]
  current?: string
  /** Renders an "All …" row that selects null. */
  allLabel?: string
  recent?: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (item: ScopeItem | null) => void
  onCreate?: () => void
  createLabel?: string
  initialQuery?: string
  /** Hide the search input for short lists (environments). */
  searchable?: boolean
  side?: "bottom" | "right"
  children: React.ReactNode
}

/** Popover + Command picker shared by the sub-scope crumb, the env chip and the palette. */
export function ScopePicker({
  noun,
  items,
  current,
  allLabel,
  recent = [],
  open,
  onOpenChange,
  onSelect,
  onCreate,
  createLabel,
  initialQuery = "",
  searchable = true,
  side = "bottom",
  children,
}: ScopePickerProps) {
  const [query, setQuery] = React.useState(initialQuery)
  React.useEffect(() => {
    if (open) setQuery(initialQuery)
  }, [open, initialQuery])

  const pick = (item: ScopeItem | null) => {
    onOpenChange(false)
    onSelect(item)
  }
  const recentItems = recent
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is ScopeItem => Boolean(item) && item?.id !== current)
    .slice(0, 3)

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        sideOffset={4}
        aria-label={`Switch ${noun}`}
        className="w-64 gap-0 overflow-hidden rounded-lg p-0"
      >
        <Command
          loop
          label={`Switch ${noun}`}
          defaultValue={current ? `${noun}:${current}` : allLabel ? `${noun}:all` : undefined}
          className="rounded-none bg-transparent p-0"
        >
          {searchable && (
            <CommandInput
              autoFocus
              placeholder={`Find ${noun}…`}
              value={query}
              onValueChange={setQuery}
            />
          )}
          <CommandList className="max-h-72">
            <CommandEmpty>No {noun} matches “{query}”</CommandEmpty>
            {recentItems.length > 0 && !query && (
              <CommandGroup heading="Recent">
                {recentItems.map((item) => (
                  <ScopeRow key={`recent-${item.id}`} noun={noun} item={item} prefix="recent:" onSelect={pick} />
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading={query ? undefined : `${capitalize(noun)}s`}>
              {allLabel && (
                <CommandItem value={`${noun}:all`} keywords={[allLabel, "all"]} onSelect={() => pick(null)}>
                  <span className="flex-1 truncate">{allLabel}</span>
                  {current === undefined && <CheckIcon className="size-4 text-primary" aria-hidden="true" />}
                </CommandItem>
              )}
              {items.map((item) => (
                <ScopeRow key={item.id} noun={noun} item={item} current={item.id === current} onSelect={pick} />
              ))}
            </CommandGroup>
            {onCreate && !query && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value={`${noun}:create`}
                    onSelect={() => {
                      onOpenChange(false)
                      onCreate()
                    }}
                  >
                    <PlusIcon />
                    {createLabel ?? `Create ${noun}`}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ScopeRow({
  noun,
  item,
  current = false,
  prefix = "",
  onSelect,
}: {
  noun: string
  item: ScopeItem
  current?: boolean
  prefix?: string
  onSelect: (item: ScopeItem) => void
}) {
  const Icon = item.icon
  return (
    <CommandItem
      value={`${prefix}${noun}:${item.id}`}
      keywords={[item.label, item.secondary ?? ""]}
      disabled={item.disabled}
      aria-current={current ? "true" : undefined}
      onSelect={() => onSelect(item)}
      className={cn(current && "bg-accent-soft/70")}
    >
      {Icon && <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />}
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate" title={item.label}>
          {item.label}
        </span>
        {item.secondary && <span className="truncate text-2xs text-muted-foreground">{item.secondary}</span>}
      </span>
      {item.tag && (
        <Badge variant="outline" className="h-4 px-1.5 text-2xs">
          {item.tag}
        </Badge>
      )}
      {current && <CheckIcon className="size-4 text-primary" aria-hidden="true" />}
    </CommandItem>
  )
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
