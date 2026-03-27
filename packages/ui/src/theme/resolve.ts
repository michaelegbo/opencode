import type { ColorValue, DesktopTheme, HexColor, ResolvedTheme, ThemeVariant } from "./types"
import { blend, generateNeutralScale, generateScale, hexToRgb, shift, withAlpha } from "./color"

export function resolveThemeVariant(variant: ThemeVariant, isDark: boolean): ResolvedTheme {
  const colors = getColors(variant)
  const overrides = variant.overrides ?? {}

  const neutral = generateNeutralScale(colors.neutral, isDark)
  const primary = generateScale(colors.primary, isDark)
  const accent = generateScale(colors.accent, isDark)
  const success = generateScale(colors.success, isDark)
  const warning = generateScale(colors.warning, isDark)
  const error = generateScale(colors.error, isDark)
  const info = generateScale(colors.info, isDark)
  const interactive = generateScale(colors.interactive, isDark)
  const diffAdd = generateScale(
    colors.diffAdd ?? shift(colors.success, { c: isDark ? 0.84 : 0.76, l: isDark ? -0.04 : 0.04 }),
    isDark,
  )
  const diffDelete = generateScale(
    colors.diffDelete ?? shift(colors.error, { c: isDark ? 0.9 : 0.8, l: isDark ? -0.03 : 0.03 }),
    isDark,
  )

  const bgValue = overrides["background-base"]
  const bgHex = getHex(bgValue)
  const overlay = Boolean(bgValue) && !bgHex
  const bg = bgHex ?? neutral[0]
  const alpha = generateNeutralAlphaScale(neutral, isDark)
  const soft = isDark ? 5 : 3
  const tone = isDark ? 6 : 5
  const rise = isDark ? 7 : 5
  const prose = isDark ? 8 : 9
  const fade = (color: HexColor, value: number) =>
    overlay ? (withAlpha(color, value) as ColorValue) : blend(color, bg, value)
  const text = (scale: HexColor[]) => shift(scale[prose], { l: isDark ? 0.006 : -0.024, c: isDark ? 1.08 : 1.14 })
  const wash = (
    seed: HexColor,
    value: { base: number; weak: number; weaker: number; strong: number; stronger: number },
  ) => ({
    base: fade(seed, value.base),
    weak: fade(seed, value.weak),
    weaker: fade(seed, value.weaker),
    strong: fade(seed, value.strong),
    stronger: fade(seed, value.stronger),
  })
  const lum = (hex: HexColor) => {
    const rgb = hexToRgb(hex)
    const lift = (value: number) => (value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4))
    return 0.2126 * lift(rgb.r) + 0.7152 * lift(rgb.g) + 0.0722 * lift(rgb.b)
  }
  const hit = (a: HexColor, b: HexColor) => {
    const light = Math.max(lum(a), lum(b))
    const dark = Math.min(lum(a), lum(b))
    return (light + 0.05) / (dark + 0.05)
  }
  const on = (fill: HexColor) => {
    const light = "#ffffff" as HexColor
    const dark = "#000000" as HexColor
    return hit(light, fill) > hit(dark, fill) ? light : dark
  }
  const hidden = wash(
    isDark ? shift(colors.interactive, { c: 0.6 }) : shift(colors.interactive, { c: 0.46, l: 0.07 }),
    isDark
      ? { base: 0.14, weak: 0.08, weaker: 0.18, strong: 0.26, stronger: 0.42 }
      : { base: 0.12, weak: 0.08, weaker: 0.16, strong: 0.24, stronger: 0.36 },
  )
  const brand = primary[8]
  const brandHover = primary[9]
  const interText = isDark ? shift(interactive[8], { l: 0.012, c: 1.08 }) : text(interactive)
  const inter = interactive[tone]
  const interHover = interactive[isDark ? 7 : 6]
  const interWeak = interactive[isDark ? 3 : soft]
  const tones = {
    success,
    warning,
    critical: error,
    info,
  }
  const avatars = {
    pink: error,
    mint: success,
    orange: warning,
    purple: accent,
    cyan: info,
    lime: primary,
  }
  const tokens: ResolvedTheme = {
    "background-base": neutral[0],
    "background-weak": neutral[2],
    "background-strong": neutral[0],
    "background-stronger": neutral[1],
    "surface-base": alpha[1],
    base: alpha[1],
    "surface-base-hover": alpha[2],
    "surface-base-active": alpha[2],
    "surface-base-interactive-active": withAlpha(interactive[2], isDark ? 0.34 : 0.26) as ColorValue,
    base2: alpha[1],
    base3: alpha[1],
    "surface-inset-base": alpha[1],
    "surface-inset-base-hover": alpha[2],
    "surface-inset-strong": fade(neutral[11], isDark ? 0.08 : 0.04),
    "surface-inset-strong-hover": fade(neutral[11], isDark ? 0.12 : 0.06),
    "surface-raised-base": alpha[0],
    "surface-float-base": isDark ? neutral[1] : neutral[11],
    "surface-float-base-hover": isDark ? neutral[2] : neutral[10],
    "surface-raised-base-hover": alpha[1],
    "surface-raised-base-active": alpha[2],
    "surface-raised-strong": isDark ? alpha[3] : neutral[0],
    "surface-raised-strong-hover": isDark ? alpha[5] : neutral[0],
    "surface-raised-stronger": isDark ? alpha[5] : neutral[0],
    "surface-raised-stronger-hover": isDark ? alpha[6] : neutral[1],
    "surface-weak": alpha[2],
    "surface-weaker": alpha[3],
    "surface-strong": isDark ? alpha[6] : neutral[0],
    "surface-raised-stronger-non-alpha": isDark ? neutral[2] : neutral[0],
    "surface-brand-base": brand,
    "surface-brand-hover": brandHover,
    "surface-interactive-base": inter,
    "surface-interactive-hover": interHover,
    "surface-interactive-weak": interWeak,
    "surface-interactive-weak-hover": inter,
    "surface-diff-unchanged-base": isDark ? neutral[0] : "#ffffff00",
    "surface-diff-skip-base": isDark ? alpha[0] : neutral[1],
    "surface-diff-hidden-base": hidden.base,
    "surface-diff-hidden-weak": hidden.weak,
    "surface-diff-hidden-weaker": hidden.weaker,
    "surface-diff-hidden-strong": hidden.strong,
    "surface-diff-hidden-stronger": hidden.stronger,
    "surface-diff-add-base": diffAdd[2],
    "surface-diff-add-weak": diffAdd[isDark ? 3 : 1],
    "surface-diff-add-weaker": diffAdd[isDark ? 2 : 0],
    "surface-diff-add-strong": diffAdd[4],
    "surface-diff-add-stronger": diffAdd[isDark ? 10 : 8],
    "surface-diff-delete-base": diffDelete[2],
    "surface-diff-delete-weak": diffDelete[isDark ? 3 : 1],
    "surface-diff-delete-weaker": diffDelete[isDark ? 2 : 0],
    "surface-diff-delete-strong": diffDelete[isDark ? 4 : 5],
    "surface-diff-delete-stronger": diffDelete[isDark ? 10 : 8],
    "input-base": isDark ? neutral[1] : neutral[0],
    "input-hover": isDark ? neutral[2] : neutral[1],
    "input-active": isDark ? interactive[tone] : interactive[0],
    "input-selected": isDark ? interactive[7] : interactive[3],
    "input-focus": isDark ? interactive[tone] : interactive[0],
    "input-disabled": neutral[3],
    "text-base": isDark ? neutral[8] : neutral[10],
    "text-weak": neutral[7],
    "text-weaker": neutral[6],
    "text-strong": neutral[11],
    "text-invert-base": isDark ? neutral[10] : neutral[1],
    "text-invert-weak": isDark ? neutral[8] : neutral[2],
    "text-invert-weaker": isDark ? neutral[7] : neutral[3],
    "text-invert-strong": isDark ? neutral[11] : neutral[0],
    "text-interactive-base": interText,
    "text-on-brand-base": on(brand),
    "text-on-brand-weak": on(brand),
    "text-on-brand-weaker": on(brand),
    "text-on-brand-strong": on(brandHover),
    "text-on-interactive-base": on(inter),
    "text-on-interactive-weak": on(inter),
    "text-diff-add-base": text(diffAdd),
    "text-diff-delete-base": text(diffDelete),
    "text-diff-add-strong": diffAdd[11],
    "text-diff-delete-strong": diffDelete[11],
    "button-primary-base": neutral[11],
    "button-secondary-base": isDark ? neutral[2] : neutral[0],
    "button-secondary-hover": isDark ? neutral[3] : neutral[1],
    "button-ghost-hover": alpha[1],
    "button-ghost-hover2": alpha[2],
    "border-base": alpha[isDark ? 4 : 6],
    "border-hover": alpha[isDark ? 5 : 7],
    "border-active": alpha[isDark ? 6 : 8],
    "border-selected": withAlpha(interactive[8], isDark ? 0.9 : 0.99) as ColorValue,
    "border-disabled": alpha[isDark ? 5 : 7],
    "border-focus": alpha[isDark ? 6 : 8],
    "border-weak-base": alpha[isDark ? 2 : 4],
    "border-strong-base": alpha[isDark ? 5 : 6],
    "border-strong-hover": alpha[isDark ? 6 : 7],
    "border-strong-active": alpha[isDark ? 5 : 6],
    "border-strong-selected": withAlpha(interactive[5], 0.6) as ColorValue,
    "border-strong-disabled": alpha[isDark ? 3 : 5],
    "border-strong-focus": alpha[isDark ? 5 : 6],
    "border-weak-hover": alpha[isDark ? 4 : 5],
    "border-weak-active": alpha[isDark ? 5 : 6],
    "border-weak-selected": withAlpha(interactive[4], isDark ? 0.6 : 0.5) as ColorValue,
    "border-weak-disabled": alpha[isDark ? 3 : 5],
    "border-weak-focus": alpha[isDark ? 5 : 6],
    "border-weaker-base": alpha[isDark ? 1 : 2],
    "border-interactive-base": interactive[6],
    "border-interactive-hover": interactive[7],
    "border-interactive-active": interactive[8],
    "border-interactive-selected": interactive[8],
    "border-interactive-disabled": neutral[7],
    "border-interactive-focus": interactive[8],
    "border-color": neutral[0],
    "icon-base": neutral[isDark ? 7 : 8],
    "icon-hover": neutral[isDark ? 8 : 10],
    "icon-active": neutral[isDark ? 9 : 11],
    "icon-selected": neutral[isDark ? 10 : 11],
    "icon-disabled": neutral[isDark ? 5 : 6],
    "icon-focus": neutral[isDark ? 10 : 11],
    "icon-invert-base": isDark ? neutral[0] : "#ffffff",
    "icon-weak-base": neutral[isDark ? 5 : 6],
    "icon-weak-hover": neutral[isDark ? 10 : 7],
    "icon-weak-active": neutral[8],
    "icon-weak-selected": neutral[isDark ? 8 : 9],
    "icon-weak-disabled": neutral[isDark ? 3 : 5],
    "icon-weak-focus": neutral[8],
    "icon-strong-base": neutral[isDark ? 10 : 11],
    "icon-strong-hover": neutral[isDark ? 10 : 11],
    "icon-strong-active": neutral[isDark ? 10 : 11],
    "icon-strong-selected": neutral[isDark ? 10 : 11],
    "icon-strong-disabled": neutral[7],
    "icon-strong-focus": neutral[isDark ? 10 : 11],
    "icon-brand-base": on(brand),
    "icon-interactive-base": interactive[rise],
    "icon-on-brand-base": on(brand),
    "icon-on-brand-hover": on(brandHover),
    "icon-on-brand-selected": on(brandHover),
    "icon-on-interactive-base": on(inter),
    "icon-agent-plan-base": info[rise],
    "icon-agent-docs-base": warning[rise],
    "icon-agent-ask-base": interactive[rise],
    "icon-agent-build-base": interactive[isDark ? 8 : 6],
    "icon-diff-add-base": diffAdd[10],
    "icon-diff-add-hover": diffAdd[11],
    "icon-diff-add-active": diffAdd[11],
    "icon-diff-delete-base": diffDelete[isDark ? 9 : 10],
    "icon-diff-delete-hover": diffDelete[isDark ? 10 : 11],
    "icon-diff-modified-base": warning[10],
    "syntax-comment": "var(--text-weak)",
    "syntax-regexp": text(primary),
    "syntax-string": text(success),
    "syntax-keyword": text(accent),
    "syntax-primitive": text(primary),
    "syntax-operator": text(info),
    "syntax-variable": "var(--text-strong)",
    "syntax-property": text(info),
    "syntax-type": text(warning),
    "syntax-constant": text(accent),
    "syntax-punctuation": "var(--text-weak)",
    "syntax-object": "var(--text-strong)",
    "syntax-success": success[10],
    "syntax-warning": warning[10],
    "syntax-critical": error[10],
    "syntax-info": text(info),
    "syntax-diff-add": diffAdd[10],
    "syntax-diff-delete": diffDelete[10],
    "syntax-diff-unknown": text(accent),
    "markdown-heading": text(primary),
    "markdown-text": neutral[10],
    "markdown-link": text(interactive),
    "markdown-link-text": text(info),
    "markdown-code": text(success),
    "markdown-block-quote": text(warning),
    "markdown-emph": text(warning),
    "markdown-strong": text(accent),
    "markdown-horizontal-rule": alpha[6],
    "markdown-list-item": text(interactive),
    "markdown-list-enumeration": text(info),
    "markdown-image": text(interactive),
    "markdown-image-text": text(info),
    "markdown-code-block": neutral[10],
  }

  for (const [name, scale] of Object.entries(tones)) {
    const fillColor = scale[tone]
    const weakColor = scale[soft]
    const strongColor = scale[10]
    const iconColor = name === "success" ? scale[isDark ? 8 : 6] : scale[rise]

    tokens[`surface-${name}-base`] = fillColor
    tokens[`surface-${name}-weak`] = weakColor
    tokens[`surface-${name}-strong`] = strongColor
    tokens[`text-on-${name}-base`] = on(fillColor)
    tokens[`text-on-${name}-weak`] = on(fillColor)
    tokens[`text-on-${name}-strong`] = on(strongColor)
    tokens[`border-${name}-base`] = scale[6]
    tokens[`border-${name}-hover`] = scale[7]
    tokens[`border-${name}-selected`] = scale[8]
    tokens[`icon-${name}-base`] = iconColor
    tokens[`icon-${name}-hover`] = scale[9]
    tokens[`icon-${name}-active`] = strongColor
    tokens[`icon-on-${name}-base`] = on(fillColor)
    tokens[`icon-on-${name}-hover`] = on(strongColor)
    tokens[`icon-on-${name}-selected`] = on(strongColor)
  }

  for (const [name, scale] of Object.entries(avatars)) {
    tokens[`avatar-background-${name}`] = scale[isDark ? 2 : 1]
    tokens[`avatar-text-${name}`] = scale[9]
  }

  for (const [key, value] of Object.entries(overrides)) {
    tokens[key] = value
  }

  if ("text-weak" in overrides && !("text-weaker" in overrides)) {
    const weak = tokens["text-weak"]
    tokens["text-weaker"] = weak.startsWith("#") ? shift(weak as HexColor, { l: isDark ? -0.12 : 0.12, c: 0.75 }) : weak
  }

  if (!("markdown-text" in overrides)) {
    tokens["markdown-text"] = tokens["text-base"]
  }
  if (!("markdown-code-block" in overrides)) {
    tokens["markdown-code-block"] = tokens["text-base"]
  }
  if (!("text-stronger" in overrides)) {
    tokens["text-stronger"] = tokens["text-strong"]
  }

  return tokens
}

