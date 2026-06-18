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
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePart7Store } from '@/stores/part7'
import { useSlideStore } from '@/stores/slides'
import { useProjectsStore } from '@/stores/projects'


const store = usePart7Store()
const slideStore = useSlideStore()
const projectsStore = useProjectsStore()
const { t, locale } = useI18n()

// ── Feedback annotation brush (2026-06-11) ─────────────────────────
//
// Mirrors the Part-6 lightbox brush (§29 + Part6Content.vue): an HTML5
// canvas overlay sized to the feedback-body's rendered bounding box so
// the teacher can circle the bits of the AI critique she wants to
// emphasise live in class ("look here — *imagination* — and here —
// *colour-mixing*").
//
// Design choices that carry over from Part-6 unchanged:
//   • Same 6-colour palette (red / amber / yellow / green / blue / white).
//     Yellow + white intentionally survive against bright/dark
//     backgrounds respectively.
//   • Same 3 brush thicknesses (3 / 6 / 12 px).
//   • Pointer-capture pattern (`setPointerCapture` on pointerdown)
//     keeps the stroke alive when the teacher draws past the text-box
//     edge — without it, strokes break into "jumps" mid-letter.
//   • DPR-aware sizing: canvas CSS dimensions track the rendered
//     bounding rect; underlying pixel buffer is scaled by
//     `window.devicePixelRatio` so retina projector screens stay
//     crisp.
//   • Session-only — annotations are cleared on (a) regenerate
//     feedback, (b) switch active work, (c) leave the Part-7 slide,
//     (d) explicit Clear button. No undo / per-stroke eraser, by
//     design (same trade-off as §29).
//
// One Part-7-specific quirk: the feedback body is plain HTML text
// (`<p>`), so the canvas sits **on top** of the text with
// `pointer-events: none` until brush mode is toggled on. That way
// teachers can copy / select the text freely when the brush is off,
// and only when it's on do clicks route to the canvas.
type BrushColor = string
const BRUSH_COLORS: BrushColor[] = [
    '#EF4444',  // red — primary callout
    '#F59E0B',  // amber
    '#FACC15',  // yellow
    '#22C55E',  // green
    '#3B82F6',  // blue
    '#FFFFFF',  // white
]
const BRUSH_THICKNESSES = [3, 6, 12]  // CSS pixels

const brushActive = ref(false)
const brushColor = ref<BrushColor>(BRUSH_COLORS[0])
const brushSize = ref<number>(BRUSH_THICKNESSES[1])  // medium default

const feedbackBodyEl = ref<HTMLElement | null>(null)
const annotationCanvasEl = ref<HTMLCanvasElement | null>(null)
let _drawing = false
let _lastX = 0
let _lastY = 0

/**
 * Match the canvas's CSS size + backing buffer to the feedback body's
 * rendered bounding rect. Re-run on mount, on feedback-text change
 * (re-flow grows the box), on window resize, and on brush toggle (so
 * the canvas is ready the moment the teacher enables it).
 */
function syncCanvasSize() {
    const body = feedbackBodyEl.value
    const canvas = annotationCanvasEl.value
    if (!body || !canvas) return
    const rect = body.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    canvas.width = Math.max(1, Math.round(rect.width * dpr))
    canvas.height = Math.max(1, Math.round(rect.height * dpr))
    const ctx = canvas.getContext('2d')
    if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)  // draw in CSS pixels
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
    }
}

function clearAnnotations() {
    const canvas = annotationCanvasEl.value
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
}

function onWindowResize() {
    if (store.activeWork?.feedbackText) syncCanvasSize()
}

watch(brushActive, on => {
    if (on) nextTick(syncCanvasSize)
})

// Re-flow the canvas whenever the feedback body's text changes —
// because the body height grows/shrinks, the canvas must follow OR
// the strokes will land at the wrong relative position next time the
// teacher draws. We also clear existing strokes on text-change since
// they were drawn against a different layout and would now be wrong.
watch(
    () => store.activeWork?.feedbackText,
    () => {
        clearAnnotations()
        nextTick(syncCanvasSize)
    },
)

