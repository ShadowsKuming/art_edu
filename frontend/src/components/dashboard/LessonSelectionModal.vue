<script setup lang="ts">
/**
 * Lesson-selection modal — opened from the Dashboard "Create Lesson" card.
 *
 * Three internal stages, driven by a single `stage` ref:
 *
 *   stage 1 — Volume picker
 *             6 grade groups × 2 volume tiles each (12 textbook covers).
 *             Only Grade-2 / Volume-2 is `available` during testing;
 *             other tiles render the cover but click is a no-op + log
 *             (matches the orphan-card pattern used on the Dashboard).
 *
 *   stage 2 — Unit picker
 *             Selected textbook on the left; 5 unit rows on the right
 *             with a "+" affordance. Click a unit → expand to stage 3.
 *
 *   stage 3 — Lesson picker
 *             Same layout as stage 2, but the chosen unit becomes "−"
 *             and reveals 5 lesson pills. Click a lesson → emit
 *             `select` and close.
 *
 * Built on top of the native <dialog> element (same pattern as
 * `AccessModal.vue`) for the free focus trap, ESC handling, scroll lock,
 * `::backdrop` styling, and focus restore.
 *
 * The component is intentionally "dumb": it doesn't create projects or
 * navigate. It only emits `select({ volume, unit, lesson })` so the
 * parent (`Dashboard.vue`) can decide what to do — typically calling
 * `projectsStore.createProject` and `router.push('/workspace')`.
 *
 * Lesson labels respond to the global `vue-i18n` locale: titles render
 * in `titleEn` (EN) or `titleZh` (ZH) via the `localized()` helper.
 */
import { ref, watch, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
    curriculumByGrade,
    type CurriculumVolume,
    type CurriculumUnit,
    type CurriculumLesson,
} from '@/data/curriculum'

interface Props {
    /** Two-way bound `v-model:open` from the parent. */
    open: boolean
}
const props = defineProps<Props>()

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void
    (e: 'select', payload: {
        volume: CurriculumVolume
        unit: CurriculumUnit
        lesson: CurriculumLesson
    }): void
}>()

const { t, locale } = useI18n()

// ── Native <dialog> wiring ─────────────────────────────────────────

const dialogEl = ref<HTMLDialogElement | null>(null)

watch(
    () => props.open,
    async (isOpen) => {
        const dlg = dialogEl.value
        if (!dlg) return
        if (isOpen && !dlg.open) {
            // Reset to stage 1 on every fresh open.
            stage.value = 1
            selectedVolume.value = null
            expandedUnitId.value = null
            dlg.showModal()
            await nextTick()
            // Push focus into the dialog (modal title) for accessibility.
            ; (dlg.querySelector('.lsm__title') as HTMLElement | null)?.focus()
        } else if (!isOpen && dlg.open) {
            dlg.close()
        }
    },
)

function onNativeClose() {
    if (props.open) emit('update:open', false)
}

function close() {
    emit('update:open', false)
}

function onBackdropClick(event: MouseEvent) {
    if (event.target === dialogEl.value) close()
}

// ── Stage state ────────────────────────────────────────────────────

const stage = ref<1 | 2 | 3>(1)
const selectedVolume = ref<CurriculumVolume | null>(null)
/** Drives the unit-row that's expanded in stage 3. */
const expandedUnitId = ref<string | null>(null)

/** Pretty "Grade N · Volume M" header for stages 2 / 3. */
const headerCrumb = computed(() => {
    const v = selectedVolume.value
    if (!v) return ''
    return `${t('lessonSelect.grade', { n: v.grade })}  ·  ${t('lessonSelect.volume', { n: v.volume })}`
})

/** Locale-aware title pick. Used everywhere the modal renders content. */
function localized(en: string, zh: string): string {
    return locale.value === 'zh' ? zh : en
}

// ── Stage transitions ──────────────────────────────────────────────

function onVolumeClick(volume: CurriculumVolume) {
    if (!volume.available) {
        // Orphan tile during testing — non-blocking signal in the console
        // matches the Dashboard orphan-card pattern.
        // eslint-disable-next-line no-console
        console.info(
            `[lesson-select] ${volume.id} is not yet available — only g2v2 is wired up for the testing stage.`,
        )
        return
    }
    selectedVolume.value = volume
    expandedUnitId.value = null
    stage.value = 2
}

