import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Style {
  label: string
  prompt: string
}

export interface StyleResult {
  styleLabel: string
  imageUrl: string
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8001'

export const usePart6Store = defineStore('part6', () => {
  const sketchDataUrl = ref<string | null>(null)
  const sketchBase64  = ref<string | null>(null)
  const sketchMime    = ref('image/jpeg')

  const styles           = ref<Style[]>([])
  const lessonSummary    = ref('')
  const selectedStyleIdx = ref<number>(0)
  const generatingStyles = ref(false)
  const stylesError      = ref<string | null>(null)

  const converting      = ref(false)
  const conversionError = ref<string | null>(null)
  const results         = ref<StyleResult[]>([])

  function setSketch(dataUrl: string) {
    sketchDataUrl.value    = dataUrl
    const [meta, b64]      = dataUrl.split(',')
    sketchBase64.value     = b64
    sketchMime.value       = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
    styles.value           = []
    lessonSummary.value    = ''
    selectedStyleIdx.value = 0
    results.value          = []
  }

  async function generateStyles(lessonContext: string) {
    if (!sketchBase64.value) return
    generatingStyles.value = true
    stylesError.value      = null
    try {
      const res = await fetch(`${API_BASE}/api/part6/generate-styles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64:   sketchBase64.value,
          image_mime:     sketchMime.value,
          lesson_context: lessonContext,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail ?? 'Style generation failed')
      }
      const data = await res.json()
      styles.value        = data.styles ?? []
      lessonSummary.value = data.lesson_summary ?? ''
      selectedStyleIdx.value = 0
    } catch (e: any) {
      stylesError.value = e.message
    } finally {
      generatingStyles.value = false
    }
  }

  async function convert() {
    if (!sketchBase64.value || !styles.value.length) return
    const style = styles.value[selectedStyleIdx.value]
    if (!style) return

    converting.value      = true
    conversionError.value = null
    try {
      const res = await fetch(`${API_BASE}/api/part6/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: sketchBase64.value,
          image_mime:   sketchMime.value,
          prompt:       style.prompt,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail ?? 'Conversion failed')
      }
      const data = await res.json()
      results.value.push({ styleLabel: style.label, imageUrl: data.image_url })
    } catch (e: any) {
      conversionError.value = e.message
    } finally {
      converting.value = false
    }
  }

  return {
    sketchDataUrl, styles, lessonSummary, selectedStyleIdx,
    generatingStyles, stylesError,
    converting, conversionError, results,
    setSketch, generateStyles, convert,
  }
})
