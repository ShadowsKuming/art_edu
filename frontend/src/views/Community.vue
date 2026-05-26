<script setup lang="ts">
/**
 * Community ("Lesson Library") view.
 *
 * Browse-published-lessons screen reached from the Dashboard hub's
 * "Community" card. Composition (matches Figma file
 * 1YkPdpdcSSvcBXPcp5nFxO node 564:4587):
 *   • <DashboardHeader>          — shared authed-area header
 *   • Back-to-dashboard link
 *   • Title block (Community + Underline.svg + subtitle) with a
 *     decorative painted-shapes hero floated to the right 
 *   • Filter bar (Grade Level / Unit / Lesson + green Discover pill)
 *   • Grid of <LessonCard> tiles (one per LKP in LESSON_REGISTRY)
 *
 * Pagination was removed once the dummy data was dropped — with a
 * single real LKP there's nothing to paginate. Re-introduce a
 * paginator (or infinite scroll) when the registry grows.
 *
 * Filter controls render to spec but their `@change` / `@click`
 * handlers are intentional no-ops while the backend is still
 * placeholder.
 */
import { ref, computed, shallowRef } from 'vue'

import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import DashboardHeader from '@/components/dashboard/DashboardHeader.vue'
import LessonCard from '@/components/community/LessonCard.vue'
import SlidePreviewModal from '@/components/community/SlidePreviewModal.vue'

import { LESSON_REGISTRY } from '@/data/lessons'

