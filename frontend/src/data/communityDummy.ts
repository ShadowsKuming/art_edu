/**
 * Placeholder data for the Community ("Lesson Library") view.
 *
 * Intentionally static — when a real backend lands this module will be
 * replaced by an API client (e.g. `GET /api/community/lessons`). For
 * now the view consumes this typed array directly.
 *
 * The `unit` / `lesson` numbers loosely echo what real curriculum
 * entries look like, but they are *not* tied to `curriculum.ts`; the
 * Community feed is conceptually a stream of *published* decks from
 * other teachers, not a curriculum drilldown.
 */
export interface CommunityLesson {
    id: string
    /** Localised title pair so the card can swap with the language pill. */
    titleEn: string
    titleZh: string
    unit: number
    lesson: number
    /** Author display name — left as a single string per Figma. */
    author: string
    /** ISO date string; the card formats it for display. */
    date: string
    /** Optional thumbnail URL; falls back to a flat grey block when omitted. */
    thumbnail?: string
}

export const communityLessons: CommunityLesson[] = [
    {
        id: 'cl-1',
        titleEn: 'Impressionism & Light',
        titleZh: '印象派与光影',
        unit: 4,
        lesson: 1,
        author: 'Mr. Hanwen Li',
        date: '2026-05-12',
    },
    {
        id: 'cl-2',
        titleEn: 'Color & Composition',
        titleZh: '色彩与构图',
        unit: 2,
        lesson: 3,
        author: 'Ms. Wei Zhang',
        date: '2026-05-09',
    },
    {
        id: 'cl-3',
        titleEn: 'Story Through Shape',
        titleZh: '从形状讲故事',
        unit: 3,
        lesson: 2,
        author: 'Mr. Hanwen Li',
        date: '2026-04-28',
    },
    {
        id: 'cl-4',
        titleEn: 'Lines That Move',
        titleZh: '会动的线条',
        unit: 1,
        lesson: 4,
        author: 'Ms. Yuxin Chen',
        date: '2026-04-21',
    },
    {
        id: 'cl-5',
        titleEn: 'Where Is Spring?',
        titleZh: '春天在哪里',
        unit: 3,
        lesson: 1,
        author: 'Mr. Bo Wang',
        date: '2026-04-15',
    },
    {
        id: 'cl-6',
        titleEn: 'Friends From the Forest',
        titleZh: '森林里的朋友们',
        unit: 5,
        lesson: 2,
        author: 'Ms. Wei Zhang',
        date: '2026-04-08',
    },
]
