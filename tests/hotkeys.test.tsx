import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CHORD_WINDOW_MS, hasOpenDialog, isEditableTarget, parseHotkey, useHotkey } from "@/shell/hotkeys"

function Harness({ combo, onFire, allowInInputs = false }: { combo: string; onFire: () => void; allowInInputs?: boolean }) {
  useHotkey(combo, onFire, { allowInInputs })
  return null
}

function press(key: string, init: KeyboardEventInit & { target?: Element } = {}) {
  const { target = document.body, ...rest } = init
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...rest })
  target.dispatchEvent(event)
  return event
}

describe("parseHotkey", () => {
  it("parses modifiers and chords", () => {
    expect(parseHotkey("mod+k")).toEqual([{ key: "k", mod: true, shift: false, alt: false }])
    expect(parseHotkey("g o")).toEqual([
      { key: "g", mod: false, shift: false, alt: false },
      { key: "o", mod: false, shift: false, alt: false },
    ])
    expect(parseHotkey("esc")[0]?.key).toBe("escape")
  })
})

describe("useHotkey chords", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("fires G then O inside the 750ms window", () => {
    const onFire = vi.fn()
    render(<Harness combo="g o" onFire={onFire} />)
    press("g")
    vi.advanceTimersByTime(200)
    press("o")
    expect(onFire).toHaveBeenCalledTimes(1)
  })

  it("does not fire when the second key arrives after the window", () => {
    const onFire = vi.fn()
    render(<Harness combo="g o" onFire={onFire} />)
    press("g")
    vi.advanceTimersByTime(CHORD_WINDOW_MS + 10)
    press("o")
    expect(onFire).not.toHaveBeenCalled()
  })

  it("a bare second key never fires", () => {
    const onFire = vi.fn()
    render(<Harness combo="g o" onFire={onFire} />)
    press("o")
    expect(onFire).not.toHaveBeenCalled()
  })

  it("restarts the chord when the first key repeats", () => {
    const onFire = vi.fn()
    render(<Harness combo="g o" onFire={onFire} />)
    press("g")
    press("g")
    press("o")
    expect(onFire).toHaveBeenCalledTimes(1)
  })

  it("ignores modifiers held during a chord key", () => {
    const onFire = vi.fn()
    render(<Harness combo="g o" onFire={onFire} />)
    press("g", { metaKey: true })
    press("o")
    expect(onFire).not.toHaveBeenCalled()
  })

  it("fires mod+k with either meta or ctrl and prevents default", () => {
    const onFire = vi.fn()
    render(<Harness combo="mod+k" onFire={onFire} />)
    const meta = press("k", { metaKey: true })
    const ctrl = press("k", { ctrlKey: true })
    press("k")
    expect(onFire).toHaveBeenCalledTimes(2)
    expect(meta.defaultPrevented).toBe(true)
    expect(ctrl.defaultPrevented).toBe(true)
  })
})

describe("useHotkey guards", () => {
  it.each([
    ["input", () => document.createElement("input")],
    ["textarea", () => document.createElement("textarea")],
    [
      "contenteditable",
      () => {
        const div = document.createElement("div")
        div.setAttribute("contenteditable", "true")
        return div
      },
    ],
    [
      "CodeMirror surface",
      () => {
        const editor = document.createElement("div")
        editor.className = "cm-editor"
        const inner = document.createElement("div")
        editor.append(inner)
        return inner
      },
    ],
    [
      "Monaco surface",
      () => {
        const editor = document.createElement("div")
        editor.className = "monaco-editor"
        const inner = document.createElement("span")
        editor.append(inner)
        return inner
      },
    ],
  ])("ignores chords typed in a %s", (_label, make) => {
    const onFire = vi.fn()
    render(<Harness combo="g o" onFire={onFire} />)
    const target = make()
    document.body.append(target.closest(".cm-editor, .monaco-editor") ?? target)
    press("g", { target })
    press("o", { target })
    expect(onFire).not.toHaveBeenCalled()
    expect(isEditableTarget(target)).toBe(true)
  })

  it("treats checkboxes and buttons as non-editable", () => {
    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    expect(isEditableTarget(checkbox)).toBe(false)
    expect(isEditableTarget(document.createElement("button"))).toBe(false)
  })

  it("ignores chords while a dialog is open", () => {
    const onFire = vi.fn()
    render(<Harness combo="g o" onFire={onFire} />)
    const dialog = document.createElement("div")
    dialog.setAttribute("role", "dialog")
    dialog.setAttribute("data-state", "open")
    document.body.append(dialog)
    expect(hasOpenDialog()).toBe(true)
    press("g")
    press("o")
    expect(onFire).not.toHaveBeenCalled()
    dialog.remove()
    expect(hasOpenDialog()).toBe(false)
  })

  it("can opt in to firing inside inputs", () => {
    const onFire = vi.fn()
    render(<Harness combo="mod+k" onFire={onFire} allowInInputs />)
    const input = document.createElement("input")
    document.body.append(input)
    press("k", { metaKey: true, target: input })
    expect(onFire).toHaveBeenCalledTimes(1)
  })

  it("stops listening on unmount", () => {
    const onFire = vi.fn()
    const view = render(<Harness combo="g o" onFire={onFire} />)
    act(() => view.unmount())
    press("g")
    press("o")
    expect(onFire).not.toHaveBeenCalled()
  })
})
