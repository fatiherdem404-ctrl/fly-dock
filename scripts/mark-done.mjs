// Usage: node scripts/mark-done.mjs 0.2 [1.1 ...] — puts a check mark in front of roadmap items.
import { readFileSync, writeFileSync } from 'node:fs'
let s = readFileSync('ROADMAP.md', 'utf-8')
for (const id of process.argv.slice(2)) s = s.replace(new RegExp(`^\| ${id.replace('.', '\.')} \|`, 'm'), `| ✅ ${id} |`)
writeFileSync('ROADMAP.md', s)
