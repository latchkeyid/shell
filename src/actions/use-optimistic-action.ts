import * as React from "react"

import { toastUndo, UNDO_TOAST_MS } from "@/actions/toast"

export interface OptimisticActionOptions<TState, TInput> {
  /** Committed state from the app (query cache, store). */
  state: TState
  /** Pure: the state as it should look while the commit is in flight. */
  apply: (state: TState, input: TInput) => TState
  /** Persist. Throw to roll back. */
  commit: (input: TInput) => Promise<void> | void
  /** Reverse a committed action from the Undo toast. */
  undo?: (input: TInput) => Promise<void> | void
  /** Toast copy after a successful commit, e.g. (input) => "Issue resolved". */
  message?: (input: TInput) => string
  undoLabel?: string
  /** Undo window. Default 8000ms. */
  undoDuration?: number
}

export interface OptimisticAction<TState, TInput> {
  /** State to render: optimistic while pending, committed otherwise. */
  state: TState
  run: (input: TInput) => Promise<void>
  pending: boolean
  /** Last failure, for an InlineMessage. Cleared on the next run. */
  error: Error | null
  clearError: () => void
}

/**
 * Tier-1 mutation: apply immediately, commit in the background, offer Undo
 * for 8 seconds. React's useOptimistic rolls the view back on failure.
 */
export function useOptimisticAction<TState, TInput>({
  state,
  apply,
  commit,
  undo,
  message,
  undoLabel,
  undoDuration = UNDO_TOAST_MS,
}: OptimisticActionOptions<TState, TInput>): OptimisticAction<TState, TInput> {
  const [optimistic, applyOptimistic] = React.useOptimistic(state, apply)
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<Error | null>(null)

  const run = React.useCallback(
    (input: TInput) =>
      new Promise<void>((resolve) => {
        setError(null)
        startTransition(async () => {
          applyOptimistic(input)
          try {
            await commit(input)
            if (message) {
              const text = message(input)
              if (undo) {
                toastUndo(text, { onUndo: () => undo(input), undoLabel, duration: undoDuration })
              }
            }
          } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)))
          } finally {
            resolve()
          }
        })
      }),
    [applyOptimistic, commit, message, undo, undoDuration, undoLabel],
  )

  const clearError = React.useCallback(() => setError(null), [])

  return { state: optimistic, run, pending, error, clearError }
}
