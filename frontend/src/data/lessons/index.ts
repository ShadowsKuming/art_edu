/**
 * LKP (Lesson Knowledge Package) registry.
 *
 * The JSON files in this directory are *copies* of the canonical
 * versions in `backend/data/lessons/`, synced via
 * `npm run sync-lessons` (also wired as a `prebuild` hook).
 *
 * Add a new lesson here when its backend LKP file is ready — keep the
 * `LESSON_REGISTRY` order matching the Community page display order.
 *
 * Production URL rewriting
 * ────────────────────────
 * LKP JSONs use root-relative `/textbook-assets/…` paths. In dev Vite
 * serves them directly from `public/textbook-assets/`. In production
 * Cloudflare Pages serves the same files at the same root-relative paths,
 * so `VITE_ASSETS_BASE` can be left empty — `rewriteAssetUrls` is a no-op.
 * Set `VITE_ASSETS_BASE` only if assets are hosted on a separate origin
 * (e.g. R2 bucket or a CDN).
 */

import type { LessonSeedData } from '@/types/lesson'

import g2v2_u4_l4 from './g2v2-u4-l4.json'

// ─── Asset URL rewriting ─────────────────────────────────────────────

// Trim trailing slash so concatenation is predictable.
const PROD_ASSETS_BASE = (
    (import.meta.env.VITE_ASSETS_BASE as string | undefined)?.replace(/\/+$/, '') ?? ''
)

/**
 * Walk an arbitrary JSON-like structure and prefix every root-relative
 * `/textbook-assets/…` path with PROD_ASSETS_BASE.
 * No-op when `VITE_ASSETS_BASE` is unset (i.e. local development with proxy).
 */
function rewriteAssetUrls<T>(node: T): T {
    if (!PROD_ASSETS_BASE) return node

    if (typeof node === 'string') {
        if (node.startsWith('/textbook-assets/')) {
            return (PROD_ASSETS_BASE + node) as unknown as T
        }
        return node
    }
    if (Array.isArray(node)) {
        return node.map((item) => rewriteAssetUrls(item)) as unknown as T
    }
    if (node && typeof node === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
            out[k] = rewriteAssetUrls(v)
        }
        return out as unknown as T
    }
    return node
}

// Vite's `resolveJsonModule` widens deeply-typed JSON into `any`, so
// the cast here is the only place we promise the shape is correct.
// The `LessonSeedData` interface is the contract.
export const LESSONS: Record<string, LessonSeedData> = {
    'g2v2-u4-l4': rewriteAssetUrls(g2v2_u4_l4 as unknown as LessonSeedData),
}

/**
 * Lessons that should appear as cards on the Community page,
 * in the order they should render.
 */
export const LESSON_REGISTRY: LessonSeedData[] = [
    LESSONS['g2v2-u4-l4'],
]

export function getLesson(id: string): LessonSeedData | null {
    return LESSONS[id] ?? null
}
