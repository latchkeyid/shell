import * as React from "react"
import { ArrowUpRightIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import { Button } from "../components/ui/button"
import { Kbd } from "../components/ui/kbd"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/ui/sheet"
import { readJson, writeJson } from "../lib/storage"
import { cn } from "../lib/utils"
import { ShellLink } from "../shell/link"
import { useShellOptional } from "../shell/shell-context"

export const DETAIL_SHEET_MIN = 400
export const DETAIL_SHEET_MAX = 720
const WIDTH_KEY = "shell.detail-sheet.width"

export function clampSheetWidth(width: number): number {
  return Math.min(DETAIL_SHEET_MAX, Math.max(DETAIL_SHEET_MIN, Math.round(width)))
}

/** Read `?panel=` from the current URL. */
export function readPanelParam(search: string = typeof window === "undefined" ? "" : window.location.search, param = "panel"): string | undefined {
  return new URLSearchParams(search).get(param) ?? undefined
}

/** Return the current path with `?panel=<id>` set, or removed when id is null. */
export function withPanelParam(id: string | null, param = "panel", href?: string): string {
  const base = href ?? (typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}${window.location.hash}`)
  const url = new URL(base, "http://shell.local")
  if (id) url.searchParams.set(param, id)
  else url.searchParams.delete(param)
  return `${url.pathname}${url.search}${url.hash}`
}

export interface DetailSheetProps {
  /** The open record's id; null closes the sheet. Mirrors `?panel=<id>`. */
  panelId: string | null
  onPanelChange: (id: string | null) => void
  title: React.ReactNode
  description?: React.ReactNode
  /** "Open full page" escape hatch. */
  fullPageHref?: string
  /** ↑/↓ or j/k between rows. */
  onPrevious?: () => void
  onNext?: () => void
  /** Query param name. Default "panel". */
  param?: string
  /** Sync the param through the shell's onNavigate. Default true when inside AppShell. */
  syncUrl?: boolean
  children: React.ReactNode
  className?: string
}

/** Right-hand record detail: resizable 400–720px with the width remembered, route-synced. */
export function DetailSheet({
  panelId,
  onPanelChange,
  title,
  description,
  fullPageHref,
  onPrevious,
  onNext,
  param = "panel",
  syncUrl,
  children,
  className,
}: DetailSheetProps) {
  const shell = useShellOptional()
  const shouldSync = syncUrl ?? Boolean(shell)
  const [width, setWidth] = React.useState(() => clampSheetWidth(readJson<number>(WIDTH_KEY, 480)))
  const dragging = React.useRef<{ startX: number; startWidth: number } | null>(null)
  const open = panelId != null

  // Keep ?panel= in step with the open record.
  React.useEffect(() => {
    if (!shouldSync || typeof window === "undefined") return
    const current = readPanelParam(window.location.search, param)
    if (current === (panelId ?? undefined)) return
    const next = withPanelParam(panelId, param)
    if (shell) shell.navigate(next)
    else window.history.replaceState(window.history.state, "", next)
  }, [panelId, param, shouldSync, shell])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = { startX: event.clientX, startWidth: width }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    setWidth(clampSheetWidth(dragging.current.startWidth - (event.clientX - dragging.current.startX)))
  }
  const onPointerUp = () => {
    if (!dragging.current) return
    dragging.current = null
    writeJson(WIDTH_KEY, width)
  }

  return (
    // Non-modal: the list stays visible and clickable while browsing rows.
    <Sheet open={open} modal={false} onOpenChange={(next) => !next && onPanelChange(null)}>
      <SheetContent
        side="right"
        data-slot="detail-sheet"
        style={{ width, maxWidth: "100vw" }}
        className={cn("gap-0 border-l shadow-lift sm:max-w-none", className)}
        onInteractOutside={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget && (event.target as HTMLElement).closest("input, textarea, [contenteditable]")) return
          if ((event.key === "ArrowUp" || event.key === "k") && onPrevious) {
            event.preventDefault()
            onPrevious()
          } else if ((event.key === "ArrowDown" || event.key === "j") && onNext) {
            event.preventDefault()
            onNext()
          }
        }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panel"
          aria-valuemin={DETAIL_SHEET_MIN}
          aria-valuemax={DETAIL_SHEET_MAX}
          aria-valuenow={width}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") setWidth((w) => clampSheetWidth(w + 16))
            if (event.key === "ArrowRight") setWidth((w) => clampSheetWidth(w - 16))
          }}
          className="absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize outline-none hover:bg-primary/20 focus-visible:bg-primary/30"
        />
        <SheetHeader className="gap-1 border-b pr-12">
          <div className="flex items-center gap-1">
            {(onPrevious || onNext) && (
              <span className="flex items-center">
                <Button variant="ghost" size="icon-xs" aria-label="Previous row" disabled={!onPrevious} onClick={onPrevious}>
                  <ChevronUpIcon />
                </Button>
                <Button variant="ghost" size="icon-xs" aria-label="Next row" disabled={!onNext} onClick={onNext}>
                  <ChevronDownIcon />
                </Button>
                <span className="ml-1 hidden text-2xs text-muted-foreground sm:inline">
                  <Kbd>j</Kbd> <Kbd>k</Kbd>
                </span>
              </span>
            )}
            {fullPageHref && (
              <Button asChild variant="ghost" size="xs" className="ml-auto text-muted-foreground">
                <ShellLink href={fullPageHref}>
                  Open full page
                  <ArrowUpRightIcon />
                </ShellLink>
              </Button>
            )}
          </div>
          <SheetTitle className="truncate text-base">{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">Record details</SheetDescription>
          )}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
