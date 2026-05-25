/**
 * LKP (Lesson Knowledge Package) registry.
 *
 * The JSON files in this directory are *copies* of the canonical
 * versions in `backend/data/lessons/`, synced via
 * `npm run sync-lessons` (also wired as a `prebuild` hook).
 *
 * Add a new lesson here when its backend LKP file is ready — keep the
 * `LESSON_REGISTRY` order matching the Community page display order.
 */

import type { LessonSeedData } from '@/types/lesson'

import g2v2_u4_l4 from './g2v2-u4-l4.json'

// Vite's `resolveJsonModule` widens deeply-typed JSON into `any`, so
// the cast here is the only place we promise the shape is correct.
// The `LessonSeedData` interface is the contract.
export const LESSONS: Record<string, LessonSeedData> = {
    'g2v2-u4-l4': g2v2_u4_l4 as unknown as LessonSeedData,
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
