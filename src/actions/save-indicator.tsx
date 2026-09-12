import * as React from "react"
import { AlertCircleIcon, CheckIcon, Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

export type SaveState = "idle" | "saving" | "saved" | "error"

export interface SaveIndicatorProps extends React.ComponentProps<"span"> {
  state: SaveState
  /** Copy for the saved state. Default "Saved". */
  savedLabel?: string
  errorLabel?: string
}

/** Inline autosave status for imperative controls (toggles, selects). Never a toast. */
export function SaveIndicator({ state, savedLabel = "Saved", errorLabel = "Not saved", className, ...props }: SaveIndicatorProps) {
  return (
    <span
      data-slot="save-indicator"
      data-state={state}
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex h-5 items-center gap-1 text-xs transition-opacity",
        state === "idle" && "opacity-0",
        state === "saving" && "text-muted-foreground",
        state === "saved" && "text-success",
        state === "error" && "text-destructive",
        className,
      )}
      {...props}
    >
      {state === "saving" && (
        <>
          <Loader2Icon className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Saving…
        </>
      )}
      {state === "saved" && (
        <>
          <CheckIcon className="size-3" aria-hidden="true" />
          {savedLabel}
        </>
      )}
      {state === "error" && (
        <>
          <AlertCircleIcon className="size-3" aria-hidden="true" />
          {errorLabel}
        </>
      )}
    </span>
  )
}

/** Drives a SaveIndicator: call `save(fn)`; "saved" clears back to idle after 2s. */
export function useSaveState(resetMs = 2000) {
  const [state, setState] = React.useState<SaveState>("idle")
  const timer = React.useRef<number | undefined>(undefined)

  React.useEffect(() => () => window.clearTimeout(timer.current), [])

  const save = React.useCallback(
    async (fn: () => Promise<void> | void) => {
      window.clearTimeout(timer.current)
      setState("saving")
      try {
        await fn()
        setState("saved")
        timer.current = window.setTimeout(() => setState("idle"), resetMs)
      } catch {
        setState("error")
      }
    },
    [resetMs],
  )

  return { state, save }
}
