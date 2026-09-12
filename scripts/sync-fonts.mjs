#!/usr/bin/env node
// Copies the Geist variable fonts out of the `geist` npm package into src/theme/fonts.
// The package only exports Next.js font loaders, so the woff2 files are vendored here
// (SIL Open Font License; see src/theme/fonts/LICENSE.txt).
import { copyFileSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const pkgRoot = dirname(require.resolve("geist/package.json"))
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "theme", "fonts")
mkdirSync(out, { recursive: true })

const files = [
  ["dist/fonts/geist-sans/Geist-Variable.woff2", "Geist-Variable.woff2"],
  ["dist/fonts/geist-mono/GeistMono-Variable.woff2", "GeistMono-Variable.woff2"],
  ["LICENSE.txt", "LICENSE.txt"],
]
for (const [from, to] of files) {
  copyFileSync(join(pkgRoot, from), join(out, to))
  console.log(`copied ${from} -> src/theme/fonts/${to}`)
}
