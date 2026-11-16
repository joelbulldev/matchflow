import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = path.join(root, 'assets', 'build')
const viteManifest = path.join(buildDir, '.vite', 'manifest.json')
const flatManifest = path.join(buildDir, 'manifest.json')

if (!existsSync(viteManifest)) {
  console.error('sync-vite-manifest: missing', viteManifest)
  process.exit(1)
}

mkdirSync(buildDir, { recursive: true })
copyFileSync(viteManifest, flatManifest)

const manifest = JSON.parse(readFileSync(flatManifest, 'utf8'))
const assetsDir = path.join(buildDir, 'assets')
let js = ''
let css = ''

for (const item of Object.values(manifest)) {
  if (item && typeof item === 'object' && item.isEntry && item.file) {
    js = String(item.file)
    if (Array.isArray(item.css) && item.css[0]) css = String(item.css[0])
    break
  }
}

if (js) {
  const pointer = {
    version: 1,
    js: js.replace(/^\//, ''),
    css: css ? css.replace(/^\//, '') : null,
    builtAt: new Date().toISOString(),
  }
  writeFileSync(path.join(buildDir, 'entry.json'), JSON.stringify(pointer, null, 2))
  console.log('sync-vite-manifest: entry', pointer.js)
}
