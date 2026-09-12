#!/usr/bin/env node
// Convert sRGB hex colours to OKLCH strings. Usage: node scripts/oklch.mjs '#5B5BD6' ...
// Used to author src/theme/*.css from the hex values in docs/DESIGN.md.

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function hexToOklch(hex) {
  const h = hex.replace("#", "")
  const r = srgbToLinear(parseInt(h.slice(0, 2), 16) / 255)
  const g = srgbToLinear(parseInt(h.slice(2, 4), 16) / 255)
  const b = srgbToLinear(parseInt(h.slice(4, 6), 16) / 255)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.hypot(a, bb)
  let H = (Math.atan2(bb, a) * 180) / Math.PI
  if (H < 0) H += 360
  return { L, C, H }
}

export function format({ L, C, H }) {
  const c = C < 0.002 ? 0 : C
  return `oklch(${L.toFixed(3)} ${c.toFixed(3)} ${c === 0 ? 0 : H.toFixed(1)})`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const arg of process.argv.slice(2)) {
    console.log(`${arg}\t${format(hexToOklch(arg))}`)
  }
}
