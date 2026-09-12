import * as React from "react"
import { AlertCircleIcon, AlertTriangleIcon, CheckCircle2Icon, InfoIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type InlineMessageTone = "error" | "warning" | "info" | "success"

const tones: Record<InlineMessageTone, { icon: typeof InfoIcon; className: string; role: "alert" | "status" }> = {
  error: { icon: AlertCircleIcon, className: "border-destructive-border bg-destructive-muted text-destructive", role: "alert" },
  warning: { icon: AlertTriangleIcon, className: "border-warning-border bg-warning-muted text-warning", role: "alert" },
  info: { icon: InfoIcon, className: "border-info-border bg-info-muted text-info", role: "status" },
  success: { icon: CheckCircle2Icon, className: "border-success-border bg-success-muted text-success", role: "status" },
}

export interface InlineMessageProps extends Omit<React.ComponentProps<"div">, "title"> {
  tone?: InlineMessageTone
  title?: React.ReactNode
  /** A retry button or a link to fix the state. */
  action?: React.ReactNode
  onDismiss?: () => void
}

/** Persistent inline note for failures and actionable states. Toasts are for acknowledgments. */
export function InlineMessage({ tone = "error", title, action, onDismiss, className, children, ...props }: InlineMessageProps) {
  const config = tones[tone]
  const Icon = config.icon
  return (
    <div
      data-slot="inline-message"
      data-tone={tone}
      role={config.role}
      className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm", config.className, className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      <div className="grid min-w-0 flex-1 gap-0.5 text-foreground">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="leading-normal text-foreground/80">{children}</div>}
        {action && <div className="pt-1.5">{action}</div>}
      </div>
      {onDismiss && (
        <Button variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={onDismiss} className="-mr-1 text-current hover:text-current">
          <XIcon />
        </Button>
      )}
    </div>
  )
}
