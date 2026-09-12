import * as React from "react"

import { cn } from "@/lib/utils"

export interface MetricProps extends React.ComponentProps<"div"> {
  label: React.ReactNode
  value: React.ReactNode
  /** Secondary line: delta, unit, period. */
  detail?: React.ReactNode
}

/** KPI tile text style: 24–32px, tabular-nums, medium. Not a heading. */
export function Metric({ label, value, detail, className, ...props }: MetricProps) {
  return (
    <div data-slot="metric" className={cn("grid gap-0.5", className)} {...props}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-metric">{value}</span>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </div>
  )
}
