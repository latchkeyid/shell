import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
  INITIAL_ROWS,
  SwitcherPanel,
  canSwitchOrgs,
  computeSections,
  resolveCurrentScope,
} from "@/shell/org-switcher"
import type { ShellOrg, ShellSession } from "@/shell/types"

const user = { id: "u1", email: "chris@example.com", name: "Chris" }

function session(overrides: Partial<ShellSession> = {}): ShellSession {
  return {
    user,
    orgs: [
      { slug: "grapevine", name: "grapevine", role: "owner" },
      { slug: "runsheet", name: "runsheet", role: "admin" },
      { slug: "optrader", name: "optrader", role: "member" },
      { slug: "bayside-pm", name: "bayside-pm", role: "viewer", suspended: true },
    ],
    currentOrg: "grapevine",
    invitations: [{ id: "inv_1", orgSlug: "northside", orgName: "Northside Plumbing", invitedBy: "jane@northside.com", role: "admin" }],
    canCreateOrg: true,
    staff: false,
    ...overrides,
  }
}

function manyOrgs(count: number): ShellOrg[] {
  return Array.from({ length: count }, (_, index) => ({
    slug: `org-${String(index).padStart(2, "0")}`,
    name: `Org ${String(index).padStart(2, "0")}`,
    role: "member" as const,
  }))
}

const noop = () => {}

function renderPanel(s: ShellSession, extra: Partial<React.ComponentProps<typeof SwitcherPanel>> = {}) {
  const current = resolveCurrentScope(s)!
  const props: React.ComponentProps<typeof SwitcherPanel> = {
    session: s,
    current,
    recentSlugs: s.recentOrgs ?? [],
    initialQuery: "",
    onSelect: vi.fn(),
    onInvitation: vi.fn(),
    onSettings: noop,
    onDirectory: noop,
    onCreate: vi.fn(),
    onExitStaffView: vi.fn(),
    onViewAsStaff: vi.fn(),
    announce: noop,
    ...extra,
  }
  return { ...render(<SwitcherPanel {...props} />), props }
}

describe("computeSections", () => {
  it("pins the current org first and sorts the rest alphabetically", () => {
    const sections = computeSections(session(), "", [], "grapevine")
    expect(sections.active.map((org) => org.slug)).toEqual(["grapevine", "optrader", "runsheet"])
    expect(sections.inactive.map((org) => org.slug)).toEqual(["bayside-pm"])
    expect(sections.invitations).toHaveLength(1)
    expect(sections.recent).toEqual([])
    expect(sections.showHint).toBe(false)
  })

  it("filters memberships and invitations by name and slug", () => {
    const sections = computeSections(session(), "north", [], "grapevine")
    expect(sections.active).toEqual([])
    expect(sections.invitations.map((inv) => inv.orgName)).toEqual(["Northside Plumbing"])
    expect(computeSections(session(), "OPT", [], "grapevine").active.map((org) => org.slug)).toEqual(["optrader"])
  })

  it("shows Recent only above eight memberships, excluding the current org", () => {
    const small = session({ orgs: manyOrgs(8), currentOrg: "org-00" })
    expect(computeSections(small, "", ["org-03", "org-00"], "org-00").recent).toEqual([])
    const large = session({ orgs: manyOrgs(9), currentOrg: "org-00" })
    const recent = computeSections(large, "", ["org-03", "org-00", "org-05", "org-07", "org-01"], "org-00").recent
    expect(recent.map((org) => org.slug)).toEqual(["org-03", "org-05", "org-07"])
  })

  it("asks for a query above fifty memberships and renders only the first rows", () => {
    const sections = computeSections(session({ orgs: manyOrgs(60), currentOrg: "org-00" }), "", [], "org-00")
    expect(sections.showHint).toBe(true)
    expect(sections.active).toHaveLength(INITIAL_ROWS)
    expect(sections.truncated).toBe(60 - INITIAL_ROWS)
    const typed = computeSections(session({ orgs: manyOrgs(60), currentOrg: "org-00" }), "org-1", [], "org-00")
    expect(typed.showHint).toBe(false)
    expect(typed.active).toHaveLength(10)
  })
})

describe("canSwitchOrgs and resolveCurrentScope", () => {
  it("is identity-only for a single org with nothing to switch to", () => {
    expect(canSwitchOrgs(session({ orgs: [{ slug: "a", name: "a", role: "owner" }], invitations: [], canCreateOrg: false }))).toBe(false)
    expect(canSwitchOrgs(session({ orgs: [{ slug: "a", name: "a", role: "owner" }], invitations: [], canCreateOrg: true }))).toBe(true)
    expect(canSwitchOrgs(session({ orgs: [{ slug: "a", name: "a", role: "owner" }], invitations: [], canCreateOrg: false, staff: true }))).toBe(true)
  })

  it("resolves the staff view-as target even without a membership", () => {
    const scope = resolveCurrentScope(session({ actAs: { org: "northcote-cafe" } }))
    expect(scope).toMatchObject({ slug: "northcote-cafe", name: "northcote-cafe", staffView: true })
  })
})

