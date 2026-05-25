#!/usr/bin/env node
/**
 * Sync `frontend/src/assets/textbook-assets/` → Cloudflare R2.
 *
 * Usage:
 *   1) One-time:  npx wrangler login    (opens browser)
 *   2) One-time:  npx wrangler r2 bucket create artbloom-textbook-assets
 *   3) One-time:  enable public access on the bucket in the Cloudflare
 *                 dashboard (R2 → bucket → Settings → Public access →
 *                 "Allow Access" → r2.dev subdomain), then copy the
 *                 `pub-xxxxxxxx.r2.dev` URL.
 *   4) Anytime:   npm run r2:sync
 *
 * Skipped: .mp4, .pptx, .mp3 (they're gitignored and too large for the
 * pilot — re-add to EXTENSIONS below once you want them on R2 too).
 */

import { spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..', 'src', 'assets', 'textbook-assets')
const BUCKET = process.env.R2_BUCKET || 'artbloom-textbook-assets'

const EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'])
const MIME = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
}

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full, out)
        else if (EXTENSIONS.has(extname(entry).toLowerCase())) out.push(full)
    }
    return out
}

const files = walk(ROOT)
console.log(`[r2-sync] found ${files.length} files under ${ROOT}`)
console.log(`[r2-sync] target bucket: ${BUCKET}\n`)

let ok = 0
let fail = 0
for (const file of files) {
    const key = relative(ROOT, file).split('\\').join('/') // win-safe
    const ct = MIME[extname(file).toLowerCase()] || 'application/octet-stream'
    process.stdout.write(`  ↑ ${key}  (${ct}) ... `)
    const res = spawnSync(
        'npx',
        [
            'wrangler',
            'r2',
            'object',
            'put',
            `${BUCKET}/${key}`,
            `--file=${file}`,
            `--content-type=${ct}`,
            '--remote',
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    if (res.status === 0) {
        ok++
        console.log('ok')
    } else {
        fail++
        console.log('FAIL')
        const stderr = (res.stderr || '').toString()
        if (stderr) console.log(stderr.split('\n').slice(0, 4).join('\n'))
    }
}

console.log(`\n[r2-sync] done: ${ok} uploaded, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
