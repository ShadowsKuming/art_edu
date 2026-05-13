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
 *   • Grid of <LessonCard> tiles (currently dummy data)
 *   • Pagination (3 buttons + prev/next, all decorative)
 *
 * The filter and pagination controls render to spec but their
 * `@change` / `@click` handlers are intentional no-ops while the
 * backend is still placeholder.
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import DashboardHeader from '@/components/dashboard/DashboardHeader.vue'
import LessonCard from '@/components/community/LessonCard.vue'

import { communityLessons } from '@/data/communityDummy'

import underlineUrl from '@/assets/images/Underline.svg'
import dashboardHeroUrl from '@/assets/images/dashboard-hero.png'

const router = useRouter()
const { t } = useI18n()

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

// ── Card actions — stubs ────────────────────────────────────────
function onPreview(id: string) {
    console.info('[Community] preview lesson', id)
}
function onSave(id: string) {
    console.info('[Community] save lesson', id)
}

// ── Pagination — decorative ─────────────────────────────────────
const currentPage = ref(1)
const pages = [1, 2, 3] as const

function onPageClick(p: number) {
    currentPage.value = p
    // No real pagination yet — the dummy list is shown as-is
    // regardless of page selection.
}

// ── Data ────────────────────────────────────────────────────────
const lessons = computed(() => communityLessons)

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
                    :thumbnail="lesson.thumbnail" @preview="onPreview" @save="onSave" />
            </section>

            <!-- Pagination — decorative -->
            <nav class="community__pagination" :aria-label="t('community.pagination.aria')">
                <button class="page page--icon" type="button"
                    :aria-label="t('community.pagination.prev')"
                    :disabled="currentPage === 1"
                    @click="onPageClick(Math.max(1, currentPage - 1))">
                    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M7.5 2L3.5 6l4 4" stroke="currentColor" stroke-width="1.5"
                            stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </button>

                <button v-for="p in pages" :key="p" class="page" type="button"
                    :class="{ 'page--active': currentPage === p }" @click="onPageClick(p)">
                    {{ p }}
                </button>

                <button class="page page--icon" type="button"
                    :aria-label="t('community.pagination.next')"
                    :disabled="currentPage === pages.length"
                    @click="onPageClick(Math.min(pages.length, currentPage + 1))">
                    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M4.5 2l4 4-4 4" stroke="currentColor" stroke-width="1.5"
                            stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </button>
            </nav>
        </main>
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
