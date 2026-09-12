import * as React from "react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleMinusIcon,
  InfoIcon,
  OctagonAlertIcon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

export type LevelValue = "fatal" | "error" | "warning" | "info" | "debug" | "ok" | "failed" | "skipped"

const levels: Record<LevelValue, { icon: LucideIcon; className: string; label: string }> = {
  fatal: { icon: OctagonAlertIcon, className: "text-destructive", label: "Fatal" },
  error: { icon: XCircleIcon, className: "text-destructive", label: "Error" },
  warning: { icon: AlertTriangleIcon, className: "text-warning", label: "Warning" },
  info: { icon: InfoIcon, className: "text-info", label: "Info" },
  debug: { icon: InfoIcon, className: "text-muted-foreground", label: "Debug" },
  ok: { icon: CheckCircle2Icon, className: "text-success", label: "OK" },
  failed: { icon: XCircleIcon, className: "text-destructive", label: "Failed" },
  skipped: { icon: CircleMinusIcon, className: "text-muted-foreground", label: "Skipped" },
}

export interface LevelProps extends React.ComponentProps<"span"> {
  level: LevelValue
  /** Override the visible label. */
  label?: string
}

/** 16px icon plus text for error/warning/info and run outcomes. */
export function Level({ level, label, className, ...props }: LevelProps) {
  const config = levels[level]
  const Icon = config.icon
  return (
    <span
      data-slot="level"
      data-level={level}
      className={cn("inline-flex items-center gap-1.5 text-sm", className)}
      {...props}
    >
      <Icon className={cn("size-4 shrink-0", config.className)} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      <span>{label ?? config.label}</span>
    </span>
  )
}
