import { expect, test, type Page } from "@playwright/test"

const apps = ["tripline", "latchkey", "runsheet", "wardroom", "purser", "foghorn"] as const
const themes = ["light", "dark"] as const

const sessions: Record<(typeof apps)[number], string> = {
  tripline: "multi",
  latchkey: "staff",
  runsheet: "single",
  wardroom: "multi",
  purser: "single",
  foghorn: "multi",
}

async function open(page: Page, query: Record<string, string>) {
  const params = new URLSearchParams({ controls: "0", ...query })
  // The theme honours prefers-reduced-motion, which keeps screenshots deterministic.
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto(`/?${params.toString()}`)
  await page.waitForLoadState("networkidle")
  await expect(page.locator("main h1")).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

test.describe("playground screens @screenshots", () => {
  for (const app of apps) {
    for (const theme of themes) {
      test(`${app} in ${theme}`, async ({ page }) => {
        const errors: string[] = []
        page.on("pageerror", (error) => errors.push(error.message))
        await open(page, { app, session: sessions[app], theme })
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme)
        await expect(page.locator("[data-slot='page-action-bar']")).toBeVisible()
        await expect(page.locator("[data-slot='org-switcher-trigger']")).toBeVisible()
        await page.screenshot({ path: `docs/screenshots/${app}-${theme}.png`, fullPage: false })
        expect(errors).toEqual([])
      })
    }
  }

  test("org switcher opens from the header and with G then O", async ({ page }) => {
    await open(page, { app: "tripline", session: "multi", theme: "light" })
    await page.locator("[data-slot='org-switcher-trigger']").click()
    const dialog = page.getByRole("dialog", { name: "Switch organisation" })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText("Invitations (1)")).toBeVisible()
    await expect(dialog.getByText("Your organisations (4)")).toBeVisible()
    await page.screenshot({ path: "docs/screenshots/org-switcher-light.png" })
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()

    await page.locator("main h1").click()
    await page.keyboard.press("g")
    await page.keyboard.press("o")
    await expect(page.getByRole("dialog", { name: "Switch organisation" })).toBeVisible()
    await page.keyboard.press("Escape")
  })

  test("icon rail keeps the avatar trigger and the org crumb", async ({ page }) => {
    await open(page, { app: "runsheet", session: "multi", theme: "light", rail: "1" })
    const sidebar = page.locator("[data-slot='sidebar'][data-state='collapsed']")
    await expect(sidebar).toBeVisible()
    await expect(page.locator("[data-slot='org-switcher-trigger']")).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Scope" }).getByText("grapevine")).toBeVisible()
    await page.screenshot({ path: "docs/screenshots/runsheet-rail-light.png" })
  })

  test("command palette opens with the mod+K chip and lists pages", async ({ page }) => {
    await open(page, { app: "latchkey", session: "multi", theme: "dark" })
    await page.locator("[data-slot='command-chip']").click()
    const dialog = page.getByRole("dialog", { name: "Command palette" })
    await expect(dialog).toBeVisible()
    await dialog.getByPlaceholder(/Search/).fill("audit")
    await expect(dialog.getByText("Go to Audit log")).toBeVisible()
    await page.screenshot({ path: "docs/screenshots/command-palette-dark.png" })
  })

  test("staff view-as paints the amber chrome", async ({ page }) => {
    await open(page, { app: "latchkey", session: "staff", theme: "light" })
    await expect(page.locator("html")).toHaveAttribute("data-staff-view", "")
    await expect(page.getByRole("status").filter({ hasText: "as platform staff" })).toBeVisible()
    await expect(page).toHaveTitle(/^\[Staff\] /)
  })

  test("zero-org session renders the welcome page", async ({ page }) => {
    await page.goto("/?app=tripline&session=zero&theme=light&controls=0")
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible()
    await expect(page.getByRole("button", { name: "Accept invitation" })).toBeVisible()
    await page.screenshot({ path: "docs/screenshots/welcome-light.png" })
  })
})
