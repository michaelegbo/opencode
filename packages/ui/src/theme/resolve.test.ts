import { describe, expect, test } from "bun:test"
import type { HexColor, ThemeVariant } from "./types"
import { generateNeutralScale, generateScale, hexToOklch } from "./color"
import { DEFAULT_THEMES } from "./default-themes"
import { resolveThemeVariant } from "./resolve"

function dist(a: HexColor, b: HexColor) {
  const x = hexToOklch(a)
  const y = hexToOklch(b)
  const hue = Math.abs(((((y.h - x.h) % 360) + 540) % 360) - 180) / 360
  return Math.abs(x.l - y.l) + Math.abs(x.c - y.c) + hue
}

describe("theme resolve", () => {
  test("resolves every bundled theme from seeds", () => {
    for (const theme of Object.values(DEFAULT_THEMES)) {
      const light = resolveThemeVariant(theme.light, false)
      const dark = resolveThemeVariant(theme.dark, true)

      expect(light["background-base"]).toStartWith("#")
      expect(light["text-base"]).toBeTruthy()
      expect(light["surface-brand-base"]).toStartWith("#")
      expect(dark["background-base"]).toStartWith("#")
      expect(dark["text-base"]).toBeTruthy()
      expect(dark["surface-brand-base"]).toStartWith("#")
    }
  })

  test("applies token overrides after generation", () => {
    const variant: ThemeVariant = {
      seeds: {
        neutral: "#f4f4f5",
        primary: "#3b7dd8",
        success: "#3d9a57",
        warning: "#d68c27",
        error: "#d1383d",
        info: "#318795",
      },
      overrides: {
        "text-base": "#111111",
      },
    }
    const tokens = resolveThemeVariant(variant, false)

    expect(tokens["text-base"]).toBe("#111111")
    expect(tokens["markdown-text"]).toBe("#111111")
    expect(tokens["text-stronger"]).toBe(tokens["text-strong"])
  })

  test("keeps dark body text separated from strong text", () => {
    const tokens = resolveThemeVariant(
      {
        seeds: {
          neutral: "#1f1f1f",
          primary: "#fab283",
          success: "#12c905",
          warning: "#fcd53a",
          error: "#fc533a",
          info: "#edb2f1",
          interactive: "#034cff",
        },
      },
      true,
    )

    const base = hexToOklch(tokens["text-base"] as HexColor).l
    const strong = hexToOklch(tokens["text-strong"] as HexColor).l

    expect(strong - base).toBeGreaterThan(0.18)
  })

  test("keeps dark icons weaker than body text", () => {
    const tokens = resolveThemeVariant(
      {
        seeds: {
          neutral: "#1f1f1f",
          primary: "#fab283",
          success: "#12c905",
          warning: "#fcd53a",
          error: "#fc533a",
          info: "#edb2f1",
          interactive: "#034cff",
        },
      },
      true,
    )

    const icon = hexToOklch(tokens["icon-base"] as HexColor).l
    const text = hexToOklch(tokens["text-base"] as HexColor).l

    expect(text - icon).toBeGreaterThan(0.08)
  })

  test("keeps base icons distinct from disabled icons", () => {
    const light = resolveThemeVariant(
      {
        seeds: {
          neutral: "#f7f7f7",
          primary: "#dcde8d",
          success: "#12c905",
          warning: "#ffdc17",
          error: "#fc533a",
          info: "#a753ae",
          interactive: "#034cff",
        },
      },
      false,
    )
    const dark = resolveThemeVariant(
      {
        seeds: {
          neutral: "#1f1f1f",
          primary: "#fab283",
          success: "#12c905",
          warning: "#fcd53a",
          error: "#fc533a",
          info: "#edb2f1",
          interactive: "#034cff",
        },
      },
      true,
    )

    const lightBase = hexToOklch(light["icon-base"] as HexColor).l
    const lightDisabled = hexToOklch(light["icon-disabled"] as HexColor).l
    const darkBase = hexToOklch(dark["icon-base"] as HexColor).l
    const darkDisabled = hexToOklch(dark["icon-disabled"] as HexColor).l

    expect(lightDisabled - lightBase).toBeGreaterThan(0.12)
    expect(darkBase - darkDisabled).toBeGreaterThan(0.12)
  })

  test("uses tuned interactive and success token steps", () => {
    const light: ThemeVariant = {
      seeds: {
        neutral: "#f7f7f7",
        primary: "#dcde8d",
        success: "#12c905",
        warning: "#ffdc17",
        error: "#fc533a",
        info: "#a753ae",
        interactive: "#034cff",
        diffDelete: "#fc533a",
      },
    }
    const dark: ThemeVariant = {
      seeds: {
        neutral: "#1f1f1f",
        primary: "#fab283",
        success: "#12c905",
        warning: "#fcd53a",
        error: "#fc533a",
        info: "#edb2f1",
        interactive: "#034cff",
        diffDelete: "#fc533a",
      },
    }

    const lightTokens = resolveThemeVariant(light, false)
    const darkTokens = resolveThemeVariant(dark, true)
    const lightNeutral = generateNeutralScale(light.seeds.neutral, false)
    const darkNeutral = generateNeutralScale(dark.seeds.neutral, true)
    const lightSuccess = generateScale(light.seeds.success, false)
    const darkSuccess = generateScale(dark.seeds.success, true)
    const darkInteractive = generateScale(dark.seeds.interactive!, true)
    const darkDelete = generateScale(dark.seeds.error, true)

    expect(lightTokens["icon-success-base"]).toBe(lightSuccess[6])
    expect(darkTokens["icon-success-base"]).toBe(darkSuccess[8])
    expect(darkTokens["surface-interactive-weak"]).toBe(darkInteractive[3])
    expect(lightTokens["icon-base"]).toBe(lightNeutral[8])
    expect(lightTokens["icon-disabled"]).toBe(lightNeutral[6])
    expect(darkTokens["icon-base"]).toBe(darkNeutral[7])
    expect(darkTokens["icon-disabled"]).toBe(darkNeutral[5])
    expect(darkTokens["icon-diff-delete-base"]).toBe(darkDelete[9])
    expect(darkTokens["icon-diff-delete-hover"]).toBe(darkDelete[10])
  })

  test("keeps accent scales centered on step 9", () => {
    const seed = "#3b7dd8" as HexColor
    const light = generateScale(seed, false)
    const dark = generateScale(seed, true)

    expect(dist(light[8], seed)).toBeLessThan(dist(light[7], seed))
    expect(dist(light[8], seed)).toBeLessThan(dist(light[10], seed))
    expect(dist(dark[8], seed)).toBeLessThan(dist(dark[7], seed))
    expect(dist(dark[8], seed)).toBeLessThan(dist(dark[10], seed))
  })

  test("keeps neutral scales monotonic", () => {
    const light = generateNeutralScale("#f7f7f7", false).map((hex) => hexToOklch(hex).l)
    const dark = generateNeutralScale("#1f1f1f", true).map((hex) => hexToOklch(hex).l)

    for (let i = 1; i < light.length; i++) {
      expect(light[i - 1]).toBeGreaterThanOrEqual(light[i])
      expect(dark[i - 1]).toBeLessThanOrEqual(dark[i])
    }
  })
})
