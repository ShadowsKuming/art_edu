import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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

export interface Part3Pair {
  id: string   // = slide ID
  imageDataUrl: string | null
  imageBase64: string | null
  imageMime: string
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

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8001'

function makePair(id: string): Part3Pair {
  return {
    id,
    imageDataUrl: null, imageBase64: null, imageMime: 'image/jpeg',
    storyData: null, storyLoading: false, storyError: null, storyStreamText: '',
    animationVersions: [], animationLoading: false, animationError: null,
    remainingAttempts: 3, chosenVideoUrl: null,
    selectedChoiceId: null, generatedContinuations: {},
    continuationLoading: false, continuationError: null, continuationStreamText: '',
  }
}

export const usePart3Store = defineStore('part3', () => {
  const pairs = ref<Part3Pair[]>([])
  const activePairId = ref<string | null>(null)

  const activePair = computed(() =>
    pairs.value.find(p => p.id === activePairId.value) ?? null
  )

  // Flat computed getters — panels read these unchanged
  const imageDataUrl     = computed(() => activePair.value?.imageDataUrl ?? null)
  const storyData        = computed(() => activePair.value?.storyData ?? null)
  const storyLoading     = computed(() => activePair.value?.storyLoading ?? false)
  const storyError       = computed(() => activePair.value?.storyError ?? null)
  const animationVersions    = computed(() => activePair.value?.animationVersions ?? [])
  const animationLoading     = computed(() => activePair.value?.animationLoading ?? false)
  const animationError       = computed(() => activePair.value?.animationError ?? null)
  const remainingAttempts    = computed(() => activePair.value?.remainingAttempts ?? 0)
  const chosenVideoUrl       = computed(() => activePair.value?.chosenVideoUrl ?? null)
  const storyStreamText      = computed(() => activePair.value?.storyStreamText ?? '')
  const selectedChoiceId     = computed(() => activePair.value?.selectedChoiceId ?? null)
  const continuationLoading  = computed(() => activePair.value?.continuationLoading ?? false)
  const continuationError    = computed(() => activePair.value?.continuationError ?? null)
  const continuationStreamText = computed(() => activePair.value?.continuationStreamText ?? '')
  const activeContinuation   = computed(() => {
    const pair = activePair.value
    if (!pair) return null
    if (pair.selectedChoiceId !== null) {
      return pair.generatedContinuations[pair.selectedChoiceId] ?? null
    }
    return null
  })

  async function _readSSE(res: Response, onChunk: (accumulated: string) => void): Promise<string> {
    const reader  = res.body!.getReader()
    const decoder = new TextDecoder()
    let accumulated = ''
    let buffer      = ''

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
          const delta  = parsed.choices?.[0]?.delta?.content
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

  function setImage(dataUrl: string) {
    const pair = activePair.value
    if (!pair) return
    pair.imageDataUrl = dataUrl
    const [meta, b64] = dataUrl.split(',')
    pair.imageBase64  = b64
    pair.imageMime    = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  }

  async function generateStory(language = 'en') {
    const pair = activePair.value
    if (!pair?.imageBase64) return
    pair.storyLoading   = true
    pair.storyError     = null
    pair.storyStreamText = ''

    try {
      const res = await fetch(`${API_BASE}/api/story/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: pair.imageBase64, image_mime: pair.imageMime, language }),
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
      pair.storyLoading    = false
      pair.storyStreamText = ''
    }
  }

  async function generateContinuation(choiceId: number, language = 'en') {
    const pair = activePair.value
    if (!pair?.storyData || !pair.imageBase64) return

    // Already cached — just switch selection
    if (pair.generatedContinuations[choiceId] !== undefined) {
      pair.selectedChoiceId = choiceId
      return
    }

    const choice = pair.storyData.choices.find(c => c.id === choiceId)
    if (!choice) return

    pair.selectedChoiceId        = choiceId
    pair.continuationLoading     = true
    pair.continuationError       = null
    pair.continuationStreamText  = ''

    try {
      const res = await fetch(`${API_BASE}/api/story/continue/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64:  pair.imageBase64,
          image_mime:    pair.imageMime,
          part1:         pair.storyData.part1,
          choice_label:  choice.label,
          choice_desc:   choice.desc,
          language,
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
      pair.continuationLoading    = false
      pair.continuationStreamText = ''
    }
  }

  async function generateAnimation(customPrompt = '') {
    const pair = activePair.value
    if (!pair?.imageBase64 || pair.remainingAttempts <= 0) return
    pair.animationLoading = true
    pair.animationError   = null
    pair.remainingAttempts--

    try {
      const res = await fetch(`${API_BASE}/api/animation/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: pair.imageBase64,
          image_mime:   pair.imageMime,
          prompt:       customPrompt,
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
      pair.animationError   = e.message
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
        const res  = await fetch(`${API_BASE}/api/animation/status/${taskId}`)
        const data = await res.json()
        if (data.status === 'succeeded' && data.video_url) {
          pair.animationVersions[index].videoUrl = data.video_url
          pair.animationVersions[index].status   = 'done'
          pair.animationLoading = false
        } else if (data.status === 'failed') {
          pair.animationVersions[index].status = 'failed'
          pair.animationError   = data.error ?? 'Generation failed'
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

  return {
    pairs, activePairId, activePair,
    imageDataUrl, storyData, storyLoading, storyError,
    animationVersions, animationLoading, animationError, remainingAttempts, chosenVideoUrl,
    selectedChoiceId, continuationLoading, continuationError, activeContinuation,
    storyStreamText, continuationStreamText,
    ensurePair, removePair, setImage, generateStory, generateAnimation, saveChosenVideo,
    generateContinuation,
  }
})