import { hydrateProjectFromLesson } from '@/utils/lessonSeed'
import { useProjectsStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toast'
import type { Slide } from '@/stores/slides'

import underlineUrl from '@/assets/images/Underline.svg'
import dashboardHeroUrl from '@/assets/images/dashboard-hero.png'

const router = useRouter()
const { t, locale } = useI18n()
const projectsStore = useProjectsStore()
const toast = useToastStore()





// ── Filter state — purely visual for now ────────────────────────
const gradeFilter = ref<'all'>('all')
const unitFilter = ref<'all'>('all')
const lessonFilter = ref<'all'>('all')

function onDiscover() {
    // Stub. Real implementation would translate the three refs into
    // a query and refetch from the backend.
    console.info('[Community] Discover clicked', {
        grade: gradeFilter.value,
        unit: unitFilter.value,
        lesson: lessonFilter.value,
    })
}

// ── Card actions ────────────────────────────────────────────────

/**
 * Set of `meta.lessonId`s already present in the teacher's library.
 * Recomputed reactively as `projectsStore.projects` mutates (via the
 * Pinia ref) so the Save button on each card auto-flips to its
 * "Saved" muted variant the moment a save completes.
 *
 * Legacy projects without `meta` are skipped; they don't correspond
 * to any Community LKP so the lookup never finds them anyway.
 */
const savedLessonIds = computed(
    () => new Set(projectsStore.projects.map((p) => p.meta?.lessonId).filter(Boolean) as string[]),
)

// ── Preview modal state ─────────────────────────────────────────
/**
 * `previewState.open` is true when the modal is visible.
 * Slides are hydrated fresh on every open so the live `locale` is
 * honoured (Chinese text vs English). We use `shallowRef` for the
 * slide list — the Slide objects themselves aren't mutated by the
 * preview, so Pinia/Vue don't need deep reactivity here.
 */
const previewOpen = ref(false)
const previewSlides = shallowRef<Slide[]>([])
const previewTitle = ref('')
const previewSubtitle = ref('')

function onPreview(id: string) {
    const seed = LESSON_REGISTRY.find((lkp) => lkp.lesson_id === id)
    if (!seed) {
        console.warn('[Community] preview: no LKP found for', id)
        return
    }
    const { snapshot } = hydrateProjectFromLesson(
        seed,
        locale.value === 'zh' ? 'zh' : 'en',
    )
    previewSlides.value = snapshot.slides
    previewTitle.value =
        locale.value === 'zh' ? seed.lesson_title_zh : seed.lesson_title_en
    // Mirror the card's "Unit N · Lesson M" subtitle so the modal feels
    // like a continuation of the card the user just clicked.
    const idMatch = /^g(\d)v(\d)-u(\d+)-l(\d+)$/.exec(seed.lesson_id)
    const unit = idMatch ? +idMatch[3] : 0
    const lesson = idMatch ? +idMatch[4] : 0
    previewSubtitle.value = t('community.card.unitLessonShort', { unit, lesson })
    previewOpen.value = true
}

function closePreview() {
    previewOpen.value = false
}

/**
 * Save = copy the LKP into the teacher's My Lessons library as a
 * new Project.
 *
 * Behaviour:
 *   • If a project with the same `meta.lessonId` already exists,
 *     fire an "Already in My Lessons" toast and do nothing else.
 *   • Otherwise hydrate the LKP, create a project, persist the
 *     hydrated snapshot, tag it with `status: 'saved'` (matches the
 *     existing "Saved" tab in My Lessons), and fire a success toast.
 *
 * Crucially we **don't** disturb whatever the user has open in the
 * workspace — `activeProjectId` is restored to its previous value
 * after the new project is written.
 */
function onSave(id: string) {
    const seed = LESSON_REGISTRY.find((lkp) => lkp.lesson_id === id)
    if (!seed) {
        console.warn('[Community] save: no LKP found for', id)
        return
    }

    // Duplicate guard — match by canonical LKP id rather than name so
    // a user-renamed copy still blocks re-import.
    if (savedLessonIds.value.has(seed.lesson_id)) {
        toast.show(t('community.save.alreadySaved'), 'info')
        return
    }

    const { name, meta, snapshot } = hydrateProjectFromLesson(
        seed,
        locale.value === 'zh' ? 'zh' : 'en',
    )

    // Remember which project (if any) the user currently has active so
    // we can restore it — `createProject` sets the new id as active as
    // a side-effect.
    const prevActiveId = projectsStore.activeProjectId

    const newId = projectsStore.createProject(name, meta)
    projectsStore.saveCurrentProject(snapshot)

    // Stamp the project as a Community-saved one so it lands in the
    // "Saved" filter tab on My Lessons. Direct mutation is safe because
    // the projects array is a deep watched Pinia ref (persisted to LS).
    const created = projectsStore.projects.find((p) => p.id === newId)
    if (created) created.status = 'saved'

    // Restore the previously-active project (or clear if there wasn't
    // one). This keeps the workspace untouched if the user already had
    // a deck open in another tab/route.
    projectsStore.setActiveProject(prevActiveId ?? '')

    toast.show(t('community.save.savedToMyLessons'), 'success')
}




// ── Data ────────────────────────────────────────────────────────
/**
 * Only the real LKP-backed lessons are shown — the dummy placeholder
 * data was removed once the first real LKP (g2v2-u4-l4) shipped. New
 * lessons appear here automatically by adding a JSON file under
 * `backend/data/lessons/` and re-running `npm run sync-lessons`
 * (or `npm run build`, which calls it via `prebuild`).
 *
 * We adapt each LKP row into the `CommunityLesson` shape on the fly
 * so the card component doesn't need to change.
 */
const lessons = computed(() =>
    LESSON_REGISTRY.map((seed) => {
        const idMatch = /^g(\d)v(\d)-u(\d+)-l(\d+)$/.exec(seed.lesson_id)
        const unit = idMatch ? +idMatch[3] : 0
        const lesson = idMatch ? +idMatch[4] : 0
        // Surface the first textbook artwork as the thumbnail — gives
        // the card a sensible preview without any extra metadata.
        const thumb = seed.textbook_artworks?.[0]?.image_url
        return {
            id: seed.lesson_id,
            titleEn: seed.lesson_title_en,
            titleZh: seed.lesson_title_zh,
            unit,
            lesson,
            author: t('community.team'),
            date: new Date().toISOString(),
            thumbnail: thumb,
        }
    }),
)



// ── Navigation ──────────────────────────────────────────────────
function backToDashboard() {
    router.push('/dashboard')
}
</script>

<template>
    <div class="community">
        <DashboardHeader />

        <main class="community__main">
            <!-- Back link -->
            <button class="community__back" type="button" @click="backToDashboard">
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M12 4l-6 6 6 6" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                {{ t('community.backToDashboard') }}
            </button>

            <!-- Title block + decorative hero -->
            <section class="community__intro">
                <div class="community__title-block">
                    <h1 class="community__title">
                        {{ t('community.title') }}
                        <img :src="underlineUrl" alt="" aria-hidden="true"
                            class="community__title-underline" />
                    </h1>
                    <p class="community__subtitle">{{ t('community.subtitle') }}</p>
                </div>
                <img :src="dashboardHeroUrl" :alt="t('community.heroAlt')"
                    class="community__hero" />
            </section>

            <!-- Filters -->
            <section class="community__filters" :aria-label="t('community.filters.aria')">
                <label class="filter">
                    <span class="filter__label">{{ t('community.filters.gradeLevel') }}</span>
                    <span class="filter__select-wrap">
                        <select v-model="gradeFilter" class="filter__select">
                            <option value="all">{{ t('community.filters.allGrades') }}</option>
                        </select>
                        <svg viewBox="0 0 12 8" fill="none" class="filter__chevron" aria-hidden="true">
                            <path d="M1 1l5 5 5-5" stroke="#6b7280" stroke-width="1.5"
                                stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </span>
                </label>

                <label class="filter">
                    <span class="filter__label">{{ t('community.filters.unit') }}</span>
                    <span class="filter__select-wrap">
                        <select v-model="unitFilter" class="filter__select">
                            <option value="all">{{ t('community.filters.allUnits') }}</option>
                        </select>
                        <svg viewBox="0 0 12 8" fill="none" class="filter__chevron" aria-hidden="true">
                            <path d="M1 1l5 5 5-5" stroke="#6b7280" stroke-width="1.5"
                                stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </span>
                </label>

                <label class="filter">
                    <span class="filter__label">{{ t('community.filters.lesson') }}</span>
                    <span class="filter__select-wrap">
                        <select v-model="lessonFilter" class="filter__select">
                            <option value="all">{{ t('community.filters.allLessons') }}</option>
                        </select>
                        <svg viewBox="0 0 12 8" fill="none" class="filter__chevron" aria-hidden="true">
                            <path d="M1 1l5 5 5-5" stroke="#6b7280" stroke-width="1.5"
                                stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </span>
                </label>

                <button class="filter__discover" type="button" @click="onDiscover">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.6" />
                        <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.6"
                            stroke-linecap="round" />
                    </svg>
                    {{ t('community.filters.discover') }}
                </button>
            </section>

            <!-- Card grid -->
            <section class="community__grid" :aria-label="t('community.gridAria')">
                <LessonCard v-for="lesson in lessons" :key="lesson.id" :id="lesson.id"
                    :title-en="lesson.titleEn" :title-zh="lesson.titleZh" :unit="lesson.unit"
                    :lesson="lesson.lesson" :author="lesson.author" :date="lesson.date"
                    :thumbnail="lesson.thumbnail"
                    :saved="savedLessonIds.has(lesson.id)"
                    @preview="onPreview" @save="onSave" />
            </section>

            <!-- Pagination removed alongside the dummy data — re-add
                 when the lesson registry grows past one page. -->
        </main>

        <!-- Read-only preview popup. Slides are re-hydrated on every
             open() call so the active locale wins. -->
        <SlidePreviewModal
            :open="previewOpen"
            :slides="previewSlides"
            :title="previewTitle"
            :subtitle="previewSubtitle"
            @close="closePreview"
        />

    </div>
</template>


<style scoped>
.community {
    min-height: 100vh;
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
}

.community__main {
    max-width: var(--content-max);
    margin: 0 auto;
    padding: var(--space-6) var(--gutter) var(--space-9);
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
}

/* ── Back link ──────────────────────────────────────────────── */
.community__back {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    align-self: flex-start;
    background: transparent;
    border: none;
    padding: 4px 0;
    font-family: inherit;
    font-size: 16px;
    font-weight: 500;
    color: var(--color-text);
    cursor: pointer;
}

.community__back svg {
    width: 18px;
    height: 18px;
}

.community__back:hover {
    color: var(--color-primary, #7FEC8F);
}

/* ── Title + hero ───────────────────────────────────────────── */
.community__intro {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--gutter);
    align-items: center;
}

.community__title-block {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
}

.community__title {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: clamp(40px, 5vw, 50px);
    line-height: 1.1;
    color: var(--color-text);
    position: relative;
    width: max-content;
    max-width: 100%;
}

.community__title-underline {
    position: absolute;
    right: 6%;
    bottom: -6px;
    width: 35%;
    max-width: 220px;
    height: auto;
    pointer-events: none;
    user-select: none;
}

.community__subtitle {
    margin: 0;
    font-family: var(--font-body);
    font-weight: 400;
    font-size: clamp(16px, 1.4vw, 20px);
    line-height: 1.4;
    color: var(--color-text-soft);
    max-width: 60ch;
}

.community__hero {
    width: 100%;
    height: auto;
    max-height: 230px;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
}

/* ── Filters ────────────────────────────────────────────────── */
.community__filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    align-items: flex-end;
}

