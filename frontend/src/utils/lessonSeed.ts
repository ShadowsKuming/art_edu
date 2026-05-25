/**
 * Turn an LKP (Lesson Knowledge Package) into a concrete `Project` +
 * `SlideSnapshot` ready to be stored by the projects store.
 *
 * Called by the Community page when a teacher clicks **Save** on a
 * lesson card — it deep-copies the seed into their personal library
 * so they can edit freely without ever touching the shared LKP.
 *
 * Video / audio binaries are *not* embedded as data URLs (the LKP
 * carries them as URLs and Part 5 will fetch on demand). Image
 * elements similarly reference URLs only — keeps the LocalStorage
 * payload small.
 */

import type { LessonSeedData, SlideFrameworkEntry } from '@/types/lesson'
import type { Slide, SlideElement } from '@/stores/slides'
import type { ProjectMeta, SlideSnapshot } from '@/stores/projects'

let elCounter = 0
function newElId() {
    return `el-seed-${Date.now()}-${++elCounter}`
}

function buildElements(
    entry: SlideFrameworkEntry,
    locale: 'en' | 'zh',
): SlideElement[] {
    // If the LKP author shipped explicit `default_elements` (including an
    // empty array — useful for image-only covers), materialise them and
    // skip the generic title+points fallback below.
    if (entry.default_elements !== undefined) {

        return entry.default_elements.map((srcEl) => {
            // Bilingual: if either content_en or content_zh is set, surface
            // both onto the element so the workspace's EN/中 toggle can swap
            // languages live. `content` itself is initialised to whichever
            // side matches the hydration locale (falling back to the other
            // side if only one was authored).
            const hasBilingual =
                srcEl.content_en !== undefined || srcEl.content_zh !== undefined
            const initialContent = hasBilingual
                ? (locale === 'zh'
                    ? (srcEl.content_zh ?? srcEl.content_en ?? '')
                    : (srcEl.content_en ?? srcEl.content_zh ?? ''))
                : (srcEl.content ?? '')

            return {
                id: newElId(),
                type: srcEl.type,
                x: srcEl.x,
                y: srcEl.y,
                width: srcEl.width,
                height: srcEl.height,
                content: initialContent,
                contentEn: hasBilingual ? (srcEl.content_en ?? '') : undefined,
                contentZh: hasBilingual ? (srcEl.content_zh ?? '') : undefined,
                fontSize: srcEl.fontSize ?? 24,
                fontWeight: srcEl.fontWeight ?? 'Normal',
                fontFamily: srcEl.fontFamily ?? 'Albert Sans',
                textAlign:
                    (srcEl.textAlign as SlideElement['textAlign']) ?? 'left',
                color: srcEl.color ?? '#111827',
                src: srcEl.src,
                flipH: srcEl.flipH,
                flipV: srcEl.flipV,
                rotation: srcEl.rotation,
            }
        })
    }


    // Otherwise, seed each slide with the section title + content
    // points as two text elements. Teacher can edit / delete freely.
    return [
        {
            id: newElId(),
            type: 'text',
            x: 80,
            y: 80,
            width: 800,
            height: 80,
            content: entry.section,
            fontSize: 40,
            fontWeight: 'Bold',
            fontFamily: 'Albert Sans',
            textAlign: 'left',
            color: '#111827',
        },
        {
            id: newElId(),
            type: 'text',
            x: 80,
            y: 200,
            width: 800,
            height: 240,
            content: entry.content_points,
            fontSize: 20,
            fontWeight: 'Normal',
            fontFamily: 'Albert Sans',
            textAlign: 'left',
            color: '#374151',
        },
    ]
}

/**
 * Build the slide list (one Slide per LKP `slide_framework` entry).
 */
function buildSlides(seed: LessonSeedData, locale: 'en' | 'zh'): Slide[] {
    return seed.slide_framework
        .slice()
        .sort((a, b) => a.page - b.page)
        .map((entry, idx) => ({
            id: `slide-${Date.now()}-${idx + 1}`,
            partId: entry.part_id,
            elements: buildElements(entry, locale),
            background: entry.default_background,
            bgColor: undefined,
            isLocalBackground: !!entry.default_background,
        }))
}


/**
 * Construct the `ProjectMeta` snapshot for a hydrated lesson.
 */
function buildMeta(seed: LessonSeedData): ProjectMeta {
    // Derive volume / unit / lesson numeric positions from the id
    // (`g2v2-u4-l4` → grade 2, volume 2, unit 4, lesson 4) so the
    // MyLessons table can render them without an extra curriculum
    // lookup.
    const idMatch = /^g(\d)v(\d)-u(\d+)-l(\d+)$/.exec(seed.lesson_id)
    const grade = seed.grade ?? (idMatch ? +idMatch[1] : 0)
    const volume = seed.volume ?? (idMatch ? +idMatch[2] : 1)
    const unitNumber = idMatch ? +idMatch[3] : 0
    const lessonNumber = idMatch ? +idMatch[4] : 0

    return {
        volumeId: `g${grade}v${volume}`,
        unitId: seed.unit_id,
        lessonId: seed.lesson_id,
        grade,
        volume,
        unitNumber,
        lessonNumber,
        unitTitleEn: seed.unit_title_en ?? '',
        unitTitleZh: seed.unit_title_zh ?? '',
        lessonTitleEn: seed.lesson_title_en,
        lessonTitleZh: seed.lesson_title_zh,
    }
}

export interface HydratedLesson {
    name: string
    meta: ProjectMeta
    snapshot: SlideSnapshot
}

/**
 * Take an LKP and return everything needed to feed
 * `projectsStore.createProject` + `saveCurrentProject`.
 *
 * Caller decides the locale at create-time (the project name is then
 * static — MyLessons re-localises the *prefix* via `meta`).
 */
export function hydrateProjectFromLesson(
    seed: LessonSeedData,
    locale: 'en' | 'zh' = 'en',
): HydratedLesson {
    const meta = buildMeta(seed)
    const slides = buildSlides(seed, locale)


    const snapshot: SlideSnapshot = {
        slides,
        activePart: 1,
        maxUnlockedPart: 7, // hydrated lessons unlock every Part immediately
        globalBackground: undefined,
        globalBgColor: undefined,
    }

    const name = locale === 'zh' ? seed.lesson_title_zh : seed.lesson_title_en

    return { name, meta, snapshot }
}
