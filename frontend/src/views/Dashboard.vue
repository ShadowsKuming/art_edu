<script setup lang="ts">
/**
 * Dashboard hub.
 *
 * Landing page after the user submits the AccessModal on the homepage.
 * Composition:
 *   • <DashboardHeader>         — logo (back to /), avatar + greeting
 *   • Title block               — "Dashboard" + subtitle, with a green
 *                                 Underline.svg overlay (homepage pattern)
 *   • Decorative painted shapes — to the right of the title (≥1100 px)
 *   • <DashboardCard> × 5       — Create Lesson · My Lessons · Community
 *                                 · Start Teaching · My Account
 *
 * Only "My Lessons" is wired right now (→ /lessons). The other four
 * cards intentionally look fully active per the Figma; their click
 * handlers log a "coming soon" message until the corresponding views
 * are built.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import DashboardHeader from '@/components/dashboard/DashboardHeader.vue'
import DashboardCard from '@/components/dashboard/DashboardCard.vue'
import LessonSelectionModal from '@/components/dashboard/LessonSelectionModal.vue'

import { useProjectsStore, type ProjectMeta } from '@/stores/projects'
import { useSlideStore } from '@/stores/slides'
import { usePart5Store } from '@/stores/part5'
import type {
    CurriculumVolume,
    CurriculumUnit,
    CurriculumLesson,
} from '@/data/curriculum'

import underlineUrl from '@/assets/images/Underline.svg'
import dashboardHeroUrl from '@/assets/images/dashboard-hero.png'

const router = useRouter()
const { t, locale } = useI18n()
const projectsStore = useProjectsStore()
const slideStore = useSlideStore()
const part5Store = usePart5Store()

/**
 * Lesson-selection modal visibility. Two-way bound via `v-model:open`,
 * which the modal flips back to `false` either when the user cancels
 * (close button / ESC / backdrop click) or after a successful lesson
 * pick (it `emit('select', …)` then closes itself).
 */
const showLessonModal = ref(false)

/**
 * The five action cards. Order matches the Figma left-to-right.
 * Each entry points at a translation namespace (`dashboardHub.cards.*`)
 * and a CSS-variable colour token defined in `tokens.css`.
 */
type CardId = 'createLesson' | 'myLessons' | 'community' | 'startTeaching' | 'myAccount'
type IconName = 'sparkles' | 'palette' | 'book' | 'play' | 'person'

interface CardSpec {
    id: CardId
    color: string
    icon: IconName
}
const cards: CardSpec[] = [
    { id: 'createLesson', color: '--card-create', icon: 'sparkles' },
    { id: 'myLessons', color: '--card-lessons', icon: 'palette' },
    { id: 'community', color: '--card-community', icon: 'book' },
    { id: 'startTeaching', color: '--card-teach', icon: 'play' },
    { id: 'myAccount', color: '--card-account', icon: 'person' },
]

function onCardClick(id: CardId) {
    if (id === 'myLessons') {
        router.push('/lessons')
        return
    }
    if (id === 'createLesson') {
        showLessonModal.value = true
        return
    }
    if (id === 'community') {
        router.push('/community')
        return
    }
    if (id === 'myAccount') {
        router.push('/account')
        return
    }
    // Orphan stubs — replace with real routes as views are built.
    // Using `console.info` (not `console.warn`) so it doesn't show as a
    // warning during development.
    console.info(`[Dashboard] "${id}" card clicked — view not implemented yet.`)
}

/**
 * Lesson-selection callback.
 *
 * Creates a fresh `Project` whose `meta` is a snapshot of the picked
 * curriculum entry, then enters the workspace. The display name uses
 * the locale-appropriate lesson title so MyLessons (and the workspace
 * header, once it surfaces project names) read naturally regardless of
 * which language the teacher is in.
 */