.filter {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 200px;
    flex: 1 1 200px;
    max-width: 240px;
}

.filter__label {
    font-family: var(--font-body, 'Albert Sans', system-ui, sans-serif);
    font-weight: 700;
    font-size: 14px;
    color: #4e607c;
}

.filter__select-wrap {
    position: relative;
    display: block;
}

.filter__select {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    height: 42px;
    padding: 0 36px 0 16px;
    background: #f3f4f4;
    border: none;
    border-radius: 28px;
    font-family: inherit;
    font-size: 16px;
    color: #2f3334;
    cursor: pointer;
    line-height: 1.4;
    box-sizing: border-box;
}

.filter__select:focus {
    outline: 2px solid var(--color-primary, #7FEC8F);
    outline-offset: 2px;
}

.filter__chevron {
    position: absolute;
    right: 16px;
    top: 50%;
    width: 12px;
    height: 8px;
    transform: translateY(-50%);
    pointer-events: none;
}

.filter__discover {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 42px;
    padding: 0 22px;
    background: var(--color-primary, #7FEC8F);
    border: none;
    border-radius: 28px;
    font-family: inherit;
    font-weight: 700;
    font-size: 14px;
    color: #2f3334;
    cursor: pointer;
    box-shadow: var(--shadow-card-soft, 2px 4px 6px rgba(0, 0, 0, 0.08));
    flex-shrink: 0;
}

.filter__discover svg {
    width: 16px;
    height: 16px;
}

.filter__discover:hover {
    transform: translateY(-1px);
}

/* ── Card grid ──────────────────────────────────────────────── */
.community__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
    gap: var(--space-5);
}

/* ── Pagination ─────────────────────────────────────────────── */
.community__pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: var(--space-3);
}