// Switching active work invalidates the strokes too — they belonged
// to the previous critique. The TTS auto-stop is already handled
// further down; this just owns the canvas reset.
watch(
    () => store.activeWork?.id,
    () => {
        clearAnnotations()
        brushActive.value = false
        nextTick(syncCanvasSize)
    },
)

function getPointerPos(e: PointerEvent): [number, number] {
    const canvas = annotationCanvasEl.value
    if (!canvas) return [0, 0]
    const rect = canvas.getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top]
}

function onCanvasPointerDown(e: PointerEvent) {
    if (!brushActive.value) return
    const canvas = annotationCanvasEl.value
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    const [x, y] = getPointerPos(e)
    _drawing = true
    _lastX = x
    _lastY = y
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Single tap should leave a dot, not just sit waiting for a move.
    ctx.beginPath()
    ctx.arc(x, y, brushSize.value / 2, 0, Math.PI * 2)
    ctx.fillStyle = brushColor.value
    ctx.fill()
    e.preventDefault()
}

function onCanvasPointerMove(e: PointerEvent) {
    if (!_drawing || !brushActive.value) return
    const canvas = annotationCanvasEl.value
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const [x, y] = getPointerPos(e)
    ctx.strokeStyle = brushColor.value
    ctx.lineWidth = brushSize.value
    ctx.beginPath()
    ctx.moveTo(_lastX, _lastY)
    ctx.lineTo(x, y)
    ctx.stroke()
    _lastX = x
    _lastY = y
    e.preventDefault()
}

function onCanvasPointerUp(e: PointerEvent) {
    if (!_drawing) return
    _drawing = false
    const canvas = annotationCanvasEl.value
    if (canvas?.hasPointerCapture?.(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId)
    }
}


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
    // 2026-06-11 — Brush canvas resize listener. Kept on `window`
    // because the right-column scroll container's `resize` event
    // isn't reliable across browsers; the feedback body's width
    // changes are driven by viewport reflow either way.
    window.addEventListener('resize', onWindowResize)
})


// Keep the pair in sync when the active slide changes
watch(
    () => slideStore.activeSlideId,
    (id) => {
        if (id && slideStore.slides.find((s) => s.id === id)?.partId === 7) {
            store.ensurePair(id)
        }
        // 2026-06-08 — Switching slides should also stop any
        // currently-playing TTS. Otherwise the teacher hears a
        // disembodied voice continuing to read the previous student's
        // feedback while she's already looking at the next one.
        store.stopFeedbackTTS()
    },
)

// 2026-06-08 — Also stop TTS when the teacher switches which student
// work is active inside the same Part-7 slide. The store policy is
// "one TTS at a time", but the play button shows per-work state so
// without this we'd leak audio across selections.
watch(
    () => store.activeWork?.id,
    () => {
        if (store.currentTtsWorkId && store.currentTtsWorkId !== store.activeWork?.id) {
            store.stopFeedbackTTS()
        }
    },
)

// 2026-06-08 — Hard stop on unmount so navigating away from Part-7
// (e.g. via the sidebar back to Part-3) doesn't leave an orphaned
// HTMLAudioElement reading aloud behind a closed view.
onBeforeUnmount(() => {
    store.stopFeedbackTTS()
    window.removeEventListener('resize', onWindowResize)
})



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

// ── Orientation controls + confirmation gate (2026-06-18) ──────────
//
// Phone photos of student work are frequently sideways. After upload
// the teacher rotates the active work upright and clicks Confirm; the
// Generate button stays disabled until `activeWork.confirmed` is true,
// so the AI critique only ever runs on an orientation the teacher
// approved. `rotateStudentWork` re-encodes the pixels in the store.
function rotateActiveWork(deg: number) {
    const pair = store.activePair
    if (!pair) return
    store.rotateStudentWork(pair.activeWorkIdx, deg)
}
function confirmActiveWork() {
    const pair = store.activePair
    if (!pair) return
    store.confirmStudentWork(pair.activeWorkIdx)
}

