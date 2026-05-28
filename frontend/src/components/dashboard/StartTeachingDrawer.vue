<script setup lang="ts">
/**
 * StartTeachingDrawer
 * ───────────────────
 * Right-side slide-in drawer that lets the teacher pick a lesson to
 * jump straight into teaching mode (= the existing workspace, since
 * a dedicated presentation mode does not exist yet).
 *
 * Opened from the Dashboard hub's "Start Teaching" (开始上课) card.
 *
 * Two layouts:
 *   • Empty state (`projects.length === 0`) — illustration + 暂无课件 +
 *     创建你的第一堂美术课吧。+ 绿色 `新建课件` pill button. Click
 *     emits `create`; the parent (`Dashboard.vue`) responds by opening
 *     the existing `LessonSelectionModal`.
 *   • Populated state — two stacked sections:
 *       1. **可立即上课 / Ready to Teach** — projects with
 *          `status === 'completed'`. Rendered as a 2-column card grid
 *          with a 16:9 SlideThumbnail cover, lesson title,
 *          "第N单元 · 第M课", create date, and a primary
 *          `开始上课` button.
 *       2. **最近使用 / Recently Used** — top 5 projects sorted by
 *          `createdAt` desc (any status). Horizontal rows with a
 *          smaller cover, title, unit/lesson, and `预览 / 开始上课`
 *          buttons.
 *
 * Built on `<Teleport to="body">` + `<Transition>` (not a native
 * `<dialog>`) because the slide-in transform animation is cleaner
 * without dialog's auto-positioning. Close triggers:
 *   • × button in the top-right
 *   • backdrop click
 *   • Esc key
 */
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SlideThumbnail from '@/components/workspace/SlideThumbnail.vue'
import type { Project } from '@/stores/projects'
import type { Slide } from '@/stores/slides'

interface Props {
    open: boolean
    projects: Project[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
    (e: 'update:open', value: boolean): void
    /** User clicked a project's "Start Teaching" button. */
    (e: 'select', projectId: string): void
    /** User clicked a project's "Preview" button. */
    (e: 'preview', projectId: string): void
    /** User clicked the empty-state "新建课件" button. */
    (e: 'create'): void
}>()

const { t, locale } = useI18n()

function close() {
    if (props.open) emit('update:open', false)
}

/** Esc-to-close. */
function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && props.open) close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

/** Lock body scroll while open so the page underneath doesn't move. */
watch(
    () => props.open,
    (isOpen) => {
        if (typeof document === 'undefined') return
        document.body.style.overflow = isOpen ? 'hidden' : ''
    },
)

// ─── Derived lists ─────────────────────────────────────────────────

/** Projects where the teacher marked the deck as ready (= completed). */
const readyProjects = computed(() =>
    props.projects.filter((p) => p.status === 'completed'),
)

/**
 * Up to 5 most-recently-touched projects, irrespective of status.
 * `createdAt` is the only timestamp on the Project today; if we ever
 * add a `lastEditedAt`, swap the sort key here.
 */
const recentProjects = computed(() => {
    return [...props.projects]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 5)
})

// ─── Per-project helpers (mirror MyLessons.vue's helpers) ──────────

function thumbnailSlide(project: Project): Slide | null {
    const slides = project.snapshot?.slides ?? []
    return slides.find((s) => s.partId === 1) ?? slides[0] ?? null
}

function unitLessonLabel(project: Project): string | null {
    const meta = project.meta
    if (!meta) return null
    const unitPrefix = t('lessonSelect.unit', { n: meta.unitNumber })
    const lessonPrefix = t('lessonSelect.lesson', { n: meta.lessonNumber })
    return `${unitPrefix} · ${lessonPrefix}`
}