interface ThemeColors {
  neutral: HexColor
  primary: HexColor
  accent: HexColor
  success: HexColor
  warning: HexColor
  error: HexColor
  info: HexColor
  interactive: HexColor
  diffAdd?: HexColor
  diffDelete?: HexColor
}

function getColors(variant: ThemeVariant): ThemeColors {
  return {
    neutral: variant.seeds.neutral,
    primary: variant.seeds.primary,
    accent: variant.seeds.accent ?? variant.seeds.info,
    success: variant.seeds.success,
    warning: variant.seeds.warning,
    error: variant.seeds.error,
    info: variant.seeds.info,
    interactive: variant.seeds.interactive ?? variant.seeds.primary,
    diffAdd: variant.seeds.diffAdd,
    diffDelete: variant.seeds.diffDelete,
  }
}

function generateNeutralAlphaScale(neutral: HexColor[], isDark: boolean): HexColor[] {
  const alpha = isDark
    ? [0.038, 0.066, 0.1, 0.142, 0.19, 0.252, 0.334, 0.446, 0.58, 0.718, 0.854, 0.985]
    : [0.03, 0.06, 0.1, 0.145, 0.2, 0.265, 0.35, 0.47, 0.61, 0.74, 0.86, 0.97]

  return alpha.map((value) => blend(neutral[11], neutral[0], value))
}

function getHex(value: ColorValue | undefined): HexColor | undefined {
  if (!value?.startsWith("#")) return
  return value as HexColor
}

export function resolveTheme(theme: DesktopTheme): { light: ResolvedTheme; dark: ResolvedTheme } {
  return {
    light: resolveThemeVariant(theme.light, false),
    dark: resolveThemeVariant(theme.dark, true),
  }
}

export function themeToCss(tokens: ResolvedTheme): string {
  return Object.entries(tokens)
    .map(([key, value]) => `--${key}: ${value};`)
    .join("\n  ")
}
