// ──────────────────────────────────────────────────────────────────────────
// In-place image optimizer for src/assets/images.
//
// Why: the source PNGs are huge (hero-main 3 MB, several 1–2 MB banners),
// totalling ~46 MB. Vite ships them essentially as-is, so the homepage pulled
// ~20 MB of images on first paint and saturated the connection (~50 s loads).
//
// What it does (Plan A — keep PNG format, DON'T touch import paths):
//   • downsizes anything wider than MAX_WIDTH (retina-safe cap)
//   • re-encodes PNG with palette quantization + max zlib effort
//   • only overwrites a file when the result is actually smaller
//
// Re-run any time new art is added:   node scripts/optimize-images.js
// Requires `sharp` (already a transitive dep; install with `npm i -D sharp`).
// ──────────────────────────────────────────────────────────────────────────
import { readdir, stat, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = fileURLToPath(new URL('../src/assets/images', import.meta.url))
const MAX_WIDTH = 1920 // retina-safe upper bound for full-bleed art

const fmtKB = (n) => `${(n / 1024).toFixed(0)} KB`

async function* walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) yield* walk(full)
        else yield full
    }
}

async function optimize(file) {
    const ext = path.extname(file).toLowerCase()
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) return null

    const before = (await stat(file)).size
    const input = await readFile(file)
    let img = sharp(input, { failOn: 'none' })
    const meta = await img.metadata()

    if (meta.width && meta.width > MAX_WIDTH) {
        img = img.resize({ width: MAX_WIDTH, withoutEnlargement: true })
    }

    if (ext === '.png') {
        img = img.png({ palette: true, quality: 80, compressionLevel: 9, effort: 8 })
    } else {
        img = img.jpeg({ quality: 82, mozjpeg: true })
    }

    const output = await img.toBuffer()
    if (output.length < before) {
        await writeFile(file, output)
        return { file, before, after: output.length }
    }
    return { file, before, after: before, skipped: true }
}

let totalBefore = 0
let totalAfter = 0
for await (const file of walk(ROOT)) {
    const res = await optimize(file)
    if (!res) continue
    totalBefore += res.before
    totalAfter += res.after
    const rel = path.relative(ROOT, res.file)
    if (res.skipped) {
        console.log(`= ${rel}  (${fmtKB(res.before)}, already optimal)`)
    } else {
        const pct = (100 * (1 - res.after / res.before)).toFixed(0)
        console.log(`✓ ${rel}  ${fmtKB(res.before)} → ${fmtKB(res.after)}  (-${pct}%)`)
    }
}
console.log(
    `\nTotal: ${fmtKB(totalBefore)} → ${fmtKB(totalAfter)} ` +
    `(-${(100 * (1 - totalAfter / totalBefore)).toFixed(0)}%)`,
)
