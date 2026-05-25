import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useProjectsStore } from './projects'

export interface StoryChoice {

  id: number
  label: string
  desc: string
}

export interface StoryData {
  part1: string
  choices: StoryChoice[]
  part3: string
  designRationale: string
  soundDesign: string
}

export type AnimationStatus = 'pending' | 'done' | 'failed'

export interface AnimationVersion {
  taskId: string
  videoUrl: string | null
  status: AnimationStatus
}

export interface UploadedArtwork {
  id: string
  imageDataUrl: string   // data URL
  imageBase64: string | null
  imageMime: string
}

export interface Part3Pair {
  id: string   // = slide ID
  imageDataUrl: string | null  // data URL for uploaded files; plain URL for curated artworks
  imageUrl: string | null      // original URL for curated artworks (used for lazy base64 fetch)
  imageBase64: string | null
  imageMime: string
  /**
   * When the image came from an LKP curated artwork picker, this is
   * the `artwork_id` (e.g. `G2V2-U4-L4-art01`) — used to inject the
   * artwork-specific story hint via the LessonContextManager.
   */
  selectedArtworkId: string | null
  uploadedArtworks: UploadedArtwork[]
  selectedUploadedId: string | null
  storyData: StoryData | null
  storyLoading: boolean
  storyError: string | null
  storyStreamText: string       // live tokens while streaming
  animationVersions: AnimationVersion[]
  animationLoading: boolean
  animationError: string | null
  remainingAttempts: number
  chosenVideoUrl: string | null
  selectedChoiceId: number | null
  generatedContinuations: Record<number, string>
  continuationLoading: boolean
  continuationError: string | null
  continuationStreamText: string  // live tokens while streaming
}


const API_BASE = import.meta.env.VITE_API_BASE ?? ''

function makePair(id: string): Part3Pair {
  return {
    id,
    imageDataUrl: null, imageUrl: null, imageBase64: null, imageMime: 'image/jpeg',
    selectedArtworkId: null, uploadedArtworks: [], selectedUploadedId: null,
    storyData: null, storyLoading: false, storyError: null, storyStreamText: '',
    animationVersions: [], animationLoading: false, animationError: null,
    remainingAttempts: 3, chosenVideoUrl: null,
    selectedChoiceId: null, generatedContinuations: {},
    continuationLoading: false, continuationError: null, continuationStreamText: '',
  }
}

/**
 * Fetch an image at `url` (a same-origin or CORS-enabled URL served
 * by the backend's `/textbook-assets` mount) and convert it to a base64
 * data URL so the Doubao Vision LLM can ingest it inline. We do this
 * client-side so the existing endpoint contract (base64 in body) stays
 * intact — keeps the change surface small.
 */
