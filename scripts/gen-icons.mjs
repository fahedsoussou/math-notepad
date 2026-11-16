// One-off script: rasterize public/icon-source.svg into the PNG icon sizes
// needed by the PWA manifest and favicon. Run with: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const src = path.join(root, 'public', 'icon-source.svg')

const sizes = [
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32x32.png', 32],
]

for (const [name, size] of sizes) {
  await sharp(src).resize(size, size).png().toFile(path.join(root, 'public', name))
  console.log('wrote', name)
}