function formatDate(iso: string) {
    const loc = locale.value === 'zh' ? 'zh-CN' : 'en-US'
    return new Date(iso).toLocaleDateString(loc, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

function onSelect(id: string) {
    emit('select', id)
}

function onPreview(id: string) {
    emit('preview', id)
}

function onCreate() {
    emit('create')
}
</script>

<template>
    <Teleport to="body">
        <Transition name="std">
            <div
                v-if="open"
                class="std-backdrop"
                role="dialog"
                aria-modal="true"
                :aria-label="t('dashboardHub.startTeachingDrawer.title')"
                @click.self="close"
            >
                <aside class="std-panel">
                    <!-- Close button (top-right) -->
                    <button
                        type="button"
                        class="std-close"
                        :aria-label="t('dashboardHub.startTeachingDrawer.closeAria')"
                        @click="close"
                    >
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <path
                                d="M5 5l10 10M15 5L5 15"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                            />
                        </svg>
                    </button>

                    <!-- Header -->
                    <header class="std-head">
                        <span class="std-head__chip" aria-hidden="true">🚀</span>
                        <h2 class="std-head__title">
                            {{ t('dashboardHub.startTeachingDrawer.title') }}
                        </h2>
                        <p class="std-head__subtitle">
                            {{ t('dashboardHub.startTeachingDrawer.subtitle') }}
                        </p>
                    </header>

                    <!-- ───────── Empty state ───────── -->
                    <div v-if="projects.length === 0" class="std-empty">
                        <div class="std-empty__icon" aria-hidden="true">
                            <svg viewBox="0 0 80 80" fill="none">
                                <!-- Document outline -->
                                <rect
                                    x="14"
                                    y="14"
                                    width="44"
                                    height="52"
                                    rx="6"
                                    stroke="#d1d5db"
                                    stroke-width="3"
                                />
                                <path
                                    d="M24 32h22M24 42h14"
                                    stroke="#d1d5db"
                                    stroke-width="3"
                                    stroke-linecap="round"
                                />
                                <!-- Green "plus" badge bottom-right of the doc -->
                                <circle cx="58" cy="48" r="12" fill="#7FEC8F" />
                                <path
                                    d="M58 42v12M52 48h12"
                                    stroke="#111827"
                                    stroke-width="2.2"
                                    stroke-linecap="round"
                                />
                            </svg>
                        </div>
                        <h3 class="std-empty__title">
                            {{ t('dashboardHub.startTeachingDrawer.empty.title') }}
                        </h3>
                        <p class="std-empty__body">
                            {{ t('dashboardHub.startTeachingDrawer.empty.body') }}
                        </p>
                        <button
                            type="button"
                            class="std-btn std-btn--primary std-empty__cta"
                            @click="onCreate"
                        >
                            {{ t('dashboardHub.startTeachingDrawer.empty.create') }}
                        </button>
                    </div>

                    <!-- ───────── Populated state ───────── -->
                    <div v-else class="std-body">
                        <!-- Ready to Teach (completed projects) -->
                        <section
                            v-if="readyProjects.length"
                            class="std-section"
                            :aria-label="t('dashboardHub.startTeachingDrawer.readyToTeach')"
                        >
                            <header class="std-section__head">
                                <span class="std-section__chip std-section__chip--ready" aria-hidden="true">🎓</span>
                                <h3 class="std-section__title">
                                    {{ t('dashboardHub.startTeachingDrawer.readyToTeach') }}
                                </h3>
                            </header>

                            <div class="std-cards">
                                <article
                                    v-for="project in readyProjects"
                                    :key="project.id"
                                    class="std-card"
                                >
                                    <div class="std-card__thumb">
                                        <SlideThumbnail
                                            v-if="thumbnailSlide(project)"
                                            :slide="thumbnailSlide(project)!"
                                        />
                                    </div>
                                    <div class="std-card__body">
                                        <h4 class="std-card__title">{{ project.name }}</h4>
                                        <p v-if="unitLessonLabel(project)" class="std-card__meta">
                                            {{ unitLessonLabel(project) }}
                                        </p>
                                        <div class="std-card__footer">
                                            <span class="std-card__date">
                                                <svg
                                                    viewBox="0 0 16 16"
                                                    fill="none"
                                                    aria-hidden="true"
                                                    class="std-card__date-icon"
                                                >
                                                    <rect
                                                        x="2"
                                                        y="3"
                                                        width="12"
                                                        height="11"
                                                        rx="2"
                                                        stroke="currentColor"
                                                        stroke-width="1.4"
                                                    />
                                                    <path
                                                        d="M2 6h12M5 1v3M11 1v3"
                                                        stroke="currentColor"
                                                        stroke-width="1.4"
                                                        stroke-linecap="round"
                                                    />
                                                </svg>
                                                {{ formatDate(project.createdAt) }}
                                            </span>
                                            <button
                                                type="button"
                                                class="std-btn std-btn--primary std-btn--sm"
                                                @click="onSelect(project.id)"
                                            >
                                                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                                    <path d="M4 3l9 5-9 5V3z" fill="currentColor" />
                                                </svg>
                                                {{ t('dashboardHub.startTeachingDrawer.startTeaching') }}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            </div>
                        </section>

                        <!-- Recently Used (everything, sorted by date desc, top 5) -->
                        <section
                            class="std-section"
                            :aria-label="t('dashboardHub.startTeachingDrawer.recentlyUsed')"
                        >
                            <header class="std-section__head">
                                <span class="std-section__chip std-section__chip--recent" aria-hidden="true">🕒</span>
                                <h3 class="std-section__title">
                                    {{ t('dashboardHub.startTeachingDrawer.recentlyUsed') }}
                                </h3>
                            </header>

                            <ul class="std-rows">
                                <li
                                    v-for="project in recentProjects"
                                    :key="project.id"
                                    class="std-row"
                                >
                                    <div class="std-row__thumb">
                                        <SlideThumbnail
                                            v-if="thumbnailSlide(project)"
                                            :slide="thumbnailSlide(project)!"
                                        />
                                    </div>
                                    <div class="std-row__text">
                                        <p class="std-row__title">{{ project.name }}</p>
                                        <p v-if="unitLessonLabel(project)" class="std-row__meta">
                                            {{ unitLessonLabel(project) }}
                                        </p>
                                    </div>
                                    <div class="std-row__actions">
                                        <button
                                            type="button"
                                            class="std-btn std-btn--ghost std-btn--sm"
                                            @click="onPreview(project.id)"
                                        >
                                            <svg
                                                viewBox="0 0 16 16"
                                                fill="none"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"
                                                    stroke="currentColor"
                                                    stroke-width="1.4"
                                                />
                                                <circle
                                                    cx="8"
                                                    cy="8"
                                                    r="2.2"
                                                    stroke="currentColor"
                                                    stroke-width="1.4"
                                                />
                                            </svg>
                                            {{ t('dashboardHub.startTeachingDrawer.preview') }}
                                        </button>
                                        <button
                                            type="button"
                                            class="std-btn std-btn--primary std-btn--sm"
                                            @click="onSelect(project.id)"
                                        >
                                            <svg
                                                viewBox="0 0 16 16"
                                                fill="none"
                                                aria-hidden="true"
                                            >
                                                <path d="M4 3l9 5-9 5V3z" fill="currentColor" />
                                            </svg>
                                            {{ t('dashboardHub.startTeachingDrawer.startTeaching') }}
                                        </button>
                                    </div>
                                </li>
                            </ul>
                        </section>
                    </div>
                </aside>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
/* ── Backdrop + panel layout ───────────────────────────────────── */
.std-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    /* Match the figma reference: page underneath shows through a soft
       grey overlay, drawer is anchored to the right edge. */
    background: rgba(15, 23, 42, 0.45);
    display: flex;
    justify-content: flex-end;
}

.std-panel {
    position: relative;
    width: min(640px, 92vw);
    height: 100%;
    background: #fff;
    border-radius: 24px 0 0 24px;
    box-shadow: -8px 0 30px rgba(0, 0, 0, 0.18);
    padding: 28px 32px 32px;
    box-sizing: border-box;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.std-close {
    position: absolute;
    top: 18px;
    right: 22px;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: none;
    background: #f3f4f6;
    color: #111827;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s;
}
.std-close:hover { background: #e5e7eb; }
.std-close svg { width: 18px; height: 18px; }

/* ── Header ───────────────────────────────────────────────────── */
.std-head {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-right: 56px; /* leave room for the absolute close button */
}

.std-head__chip {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #DCFCE7;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    line-height: 1;
}

.std-head__title {
    margin: 0;
    font-family: var(--font-display, var(--font-body));
    font-weight: 700;
    font-size: clamp(32px, 4.4vw, 42px);
    color: #111827;
    line-height: 1.1;
}

.std-head__subtitle {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: #6b7280;
}

/* ── Empty state ──────────────────────────────────────────────── */
.std-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 14px;
    padding: 32px 16px 48px;
}

.std-empty__icon {
    /* The icon's own SVG already includes the dashed-document look + the
       green "+" badge, so we just need a touch of breathing room. */
    margin-bottom: 6px;
}
.std-empty__icon svg { width: 96px; height: 96px; }

.std-empty__title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: #111827;
}

.std-empty__body {
    margin: 0;
    font-size: 15px;
    color: #6b7280;
    line-height: 1.5;
    max-width: 28ch;
}

.std-empty__cta {
    margin-top: 10px;
    min-width: 132px;
}

/* ── Body sections ────────────────────────────────────────────── */
.std-body {
    display: flex;
    flex-direction: column;
    gap: 28px;
    /* Light divider between Ready / Recently sections — matches Figma's
       horizontal hairline. */
}

.std-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.std-section + .std-section {
    border-top: 1px solid #e5e7eb;
    padding-top: 22px;
}

.std-section__head {
    display: flex;
    align-items: center;
    gap: 12px;
}

.std-section__chip {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
}
.std-section__chip--ready  { background: #DCFCE7; }
.std-section__chip--recent { background: #E0E7FF; }

.std-section__title {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    color: #111827;
}

/* ── Ready-to-Teach cards grid ────────────────────────────────── */
.std-cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
}

.std-card {
    display: flex;
    flex-direction: column;
    border-radius: 18px;
    background: #fff;
    border: 1px solid #eef0f4;
    box-shadow: 2px 4px 12px rgba(0, 0, 0, 0.05);
    overflow: hidden;
}

.std-card__thumb {
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #f3f4f6;
    overflow: hidden;
}

.std-card__body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 14px 16px;
}

.std-card__title {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: #111827;
    line-height: 1.3;
    /* Clamp to 2 lines so the card heights stay aligned in the grid. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.std-card__meta {
    margin: 0;
    font-size: 12px;
    color: #6b7280;
}

.std-card__footer {
    margin-top: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.std-card__date {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #6b7280;
}
.std-card__date-icon { width: 12px; height: 12px; }

/* ── Recently Used rows ───────────────────────────────────────── */
.std-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.std-row {
    display: grid;
    grid-template-columns: 80px 1fr auto;
    align-items: center;
    gap: 14px;
    padding: 10px 12px;
    border: 1px solid #eef0f4;
    border-radius: 12px;
    background: #fff;
}

.std-row__thumb {
    width: 80px;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    overflow: hidden;
    background: #f3f4f6;
    flex-shrink: 0;
}

.std-row__text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.std-row__title {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: #111827;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.std-row__meta {
    margin: 0;
    font-size: 12px;
    color: #6b7280;
}

.std-row__actions {
    display: flex;
    align-items: center;
    gap: 6px;
}

/* ── Buttons (shared between empty state, cards, and rows) ────── */
.std-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    padding: 0 16px;
    border-radius: 999px;
    border: none;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    color: #111827;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
}
.std-btn svg { width: 12px; height: 12px; flex-shrink: 0; }

.std-btn--sm { height: 30px; padding: 0 12px; font-size: 12px; }

.std-btn--primary {
    background: #B2F4BC;
    color: #111827;
}
.std-btn--primary:hover { background: #9eebac; }
.std-btn--primary:active { transform: translateY(1px); }

.std-btn--ghost {
    background: #fff;
    border: 1px solid #e5e7eb;
    color: #374151;
}
.std-btn--ghost:hover { background: #f3f4f6; }

/* ── Slide-in transition (matches Figma drawer behaviour) ─────── */
.std-enter-from,
.std-leave-to {
    opacity: 0;
}
.std-enter-from .std-panel,
.std-leave-to .std-panel {
    transform: translateX(24px);
}
.std-enter-active,
.std-leave-active {
    transition: opacity 0.22s ease;
}
.std-enter-active .std-panel,
.std-leave-active .std-panel {
    transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* ── Responsive ───────────────────────────────────────────────── */
@media (max-width: 720px) {
    .std-panel {
        width: 100vw;
        border-radius: 0;
        padding: 22px 18px 28px;
    }
    .std-cards { grid-template-columns: 1fr; }
    .std-row { grid-template-columns: 72px 1fr; row-gap: 8px; }
    .std-row__actions { grid-column: 1 / -1; justify-content: flex-end; }
}
</style>
