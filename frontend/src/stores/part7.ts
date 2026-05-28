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

export const usePart7Store = defineStore('part7', () => {
    const pairs = ref<Part7Pair[]>([])
    const activePairId = ref<string | null>(null)

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

    function addStudentWork(dataUrl: string) {
        const pair = activePair.value
        if (!pair) return
        const work = makeWork(dataUrl)
        pair.works.push(work)
        pair.activeWorkIdx = pair.works.length - 1
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
    }
})
