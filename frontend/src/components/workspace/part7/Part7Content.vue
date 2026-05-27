<script setup lang="ts">
/**
 * Part 7 — Share & Feedback.
 *
 * Left column: upload area + thumbnails of student works.
 * Right column: feedback panel for the currently selected work.
 *
 * Requires an LKP-anchored project — without `projectsStore.activeLessonId`
 * the page shows a clear empty state explaining why.
 */
import { computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePart7Store } from '@/stores/part7'
import { useSlideStore } from '@/stores/slides'
import { useProjectsStore } from '@/stores/projects'

const store = usePart7Store()
const slideStore = useSlideStore()
const projectsStore = useProjectsStore()
const { t, locale } = useI18n()

// Ensure at least one Part-7 slide exists and is selected when this panel mounts.
// The sidebar only manages slides for parts 1-4, so Part 7 must self-bootstrap.
onMounted(() => {
    const part7Slides = slideStore.slides.filter((s) => s.partId === 7)
    if (part7Slides.length === 0) {
        const id = slideStore.addSlide(7)
        store.ensurePair(id)
    } else {
        const current = slideStore.slides.find((s) => s.id === slideStore.activeSlideId)
        if (!current || current.partId !== 7) {
            slideStore.selectSlide(part7Slides[0].id)
        }
        const activeId = slideStore.slides.find((s) => s.partId === 7 && s.id === slideStore.activeSlideId)?.id
            ?? part7Slides[0].id
        store.ensurePair(activeId)
    }
})

// Keep the pair in sync when the active slide changes
watch(
    () => slideStore.activeSlideId,
    (id) => {
        if (id && slideStore.slides.find((s) => s.id === id)?.partId === 7) {
            store.ensurePair(id)
        }
    },
)

const hasLesson = computed(() => !!projectsStore.activeLessonId)
const hasWorks = computed(() => (store.activePair?.works.length ?? 0) > 0)

function openFilePicker() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.cssText = 'position:fixed;top:-999px;left:-999px;'
    document.body.appendChild(input)
    input.addEventListener('change', () => {
        const file = input.files?.[0]
        input.remove()
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
            store.addStudentWork(reader.result as string)
        }
        reader.readAsDataURL(file)
    })
    input.click()
}

function onDrop(e: DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => store.addStudentWork(reader.result as string)
    reader.readAsDataURL(file)
}

async function generate() {
    const pair = store.activePair
    if (!pair) return
    await store.generateComment(pair.activeWorkIdx, locale.value as 'en' | 'zh')
}
</script>

<template>
    <section class="p7">
        <!-- No LKP → friendly empty state -->
        <div v-if="!hasLesson" class="p7-empty">
            <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
                <rect x="8" y="12" width="48" height="40" rx="6" stroke="#d1d5db" stroke-width="2.5" />
                <path d="M16 24h32M16 32h24M16 40h16" stroke="#d1d5db" stroke-width="2.5" stroke-linecap="round" />
            </svg>
            <h2>{{ t('part7.noLessonTitle') }}</h2>
            <p>{{ t('part7.noLessonHint') }}</p>
        </div>

        <template v-else>
            <!-- Left: upload + work thumbnails -->
            <aside class="p7-left">
                <h2 class="p7-h">{{ t('part7.studentWorks') }}</h2>
                <p class="p7-sub">{{ t('part7.studentWorksHint') }}</p>

                <div
                    class="p7-upload"
                    role="button"
                    tabindex="0"
                    @click="openFilePicker"
                    @keydown.enter="openFilePicker"
                    @dragover.prevent
                    @drop="onDrop"
                >
                    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
                        <rect x="4" y="6" width="24" height="20" rx="3" stroke="#9ca3af" stroke-width="1.8" />
                        <circle cx="11" cy="13" r="2" stroke="#9ca3af" stroke-width="1.8" />
                        <path d="M4 22l6-6 5 5 4-4 9 7" stroke="#9ca3af" stroke-width="1.8" stroke-linejoin="round" />
                    </svg>
                    <span>{{ t('part7.uploadLabel') }}</span>
                </div>

                <ul v-if="hasWorks" class="p7-thumbs">
                    <li
                        v-for="(w, i) in store.activePair!.works"
                        :key="w.id"
                        class="p7-thumb"
                        :class="{ 'p7-thumb--active': i === store.activePair!.activeWorkIdx }"
                        @click="store.selectStudentWork(i)"
                    >
                        <img :src="w.imageDataUrl" alt="" />
                        <button
                            class="p7-thumb-x"
                            type="button"
                            :aria-label="t('part7.removeWork')"
                            @click.stop="store.removeStudentWork(i)"
                        >×</button>
                    </li>
                </ul>
            </aside>

            <!-- Right: feedback for the selected work -->
            <section class="p7-right">
                <!-- Placeholder text removed per pilot feedback —
                     the left column already prompts the teacher to
                     upload / pick a work, so the duplicate hint here
                     felt noisy. The wrapper div is kept so the right
                     column still reserves layout before a selection. -->
                <div v-if="!store.activeWork" class="p7-placeholder" />

                <template v-else>
                    <div class="p7-work-preview">
                        <img :src="store.activeWork.imageDataUrl" alt="" />
                    </div>

                    <!-- 2026-05: 学生备注 (studentNote) input box was
                         removed. Pilot teachers said the LKP already
                         encodes every objective / concept / criterion
                         the AI needs, and asking a teacher to retype a
                         description of the student's work duplicated
                         effort (and was usually left blank anyway). The
                         vision LLM looks at the image directly. The
                         `studentNote` field is still in the store +
                         /api/part7/comment payload for forward-compat;
                         we just no longer let the teacher author it. -->

                    <div class="p7-actions">
                        <button
                            class="p7-btn p7-btn--primary"
                            type="button"
                            :disabled="store.activeWork.generatingFeedback"
                            @click="generate"
                        >
                            <span v-if="store.activeWork.generatingFeedback">{{ t('part7.generating') }}</span>
                            <span v-else>
                                {{
                                    store.activeWork.feedbackText
                                        ? t('part7.regenerate')
                                        : t('part7.generate')
                                }}
                            </span>
                        </button>
                    </div>

                    <p v-if="store.activeWork.feedbackError" class="p7-err">
                        {{ store.activeWork.feedbackError }}
                    </p>

                    <article v-if="store.activeWork.feedbackText" class="p7-feedback">
                        <header>
                            <h3>{{ t('part7.feedbackHeading') }}</h3>
                            <span class="p7-wc">
                                {{ t('part7.wordCount', { n: store.activeWork.feedbackWordCount }) }}
                            </span>
                        </header>
                        <p class="p7-feedback-body">{{ store.activeWork.feedbackText }}</p>
                        <footer v-if="store.activeWork.feedbackDimensions.length">
                            <span class="p7-dim-label">{{ t('part7.dimensionsCovered') }}</span>
                            <span
                                v-for="d in store.activeWork.feedbackDimensions"
                                :key="d"
                                class="p7-dim"
                            >{{ d }}</span>
                        </footer>
                    </article>
                </template>
            </section>
        </template>
    </section>
