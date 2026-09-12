import { act, render, renderHook, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { DataTable, createColumns } from "@/data/data-table"
import { densityKey, useDensity } from "@/data/density"

interface Row {
  id: string
  name: string
  count: number | null
}

const helper = createColumns<Row>()
const columns = helper.columns([
  helper.accessor("name", { header: "Name" }),
  helper.accessor("count", { header: "Count", meta: { numeric: true } }),
])
const data: Row[] = [
  { id: "a", name: "Alpha", count: 3 },
  { id: "b", name: "Beta", count: null },
]

describe("useDensity", () => {
  it("falls back to the default and persists per route", () => {
    const { result } = renderHook(() => useDensity("tripline/issues", "compact"))
    expect(result.current[0]).toBe("compact")
    act(() => result.current[1]("spacious"))
    expect(result.current[0]).toBe("spacious")
    expect(JSON.parse(window.localStorage.getItem(densityKey("tripline/issues"))!)).toBe("spacious")

    const again = renderHook(() => useDensity("tripline/issues", "compact"))
    expect(again.result.current[0]).toBe("spacious")
    const other = renderHook(() => useDensity("latchkey/identities", "normal"))
    expect(other.result.current[0]).toBe("normal")
  })

  it("ignores junk in storage", () => {
    window.localStorage.setItem(densityKey("x"), JSON.stringify("huge"))
    const { result } = renderHook(() => useDensity("x", "normal"))
    expect(result.current[0]).toBe("normal")
  })
})

describe("DataTable density", () => {
  it("exposes the density on the root and lets the view menu change it", async () => {
    const user = userEvent.setup()
    render(<DataTable columns={columns} data={data} getRowId={(row) => row.id} densityKey="test/table" defaultDensity="compact" />)
    const root = document.querySelector("[data-slot='data-table']")!
    expect(root).toHaveAttribute("data-density", "compact")

    await user.click(screen.getByRole("button", { name: "View options" }))
    await user.click(await screen.findByRole("menuitemradio", { name: "Spacious" }))
    expect(root).toHaveAttribute("data-density", "spacious")
    expect(JSON.parse(window.localStorage.getItem(densityKey("test/table"))!)).toBe("spacious")
  })

  it("right-aligns numeric columns and renders an em dash for empty cells", () => {
    render(<DataTable columns={columns} data={data} getRowId={(row) => row.id} hideViewOptions />)
    const header = screen.getByRole("columnheader", { name: /Count/ })
    expect(header.className).toContain("text-right")
    const cells = screen.getAllByRole("cell")
    expect(cells.map((cell) => cell.textContent)).toEqual(["Alpha", "3", "Beta", "—"])
    expect(cells[1]?.className).toContain("tabular-nums")
  })
})