async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch artwork: ${res.status}`)
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}


export const usePart3Store = defineStore('part3', () => {
  const pairs = ref<Part3Pair[]>([])
  const activePairId = ref<string | null>(null)

  const activePair = computed(() =>
    pairs.value.find(p => p.id === activePairId.value) ?? null
  )

  // Flat computed getters — panels read these unchanged
  const imageDataUrl = computed(() => activePair.value?.imageDataUrl ?? null)
  const storyData = computed(() => activePair.value?.storyData ?? null)
  const storyLoading = computed(() => activePair.value?.storyLoading ?? false)
  const storyError = computed(() => activePair.value?.storyError ?? null)
  const animationVersions = computed(() => activePair.value?.animationVersions ?? [])
  const animationLoading = computed(() => activePair.value?.animationLoading ?? false)
  const animationError = computed(() => activePair.value?.animationError ?? null)
  const remainingAttempts = computed(() => activePair.value?.remainingAttempts ?? 0)
  const chosenVideoUrl = computed(() => activePair.value?.chosenVideoUrl ?? null)
  const storyStreamText = computed(() => activePair.value?.storyStreamText ?? '')
  const selectedChoiceId = computed(() => activePair.value?.selectedChoiceId ?? null)
  const continuationLoading = computed(() => activePair.value?.continuationLoading ?? false)
  const continuationError = computed(() => activePair.value?.continuationError ?? null)
  const continuationStreamText = computed(() => activePair.value?.continuationStreamText ?? '')
  const activeContinuation = computed(() => {
    const pair = activePair.value
    if (!pair) return null
    if (pair.selectedChoiceId !== null) {
      return pair.generatedContinuations[pair.selectedChoiceId] ?? null
    }
    return null
  })

  async function _readSSE(res: Response, onChunk: (accumulated: string) => void): Promise<string> {
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let accumulated = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const parsed = JSON.parse(payload)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            accumulated += delta
            onChunk(accumulated)
          }
        } catch { /* ignore malformed SSE lines */ }
      }
    }
    return accumulated
  }

  function ensurePair(id: string) {
    if (!pairs.value.find(p => p.id === id)) {
      pairs.value.push(makePair(id))
    }
    activePairId.value = id
  }

  function addUploadedArtwork(dataUrl: string) {
    const pair = activePair.value
    if (!pair) return
    const id = `ua-${Date.now()}`
    const [meta, b64] = dataUrl.split(',')
    const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
    pair.uploadedArtworks.push({ id, imageDataUrl: dataUrl, imageBase64: b64, imageMime: mime })
    _selectUploaded(pair, id)
  }

  function selectUploadedArtwork(id: string) {
    const pair = activePair.value
    if (!pair) return
    _selectUploaded(pair, id)
  }

  function removeUploadedArtwork(id: string) {
    const pair = activePair.value
    if (!pair) return
    pair.uploadedArtworks = pair.uploadedArtworks.filter(a => a.id !== id)
    if (pair.selectedUploadedId === id) {
      const next = pair.uploadedArtworks[0]
      if (next) {
        _selectUploaded(pair, next.id)
      } else {
        pair.selectedUploadedId = null
        pair.imageDataUrl = null
        pair.imageBase64 = null
        pair.imageUrl = null
        pair.storyData = null
        pair.storyStreamText = ''
        pair.animationVersions = []
        pair.remainingAttempts = 3
      }
    }
  }

  function _selectUploaded(pair: Part3Pair, id: string) {
    const art = pair.uploadedArtworks.find(a => a.id === id)
    if (!art) return
    pair.selectedUploadedId = id
    pair.selectedArtworkId = null
    pair.imageDataUrl = art.imageDataUrl
    pair.imageUrl = null
    pair.imageBase64 = art.imageBase64
    pair.imageMime = art.imageMime
    pair.storyData = null
    pair.storyStreamText = ''
    pair.animationVersions = []
    pair.remainingAttempts = 3
  }

  /**
   * Pick one of the LKP's curated artworks (Pilot demo flow).
   * Stores the URL immediately for display — no async fetch here.
   * Base64 is populated lazily by `_ensureBase64` before any LLM call.
   */
  function setArtworkFromUrl(url: string, artworkId: string) {
    const pair = activePair.value
    if (!pair) return
    pair.imageDataUrl = url
    pair.imageUrl = url
    pair.imageBase64 = null
    pair.imageMime = 'image/jpeg'
    pair.selectedArtworkId = artworkId
    pair.selectedUploadedId = null
    pair.storyData = null
    pair.storyStreamText = ''
    pair.animationVersions = []
    pair.remainingAttempts = 3
  }

  /**
   * Ensures `pair.imageBase64` is populated before an LLM call.
   * If the image came from a curated artwork URL, fetch and convert now.
   * If it's already a data URL (user upload), extract base64 from it.
   */
  async function _ensureBase64(pair: Part3Pair): Promise<boolean> {
    if (pair.imageBase64) return true
    const src = pair.imageUrl ?? pair.imageDataUrl
    if (!src) return false
    try {
      let dataUrl: string
      if (src.startsWith('data:')) {
        dataUrl = src
      } else {
        dataUrl = await fetchImageAsDataUrl(src)
      }
      const [meta, b64] = dataUrl.split(',')
      pair.imageBase64 = b64
      pair.imageMime = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      return true
    } catch {
      return false
    }
  }


  async function generateStory(language = 'en') {
    const pair = activePair.value
    if (!pair?.imageDataUrl) return
    if (!await _ensureBase64(pair)) return
    pair.storyLoading = true
    pair.storyError = null
    pair.storyStreamText = ''

    const lessonId = useProjectsStore().activeLessonId

    try {
      const res = await fetch(`${API_BASE}/api/story/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: pair.imageBase64,
          image_mime: pair.imageMime,
          language,
          lesson_id: lessonId ?? undefined,
          artwork_id: pair.selectedArtworkId ?? undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail ?? 'Story generation failed')
      }

      const fullText = await _readSSE(res, (accumulated) => {
        pair.storyStreamText = accumulated
      })

      // Parse the complete JSON response
      let raw = fullText.trim()
      if (raw.startsWith('```')) {
        const parts = raw.split('```')
        raw = parts[1].replace(/^json/, '').trim()
      }
      pair.storyData = JSON.parse(raw)
      if (pair.storyData?.part3) {
        pair.generatedContinuations = { 0: pair.storyData.part3 }
      }
    } catch (e: any) {
      pair.storyError = e.message
    } finally {
      pair.storyLoading = false
      pair.storyStreamText = ''
    }
  }

  async function generateContinuation(choiceId: number, language = 'en') {
    const pair = activePair.value
    if (!pair?.storyData || !pair.imageDataUrl) return

    // Already cached — just switch selection
    if (pair.generatedContinuations[choiceId] !== undefined) {
      pair.selectedChoiceId = choiceId
      return
    }

    const choice = pair.storyData.choices.find(c => c.id === choiceId)
    if (!choice) return

    pair.selectedChoiceId = choiceId
    if (!await _ensureBase64(pair)) return
    pair.continuationLoading = true
    pair.continuationError = null
    pair.continuationStreamText = ''

    const lessonId = useProjectsStore().activeLessonId

    try {
      const res = await fetch(`${API_BASE}/api/story/continue/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: pair.imageBase64,
          image_mime: pair.imageMime,
          part1: pair.storyData.part1,
          choice_label: choice.label,
          choice_desc: choice.desc,
          language,
          lesson_id: lessonId ?? undefined,
          artwork_id: pair.selectedArtworkId ?? undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail ?? 'Continuation generation failed')
      }

      const fullText = await _readSSE(res, (accumulated) => {
        pair.continuationStreamText = accumulated
      })
      pair.generatedContinuations = { ...pair.generatedContinuations, [choiceId]: fullText.trim() }
    } catch (e: any) {
      pair.continuationError = e.message
    } finally {
      pair.continuationLoading = false
      pair.continuationStreamText = ''
    }
  }

  async function generateAnimation(customPrompt = '') {
    const pair = activePair.value
    if (!pair?.imageDataUrl || pair.remainingAttempts <= 0) return
    if (!await _ensureBase64(pair)) return
    pair.animationLoading = true
    pair.animationError = null
    pair.remainingAttempts--

    const lessonId = useProjectsStore().activeLessonId

    try {
      const res = await fetch(`${API_BASE}/api/animation/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: pair.imageBase64,
          image_mime: pair.imageMime,
          prompt: customPrompt,
          lesson_id: lessonId ?? undefined,
          artwork_id: pair.selectedArtworkId ?? undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail ?? 'Animation submission failed')
      }
      const { task_id } = await res.json()
      const idx = pair.animationVersions.length
      pair.animationVersions.push({ taskId: task_id, videoUrl: null, status: 'pending' })
      _pollAnimation(pair.id, task_id, idx)
    } catch (e: any) {
      pair.animationError = e.message
      pair.animationLoading = false
    }
  }

  async function _pollAnimation(pairId: string, taskId: string, index: number) {
    let attempts = 0
    const MAX = 80

    const tick = async () => {
      const pair = pairs.value.find(p => p.id === pairId)
      if (!pair) return
      if (attempts >= MAX) {
        pair.animationVersions[index].status = 'failed'
        pair.animationLoading = false
        return
      }
      attempts++
      try {
        const res = await fetch(`${API_BASE}/api/animation/status/${taskId}`)
        const data = await res.json()
        if (data.status === 'succeeded' && data.video_url) {
          pair.animationVersions[index].videoUrl = data.video_url
          pair.animationVersions[index].status = 'done'
          pair.animationLoading = false
        } else if (data.status === 'failed') {
          pair.animationVersions[index].status = 'failed'
          pair.animationError = data.error ?? 'Generation failed'
          pair.animationLoading = false
        } else {
          setTimeout(tick, 3000)
        }
      } catch {
        setTimeout(tick, 5000)
      }
    }
    setTimeout(tick, 3000)
  }

  function removePair(id: string) {
    pairs.value = pairs.value.filter(p => p.id !== id)
    if (activePairId.value === id) {
      activePairId.value = pairs.value[0]?.id ?? null
    }
  }

  function saveChosenVideo(url: string) {
    const pair = activePair.value
    if (pair) pair.chosenVideoUrl = url
  }

  const selectedArtworkId = computed(() => activePair.value?.selectedArtworkId ?? null)
  const selectedUploadedId = computed(() => activePair.value?.selectedUploadedId ?? null)
  const uploadedArtworks = computed(() => activePair.value?.uploadedArtworks ?? [])

  return {
    pairs, activePairId, activePair,
    imageDataUrl, storyData, storyLoading, storyError,
    animationVersions, animationLoading, animationError, remainingAttempts, chosenVideoUrl,
    selectedChoiceId, continuationLoading, continuationError, activeContinuation,
    storyStreamText, continuationStreamText,
    selectedArtworkId, selectedUploadedId, uploadedArtworks,
    ensurePair, removePair, setArtworkFromUrl,
    addUploadedArtwork, selectUploadedArtwork, removeUploadedArtwork,
    generateStory, generateAnimation, saveChosenVideo, generateContinuation,
  }
})

