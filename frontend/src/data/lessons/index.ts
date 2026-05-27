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
 * Textbook assets live in `public/textbook-assets/` and are served at
 * root-relative `/textbook-assets/…` paths by both Vite (dev) and
 * Cloudflare Pages (production). No runtime URL rewriting needed.
 */

import type { LessonSeedData } from '@/types/lesson'

import g2v2_u4_l4 from './g2v2-u4-l4.json'
import g2v2_u4_l5 from './g2v2-u4-l5.json'
import g2v2_u5_l1 from './g2v2-u5-l1.json'

// Vite's `resolveJsonModule` widens deeply-typed JSON into `any`, so
// the cast here is the only place we promise the shape is correct.
// The `LessonSeedData` interface is the contract.
export const LESSONS: Record<string, LessonSeedData> = {
    'g2v2-u4-l4': g2v2_u4_l4 as unknown as LessonSeedData,
    'g2v2-u4-l5': g2v2_u4_l5 as unknown as LessonSeedData,
    'g2v2-u5-l1': g2v2_u5_l1 as unknown as LessonSeedData,
}

/**
 * Lessons that should appear as cards on the Community page,
 * in the order they should render. Pilot study scope is fixed at
 * these three lessons; expand here when more LKPs ship.
 */
export const LESSON_REGISTRY: LessonSeedData[] = [
    LESSONS['g2v2-u4-l4'],
    LESSONS['g2v2-u4-l5'],
    LESSONS['g2v2-u5-l1'],
]

export function getLesson(id: string): LessonSeedData | null {
    return LESSONS[id] ?? null
}