function onLessonSelect(payload: {
    volume: CurriculumVolume
    unit: CurriculumUnit
    lesson: CurriculumLesson
}) {
    const { volume, unit, lesson } = payload

    const meta: ProjectMeta = {
        volumeId: volume.id,
        unitId: unit.id,
        lessonId: lesson.id,
        grade: volume.grade,
        volume: volume.volume,
        unitNumber: unit.number,
        lessonNumber: lesson.number,
        unitTitleEn: unit.titleEn,
        unitTitleZh: unit.titleZh,
        lessonTitleEn: lesson.titleEn,
        lessonTitleZh: lesson.titleZh,
    }

    const name = locale.value === 'zh' ? lesson.titleZh : lesson.titleEn

    projectsStore.createProject(name, meta)
    // Reset workspace state — same dance MyLessons does for its
    // "+ New Lesson" prompt, kept here so we don't carry state from
    // a previously-open project into the new deck.
    slideStore.reset()
    part5Store.clearVideo()

    router.push('/workspace')
}
</script>

<template>
    <div class="dashboard">
        <DashboardHeader />

        <main class="dashboard__main">
            <section class="dashboard__intro">
                <div class="dashboard__title-block">
                    <h1 class="dashboard__title">
                        {{ t('dashboardHub.title') }}
                        <img :src="underlineUrl" alt="" aria-hidden="true" class="dashboard__title-underline" />
                    </h1>
                    <p class="dashboard__subtitle">
                        {{ t('dashboardHub.subtitle') }}
                    </p>
                </div>

                <img :src="dashboardHeroUrl" :alt="t('dashboardHub.heroAlt')" class="dashboard__hero" />
            </section>

            <section class="dashboard__cards" :aria-label="t('dashboardHub.title')">
                <DashboardCard v-for="card in cards" :key="card.id" :color="card.color" :icon="card.icon"
                    :title="t(`dashboardHub.cards.${card.id}.title`)"
                    :description="t(`dashboardHub.cards.${card.id}.description`)" @click="onCardClick(card.id)" />
            </section>
        </main>

        <!-- Lesson-selection modal, opened by the Create-Lesson card. -->
        <LessonSelectionModal v-model:open="showLessonModal" @select="onLessonSelect" />
    </div>
</template>

<style scoped>
.dashboard {
    min-height: 100vh;
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
}

.dashboard__main {
    max-width: var(--content-max);
    margin: 0 auto;
    padding: var(--space-7) var(--gutter) var(--space-9);
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-9);
}

/* ── Title block + decorative hero ───────────────────────── */

.dashboard__intro {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--gutter);
    align-items: center;
}

.dashboard__title-block {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
}

.dashboard__title {
    /* IF Kica Bold matching Figma's 75 px / 110% line-height. */
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: clamp(48px, 6vw, 75px);
    line-height: 1.1;
    color: var(--color-text);
    /* The underline is an inline-flow image positioned by `align-self`
       on a flex container; we use `position: relative` so the image can
       be absolutely placed *inside the heading box only* — the rest of
       the page layout is unaffected. This mirrors the homepage pattern. */
    position: relative;
    width: max-content;
    max-width: 100%;
}

.dashboard__title-underline {
    position: absolute;
    /* Slot the squiggle under the right side of the word, as in Figma
       (Underline_06 sits at x=319, y=43 of a ~635×83 title box). */
    right: 6%;
    bottom: -6px;
    width: 30%;
    max-width: 240px;
    height: auto;
    pointer-events: none;
    user-select: none;
}

.dashboard__subtitle {
    margin: 0;
    font-family: var(--font-body);
    font-weight: 400;
    font-size: clamp(18px, 1.6vw, 24px);
    line-height: 1.4;
    color: var(--color-text-soft);
    max-width: 56ch;
}

.dashboard__hero {
    width: 100%;
    height: auto;
    max-height: 252px;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
}

/* ── Cards grid ──────────────────────────────────────────── */

.dashboard__cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: var(--space-5);
}

/* ── Responsive ──────────────────────────────────────────── */

@media (max-width: 1100px) {
    .dashboard__intro {
        grid-template-columns: 1fr;
        gap: var(--space-6);
    }

    .dashboard__hero {
        max-height: 200px;
        justify-self: center;
    }
}

@media (max-width: 720px) {
    .dashboard__main {
        padding: var(--space-6) var(--gutter) var(--space-8);
        gap: var(--space-7);
    }

    .dashboard__hero {
        display: none;
        /* keep the hero clean on small phones */
    }

    .dashboard__title-underline {
        width: 40%;
        right: 0;
    }
}
</style>
