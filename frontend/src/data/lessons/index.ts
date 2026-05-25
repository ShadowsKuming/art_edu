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
 * LKP JSONs ship with hard-coded `http://localhost:8001/textbook-assets/…`
 * URLs so the backend's StaticFiles mount + Doubao vision LLM see the
 * same files in dev. In production we set `VITE_ASSETS_BASE` to the
 * Cloudflare R2 public bucket (e.g. `https://pub-xxx.r2.dev`) and
 * rewrite every `localhost:8001/textbook-assets/...` → R2 host below.
 *
 * If you want the backend (Render) to *also* see R2 instead of local
 * disk, set `TEXTBOOK_ASSETS_URL` in Render env to the same R2 host.
 */

import type { LessonSeedData } from '@/types/lesson'

import g2v2_u4_l4 from './g2v2-u4-l4.json'

// ─── Asset URL rewriting ─────────────────────────────────────────────

const DEV_ASSETS_BASE = 'http://localhost:8001/textbook-assets'

// Trim trailing slash so concatenation is predictable.
const PROD_ASSETS_BASE = (
    (import.meta.env.VITE_ASSETS_BASE as string | undefined)?.replace(/\/+$/, '') ?? ''
)

/**
 * Walk an arbitrary JSON-like structure and replace every occurrence
 * of the dev assets prefix with the configured production prefix.
 * No-op when `VITE_ASSETS_BASE` is unset (i.e. local development).
 */
function rewriteAssetUrls<T>(node: T): T {
    if (!PROD_ASSETS_BASE) return node

    if (typeof node === 'string') {
        if (node.startsWith(DEV_ASSETS_BASE)) {
            return node.replace(DEV_ASSETS_BASE, `${PROD_ASSETS_BASE}`) as unknown as T
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
