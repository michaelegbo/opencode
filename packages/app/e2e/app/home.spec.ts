import { test, expect } from "../fixtures"
import { serverNamePattern } from "../utils"

test("home renders and shows core entrypoints", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("button", { name: "Open project" }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: serverNamePattern })).toBeVisible()
})

test("server picker dialog opens from home", async ({ page }) => {
  await page.goto("/")

  const trigger = page.getByRole("button", { name: serverNamePattern })
  await expect(trigger).toBeVisible()
  await trigger.click()

  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("textbox").first()).toBeVisible()
})

test("home hides desktop history and sidebar controls", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto("/")

  await expect(page.getByRole("button", { name: "Toggle sidebar" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Go back" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Go forward" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Toggle menu" })).toHaveCount(0)
})

test("home keeps the mobile menu available", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 900 })
  await page.goto("/")

  const toggle = page.getByRole("button", { name: "Toggle menu" }).first()
  await expect(toggle).toBeVisible()
  await toggle.click()

  const nav = page.locator('[data-component="sidebar-nav-mobile"]')
  await expect(nav).toBeVisible()
  await expect.poll(async () => (await nav.boundingBox())?.width ?? 0).toBeLessThan(120)
  await expect(nav.getByRole("button", { name: "Settings" })).toBeVisible()
  await expect(nav.getByRole("button", { name: "Help" })).toBeVisible()

  await page.setViewportSize({ width: 1400, height: 900 })
  await expect(nav).toBeHidden()

  await page.setViewportSize({ width: 430, height: 900 })
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
  await expect(nav).toHaveClass(/-translate-x-full/)

  await toggle.click()
  await expect(nav).toBeVisible()

  await nav.getByRole("button", { name: "Settings" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
})