// ── Fullscreen viewer (2026-06-18) ─────────────────────────────────
//
// Pilot request: teachers want to enlarge a student-work photo to
// projector size so the whole class can see it. Click the preview
// image to open a full-screen lightbox; Esc / click-backdrop / ×
// closes it. Mounted via Teleport so it sits outside the column's
// scroll container.
const lightboxUrl = ref<string | null>(null)
function openLightbox(url: string) {
    lightboxUrl.value = url
}
function closeLightbox() {
    lightboxUrl.value = null
}
function onLightboxKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && lightboxUrl.value !== null) {
        e.stopPropagation()
        closeLightbox()
    }
}
onMounted(() => document.addEventListener('keydown', onLightboxKey, true))
onBeforeUnmount(() => document.removeEventListener('keydown', onLightboxKey, true))
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
                    <!-- 2026-06-18 — Click the preview to open the
                         student work fullscreen for the whole class. -->
                    <div class="p7-work-preview">
                        <img
                            :src="store.activeWork.imageDataUrl"
                            class="p7-work-preview-img"
                            :title="t('part7.viewFullscreen')"
                            alt=""
                            @click="openLightbox(store.activeWork.imageDataUrl)"
                        />
                    </div>

                    <!-- 2026-06-18 — Orientation controls + confirmation
                         gate. Phone photos are frequently sideways; the
                         teacher rotates the work upright and clicks
                         Confirm before the critique can be generated.
                         Rotating re-arms the gate. -->
                    <div class="p7-orient">
                        <div class="p7-orient-controls">
                            <button
                                type="button"
                                class="p7-orient-btn"
                                :title="t('part7.rotateLeft')"
                                :aria-label="t('part7.rotateLeft')"
                                @click="rotateActiveWork(-90)"
                            >
                                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                                    <path d="M5 8V5a1 1 0 011-1h7a1 1 0 011 1v10a1 1 0 01-1 1H6a1 1 0 01-1-1v-1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M5 8L2.5 10.5M5 8l2.5 2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <span>{{ t('part7.rotateLeft') }}</span>
                            </button>
                            <button
                                type="button"
                                class="p7-orient-btn"
                                :title="t('part7.rotateRight')"
                                :aria-label="t('part7.rotateRight')"
                                @click="rotateActiveWork(90)"
                            >
                                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                                    <path d="M15 8V5a1 1 0 00-1-1H7a1 1 0 00-1 1v10a1 1 0 001 1h7a1 1 0 001-1v-1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M15 8l2.5 2.5M15 8l-2.5 2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <span>{{ t('part7.rotateRight') }}</span>
                            </button>
                        </div>

                        <button
                            type="button"
                            class="p7-confirm-btn"
                            :class="{ 'p7-confirm-btn--done': store.activeWork.confirmed }"
                            :disabled="store.activeWork.confirmed"
                            @click="confirmActiveWork"
                        >
                            <span v-if="store.activeWork.confirmed">✓ {{ t('part7.imageConfirmed') }}</span>
                            <span v-else>{{ t('part7.confirmImage') }}</span>
                        </button>

                        <p v-if="!store.activeWork.confirmed" class="p7-orient-hint">
                            {{ t('part7.rotateHint') }}
                        </p>
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
                            :disabled="store.activeWork.generatingFeedback || !store.activeWork.confirmed"
                            :title="!store.activeWork.confirmed ? t('part7.confirmFirst') : ''"
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
                        <!-- 2026-05: 老师反馈：「AI 评价」标题 + 「xxx 字」
                             字数统计被认为是不必要的「系统装饰」——卡片
                             的语境（按了"获得作品点评"按钮、下面就是
                             一段文字）已经足够清楚，多余的标签反而干扰
                             阅读评语。两者均移除；底部「已覆盖维度」chip
                             仍保留，因为它是真正能传达评价覆盖度的信号。
                             `feedbackWordCount` 在 store 中仍计算，
                             以便日后做导出/统计用。 -->
                        <!-- 2026-06-08 — Voice playback toolbar.
                             Lives above the feedback text so it
                             reads as a "play this paragraph" affordance
                             rather than a free-floating control.
                             Four button states wired to the store's
                             tts state machine (2026-06-11 added
                             `paused` → true resume from currentTime,
                             not restart from zero):
                                 idle    → ▶ 朗读评语 / Read aloud
                                 loading → ⏳ 加载中... / Loading…
                                 playing → ⏸ 暂停    / Pause
                                 paused  → ▶ 继续    / Resume
                             2026-06-11 — brush controls live alongside
                             the TTS pill so teachers can annotate the
                             critique text while it's being read. -->
                        <div class="p7-feedback-toolbar">
                            <!-- Brush toggle (always present) -->
                            <button
                                type="button"
                                class="p7-brush-toggle"
                                :class="{ 'p7-brush-toggle--on': brushActive }"
                                :title="brushActive
                                    ? (locale === 'zh' ? '关闭画笔' : 'Hide brush')
                                    : (locale === 'zh' ? '打开画笔' : 'Show brush')"
                                @click="brushActive = !brushActive"
                            >
                                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                                    <path d="M3 17l3.5-1 9-9-2.5-2.5-9 9L3 17z"
                                          stroke="currentColor" stroke-width="1.6"
                                          stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M12 5l2.5 2.5"
                                          stroke="currentColor" stroke-width="1.6"
                                          stroke-linecap="round"/>
                                </svg>
                                <span>{{
                                    brushActive
                                        ? (locale === 'zh' ? '画笔已开' : 'Brush on')
                                        : (locale === 'zh' ? '画笔' : 'Brush')
                                }}</span>
                            </button>

                            <!-- Brush palette: colour + size + clear.
                                 Only surfaces when the brush is on so
                                 the inactive toolbar stays compact. -->
                            <template v-if="brushActive">
                                <div class="p7-brush-colors" role="group" aria-label="颜色">
                                    <button
                                        v-for="c in BRUSH_COLORS"
                                        :key="c"
                                        type="button"
                                        class="p7-brush-color"
                                        :class="{ 'p7-brush-color--active': brushColor === c }"
                                        :style="{ background: c }"
                                        :aria-label="`Color ${c}`"
                                        @click="brushColor = c"
                                    />
                                </div>
                                <div class="p7-brush-sizes" role="group" aria-label="粗细">
                                    <button
                                        v-for="s in BRUSH_THICKNESSES"
                                        :key="s"
                                        type="button"
                                        class="p7-brush-size"
                                        :class="{ 'p7-brush-size--active': brushSize === s }"
                                        :aria-label="`Size ${s}`"
                                        @click="brushSize = s"
                                    >
                                        <span
                                            class="p7-brush-size-dot"
                                            :style="{
                                                width: s + 'px',
                                                height: s + 'px',
                                                background: brushColor,
                                            }"
                                        />
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    class="p7-brush-clear"
                                    :title="locale === 'zh' ? '清除全部' : 'Clear all'"
                                    @click="clearAnnotations"
                                >
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                        <path d="M3 5h10M6 5V3.5A1 1 0 017 2.5h2a1 1 0 011 1V5M4.5 5l.7 8a1 1 0 001 1h3.6a1 1 0 001-1l.7-8"
                                              stroke="currentColor" stroke-width="1.4"
                                              stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    <span>{{ locale === 'zh' ? '清除' : 'Clear' }}</span>
                                </button>
                            </template>

                            <!-- Spacer pushes TTS pill to the right -->
                            <span class="p7-toolbar-spacer" />

                            <button
                                type="button"
                                class="p7-tts-btn"
                                :class="{
                                  'p7-tts-btn--loading': store.ttsStateFor(store.activeWork.id) === 'loading',
                                  'p7-tts-btn--playing': store.ttsStateFor(store.activeWork.id) === 'playing',
                                  'p7-tts-btn--paused':  store.ttsStateFor(store.activeWork.id) === 'paused',
                                }"
                                :disabled="store.ttsStateFor(store.activeWork.id) === 'loading'"
                                @click="store.playFeedbackTTS(
                                    store.activeWork.id,
                                    store.activeWork.feedbackText,
                                )"
                            >
                                <!-- Play icon (idle OR paused — both
                                     resolve forward by tapping the
                                     button; "paused" just resumes mid-
                                     sentence instead of starting over). -->
                                <svg
                                    v-if="store.ttsStateFor(store.activeWork.id) === 'idle'
                                       || store.ttsStateFor(store.activeWork.id) === 'paused'"
                                    viewBox="0 0 20 20" fill="none" class="p7-tts-icon"
                                >
                                    <path d="M6 4.5L15 10L6 15.5V4.5Z" fill="currentColor"/>
                                </svg>
                                <!-- Loading spinner -->
                                <span
                                    v-else-if="store.ttsStateFor(store.activeWork.id) === 'loading'"
                                    class="p7-tts-spinner"
                                />
                                <!-- Pause icon (playing) -->
                                <svg
                                    v-else
                                    viewBox="0 0 20 20" fill="none" class="p7-tts-icon"
                                >
                                    <rect x="5" y="4" width="3.5" height="12" rx="1" fill="currentColor"/>
                                    <rect x="11.5" y="4" width="3.5" height="12" rx="1" fill="currentColor"/>
                                </svg>
                                <span class="p7-tts-label">
                                    <template v-if="store.ttsStateFor(store.activeWork.id) === 'idle'">
                                        {{ locale === 'zh' ? '朗读评语' : 'Read aloud' }}
                                    </template>
                                    <template v-else-if="store.ttsStateFor(store.activeWork.id) === 'loading'">
                                        {{ locale === 'zh' ? '加载中…' : 'Loading…' }}
                                    </template>
                                    <template v-else-if="store.ttsStateFor(store.activeWork.id) === 'paused'">
                                        {{ locale === 'zh' ? '继续' : 'Resume' }}
                                    </template>
                                    <template v-else>
                                        {{ locale === 'zh' ? '暂停' : 'Pause' }}
                                    </template>
                                </span>
                            </button>
                        </div>

                        <!-- 2026-06-11 — feedback body + brush canvas
                             overlay. The body is `position: relative`
                             so the canvas can sit on top of it. The
                             canvas's `pointer-events` is gated on
                             `brushActive`: when off the text below is
                             freely selectable / copyable; when on the
                             canvas intercepts clicks so strokes land
                             where the teacher draws. -->
                        <div
                            class="p7-feedback-body-wrap"
                            :class="{ 'p7-feedback-body-wrap--brush': brushActive }"
                        >
                            <p
                                ref="feedbackBodyEl"
                                class="p7-feedback-body"
                            >{{ store.activeWork.feedbackText }}</p>
                            <canvas
                                ref="annotationCanvasEl"
                                class="p7-annotation-canvas"
                                :class="{ 'p7-annotation-canvas--active': brushActive }"
                                @pointerdown="onCanvasPointerDown"
                                @pointermove="onCanvasPointerMove"
                                @pointerup="onCanvasPointerUp"
                                @pointercancel="onCanvasPointerUp"
                            />
                        </div>


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

        <!-- 2026-06-18 — Fullscreen viewer for a student work. Mounted
             via Teleport so it isn't clipped by the column's scroll
             container. Click backdrop / × / press Esc to close. -->
        <Teleport to="body">
            <div
                v-if="lightboxUrl"
                class="p7-lightbox"
                role="dialog"
                aria-modal="true"
                @click.self="closeLightbox"
            >
                <img :src="lightboxUrl" class="p7-lightbox-img" alt="" />
                <button
                    class="p7-lightbox-close"
                    type="button"
                    :title="t('part7.closeFullscreen')"
                    :aria-label="t('part7.closeFullscreen')"
                    @click="closeLightbox"
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
        </Teleport>
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
/* 2026-06-18 — Clickable preview → fullscreen. Zoom-in cursor +
   subtle hover signals the affordance without a separate button. */
