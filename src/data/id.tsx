import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import { cn } from "../lib/utils"
import { truncateId } from "./formatters"
import { useAnnounce } from "../shell/live-region"

export interface IdProps extends Omit<React.ComponentProps<"button">, "value" | "children"> {
  value: string
  /** Shorten long values: "a1b2c3d4…ef56". The full value is copied and in the title. */
  truncate?: boolean | { head?: number; tail?: number }
  /** Copy on click. Default true. */
  copy?: boolean
}

/** Identifier in mono at 12.5px with slashed zero; click copies the full value. */
export function Id({ value, truncate = false, copy = true, className, onClick, ...props }: IdProps) {
  const [copied, setCopied] = React.useState(false)
  const announce = useAnnounce()
  const display = truncate
    ? truncateId(value, typeof truncate === "object" ? truncate.head : undefined, typeof truncate === "object" ? truncate.tail : undefined)
    : value

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || !copy) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      announce("Copied to clipboard")
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  if (!copy) {
    return (
      <code data-slot="id" title={value} className={cn("font-mono text-[12.5px] tabular-nums", className)}>
        {display}
      </code>
    )
  }

  return (
    <button
      type="button"
      data-slot="id"
      title={value}
      aria-label={`Copy ${value}`}
      onClick={handleCopy}
      className={cn(
        "group/id inline-flex max-w-full items-center gap-1 rounded-sm font-mono text-[12.5px] tabular-nums outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      <span className="truncate">{display}</span>
      {copied ? (
        <CheckIcon className="size-3 shrink-0 text-success" aria-hidden="true" />
      ) : (
        <CopyIcon
          className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/id:opacity-100 group-focus-visible/id:opacity-100"
          aria-hidden="true"
        />
      )}
    </button>
  )
}
