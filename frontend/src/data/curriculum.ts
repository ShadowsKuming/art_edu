/**
 * Curriculum data — Grades 1-6, Volumes 1-2, Units, Lessons.
 *
 * Source of truth: `25-lesson mapping table.xlsx` at the project root.
 *
 * Only **Grade 2 Volume 2** is populated for the testing stage. The other
 * 11 volumes are present so the lesson-selection modal can render their
 * cover art, but their `available` flag is `false` and `units` is `[]` —
 * the UI must short-circuit clicks on those tiles with a non-blocking
 * "coming soon" affordance.
 *
 * Lesson titles, unit names, the per-lesson `task`, `category` (A/B per
 * the research team's taxonomy) and `aiSupport` text are all copied
 * verbatim from the xlsx so this module doubles as a lookup for future
 * Part-3 / Part-6 prompts that need the lesson metadata.
 */

// ── Volume cover images ────────────────────────────────────────────
//
// Imported as URLs so Vite hashes + emits them at build time. The 12
// PNGs were exported from the Figma file (file key 1YkPdpdcSSvcBXPcp5nFxO,
// node 563:2601) at 2× scale.

import g1v1 from '@/assets/images/textbooks/g1v1.png'
import g1v2 from '@/assets/images/textbooks/g1v2.png'
import g2v1 from '@/assets/images/textbooks/g2v1.png'
import g2v2 from '@/assets/images/textbooks/g2v2.png'
import g3v1 from '@/assets/images/textbooks/g3v1.png'
import g3v2 from '@/assets/images/textbooks/g3v2.png'
import g4v1 from '@/assets/images/textbooks/g4v1.png'
import g4v2 from '@/assets/images/textbooks/g4v2.png'
import g5v1 from '@/assets/images/textbooks/g5v1.png'
import g5v2 from '@/assets/images/textbooks/g5v2.png'
import g6v1 from '@/assets/images/textbooks/g6v1.png'
import g6v2 from '@/assets/images/textbooks/g6v2.png'

// ── Types ──────────────────────────────────────────────────────────

export type LessonCategory = 'A' | 'B'

export interface CurriculumLesson {
    /** Stable id, e.g. `g2v2-u3-l1`. Used as the `lessonId` on `Project.meta`. */
    id: string
    /** 1-based position within the unit (1..5). */
    number: number
    titleEn: string
    titleZh: string
    /** Verbatim "Main textbook task" column from the xlsx. */
    task: string
    /**
     * Research-team category:
     *   • A — flat 2D image / drawing / layout output
     *   • B — physical material construction
     */
    category: LessonCategory
    /** Verbatim "Suggested AI support" column from the xlsx. */
    aiSupport: string
}

export interface CurriculumUnit {
    /** Stable id, e.g. `g2v2-u3`. */
    id: string
    number: number
    titleEn: string
    titleZh: string
    lessons: CurriculumLesson[]
}

export interface CurriculumVolume {
    /** Stable id, e.g. `g2v2`. */
    id: string
    grade: 1 | 2 | 3 | 4 | 5 | 6
    volume: 1 | 2
    /** Cover image (Vite-hashed asset URL). */
    coverUrl: string
    /**
     * `true` only for the volume that has actual lesson data wired up
     * during the testing stage. Other volumes show their cover and a
     * disabled affordance.
     */
    available: boolean
    /** Empty `[]` when `available === false`. */
    units: CurriculumUnit[]
}

// ── Grade 2, Volume 2 — the only fully populated entry ─────────────

