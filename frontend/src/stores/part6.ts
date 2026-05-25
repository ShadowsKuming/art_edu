import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useProjectsStore } from './projects'

export interface Style {

  label: string
  prompt: string
}

export interface StyleResult {
  originalUrl: string
  prompt: string
  resultUrl: string
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8001'

export const usePart6Store = defineStore('part6', () => {
  const sketchDataUrl = ref<string | null>(null)
  const sketchBase64 = ref<string | null>(null)
  const sketchMime = ref('image/jpeg')

  const styles = ref<Style[]>([])
  const lessonSummary = ref('')
  const selectedStyleIdx = ref<number | null>(null)
  const generatingStyles = ref(false)
  const stylesError = ref<string | null>(null)

  const view = ref<'steps' | 'converting' | 'result'>('steps')
  const usedStyleIndices = ref<number[]>([])
  const latestResult = ref<StyleResult | null>(null)
  const conversionError = ref<string | null>(null)

  function setSketch(dataUrl: string) {
    sketchDataUrl.value = dataUrl
    const [meta, b64] = dataUrl.split(',')
    sketchBase64.value = b64
    sketchMime.value = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
    styles.value = []
    lessonSummary.value = ''
    selectedStyleIdx.value = null
    usedStyleIndices.value = []
    latestResult.value = null
    view.value = 'steps'
    conversionError.value = null
  }

  async function generateStyles(lessonContext: string) {
    if (!sketchBase64.value) return
    generatingStyles.value = true
    stylesError.value = null
    // LKP wiring: when the active project came from a curriculum
    // lesson, the backend short-circuits and returns the seed's
    // predefined 3 styles (Branch A) or an empty list (Branch B) —
    // no LLM call needed.
    const lessonId = useProjectsStore().activeLessonId
    try {
      const res = await fetch(`${API_BASE}/api/part6/generate-styles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: sketchBase64.value,
          image_mime: sketchMime.value,
          lesson_context: lessonContext,
          lesson_id: lessonId ?? undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail ?? 'Style generation failed')
      }
      const data = await res.json()
      styles.value = data.styles ?? []
      lessonSummary.value = data.lesson_summary ?? ''
      selectedStyleIdx.value = null
    } catch (e: any) {
      stylesError.value = e.message
    } finally {
      generatingStyles.value = false
    }
  }

  async function convert() {
    if (!sketchBase64.value || !styles.value.length) return
    if (selectedStyleIdx.value === null) return
    const style = styles.value[selectedStyleIdx.value]
    if (!style) return

    view.value = 'converting'
    conversionError.value = null

    const lessonId = useProjectsStore().activeLessonId

    try {
      const res = await fetch(`${API_BASE}/api/part6/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: sketchBase64.value,
          image_mime: sketchMime.value,
          prompt: style.prompt,
          lesson_id: lessonId ?? undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail ?? 'Conversion failed')
      }
      const data = await res.json()
      latestResult.value = {
        originalUrl: sketchDataUrl.value!,
        prompt: style.prompt,
        resultUrl: data.image_url,
      }
      view.value = 'result'
    } catch (e: any) {
      conversionError.value = e.message
      view.value = 'steps'
    }
  }

  function convertAgain() {
    if (selectedStyleIdx.value !== null && !usedStyleIndices.value.includes(selectedStyleIdx.value)) {
      usedStyleIndices.value = [...usedStyleIndices.value, selectedStyleIdx.value]
    }
    selectedStyleIdx.value = null
    view.value = 'steps'
  }

  return {
    sketchDataUrl, styles, lessonSummary, selectedStyleIdx,
    generatingStyles, stylesError,
    view, usedStyleIndices, latestResult, conversionError,
    setSketch, generateStyles, convert, convertAgain,
  }
})