.page {
    width: 40px;
    height: 40px;
    border-radius: 9999px;
    border: 1px solid #dedede;
    background: #fff;
    font-family: 'Plus Jakarta Sans', var(--font-body, sans-serif);
    font-size: 16px;
    font-weight: 400;
    color: #475569;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s, color 0.15s;
}

.page svg {
    width: 14px;
    height: 14px;
    color: #8e8e8e;
}

.page:hover:not(:disabled):not(.page--active) {
    background: #f7f7f7;
}

.page--active {
    background: var(--color-primary, #7FEC8F);
    color: #000;
    font-weight: 700;
    border-color: transparent;
}

.page--icon {
    background: #fff;
}

.page:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

/* ── Responsive ─────────────────────────────────────────────── */
@media (max-width: 1100px) {
    .community__intro {
        grid-template-columns: 1fr;
        gap: var(--space-5);
    }

    .community__hero {
        max-height: 180px;
        justify-self: center;
    }
}

@media (max-width: 720px) {
    .community__main {
        padding: var(--space-5) var(--gutter) var(--space-7);
        gap: var(--space-5);
    }

    .community__hero {
        display: none;
    }

    .community__title-underline {
        width: 45%;
        right: 0;
    }

    .filter {
        max-width: none;
        flex: 1 1 100%;
    }

    .filter__discover {
        flex: 1 1 100%;
        justify-content: center;
    }
}
</style>