function onUnitClick(unit: CurriculumUnit) {
    if (expandedUnitId.value === unit.id) {
        // Tap an expanded unit's "−" → collapse back to stage 2.
        expandedUnitId.value = null
        stage.value = 2
        return
    }
    expandedUnitId.value = unit.id
    stage.value = 3
}

function onLessonClick(unit: CurriculumUnit, lesson: CurriculumLesson) {
    const volume = selectedVolume.value
    if (!volume) return
    emit('select', { volume, unit, lesson })
    close()
}

/** "← Back to volume picker" affordance on stages 2 / 3. */
function backToVolumes() {
    selectedVolume.value = null
    expandedUnitId.value = null
    stage.value = 1
}
</script>

<template>
    <dialog ref="dialogEl" class="lsm" aria-labelledby="lsm-title" @close="onNativeClose" @click="onBackdropClick">
        <!-- Close button (top-right, all stages) -->
        <button type="button" class="lsm__close" :aria-label="t('lessonSelect.closeAria')" @click="close">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
            </svg>
        </button>

        <!-- Title row (consistent across all 3 stages) -->
        <header class="lsm__header">
            <span class="lsm__bullet" aria-hidden="true" />
            <h2 id="lsm-title" class="lsm__title" tabindex="-1">
                {{ t('lessonSelect.title') }}
            </h2>
        </header>

        <!-- ─────────────────  STAGE 1 — VOLUME PICKER  ───────────────── -->
        <section v-if="stage === 1" class="lsm__stage lsm__stage--volumes">
            <div v-for="(row, gradeIdx) in curriculumByGrade" :key="`g${gradeIdx + 1}`" class="lsm__grade">
                <h3 class="lsm__grade-title">
                    {{ t('lessonSelect.grade', { n: gradeIdx + 1 }) }}
                </h3>

                <ul class="lsm__volume-list">
                    <li v-for="volume in row" :key="volume.id">
                        <button type="button" class="lsm__volume" :class="{
                            'lsm__volume--available': volume.available,
                            'lsm__volume--orphan': !volume.available,
                        }" :aria-label="t('lessonSelect.volumeAria', {
                            grade: volume.grade,
                            volume: volume.volume,
                        })" @click="onVolumeClick(volume)">
                            <img :src="volume.coverUrl" :alt="''" class="lsm__cover" />
                            <span class="lsm__volume-pill">
                                {{ t('lessonSelect.volume', { n: volume.volume }) }}
                            </span>
                        </button>
                    </li>
                </ul>
            </div>
        </section>

        <!-- ──────────  STAGE 2 / 3 — UNIT + LESSON PICKER  ────────── -->
        <section v-else class="lsm__stage lsm__stage--units">
            <!-- "← Back to volume picker" link is the only escape hatch
                 once the user is past stage 1 (the modal otherwise has
                 no other navigation between stages). -->
            <button type="button" class="lsm__back" @click="backToVolumes">
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                        stroke-linejoin="round" />
                </svg>
                {{ t('lessonSelect.backToVolumes') }}
            </button>

            <p class="lsm__crumb">{{ headerCrumb }}</p>

            <div class="lsm__panel">
                <!-- Left: chosen textbook cover -->
                <img v-if="selectedVolume" :src="selectedVolume.coverUrl" :alt="''" class="lsm__panel-cover" />

                <!-- Right: unit list (with optional expanded lessons) -->
                <ul class="lsm__unit-list">
                    <li v-for="unit in selectedVolume?.units ?? []" :key="unit.id" class="lsm__unit-item" :class="{
                        'lsm__unit-item--expanded': expandedUnitId === unit.id,
                    }">
                        <button type="button" class="lsm__unit-row" :aria-expanded="expandedUnitId === unit.id"
                            @click="onUnitClick(unit)">
                            <span class="lsm__unit-label">
                                <span class="lsm__unit-prefix">
                                    {{ t('lessonSelect.unit', { n: unit.number }) }}
                                </span>
                                {{ localized(unit.titleEn, unit.titleZh) }}
                            </span>
                            <span class="lsm__unit-toggle" aria-hidden="true">
                                <span class="lsm__unit-toggle-line lsm__unit-toggle-line--h" />
                                <span v-if="expandedUnitId !== unit.id"
                                    class="lsm__unit-toggle-line lsm__unit-toggle-line--v" />
                            </span>
                        </button>

                        <!-- Lessons (revealed when this unit is expanded) -->
                        <ul v-if="expandedUnitId === unit.id" class="lsm__lesson-list">
                            <li v-for="lesson in unit.lessons" :key="lesson.id">
                                <button type="button" class="lsm__lesson" @click="onLessonClick(unit, lesson)">
                                    <span class="lsm__lesson-prefix">
                                        {{ t('lessonSelect.lesson', { n: lesson.number }) }}:
                                    </span>
                                    {{ localized(lesson.titleEn, lesson.titleZh) }}
                                </button>
                            </li>
                        </ul>
                    </li>
                </ul>
            </div>
        </section>
    </dialog>
