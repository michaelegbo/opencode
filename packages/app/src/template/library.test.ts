import { describe, expect, test } from "bun:test"
import { filesFor, materialize, template, templates } from "./library"

describe("template library", () => {
  test("ships a landing template with curated parts", () => {
    const list = templates()
    expect(list.length).toBeGreaterThan(0)
    expect(list[0]?.id).toBe("landing")
    expect(list[0]?.parts.some((item) => item.id === "hero")).toBe(true)
  })

  test("filters files for a curated part", () => {
    const tpl = template("landing")
    expect(tpl).toBeDefined()
    if (!tpl) return
    const hit = tpl.parts.find((item) => item.id === "hero")
    expect(hit).toBeDefined()
    if (!hit) return
    expect(filesFor(tpl, hit).map((file) => file.path)).toEqual(["src/App.tsx", "src/styles.css"])
  })

  test("materializes placeholders with the chosen project name", () => {
    const tpl = template("landing")
    expect(tpl).toBeDefined()
    if (!tpl) return
    const out = materialize(tpl, "Orbit Studio")
    const pkg = out.find((file) => file.path === "package.json")
    const html = out.find((file) => file.path === "index.html")
    expect(pkg?.content).toContain('"name": "orbit-studio"')
    expect(html?.content).toContain("<title>Orbit Studio</title>")
  })
})
