import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 语义文字色的对比度门禁。
 *
 * 为什么不是快照测试：颜色值会被设计调整，但「浅底小字必须 ≥ 4.5:1」
 * 这条约束不能跟着漂。这里直接解析 variables.css，把 var() 链解开，
 * 所以 token 改名或改值都会重新计算，而不是锁死某几个十六进制。
 */

type Declarations = Map<string, string>

interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

const css = readFileSync(new URL('../src/styles/variables.css', import.meta.url), 'utf8')

function blockFor(selector: string): Declarations {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`${escaped}\\s*{([^}]*)}`, 'g')
  const declarations: Declarations = new Map()
  let found = false
  for (const match of css.matchAll(pattern)) {
    found = true
    for (const [, name, value] of match[1].matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      declarations.set(name, value.trim())
    }
  }
  if (!found) throw new Error(`找不到 CSS 块: ${selector}`)
  return declarations
}

const light = blockFor(':root')
const dark = new Map([...light, ...blockFor(":root[data-theme='dark']")])

function resolve(name: string, declarations: Declarations, seen: string[] = []): string {
  if (seen.includes(name)) throw new Error(`CSS 变量循环: ${[...seen, name].join(' -> ')}`)
  const value = declarations.get(name)
  if (!value) throw new Error(`找不到 CSS 变量: --${name}`)
  const variable = /^var\(--([a-z0-9-]+)\)$/.exec(value)
  return variable ? resolve(variable[1], declarations, [...seen, name]) : value
}

function parseColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join('') : hex[1]
    return {
      r: Number.parseInt(digits.slice(0, 2), 16),
      g: Number.parseInt(digits.slice(2, 4), 16),
      b: Number.parseInt(digits.slice(4, 6), 16),
      a: 1,
    }
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(value)
  if (rgba) {
    const [r, g, b, a = '1'] = rgba[1].split(',').map((part) => part.trim())
    return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) }
  }
  throw new Error(`无法解析颜色: ${value}`)
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground.a + background.a * (1 - foreground.a)
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 1 }
  const blend = (fg: number, bg: number) =>
    Math.round((fg * foreground.a + bg * background.a * (1 - foreground.a)) / alpha)
  return {
    r: blend(foreground.r, background.r),
    g: blend(foreground.g, background.g),
    b: blend(foreground.b, background.b),
    a: alpha,
  }
}

function luminance(color: Rgba): number {
  const channel = (value: number) => {
    const normalized = value / 255
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

function contrast(foreground: Rgba, background: Rgba): number {
  const fg = luminance(composite(foreground, background))
  const bg = luminance(background)
  const [lighter, darker] = fg > bg ? [fg, bg] : [bg, fg]
  return (lighter + 0.05) / (darker + 0.05)
}

function ratio(textToken: string, backgroundToken: string, declarations: Declarations): number {
  const base = parseColor(resolve('color-bg-primary', declarations))
  let background = parseColor(resolve(backgroundToken, declarations))
  if (background.a < 1) background = composite(background, base)
  const foreground = parseColor(resolve(textToken, declarations))
  return contrast(foreground, background)
}

const cases: Array<{
  theme: 'light' | 'dark'
  text: string
  backgrounds: string[]
}> = [
  { theme: 'light', text: 'color-text-primary', backgrounds: ['color-bg-primary', 'color-bg-secondary'] },
  { theme: 'light', text: 'color-text-secondary', backgrounds: ['color-bg-primary', 'color-bg-secondary'] },
  { theme: 'light', text: 'color-text-tertiary', backgrounds: ['color-bg-primary', 'color-bg-secondary'] },
  { theme: 'light', text: 'color-text-brand', backgrounds: ['color-bg-primary', 'color-bg-brand-light', 'color-primary-100'] },
  { theme: 'light', text: 'color-text-success', backgrounds: ['color-bg-primary', 'color-success-50'] },
  { theme: 'light', text: 'color-text-warning', backgrounds: ['color-bg-primary', 'color-warning-50'] },
  { theme: 'light', text: 'color-text-danger', backgrounds: ['color-bg-primary', 'color-danger-50'] },
  { theme: 'light', text: 'color-text-info', backgrounds: ['color-bg-primary'] },
  { theme: 'dark', text: 'color-text-primary', backgrounds: ['color-bg-primary', 'color-bg-secondary', 'color-bg-tertiary'] },
  { theme: 'dark', text: 'color-text-secondary', backgrounds: ['color-bg-primary', 'color-bg-secondary', 'color-bg-tertiary'] },
  { theme: 'dark', text: 'color-text-tertiary', backgrounds: ['color-bg-primary', 'color-bg-secondary', 'color-bg-tertiary'] },
  { theme: 'dark', text: 'color-text-brand', backgrounds: ['color-bg-primary', 'color-bg-brand-light'] },
  { theme: 'dark', text: 'color-text-success', backgrounds: ['color-bg-primary', 'color-bg-secondary'] },
  { theme: 'dark', text: 'color-text-warning', backgrounds: ['color-bg-primary', 'color-bg-secondary'] },
  { theme: 'dark', text: 'color-text-danger', backgrounds: ['color-bg-primary', 'color-bg-secondary'] },
  { theme: 'dark', text: 'color-text-info', backgrounds: ['color-bg-primary', 'color-bg-secondary'] },
]

describe('语义文字色对比度', () => {
  for (const { theme, text, backgrounds } of cases) {
    for (const background of backgrounds) {
      it(`${theme}: --${text} on --${background} ≥ 4.5:1`, () => {
        const value = ratio(text, background, theme === 'light' ? light : dark)
        expect(value, `实际 ${value.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})