</template>

<style scoped>
/* ── The dialog skin ──────────────────────────────────────────
 * Same defensive pattern as AccessModal: NO layout properties on
 * the base `.lsm` rule, all layout gated behind `[open]`. Keeps the
 * UA's `display: none` for closed dialogs. */

.lsm {
    border: 0;
    background: var(--color-bg);
    color: var(--color-text);
    border-radius: var(--radius-card-lg);
    box-shadow: 12px 12px 20px rgba(0, 0, 0, 0.12);
    padding: 0;
    width: min(1500px, 92vw);
    max-height: 90vh;
    box-sizing: border-box;
    overflow: visible;
}

.lsm[open] {
    /* Explicit centering — same trick as AccessModal. */
    position: fixed;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
    margin: 0;

    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-7) var(--space-7) var(--space-7);
    animation: lsm-in 220ms ease-out;
    overflow-y: auto;
}

.lsm::backdrop {
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(2px);
    animation: lsm-backdrop-in 220ms ease-out;
}

@keyframes lsm-in {
    from {
        opacity: 0;
        transform: translateY(8px) scale(0.98);
    }

    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

@keyframes lsm-backdrop-in {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

/* ── Close button ─────────────────────────────────────────── */

.lsm__close {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 0;
    background: var(--color-text);
    color: var(--color-bg);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: filter 0.15s ease;
}

.lsm__close:hover {
    filter: brightness(1.2);
}

.lsm__close svg {
    width: 18px;
    height: 18px;
}

/* ── Header (title + green bullet) ─────────────────────────── */

.lsm__header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding-right: 56px;
    /* leave room for close button */
}

.lsm__bullet {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--color-primary);
    flex-shrink: 0;
}

.lsm__title {
    margin: 0;
    font-family: var(--font-body);
    font-weight: 600;
    font-size: clamp(20px, 1.8vw, 28px);
    line-height: 1.4;
    color: var(--color-text);
    outline: none;
}

.lsm__stage {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
}

/* ── Stage 1: Volume picker ───────────────────────────────── */

.lsm__stage--volumes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-rows: min-content;
    gap: var(--space-6) var(--space-7);
    align-items: start;
}

.lsm__grade {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
}

.lsm__grade-title {
    margin: 0;
    font-family: var(--font-body);
    font-weight: 600;
    font-size: clamp(18px, 1.4vw, 22px);
    color: var(--color-text);
}

.lsm__volume-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
}

.lsm__volume {
    appearance: none;
    border: 0;
    background: transparent;
    padding: 0;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    transition: transform 0.18s ease, filter 0.18s ease;
}

.lsm__volume--available:hover {
    transform: translateY(-3px);
    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.12));
}

.lsm__volume--orphan {
    cursor: not-allowed;
    opacity: 0.55;
}

.lsm__volume--orphan:hover {
    opacity: 0.7;
}

.lsm__cover {
    width: 100%;
    aspect-ratio: 1000 / 1200;
    object-fit: cover;
    border-radius: 6px;
    /* 2026-05 — 老师反馈：教材封面的投影让弹窗显得"过装饰"。整套
       系统现在用浅灰描边卡片为主，封面下方有阴影会和后面的卡片
       结构打架。移除 box-shadow，保留 hover 时的 drop-shadow
       作为微交互即可。 */
    user-select: none;
    -webkit-user-drag: none;
}

