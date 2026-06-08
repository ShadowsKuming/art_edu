/**
 * Part 7 — Share & Feedback.
 *
 * Per-slide pair (matches the `Part3` keying strategy): each Part-7
 * slide owns one or more student-work uploads. Each upload can have
 * an AI-generated commenter feedback attached.
 *
 * The commenter endpoint is `/api/part7/comment` (added by P0-3 of
 * the pilot spec). It requires a `lesson_id` so the LessonContext-
 * Manager can wire in the assessment rubric, dimensions, and tone
 * directives — Part 7 is intentionally only useful inside an LKP-
 * anchored project, so the UI surfaces a clear empty state when the
 * teacher opens it for a non-curriculum project.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useProjectsStore } from './projects'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

// ────────────────────────────────────────────────────────────────────
// 2026-06-04 — student-work downsampler (ported from part3.ts §25.5).
//
// Teachers were hitting `LLM timeout` on Part 7 → Get a Critique when
// the uploaded student photo was a multi-megabyte phone capture. Same
// root cause as the Part 3 "2000 Symphony" timeout: Doubao Vision
// receives the entire base64 payload, and a 3-5 MB image pushes the
// end-to-end round trip past Render's edge proxy ceiling (~100 s) →
// the browser surfaces a 504 the frontend reports as "LLM timeout".
//
// Fix: cap any upload to a long-edge of 1280 px and JPEG quality 0.85
// **on the client** before sending. The vision model consumes a
// downsampled tensor anyway, so quality loss for the critique task is
// imperceptible. Small images (<1.5 MB) pass through untouched.
// ────────────────────────────────────────────────────────────────────
const _LLM_MAX_EDGE = 1280
const _LLM_SIZE_OK_BYTES = 1_500_000  // ~1.5 MB

async function _downsampleIfLarge(dataUrl: string): Promise<string> {
    const approxBytes = (dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75
    if (approxBytes < _LLM_SIZE_OK_BYTES) return dataUrl
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image()
            el.onload = () => resolve(el)
            el.onerror = () => reject(new Error('image decode failed'))
            el.src = dataUrl
        })
        const longEdge = Math.max(img.naturalWidth, img.naturalHeight)
        const scale = longEdge > _LLM_MAX_EDGE ? _LLM_MAX_EDGE / longEdge : 1
        const targetW = Math.max(1, Math.round(img.naturalWidth * scale))
        const targetH = Math.max(1, Math.round(img.naturalHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width = targetW
        canvas.height = targetH
        const ctx = canvas.getContext('2d')
        if (!ctx) return dataUrl
        ctx.drawImage(img, 0, 0, targetW, targetH)
        return canvas.toDataURL('image/jpeg', 0.85)
    } catch {
        // Defensive: if decode/canvas fails (e.g. SVG, CORS-tainted)
        // we return the original so the upload still works — just
        // without the size guarantee.
        return dataUrl
    }
}

export interface StudentWork {

    id: string
    imageDataUrl: string
    imageBase64: string
    imageMime: string
    studentNote: string
    feedbackText: string
    feedbackWordCount: number
    feedbackDimensions: string[]
    feedbackTimestamp: string
    generatingFeedback: boolean
    feedbackError: string | null
}

export interface Part7Pair {
    id: string // = slide id
    works: StudentWork[]
    activeWorkIdx: number
}

let workCounter = 0
function newWorkId() {
    return `work-${Date.now()}-${++workCounter}`
}

function makePair(id: string): Part7Pair {
    return { id, works: [], activeWorkIdx: 0 }
}

function makeWork(dataUrl: string): StudentWork {
    const [meta, b64] = dataUrl.split(',')
    return {
        id: newWorkId(),
        imageDataUrl: dataUrl,
        imageBase64: b64,
        imageMime: meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg',
        studentNote: '',
        feedbackText: '',
        feedbackWordCount: 0,
        feedbackDimensions: [],
        feedbackTimestamp: '',
        generatingFeedback: false,
        feedbackError: null,
    }
}

// ─────────────────────────────────────────────────────────────────────
// 2026-06-08 — Feedback voice playback (Task 2 of the §29 batch).
//
// We reuse the existing `/api/tts` endpoint (the same one Part-3 uses
// for narrating the story) so no new backend work is needed. The
// audio element is module-scoped — at most one feedback plays at a
// time across the entire app, which is the correct UX (the teacher
// would never want two TTS streams overlapping).
//
// State machine per work:
//     idle  ──[play btn]──▶ loading ──[blob ready]──▶ playing
//      ▲                                                  │
//      └──[pause btn / blob fail / switch work]───────────┘
//
// `currentTtsWorkId` tracks which work owns the audio element right
// now so the UI can render distinct button states for the active
// vs. inactive feedback cards (e.g. when teacher is multi-tasking
// across student works).
// ─────────────────────────────────────────────────────────────────────
type TtsState = 'idle' | 'loading' | 'playing'

let _audioEl: HTMLAudioElement | null = null
let _audioObjectUrl: string | null = null

function _releaseAudio() {
    if (_audioEl) {
        _audioEl.pause()
        _audioEl.src = ''
        _audioEl = null
    }
    if (_audioObjectUrl) {
        URL.revokeObjectURL(_audioObjectUrl)
        _audioObjectUrl = null
    }
}

export const usePart7Store = defineStore('part7', () => {
    const pairs = ref<Part7Pair[]>([])
    const activePairId = ref<string | null>(null)

    // Per-work TTS state. Kept *outside* the StudentWork struct on
    // purpose so it never gets serialised into the snapshot — TTS
    // is purely a runtime UI affordance, not part of the saved
    // lesson. Keyed by `work.id`.
    const ttsStates = ref<Record<string, TtsState>>({})
    const currentTtsWorkId = ref<string | null>(null)

    function ttsStateFor(workId: string): TtsState {
        return ttsStates.value[workId] ?? 'idle'
    }

    /**
     * Stop whatever TTS is currently playing and reset its work's
     * state to 'idle'. Safe to call when nothing is playing.
     * Called when:
     *   • teacher clicks pause on the playing work,
     *   • teacher switches to a different work / re-generates feedback,
     *   • audio element fires `ended`,
     *   • project is unloaded.
     */
    function stopFeedbackTTS() {
        if (currentTtsWorkId.value) {
            ttsStates.value[currentTtsWorkId.value] = 'idle'
        }
        currentTtsWorkId.value = null
        _releaseAudio()
    }

    /**
     * Play (or toggle pause) the feedback text for one student work.
     *
     * Behaviour:
     *   • If this work is already 'playing' → pause (back to 'idle').
     *   • If a *different* work is currently playing → stop it first,
     *     then start this one (one-at-a-time policy).
     *   • If this work is 'loading' → no-op (request already in flight).
     *   • Otherwise → POST /api/tts, build an audio element, play.
     *
     * The default voice is `zh-CN-XiaoxiaoNeural` (warm female) which
     * matches the Part-3 story narrator default; we'll add a voice
     * picker only if pilot teachers ask for one. EN text falls back to
     * the same voice — Edge-TTS gracefully handles latin input even
     * with a CN voice id (read with a CN accent, which is fine for the
     * occasional EN demo).
     */
    async function playFeedbackTTS(
        workId: string,
        text: string,
        voiceId: string = 'zh-CN-XiaoxiaoNeural',
    ) {
        const cur = ttsStateFor(workId)
        if (cur === 'loading') return
        if (cur === 'playing') {
            // Toggle pause = stop entirely. We don't preserve playback
            // position because re-clicking play should restart the
            // narration from the top — that's what a teacher would
            // expect after the class has been talking over the
            // previous line.
            stopFeedbackTTS()
            return
        }
        // Different work playing? Stop it first.
        if (currentTtsWorkId.value && currentTtsWorkId.value !== workId) {
            stopFeedbackTTS()
        }
        ttsStates.value[workId] = 'loading'
        currentTtsWorkId.value = workId
        try {
            const res = await fetch(`${API_BASE}/api/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice_id: voiceId }),
            })
            if (!res.ok) throw new Error(`TTS ${res.status}`)
            const blob = await res.blob()
            // If the user clicked pause / switched works during the
            // fetch, the state will have already been reset by
            // `stopFeedbackTTS()`. Abort instead of starting a stale
            // playback.
            if (currentTtsWorkId.value !== workId) {
                return
            }
            _audioObjectUrl = URL.createObjectURL(blob)
            _audioEl = new Audio(_audioObjectUrl)
            _audioEl.onended = () => stopFeedbackTTS()
            _audioEl.onerror = () => stopFeedbackTTS()
            await _audioEl.play()
            ttsStates.value[workId] = 'playing'
        } catch (err) {
            console.error('[part7] TTS playback failed', err)
            // Reset cleanly so the button returns to 'idle' and the
            // teacher can retry. No toast — TTS is a non-essential
            // affordance; bothering the teacher with an error toast
            // every time would be louder than the value.
            stopFeedbackTTS()
        }
    }


    const activePair = computed(
        () => pairs.value.find((p) => p.id === activePairId.value) ?? null,
    )

    const activeWork = computed<StudentWork | null>(() => {
        const pair = activePair.value
        if (!pair) return null
        return pair.works[pair.activeWorkIdx] ?? null
    })

    function ensurePair(id: string) {
        if (!pairs.value.find((p) => p.id === id)) {
            pairs.value.push(makePair(id))
        }
        activePairId.value = id
    }

    /**
     * 2026-06-04 — accepts the raw data URL from the file picker and
     * routes it through `_downsampleIfLarge` BEFORE building the work
     * record. This is the single source of truth for the "shrink big
     * student photos" rule — every later consumer
     * (`work.imageBase64`, snapshot persistence, the `/api/part7/
     * comment` request body) sees the already-shrunk payload, so we
     * don't have to remember to call the helper at each site.
     *
     * Returns the new work id so the caller can show a toast or
     * focus the thumbnail.
     */
    async function addStudentWork(dataUrl: string): Promise<string | null> {
        const pair = activePair.value
        if (!pair) return null
        const safeUrl = await _downsampleIfLarge(dataUrl)
        const work = makeWork(safeUrl)
        pair.works.push(work)
        pair.activeWorkIdx = pair.works.length - 1
        return work.id
    }


    function removeStudentWork(idx: number) {
        const pair = activePair.value
        if (!pair) return
        pair.works.splice(idx, 1)
        if (pair.activeWorkIdx >= pair.works.length) {
            pair.activeWorkIdx = Math.max(0, pair.works.length - 1)
        }
    }

    function selectStudentWork(idx: number) {
        const pair = activePair.value
        if (!pair) return
        if (idx >= 0 && idx < pair.works.length) {
            pair.activeWorkIdx = idx
        }
    }

    function setStudentNote(idx: number, note: string) {
        const pair = activePair.value
        if (!pair) return
        const work = pair.works[idx]
        if (work) work.studentNote = note
    }

    async function generateComment(idx: number, language: 'en' | 'zh' = 'zh') {
        const pair = activePair.value
        if (!pair) return
        const work = pair.works[idx]
        if (!work) return

        const lessonId = useProjectsStore().activeLessonId
        if (!lessonId) {
            work.feedbackError = 'No lesson_id on active project — Part 7 commenter requires an LKP-anchored project.'
            return
        }

        work.generatingFeedback = true
        work.feedbackError = null

        try {
            const res = await fetch(`${API_BASE}/api/part7/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_work_base64: work.imageBase64,
                    student_work_mime: work.imageMime,
                    lesson_id: lessonId,
                    language,
                    student_note: work.studentNote || undefined,
                }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }))
                throw new Error(err.detail ?? 'Comment generation failed')
            }
            const data = await res.json()
            work.feedbackText = data.feedback_text
            work.feedbackWordCount = data.word_count
            work.feedbackDimensions = data.dimensions_covered
            work.feedbackTimestamp = data.timestamp
        } catch (e: any) {
            work.feedbackError = e?.message ?? 'Unknown error'
        } finally {
            work.generatingFeedback = false
        }
    }

    // ── Snapshot (persist to DB via project snapshot) ────────────────
    function getSnapshot() {
        return {
            activePairId: activePairId.value,
            pairs: pairs.value.map(p => ({
                id: p.id,
                activeWorkIdx: p.activeWorkIdx,
                works: p.works.map(w => ({
                    ...w,
                    generatingFeedback: false,
                    feedbackError: null,
                })),
            })),
        }
    }

    function loadSnapshot(snap: ReturnType<typeof getSnapshot>) {
        pairs.value = (snap.pairs ?? []).map((p: any) => ({
            ...makePair(p.id),
            activeWorkIdx: p.activeWorkIdx ?? 0,
            works: (p.works ?? []).map((w: any) => ({
                ...w,
                generatingFeedback: false,
                feedbackError: null,
            })),
        }))
        activePairId.value = snap.activePairId ?? null
    }

    /**
     * 2026-05-29 — Wipe Part-7 state back to factory defaults so the
     * previous project's student-work uploads and AI feedback do not
     * leak when the workspace opens a different project. Mirrors
     * `usePart6Store().reset()` and `usePart3Store().reset()` — see
     * those docstrings for the full rationale.
     */
    function reset() {
        pairs.value = []
        activePairId.value = null
    }

    return {
        pairs,
        activePairId,
        activePair,
        activeWork,
        ensurePair,
        addStudentWork,
        removeStudentWork,
        selectStudentWork,
        setStudentNote,
        generateComment,
        getSnapshot,
        loadSnapshot,
        reset,
        // 2026-06-08 — TTS playback for AI feedback. `ttsStateFor()` is
        // exposed (not the raw map) so the template can ask "what state
        // is this work's button in?" without reaching into the
        // implementation detail.
        ttsStateFor,
        currentTtsWorkId,
        playFeedbackTTS,
        stopFeedbackTTS,
    }

})
