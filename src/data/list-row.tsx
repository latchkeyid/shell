import * as React from "react"

import { cn } from "../lib/utils"
import { ShellLink } from "../shell/link"

export interface ListRowProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** Navigates when set; otherwise onClick makes the row a button. */
  href?: string
  onClick?: () => void
  /** Leading status glyph: a StatusDot, Level, or icon. */
  status?: React.ReactNode
  /** Primary text. */
  title: React.ReactNode
  /** Inline 12px muted metadata under the title. */
  meta?: React.ReactNode
  /** Right-aligned columns (counts, times). */
  trailing?: React.ReactNode
  /** Actions revealed on hover or focus. */
  actions?: React.ReactNode
  selected?: boolean
  /** Left border tint. */
  tone?: "danger" | "warning"
}

/** Whole-row clickable list item for streams and histories. */
export function ListRow({
  href,
  onClick,
  status,
  title,
  meta,
  trailing,
  actions,
  selected = false,
  tone,
  className,
  ...props
}: ListRowProps) {
  const body = (
    <>
      {status && <span className="flex shrink-0 items-center pt-px">{status}</span>}
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate text-sm">{title}</span>
        {meta && <span className="truncate text-xs text-muted-foreground">{meta}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground tabular-nums">{trailing}</span>}
    </>
  )
  const surfaceClass =
    "flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-left outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"

  return (
    <div
      data-slot="list-row"
      data-state={selected ? "selected" : undefined}
      data-tone={tone}
      className={cn(
        "group/list-row relative flex items-stretch border-b border-b-border-soft last:border-b-0 hover:bg-row-hover data-[state=selected]:bg-row-selected",
        tone === "danger" && "shadow-[inset_2px_0_0_var(--destructive)]",
        tone === "warning" && "shadow-[inset_2px_0_0_var(--warning)]",
        className,
      )}
      {...props}
    >
      {href ? (
        <ShellLink href={href} aria-current={selected ? "true" : undefined} className={surfaceClass}>
          {body}
        </ShellLink>
      ) : onClick ? (
        <button type="button" onClick={onClick} aria-pressed={selected || undefined} className={surfaceClass}>
          {body}
        </button>
      ) : (
        <div className={surfaceClass}>{body}</div>
      )}
      {actions && (
        <div
          data-slot="list-row-actions"
          className="flex shrink-0 items-center gap-1 pr-2 opacity-0 transition-opacity group-focus-within/list-row:opacity-100 group-hover/list-row:opacity-100"
        >
          {actions}
        </div>
      )}
    </div>
  )
}

export function ListRows({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="list-rows" role="list" className={cn("overflow-hidden rounded-lg border bg-card", className)} {...props} />
}
