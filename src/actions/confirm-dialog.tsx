import * as React from "react"

import { Button } from "../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { InlineMessage } from "./inline-message"

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Tier 2: Cancel-focused dialog. Tier 3: also gated on typing the resource name. */
  tier?: 2 | 3
  title: React.ReactNode
  description?: React.ReactNode
  /** Verb + noun: "Revoke session", "Delete runbook". */
  confirmLabel: string
  cancelLabel?: string
  /** Tier 3 only: the exact name the user must type. */
  resourceName?: string
  destructive?: boolean
  /** Resolves when done; the dialog closes on success and shows the error inline otherwise. */
  onConfirm: () => void | Promise<void>
  children?: React.ReactNode
}

/**
 * Stakes-proportional confirmation. Focus lands on Cancel, the primary is
 * a verb+noun, and Enter never confirms.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  tier = 2,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  resourceName,
  destructive = true,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const [typed, setTyped] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputId = React.useId()

  React.useEffect(() => {
    if (!open) {
      setTyped("")
      setError(null)
      setPending(false)
    }
  }, [open])

  const gated = tier === 3 && resourceName != null
  const ready = !pending && (!gated || typed.trim() === resourceName)

  const confirm = async () => {
    if (!ready) return
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="confirm-dialog"
        data-tier={tier}
        role="alertdialog"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          cancelRef.current?.focus()
        }}
        onKeyDown={(event) => {
          // Enter never confirms; Space on the focused button still does.
          if (event.key === "Enter") event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {gated && (
          <div className="grid gap-2">
            <Label htmlFor={inputId}>
              Type <span className="font-mono text-xs">{resourceName}</span> to confirm
            </Label>
            <Input
              id={inputId}
              value={typed}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setTyped(event.target.value)}
              aria-describedby={error ? `${inputId}-error` : undefined}
            />
          </div>
        )}
        {error && (
          <InlineMessage tone="error" id={`${inputId}-error`}>
            {error}
          </InlineMessage>
        )}
        <DialogFooter>
          <Button ref={cancelRef} variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!ready}
            aria-busy={pending || undefined}
            onClick={confirm}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90" : undefined}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