.lsm__volume-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 26px;
    padding: 0 14px;
    border: 1px solid rgba(0, 0, 0, 0.5);
    border-radius: var(--radius-pill);
    font-family: var(--font-body);
    font-weight: 500;
    font-size: 14px;
    color: var(--color-text);
    background: var(--color-bg);
    transition: background 0.18s ease, border-color 0.18s ease;
}

.lsm__volume--available:hover .lsm__volume-pill {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-text);
    font-weight: 600;
}

/* ── Stage 2 / 3: Unit + lesson picker ────────────────────── */

.lsm__back {
    align-self: flex-start;
    appearance: none;
    border: 0;
    background: transparent;
    padding: 0;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text-soft);
    font-family: var(--font-body);
    font-size: 14px;
    cursor: pointer;
    transition: color 0.15s ease;
}

.lsm__back:hover {
    color: var(--color-text);
}

.lsm__back svg {
    width: 14px;
    height: 14px;
}

.lsm__crumb {
    margin: 0;
    font-family: var(--font-body);
    font-weight: 600;
    font-size: clamp(20px, 1.6vw, 24px);
    color: var(--color-text);
}

.lsm__panel {
    display: grid;
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    gap: var(--space-7);
    align-items: start;
}

.lsm__panel-cover {
    width: 100%;
    aspect-ratio: 1000 / 1200;
    object-fit: cover;
    border-radius: 6px;
    /* 2026-05 — 同 .lsm__cover：移除投影，与重新设计的扁平卡片
       风格保持一致。 */
    user-select: none;
    -webkit-user-drag: none;
}

.lsm__unit-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
}

.lsm__unit-item {
    border-bottom: 1px solid var(--color-border);
}

.lsm__unit-item:last-child {
    border-bottom: 0;
}

.lsm__unit-item--expanded {
    background: rgba(127, 236, 143, 0.10);
    /* primary @10% — subtle highlight, matches Figma */
    border-radius: var(--radius-input);
    border-bottom-color: transparent;
}

.lsm__unit-row {
    appearance: none;
    border: 0;
    background: transparent;
    padding: var(--space-4) var(--space-4);
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
}

.lsm__unit-row:hover {
    background: rgba(0, 0, 0, 0.03);
    border-radius: var(--radius-input);
}

.lsm__unit-label {
    font-family: var(--font-body);
    font-size: clamp(15px, 1.2vw, 18px);
    color: var(--color-text);
    line-height: 1.4;
}

.lsm__unit-prefix {
    font-weight: 700;
    margin-right: var(--space-2);
}

.lsm__unit-toggle {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--color-text);
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.lsm__unit-toggle-line {
    background: var(--color-bg);
    position: absolute;
    border-radius: 1px;
}

.lsm__unit-toggle-line--h {
    width: 14px;
    height: 2px;
}

.lsm__unit-toggle-line--v {
    width: 2px;
    height: 14px;
}

/* Lessons (stage 3) */

.lsm__lesson-list {
    list-style: none;
    margin: 0;
    padding: 0 var(--space-4) var(--space-4) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.lsm__lesson {
    appearance: none;
    border: 0;
    width: 100%;
    text-align: left;
    background: var(--color-input-bg);
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-pill);
    font-family: var(--font-body);
    font-size: 15px;
    color: var(--color-text);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
}

.lsm__lesson:hover {
    background: var(--color-primary);
}

.lsm__lesson:active {
    transform: scale(0.99);
}

.lsm__lesson-prefix {
    font-weight: 700;
    margin-right: var(--space-2);
}

/* ── Responsive ───────────────────────────────────────────── */

@media (max-width: 1100px) {
    .lsm__stage--volumes {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-5) var(--space-6);
    }

    .lsm__panel {
        grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
        gap: var(--space-5);
    }
}

@media (max-width: 720px) {
    .lsm[open] {
        padding: var(--space-6) var(--space-5);
        gap: var(--space-4);
    }

    .lsm__stage--volumes {
        grid-template-columns: 1fr;
    }

    .lsm__panel {
        grid-template-columns: 1fr;
    }

    .lsm__panel-cover {
        max-width: 220px;
        margin: 0 auto;
    }
}
</style>