const g2v2Units: CurriculumUnit[] = [
    {
        id: 'g2v2-u1',
        number: 1,
        titleEn: 'The Beauty of Arrangement and Combination',
        titleZh: '排列组合的美',
        lessons: [
            {
                id: 'g2v2-u1-l1',
                number: 1,
                titleEn: 'Dot Gathering',
                titleZh: '点点聚会',
                task: 'Use dot-like similar shapes to create an interesting picture and tell a small story about it.',
                category: 'A',
                aiSupport: 'Example generation, composition prompts, story prompt',
            },
            {
                id: 'g2v2-u1-l2',
                number: 2,
                titleEn: 'Neat Stripes',
                titleZh: '条纹乖乖',
                task: 'Use lines in repeated arrangements; draw striped clothing / figures.',
                category: 'A',
                aiSupport: 'Line variation prompts, pattern exemplars',
            },
            {
                id: 'g2v2-u1-l3',
                number: 3,
                titleEn: 'Long and Short',
                titleZh: '长长短短',
                task: 'Use dots and lines to create an ink painting of natural scenery.',
                category: 'A',
                aiSupport: 'Brushstroke prompts, ink-style exemplars',
            },
            {
                id: 'g2v2-u1-l4',
                number: 4,
                titleEn: 'Arrange and Observe',
                titleZh: '摆摆看看',
                task: 'Arrange common materials into repeated, regular forms and experience the beauty of order.',
                category: 'B',
                aiSupport: 'Arrangement suggestions, photo capture, transformation',
            },
            {
                id: 'g2v2-u1-l5',
                number: 5,
                titleEn: 'Standing in Line',
                titleZh: '排排队',
                task: 'Observe queuing order in daily life and practise arranging human figures in a drawing.',
                category: 'A',
                aiSupport: 'Figure layout prompts, scene arrangement support',
            },
        ],
    },
    {
        id: 'g2v2-u2',
        number: 2,
        titleEn: 'Toy Adventure',
        titleZh: '玩具总动员',
        lessons: [
            {
                id: 'g2v2-u2-l1',
                number: 1,
                titleEn: 'Folk Toys',
                titleZh: '民间玩具',
                task: 'Appreciate folk toys; discuss their stories, colours, shapes, and materials.',
                category: 'B',
                aiSupport: 'Material/shape comparison, toy-form inspiration, discussion prompts',
            },
            {
                id: 'g2v2-u2-l2',
                number: 2,
                titleEn: 'Tangram',
                titleZh: '七巧板',
                task: 'Make a tangram set by folding, drawing, and cutting; then assemble shapes.',
                category: 'B',
                aiSupport: 'Build steps, arrangement ideas, photo-to-variation',
            },
            {
                id: 'g2v2-u2-l3',
                number: 3,
                titleEn: 'Little Tiger Toy',
                titleZh: '老虎娃',
                task: 'Make a tiger toy using card, old newspaper, cutting, layering, and decoration.',
                category: 'B',
                aiSupport: 'Prototype sketches, step visuals, decoration ideas',
            },
            {
                id: 'g2v2-u2-l4',
                number: 4,
                titleEn: 'Fold a "Big Mouth"',
                titleZh: '折"大嘴巴"',
                task: 'Fold and decorate a paper toy, then use it in play/performance.',
                category: 'B',
                aiSupport: 'Fold-step visuals, decoration variants',
            },
            {
                id: 'g2v2-u2-l5',
                number: 5,
                titleEn: 'Transforming Toys',
                titleZh: '巧变玩具',
                task: 'Transform waste materials into toys and perform a short story with them.',
                category: 'B',
                aiSupport: 'Material-to-form suggestions, buildable concepts',
            },
        ],
    },
    {
        id: 'g2v2-u3',
        number: 3,
        titleEn: 'Spring Has Arrived',
        titleZh: '春天来了',
        lessons: [
            {
                id: 'g2v2-u3-l1',
                number: 1,
                titleEn: 'Where Is Spring?',
                titleZh: '春天在哪里',
                task: 'Appreciate artworks and express the beauty of spring in an image.',
                category: 'A',
                aiSupport: 'Seasonal colour prompts, scene inspiration',
            },
            {
                id: 'g2v2-u3-l2',
                number: 2,
                titleEn: 'Little Tree, Grow Quickly',
                titleZh: '小树快快长',
                task: 'Tear, cut, and paste coloured paper to make a tree image.',
                category: 'A',
                aiSupport: 'Collage exemplars, shape/colour prompts',
            },
            {
                id: 'g2v2-u3-l3',
                number: 3,
                titleEn: "It's Raining",
                titleZh: '下雨了',
                task: 'Draw rainy scenes, often with personified plants/animals.',
                category: 'A',
                aiSupport: 'Weather/mood prompt cards, character cues',
            },
            {
                id: 'g2v2-u3-l4',
                number: 4,
                titleEn: 'Spring Solar Term Card',
                titleZh: '春日节气卡',
                task: 'Design a spring solar-term card combining image and layout.',
                category: 'A',
                aiSupport: 'Card templates, motif suggestions, title/layout help',
            },
            {
                id: 'g2v2-u3-l5',
                number: 5,
                titleEn: 'All Things Grow',
                titleZh: '万物生长',
                task: 'Observe growth changes and make a stop-motion sequence based on physical making and photo capture.',
                category: 'B',
                aiSupport: 'Physical scene setup, sequence prompts, capture support',
            },
        ],
    },
    {
        id: 'g2v2-u4',
        number: 4,
        titleEn: 'My Picture Book',
        titleZh: '我的图画书',
        lessons: [
            {
                id: 'g2v2-u4-l1',
                number: 1,
                titleEn: 'Interesting Picture Books',
                titleZh: '有趣的图画书',
                task: 'Appreciate different picture books, share stories, and role-play characters.',
                category: 'A',
                aiSupport: 'Story-page comparison, character/story prompts, discussion scaffolds',
            },
            {
                id: 'g2v2-u4-l2',
                number: 2,
                titleEn: 'A Different Picture Book',
                titleZh: '不一样的图画书',
                task: 'Fold, draw, cut, and make a special picture book.',
                category: 'A',
                aiSupport: 'Page ideas, cut/fold page prompts, sequencing support',
            },
            {
                id: 'g2v2-u4-l3',
                number: 3,
                titleEn: 'What Happened?',
                titleZh: '发生了什么？',
                task: 'Add scenes to repeated shapes and connect front/back pages into a small story.',
                category: 'A',
                aiSupport: 'Shape-to-scene prompts, story generation cues',
            },
            {
                id: 'g2v2-u4-l4',
                number: 4,
                titleEn: 'So Long, So Long…',
                titleZh: '好长好长……',
                task: 'Use a long sheet of paper to create an extended visual story.',
                category: 'A',
                aiSupport: 'Scroll layout support, scene-sequence prompts',
            },
            {
                id: 'g2v2-u4-l5',
                number: 5,
                titleEn: 'An Eye-Catching Title',
                titleZh: '吸引人的标题',
                task: 'Design an attractive title for a favourite or self-made story.',
                category: 'A',
                aiSupport: 'Title style options, font-size/colour/layout suggestions',
            },
        ],
    },
    {
        id: 'g2v2-u5',
        number: 5,
        titleEn: 'Painting with Music',
        titleZh: '音乐入画来',
        lessons: [
            {
                id: 'g2v2-u5-l1',
                number: 1,
                titleEn: 'Listen and Draw',
                titleZh: '听听画画',
                task: 'Listen to music and express feelings with lines and colours.',
                category: 'A',
                aiSupport: 'Mood-line-colour exemplars, music-to-image prompts',
            },
            {
                id: 'g2v2-u5-l2',
                number: 2,
                titleEn: 'Make Your Own Musical Instrument',
                titleZh: '自制乐器',
                task: 'Design and make small musical instruments using bottles, sand, beans, chopsticks, etc.',
                category: 'B',
                aiSupport: 'Buildable concept sketches, assembly steps',
            },
            {
                id: 'g2v2-u5-l3',
                number: 3,
                titleEn: 'Our Programme Sheet',
                titleZh: '我们的节目单',
                task: 'Learn the structure of a programme sheet and design one for the class concert.',
                category: 'A',
                aiSupport: 'Programme templates, title/decor/layout support',
            },
            {
                id: 'g2v2-u5-l4',
                number: 4,
                titleEn: 'Class Concert',
                titleZh: '班级音乐会',
                task: 'Use video to record the class concert and share it.',
                category: 'A',
                aiSupport: 'Recording workflow, still-frame selection, gallery reflection',
            },
            {
                id: 'g2v2-u5-l5',
                number: 5,
                titleEn: 'Wonderful Memories',
                titleZh: '精彩的记忆',
                task: 'Draw a memorable scene from the class concert based on recall.',
                category: 'A',
                aiSupport: 'Memory prompts, pose/reference support',
            },
        ],
    },
]