.p7-work-preview-img {
    cursor: zoom-in;
    transition: opacity 0.15s;
}
.p7-work-preview-img:hover { opacity: 0.92; }

/* 2026-06-18 — Orientation controls + confirmation gate */
.p7-orient {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    max-width: 720px;
}
.p7-orient-controls {
    display: inline-flex;
    gap: 10px;
}
.p7-orient-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px 0 12px;
    background: #fff;
    border: 1px solid #d1d5db;
    border-radius: 999px;
    font-family: inherit;
    font-size: 13px;
    color: #374151;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}
.p7-orient-btn:hover { background: #f3f4f6; border-color: #9ca3af; }
.p7-orient-btn svg { flex-shrink: 0; }

.p7-confirm-btn {
    height: 38px;
    padding: 0 26px;
    background: #7FEC8F;
    border: none;
    border-radius: 999px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    cursor: pointer;
    box-shadow: 2px 2px 6px rgba(0,0,0,0.12);
    transition: transform 0.15s;
}
.p7-confirm-btn:not(:disabled):hover { transform: translateY(-1px) scale(1.02); }
.p7-confirm-btn--done {
    background: #d1fae5;
    color: #14532d;
    box-shadow: none;
    cursor: default;
}
.p7-orient-hint {
    margin: 0;
    font-size: 12px;
    color: #6b7280;
    line-height: 1.4;
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

/* 2026-06-08 — TTS playback toolbar inside the feedback card.
   Positioned above the feedback body. 2026-06-11 update: now also
   hosts the brush controls so teachers can annotate the critique
   while it's being narrated. Layout is a flex row that wraps on
   narrow widths; the `.p7-toolbar-spacer` forces the TTS pill to
   the right edge when there's room. */
.p7-feedback-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: -4px 0 -4px;
}
.p7-toolbar-spacer {
    flex: 1;
    min-width: 8px;
}

/* Brush toggle — pill modelled on the TTS button but in a neutral
   grey so the two controls read as siblings without one stealing
   focus from the other. Becomes amber/green when active. */
.p7-brush-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 12px 0 10px;
    border-radius: 999px;
    border: 1.5px solid #e5e7eb;
    background: #f9fafb;
    color: #4b5563;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.1s;
}
.p7-brush-toggle:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
    color: #111827;
}
.p7-brush-toggle:active { transform: scale(0.97); }
.p7-brush-toggle--on {
    background: #fef3c7;
    border-color: #f59e0b;
    color: #92400e;
}
.p7-brush-toggle--on:hover {
    background: #fde68a;
    border-color: #d97706;
}
.p7-brush-toggle svg { flex-shrink: 0; }

