#!/usr/bin/env node
/**
 * Sync LKP (Lesson Knowledge Package) JSON files from the backend
 * (`backend/data/lessons/`) to the frontend (`src/data/lessons/`).
 *
 * Source of truth lives in the backend so the LKP loader and the
 * Community page always see the same data. Run before each build
 * (wired via the `prebuild` script in package.json).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(__dirname, '../../backend/data/lessons')
const DST = path.resolve(__dirname, '../src/data/lessons')

if (!fs.existsSync(SRC)) {
    console.error(`[sync-lessons] source missing: ${SRC}`)
    process.exit(1)
}

fs.mkdirSync(DST, { recursive: true })

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.json'))
if (files.length === 0) {
    console.warn(`[sync-lessons] no .json files found in ${SRC}`)
}
for (const f of files) {
    fs.copyFileSync(path.join(SRC, f), path.join(DST, f))
    console.log(`[sync-lessons] ✓ ${f}`)
}
console.log(`[sync-lessons] synced ${files.length} file(s) → ${path.relative(process.cwd(), DST)}`)
