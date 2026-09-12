import * as React from "react"

/** Chords ("g then o") must complete within this window. */
export const CHORD_WINDOW_MS = 750

const EDITOR_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='textbox']",
  "[role='combobox']",
  ".cm-editor",
  ".monaco-editor",
  ".ProseMirror",
  "[data-hotkeys-ignore]",
].join(",")

/** True when keystrokes belong to a text field or a code editor. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target instanceof HTMLInputElement) {
    const type = target.type
    if (["checkbox", "radio", "button", "submit", "range", "file"].includes(type)) {
      return false
    }
    return !target.readOnly
  }
  return target.closest(EDITOR_SELECTOR) != null
}

/** True while any dialog, sheet or alert dialog is open. */
export function hasOpenDialog(root: ParentNode = document): boolean {
  return (
    root.querySelector(
      "[role='dialog'][data-state='open'], [role='alertdialog'][data-state='open'], [aria-modal='true']:not([data-state='closed'])",
    ) != null
  )
}

export interface HotkeyOptions {
  enabled?: boolean
  /** Fire even when focus is inside an input or editor. */
  allowInInputs?: boolean
  /** Fire even while a dialog is open. */
  allowInDialogs?: boolean
  /** Default true: preventDefault on match. */
  preventDefault?: boolean
}

interface ParsedKey {
  key: string
  mod: boolean
  shift: boolean
  alt: boolean
}

function parseToken(token: string): ParsedKey {
  const parts = token.toLowerCase().split("+")
  const key = parts.pop() ?? ""
  return {
    key: key === "esc" ? "escape" : key,
    mod: parts.includes("mod") || parts.includes("meta") || parts.includes("ctrl"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
  }
}

/** "g o" → chord of two tokens; "mod+k" → single token with a modifier. */
export function parseHotkey(combo: string): ParsedKey[] {
  return combo.trim().split(/\s+/).map(parseToken)
}

function keyMatches(event: KeyboardEvent, parsed: ParsedKey): boolean {
  const key = event.key.toLowerCase()
  const modifierHeld = event.metaKey || event.ctrlKey
  if (parsed.mod !== modifierHeld) return false
  if (parsed.shift !== event.shiftKey) return false
  if (parsed.alt !== event.altKey) return false
  return key === parsed.key
}

/**
 * Global keyboard shortcut. `combo` accepts "mod+k", "escape", or a two-key
 * chord written with a space ("g o"). Chords ignore input fields, editors
 * and open dialogs unless told otherwise, and expire after 750ms.
 */
export function useHotkey(
  combo: string | string[],
  handler: (event: KeyboardEvent) => void,
  options: HotkeyOptions = {},
) {
  const {
    enabled = true,
    allowInInputs = false,
    allowInDialogs = false,
    preventDefault = true,
  } = options
  const handlerRef = React.useRef(handler)
  React.useEffect(() => {
    handlerRef.current = handler
  })
  const combos = Array.isArray(combo) ? combo.join("|") : combo

  React.useEffect(() => {
    if (!enabled) return
    const sequences = combos.split("|").map(parseHotkey)
    let pending: { index: number; seq: ParsedKey[]; at: number } | null = null

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return
      if (!allowInInputs && isEditableTarget(event.target)) {
        pending = null
        return
      }
      if (!allowInDialogs && hasOpenDialog()) {
        pending = null
        return
      }
      const now = Date.now()
      if (pending && now - pending.at > CHORD_WINDOW_MS) pending = null

      if (pending) {
        const expected = pending.seq[pending.index]
        if (expected && keyMatches(event, expected)) {
          if (pending.index === pending.seq.length - 1) {
            pending = null
            if (preventDefault) event.preventDefault()
            handlerRef.current(event)
          } else {
            pending = { ...pending, index: pending.index + 1, at: now }
            if (preventDefault) event.preventDefault()
          }
          return
        }
        pending = null
      }

      for (const seq of sequences) {
        const first = seq[0]
        if (!first || !keyMatches(event, first)) continue
        if (seq.length === 1) {
          if (preventDefault) event.preventDefault()
          handlerRef.current(event)
          return
        }
        pending = { index: 1, seq, at: now }
        if (preventDefault) event.preventDefault()
        return
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [combos, enabled, allowInInputs, allowInDialogs, preventDefault])
}

/** Sugar for two-key chords: useChord("g", "o", open). */
export function useChord(
  first: string,
  second: string,
  handler: (event: KeyboardEvent) => void,
  options?: HotkeyOptions,
) {
  useHotkey(`${first} ${second}`, handler, options)
}
