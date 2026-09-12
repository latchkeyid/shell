import * as React from "react"

import { cn } from "@/lib/utils"

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "accent"

const tones: Record<StatusTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
  neutral: "text-muted-foreground",
  accent: "text-primary",
}

export interface StatusDotProps extends React.ComponentProps<"span"> {
  tone: StatusTone
  /** Visible label; status is never colour-only. */
  children: React.ReactNode
  /** Hide the halo (dense contexts). */
  plain?: boolean
}

/** 6px dot with a 3px halo plus text. Colour carries tone; the text carries meaning. */
export function StatusDot({ tone, children, plain = false, className, ...props }: StatusDotProps) {
  return (
    <span
      data-slot="status-dot"
      data-tone={tone}
      className={cn("inline-flex items-center gap-1.5 text-sm", tones[tone], className)}
      {...props}
    >
      <span
        data-slot={plain ? undefined : "status-dot-glyph"}
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-current"
      />
      <span className="text-foreground">{children}</span>
    </span>
  )
}
