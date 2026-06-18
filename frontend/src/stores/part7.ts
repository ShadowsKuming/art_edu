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

/**
 * 2026-06-18 — Canvas-based image rotation helper (mirrors the Part-6
 * copy in stores/part6.ts).
 *
 * Phone photos of student work are frequently sideways; the Doubao
 * vision commenter then critiques a rotated image. Re-encoding the
 * pixels here means `imageBase64` (and therefore the /api/part7/comment
 * request body) carries the corrected orientation with no extra
 * plumbing downstream. `deg` is normalised to 0/90/180/270.
 */
async function rotateImageDataUrl(dataUrl: string, deg: number): Promise<string> {
    const norm = ((deg % 360) + 360) % 360
    if (norm === 0) return dataUrl
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image()
            el.onload = () => resolve(el)
            el.onerror = () => reject(new Error('image decode failed'))
            el.src = dataUrl
        })
        const w = img.naturalWidth
        const h = img.naturalHeight
        const canvas = document.createElement('canvas')
        const swap = norm === 90 || norm === 270
        canvas.width = swap ? h : w
        canvas.height = swap ? w : h
        const ctx = canvas.getContext('2d')
        if (!ctx) return dataUrl
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate((norm * Math.PI) / 180)
        ctx.drawImage(img, -w / 2, -h / 2)
        // Student photos are JPEGs; keep them JPEG @0.9 to bound size.
        return canvas.toDataURL('image/jpeg', 0.9)
    } catch {
        return dataUrl
    }
}

export interface StudentWork {

    id: string
    imageDataUrl: string
    imageBase64: string
    imageMime: string
    /**
     * 2026-06-18 — Orientation-confirmation gate. A freshly-uploaded
     * work is `false`; the teacher rotates it upright and clicks
     * Confirm, which flips this to `true`. `generateComment` refuses
     * to run until then, so the AI only ever critiques an orientation
     * the teacher approved.
     */
    confirmed: boolean
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
        // 2026-06-18 — fresh uploads start unconfirmed; the teacher
        // rotates upright + confirms before the critique can run.
        confirmed: false,
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
// 2026-06-11 — True pause / resume.
//
// Pre-2026-06-11 the 「暂停」 button was a misnomer: it actually
// destroyed the audio element and revoked the object URL, so the
// "继续" press re-fetched the entire TTS blob and started narration
// from t=0. Pilot teachers (BLOOM-2026-B etc.) complained — a
// classroom interruption ("please open your sketchbooks") would
// erase 30 seconds of progress on a 200-word critique.
//
// New state machine per work:
//     idle  ──[play]──▶ loading ──[blob ready]──▶ playing
//      ▲                                              │ │
//      │                                       [pause]│ │[ended/error]
//      │                                              ▼ │
//      │                                            paused
//      │                                              │
//      │                                          [resume play]
//      │                                              │
//      │                                              ▼ → playing
//      │
//      └──[stop: switch work / slide / unmount]
//
//   • A `paused` state preserves `_audioEl.currentTime` so resume
//     picks up the same syllable the teacher left off on.
//   • The audio element is kept alive (and the object URL is NOT
//     revoked) for the entire idle-to-end run of one TTS request.
//   • Only the "external stop" path (`stopFeedbackTTS`) tears the
//     audio element down — that's what fires when the teacher
//     navigates away, switches the active work, or the audio
//     completes naturally.
// ─────────────────────────────────────────────────────────────────────
type TtsState = 'idle' | 'loading' | 'playing' | 'paused'

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
     * Toggle the feedback voice for one student work.
     *
     * 2026-06-11 — True pause / resume:
     *   • idle             → fetch + load + start playback
     *   • loading          → no-op (request already in flight)
     *   • playing          → `_audioEl.pause()`, state ➜ 'paused'
     *                        (preserves currentTime — does NOT release)
     *   • paused           → `_audioEl.play()`, state ➜ 'playing'
     *                        (resumes from the exact same syllable)
     *   • a *different* work is currently active (playing or paused)
     *     → full `stopFeedbackTTS()` of the other work first
     *       (one-at-a-time policy; switching also tears down the old
     *       audio element so we don't leak object URLs across tracks),
     *       then start this one from scratch.
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

        // ── Pause: keep the audio element alive so we can resume ───
        if (cur === 'playing') {
            if (_audioEl) {
                try { _audioEl.pause() } catch { /* benign */ }
            }
            ttsStates.value[workId] = 'paused'
            return
        }

        // ── Resume: same audio element, same currentTime ───────────
        if (cur === 'paused' && currentTtsWorkId.value === workId && _audioEl) {
            try {
                await _audioEl.play()
                ttsStates.value[workId] = 'playing'
            } catch (err) {
                // Browsers occasionally reject `play()` after a long
                // pause (e.g. autoplay-policy timing) — fall back to
                // a hard reset so the teacher can retry from the top.
                console.error('[part7] TTS resume failed', err)
                stopFeedbackTTS()
            }
            return
        }

        // ── Fresh fetch + start ────────────────────────────────────
        // Different work was playing/paused? Tear it down first so we
        // don't leak the audio element / object URL across tracks.
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
            // If the user paused / switched works during the fetch,
            // the state will have already been reset by
            // `stopFeedbackTTS()`. Abort instead of starting a stale
            // playback. (A `paused` state with no audio yet shouldn't
            // happen — the only path to `paused` is from `playing`.)
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

    /**
     * 2026-06-18 — Rotate a student work ±90°, re-encoding the pixels
     * (so the corrected orientation is what /api/part7/comment sees)
     * and re-arming the confirmation gate. The teacher must Confirm
     * again after the last rotation before the critique can run.
     */
    async function rotateStudentWork(idx: number, deg: number) {
        const pair = activePair.value
        if (!pair) return
        const work = pair.works[idx]
        if (!work) return
        const rotated = await rotateImageDataUrl(work.imageDataUrl, deg)
        const [meta, b64] = rotated.split(',')
        work.imageDataUrl = rotated
        work.imageBase64 = b64
        work.imageMime = meta.match(/:(.*?);/)?.[1] ?? work.imageMime
        work.confirmed = false
    }

    /**
     * 2026-06-18 — Lock in the current orientation for a student work.
     * Until this is called the Generate button stays disabled.
     */
    function confirmStudentWork(idx: number) {
        const pair = activePair.value
        if (!pair) return
        const work = pair.works[idx]
        if (work) work.confirmed = true
    }

    async function generateComment(idx: number, language: 'en' | 'zh' = 'zh') {
        const pair = activePair.value
        if (!pair) return
        const work = pair.works[idx]
        if (!work) return

        // 2026-06-18 — Orientation gate: never critique an unconfirmed
        // (possibly sideways) upload. The button is disabled in this
        // state too, but guard here as a belt-and-braces backstop.
        if (!work.confirmed) return

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
                // 2026-06-18 — Back-compat: works saved before the
                // rotation gate existed have no `confirmed` flag.
                // Treat them as already-confirmed so resuming an old
                // project doesn't block the critique button.
                confirmed: w.confirmed ?? true,
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
        rotateStudentWork,
        confirmStudentWork,
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