/* Colour swatches: 22 px circles. Active swatch gets a darker ring
   so the teacher can see the current colour at a glance regardless
   of which palette entry is chosen. */
.p7-brush-colors {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 4px;
    border-left: 1px solid #e5e7eb;
    border-right: 1px solid #e5e7eb;
    height: 30px;
}
.p7-brush-color {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1.5px solid rgba(0, 0, 0, 0.18);
    cursor: pointer;
    padding: 0;
    transition: transform 0.1s, border-color 0.15s, box-shadow 0.15s;
}
.p7-brush-color:hover { transform: scale(1.1); }
.p7-brush-color--active {
    border-color: #111827;
    box-shadow: 0 0 0 2px rgba(17, 24, 39, 0.18);
    transform: scale(1.1);
}

/* Thickness buttons: each one shows a coloured dot matching the
   current brushColor so the teacher reads "size of dot" rather than
   parsing S/M/L labels. */
.p7-brush-sizes {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 30px;
}
.p7-brush-size {
    width: 26px;
    height: 26px;
    border-radius: 999px;
    border: 1.5px solid #e5e7eb;
    background: #fff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: border-color 0.15s, background 0.15s;
}
.p7-brush-size:hover { border-color: #9ca3af; }
.p7-brush-size--active {
    border-color: #111827;
    background: #f3f4f6;
}
.p7-brush-size-dot {
    border-radius: 50%;
    display: block;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12);
}

