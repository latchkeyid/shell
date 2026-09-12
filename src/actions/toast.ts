import { toast as sonner, type ExternalToast } from "sonner"

export const UNDO_TOAST_MS = 8000

/** sonner's toast, re-exported so apps import one thing. Acknowledgments only. */
export const toast = sonner

export interface UndoToastOptions extends ExternalToast {
  /** Called if the user clicks Undo before the toast expires. */
  onUndo: () => void | Promise<void>
  undoLabel?: string
}

/** "Issue resolved · Undo" for 8 seconds. Failures never go here; use InlineMessage. */
export function toastUndo(message: string, { onUndo, undoLabel = "Undo", duration = UNDO_TOAST_MS, ...options }: UndoToastOptions) {
  return sonner(message, {
    duration,
    action: {
      label: undoLabel,
      onClick: () => void onUndo(),
    },
    ...options,
  })
}

/** Autosave acknowledgment for imperative controls. */
export function toastSaved(message = "Saved") {
  return sonner.success(message, { duration: 2000 })
}