// ── Volume registry (12 entries, ordered grade-then-volume) ────────

export const curriculum: CurriculumVolume[] = [
    { id: 'g1v1', grade: 1, volume: 1, coverUrl: g1v1, available: false, units: [] },
    { id: 'g1v2', grade: 1, volume: 2, coverUrl: g1v2, available: false, units: [] },
    { id: 'g2v1', grade: 2, volume: 1, coverUrl: g2v1, available: false, units: [] },
    { id: 'g2v2', grade: 2, volume: 2, coverUrl: g2v2, available: true, units: g2v2Units },
    { id: 'g3v1', grade: 3, volume: 1, coverUrl: g3v1, available: false, units: [] },
    { id: 'g3v2', grade: 3, volume: 2, coverUrl: g3v2, available: false, units: [] },
    { id: 'g4v1', grade: 4, volume: 1, coverUrl: g4v1, available: false, units: [] },
    { id: 'g4v2', grade: 4, volume: 2, coverUrl: g4v2, available: false, units: [] },
    { id: 'g5v1', grade: 5, volume: 1, coverUrl: g5v1, available: false, units: [] },
    { id: 'g5v2', grade: 5, volume: 2, coverUrl: g5v2, available: false, units: [] },
    { id: 'g6v1', grade: 6, volume: 1, coverUrl: g6v1, available: false, units: [] },
    { id: 'g6v2', grade: 6, volume: 2, coverUrl: g6v2, available: false, units: [] },
]

/**
 * Convenience grouping for the volume picker grid:
 * `[ [Grade1Vol1, Grade1Vol2], [Grade2Vol1, Grade2Vol2], … ]`.
 */
export const curriculumByGrade: CurriculumVolume[][] = (() => {
    const rows: CurriculumVolume[][] = []
    for (let g = 1; g <= 6; g++) {
        rows.push(curriculum.filter(v => v.grade === g))
    }
    return rows
})()