/* Clear-all — red-tinted so it reads as destructive. */
.p7-brush-clear {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 30px;
    padding: 0 10px 0 8px;
    border-radius: 999px;
    border: 1.5px solid #fecaca;
    background: #fef2f2;
    color: #b91c1c;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.p7-brush-clear:hover {
    background: #fee2e2;
    border-color: #fca5a5;
}
.p7-brush-clear:active { transform: scale(0.97); }
.p7-brush-clear svg { flex-shrink: 0; }

/* Feedback body wrapper + canvas overlay.
   `position: relative` on the wrapper anchors the canvas; the canvas
   is sized in JS to match the body's bounding rect. `pointer-events`
   gating is what makes the text selectable when the brush is off
   and only the canvas captures pointer when brush is on. */
.p7-feedback-body-wrap {
    position: relative;
}
.p7-feedback-body-wrap--brush {
    cursor: crosshair;
}
.p7-annotation-canvas {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    /* Sit above the feedback text but below the toolbar (no z-index
       war — toolbar isn't a sibling). */
    z-index: 1;
    /* Hint to the browser that this canvas changes often. */
    touch-action: none;
}
.p7-annotation-canvas--active {
    pointer-events: auto;
    cursor: crosshair;
}

/* 2026-06-11 — Paused state mirrors the idle pill style so the
   teacher reads it as "click to resume" rather than "in progress".
   Distinct from --playing (which uses the bright green fill). */
