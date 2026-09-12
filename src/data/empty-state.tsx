import * as React from "react"
import { AlertCircleIcon, InboxIcon, LockIcon, SearchXIcon, SparklesIcon, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type EmptyStateVariant = "no-results" | "blank-slate" | "cleared" | "permission" | "error"

const defaults: Record<EmptyStateVariant, { icon: LucideIcon; title: string; description?: string }> = {
  "no-results": { icon: SearchXIcon, title: "No results", description: "Try a different search or clear the filters." },
  "blank-slate": { icon: SparklesIcon, title: "Nothing here yet", description: "Get started by creating your first item." },
  cleared: { icon: InboxIcon, title: "All clear", description: "Nothing needs your attention." },
  permission: { icon: LockIcon, title: "You do not have access", description: "Ask an admin for the right role." },
  error: { icon: AlertCircleIcon, title: "Something went wrong", description: "Try again, or contact support if it keeps happening." },
}

export interface EmptyStateProps extends Omit<React.ComponentProps<"div">, "title"> {
  variant?: EmptyStateVariant
  icon?: LucideIcon
  title?: React.ReactNode
  description?: React.ReactNode
  /** The next step: a button, a link, or a code snippet. No dead ends. */
  action?: React.ReactNode
  /** Compact, for inside tables and cards. */
  size?: "default" | "sm"
}

export function EmptyState({
  variant = "blank-slate",
  icon,
  title,
  description,
  action,
  size = "default",
  className,
  ...props
}: EmptyStateProps) {
  const config = defaults[variant]
  const Icon = icon ?? config.icon
  return (
    <div
      data-slot="empty-state"
      data-variant={variant}
      role={variant === "error" ? "alert" : undefined}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "sm" ? "gap-2 px-4 py-8" : "gap-3 px-6 py-16",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-muted",
          size === "sm" ? "size-8" : "size-10",
          variant === "error" && "bg-destructive-muted text-destructive",
          variant === "permission" && "bg-warning-muted text-warning",
        )}
      >
        <Icon className={cn("text-muted-foreground", size === "sm" ? "size-4" : "size-5", variant === "error" && "text-destructive", variant === "permission" && "text-warning")} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      </span>
      <div className="grid max-w-sm gap-1">
        <p className={cn("font-medium", size === "sm" ? "text-sm" : "text-base")}>{title ?? config.title}</p>
        {(description ?? config.description) && (
          <p className="text-sm leading-normal text-muted-foreground">{description ?? config.description}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}