describe("SwitcherPanel", () => {
  it("renders the sections in order with counts", () => {
    renderPanel(session())
    const headings = Array.from(document.querySelectorAll("[cmdk-group-heading]")).map((el) => el.textContent)
    expect(headings).toEqual(["Invitations (1)", "Your organisations (4)", "Inactive"])

    const options = screen.getAllByRole("option").map((el) => el.textContent)
    expect(options[0]).toContain("Northside Plumbing")
    expect(options[0]).toContain("Invited by jane@northside.com as Admin")
    // Initials avatar, then name, then role.
    expect(options.slice(1, 4)).toEqual(["GgrapevineOwner", "OoptraderMember", "RrunsheetAdmin"])
  })

  it("marks the current org and disables suspended ones", () => {
    renderPanel(session())
    const current = screen.getByRole("option", { name: /^grapevine/ })
    expect(current).toHaveAttribute("aria-current", "true")
    const suspended = screen.getByRole("option", { name: /bayside-pm/ })
    expect(suspended).toHaveAttribute("aria-disabled", "true")
    expect(suspended).toHaveTextContent("Suspended")
  })

  it("shows the header row, the always-present input and the create action", () => {
    renderPanel(session())
    expect(screen.getByRole("button", { name: "Organisation settings" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Find organisation…")).toHaveAttribute("role", "combobox")
    expect(screen.getByRole("option", { name: /Create organisation/ })).toBeInTheDocument()
  })

  it("filters as the user types and shows the empty message", async () => {
    const user = userEvent.setup()
    renderPanel(session())
    await user.type(screen.getByPlaceholderText("Find organisation…"), "opt")
    expect(screen.getAllByRole("option").map((el) => el.textContent)).toEqual(["OoptraderMember"])
    await user.clear(screen.getByPlaceholderText("Find organisation…"))
    await user.type(screen.getByPlaceholderText("Find organisation…"), "zzz")
    expect(screen.getByRole("status")).toHaveTextContent("No organisations match “zzz”")
  })

  it("calls onSelect with the chosen org and onInvitation with the id", async () => {
    const user = userEvent.setup()
    const { props } = renderPanel(session())
    await user.click(screen.getByRole("option", { name: /^runsheet/ }))
    expect(props.onSelect).toHaveBeenCalledWith(expect.objectContaining({ slug: "runsheet" }))
    await user.click(screen.getByRole("option", { name: /Northside Plumbing/ }))
    expect(props.onInvitation).toHaveBeenCalledWith("inv_1")
  })

  it("shows the search hint and the Recent group for sixty orgs", () => {
    renderPanel(session({ orgs: manyOrgs(60), currentOrg: "org-00", recentOrgs: ["org-42", "org-07"], invitations: [] }))
    expect(screen.getByText("Type to search 60 organisations")).toBeInTheDocument()
    const recent = screen.getByText("Recent").closest("[cmdk-group]")!
    expect(within(recent as HTMLElement).getAllByRole("option")).toHaveLength(2)
    const yours = screen.getByText("Your organisations (60)").closest("[cmdk-group]")!
    expect(within(yours as HTMLElement).getAllByRole("option")).toHaveLength(INITIAL_ROWS)
    expect(screen.getByText(`${60 - INITIAL_ROWS} more · keep typing to narrow`)).toBeInTheDocument()
  })

  it("gives staff the Platform group and puts Exit staff view first while acting", async () => {
    const user = userEvent.setup()
    const searchOrgs = vi.fn(async () => [
      { slug: "northcote-cafe", name: "Northcote Cafe" },
      { slug: "grapevine", name: "grapevine" },
    ])
    const s = session({ staff: true, actAs: { org: "northcote-cafe", reason: "ticket" }, invitations: [] })
    renderPanel(s, { searchOrgs })
    expect(screen.getByText("Staff view")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Exit staff view" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /All organisations/ })).toBeInTheDocument()
    const actions = screen.getAllByRole("option").filter((el) => /Exit staff view|Create organisation/.test(el.textContent ?? ""))
    expect(actions.map((el) => el.textContent)).toEqual(["Exit staff view", "Create organisation"])

    await user.type(screen.getByPlaceholderText("Find organisation…"), "north")
    const result = await screen.findByRole("option", { name: /Northcote Cafe/ })
    expect(result).toHaveTextContent("Not a member")
    expect(result).toHaveTextContent("northcote-cafe")
    expect(searchOrgs).toHaveBeenCalledWith("north", expect.any(AbortSignal))
    // Memberships never show up as platform results.
    expect(screen.queryByRole("option", { name: /^grapevine.*Not a member/ })).toBeNull()
  })

  it("shows a Retry row when the platform search fails", async () => {
    const user = userEvent.setup()
    const searchOrgs = vi.fn(async () => {
      throw new Error("boom")
    })
    renderPanel(session({ staff: true, invitations: [] }), { searchOrgs })
    await user.type(screen.getByPlaceholderText("Find organisation…"), "zz")
    expect(await screen.findByRole("option", { name: /Couldn't load organisations/ })).toBeInTheDocument()
  })
})