.p7-tts-btn--paused {
    background: #f0fdf4;
    border-color: #B2F4BC;
    color: #14532d;
}
.p7-tts-btn--paused:hover:not(:disabled) {
    background: #d1fae5;
    border-color: #7FEC8F;
}

.p7-tts-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 12px 0 10px;
    border-radius: 999px;
    border: 1.5px solid #B2F4BC;
    background: #f0fdf4;
    color: #14532d;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.p7-tts-btn:hover:not(:disabled) {
    background: #d1fae5;
    border-color: #7FEC8F;
}
.p7-tts-btn:active:not(:disabled) {
    transform: scale(0.97);
}
.p7-tts-btn:disabled {
    opacity: 0.7;
    cursor: progress;
}
.p7-tts-btn--playing {
    background: #7FEC8F;
    border-color: #7FEC8F;
    color: #14532d;
}
.p7-tts-btn--playing:hover:not(:disabled) {
    background: #5fd97a;
    border-color: #5fd97a;
}
.p7-tts-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
}
.p7-tts-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(20, 83, 45, 0.25);
    border-top-color: #14532d;
    border-radius: 50%;
    animation: p7-tts-spin 0.8s linear infinite;
    flex-shrink: 0;
}
@keyframes p7-tts-spin { to { transform: rotate(360deg); } }
.p7-tts-label { line-height: 1; }
</style>

<!-- 2026-06-18 — Lightbox styles are NOT scoped: the element is
     Teleported to <body>, outside this component's DOM subtree, so
     scoped attribute selectors wouldn't match. Class names are
     `p7-lightbox-` prefixed to avoid global collisions. -->
<style>
.p7-lightbox {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    cursor: zoom-out;
    animation: p7LightboxFadeIn 0.18s ease;
}
@keyframes p7LightboxFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
}
.p7-lightbox-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 12px 64px rgba(0, 0, 0, 0.6);
    cursor: default;
}
.p7-lightbox-close {
    position: fixed;
    top: 24px;
    right: 24px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s;
}
.p7-lightbox-close:hover {
    background: rgba(239, 68, 68, 0.55);
}
</style>