</template>

<style scoped>
.p7 {
    flex: 1;
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 0;
    background: #F3F4F4;
    overflow: hidden;
    min-height: 0;
}

/* Empty state */
.p7-empty {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px;
    color: #6b7280;
    text-align: center;
}
.p7-empty svg { width: 64px; height: 64px; }
.p7-empty h2 { font-size: 18px; font-weight: 700; color: #111827; margin: 0; }
.p7-empty p  { margin: 0; max-width: 360px; line-height: 1.5; }

/* Left column */
.p7-left {
    background: #fff;
    border-right: 1px solid #e5e7eb;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    min-height: 0;
}

.p7-h { margin: 0; font-size: 16px; font-weight: 700; color: #111827; }
.p7-sub { margin: 0; font-size: 12px; color: #6b7280; line-height: 1.4; }

.p7-upload {
    border: 2px dashed #d1d5db;
    border-radius: 12px;
    padding: 22px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: #6b7280;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
}
.p7-upload:hover, .p7-upload:focus-visible { border-color: #7FEC8F; background: #f7fffa; outline: none; }
.p7-upload svg { width: 32px; height: 32px; }
.p7-upload span { font-size: 13px; }

.p7-thumbs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.p7-thumb {
    position: relative;
    aspect-ratio: 1 / 1;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid #e5e7eb;
    cursor: pointer;
}
.p7-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.p7-thumb--active { border-color: #7FEC8F; box-shadow: 0 0 0 2px #B2F4BC; }
.p7-thumb-x {
    position: absolute; top: 4px; right: 4px;
    width: 22px; height: 22px; border-radius: 50%;
    background: rgba(0,0,0,0.55); color: #fff; border: none;
    font-size: 16px; line-height: 1; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
}
.p7-thumb-x:hover { background: rgba(0,0,0,0.8); }

/* Right column */
.p7-right {
    padding: 24px 32px;
    overflow-y: auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.p7-placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    font-size: 14px;
}

.p7-work-preview {
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    max-width: 720px;
}
.p7-work-preview img {
    width: 100%; height: auto; display: block;
    max-height: 360px; object-fit: contain;
    background: #f9fafb;
}

.p7-note {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 720px;
}
.p7-note > span { font-size: 13px; font-weight: 600; color: #374151; }
.p7-note textarea {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 10px 12px;
    font-family: inherit;
    font-size: 14px;
    color: #111827;
    resize: vertical;
    outline: none;
    background: #fff;
}
.p7-note textarea:focus { border-color: #7FEC8F; }

.p7-actions { display: flex; gap: 10px; }
.p7-btn {
    height: 40px;
    padding: 0 22px;
    border-radius: 999px;
    border: none;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
}
.p7-btn--primary { background: #7FEC8F; color: #111827; }
.p7-btn--primary:hover:not(:disabled) { transform: translateY(-1px); }
.p7-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.p7-err {
    margin: 0;
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13px;
    max-width: 720px;
}

/* Feedback card */
.p7-feedback {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 720px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.p7-feedback header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.p7-feedback h3 { margin: 0; font-size: 15px; font-weight: 700; color: #111827; }
.p7-wc { font-size: 12px; color: #6b7280; }
.p7-feedback-body { margin: 0; font-size: 15px; line-height: 1.65; color: #1f2937; white-space: pre-wrap; }
.p7-feedback footer { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding-top: 8px; border-top: 1px dashed #e5e7eb; }
.p7-dim-label { font-size: 12px; color: #6b7280; margin-right: 4px; }
.p7-dim {
    background: #B2F4BC;
    color: #14532d;
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 600;
}

@media (max-width: 900px) {
    .p7 { grid-template-columns: 1fr; }
    .p7-left { border-right: none; border-bottom: 1px solid #e5e7eb; max-height: 40vh; }
}
</style>
