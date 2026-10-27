// Fails when the product name, ids or links are hardcoded in code, or when package.json / generated docs
// disagree with src/config/brand.config.json. Placeholder values only produce warnings.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const brand = JSON.parse(readFileSync('src/config/brand.config.json', 'utf-8'))
const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
const errors = []
const warnings = []

const forbidden = [brand.name, brand.slug, brand.appId, brand.repoUrl, brand.issuesUrl, brand.kofiUrl, brand.websiteUrl, 'RocketDock Pro', 'rocketdockpro', 'rocketdock-pro']
  .filter(Boolean)
const codeRoots = ['electron', 'src']
const codeFiles = ['index.html']
const ext = /\.(ts|tsx|css|html|js|cjs|mjs)$/

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (ext.test(full)) yield full
  }
}
for (const file of [...codeRoots.flatMap((r) => [...walk(r)]), ...codeFiles]) {
  readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
    for (const word of forbidden) if (line.includes(word)) errors.push(`${file}:${i + 1}: hardcoded "${word}" — read it from brand.config.json`)
    if (/https?:\/\/(ko-fi\.com|github\.com)\//.test(line)) errors.push(`${file}:${i + 1}: hardcoded link — put it in brand.config.json`)
  })
}

const expect = (label, actual, wanted) => { if (actual !== wanted) errors.push(`package.json ${label} is "${actual}", brand says "${wanted}"`) }
expect('name', pkg.name, brand.slug)
expect('description', pkg.description, brand.description.en)
expect('license', pkg.license, brand.license)
expect('author', pkg.author, brand.company)

for (const [key, path] of Object.entries(brand.logo)) if (!existsSync(path)) errors.push(`logo.${key} points to missing file ${path}`)
if (!existsSync('LICENSE')) errors.push('LICENSE file is missing')

try { execFileSync(process.execPath, ['scripts/render-docs.mjs', '--check'], { stdio: 'pipe' }) }
catch (e) { errors.push(String(e.stderr || e.message).trim()) }

if (JSON.stringify(brand).includes('PLACEHOLDER')) warnings.push('brand.config.json still has PLACEHOLDER values (repo / Ko-fi) — fill them in before publishing')

warnings.forEach((w) => console.warn(`warning: ${w}`))
if (errors.length) { errors.forEach((e) => console.error(e)); console.error(`\n${errors.length} brand problem(s).`); process.exit(1) }
console.log('check-brand: OK')
