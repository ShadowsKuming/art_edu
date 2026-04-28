import { defineStore } from 'pinia'
import { ref } from 'vue'

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

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

export const usePart3Store = defineStore('part3', () => {
  // ── Image ─────────────────────────────────────────────────────────────
  const imageDataUrl  = ref<string | null>(null)
  const imageBase64   = ref<string | null>(null)
  const imageMime     = ref('image/jpeg')

  function setImage(dataUrl: string) {
    imageDataUrl.value = dataUrl
    const [meta, b64]  = dataUrl.split(',')
    imageBase64.value  = b64
    imageMime.value    = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  }

  // ── Story ─────────────────────────────────────────────────────────────
  const storyLoading = ref(false)
  const storyData    = ref<StoryData | null>(null)
  const storyError   = ref<string | null>(null)

  async function generateStory() {
    if (!imageBase64.value) return
    storyLoading.value = true
    storyError.value   = null
    try {
      const res = await fetch(`${API_BASE}/api/story/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageBase64.value,
          image_mime:   imageMime.value,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail ?? 'Story generation failed')
      }
      storyData.value = await res.json()
    } catch (e: any) {
      storyError.value = e.message
    } finally {
      storyLoading.value = false
    }
  }

  // ── Animation ─────────────────────────────────────────────────────────
  const remainingAttempts  = ref(3)
  const animationVersions  = ref<AnimationVersion[]>([])
  const animationLoading   = ref(false)
  const animationError     = ref<string | null>(null)

  async function generateAnimation(customPrompt = '') {
    if (!imageBase64.value || remainingAttempts.value <= 0) return
    animationLoading.value = true
    animationError.value   = null
    remainingAttempts.value--

    try {
      const res = await fetch(`${API_BASE}/api/animation/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageBase64.value,
          image_mime:   imageMime.value,
          prompt:       customPrompt,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail ?? 'Animation submission failed')
      }
      const { task_id } = await res.json()
      const idx = animationVersions.value.length
      animationVersions.value.push({ taskId: task_id, videoUrl: null, status: 'pending' })
      _pollAnimation(task_id, idx)
    } catch (e: any) {
      animationError.value   = e.message
      animationLoading.value = false
    }
  }

  async function _pollAnimation(taskId: string, index: number) {
    let attempts = 0
    const MAX    = 80   // ~4 minutes at 3s intervals

    const tick = async () => {
      if (attempts >= MAX) {
        animationVersions.value[index].status = 'failed'
        animationLoading.value = false
        return
      }
      attempts++
      try {
        const res  = await fetch(`${API_BASE}/api/animation/status/${taskId}`)
        const data = await res.json()

        if (data.status === 'succeeded' && data.video_url) {
          animationVersions.value[index].videoUrl = data.video_url
          animationVersions.value[index].status   = 'done'
          animationLoading.value = false
        } else if (data.status === 'failed') {
          animationVersions.value[index].status = 'failed'
          animationError.value   = data.error ?? 'Generation failed'
          animationLoading.value = false
        } else {
          setTimeout(tick, 3000)
        }
      } catch {
        setTimeout(tick, 5000)
      }
    }

    setTimeout(tick, 3000)
  }

  const chosenVideoUrl = ref<string | null>(null)

  function saveChosenVideo(url: string) {
    chosenVideoUrl.value = url
  }

  return {
    imageDataUrl, storyLoading, storyData, storyError,
    remainingAttempts, animationVersions, animationLoading, animationError,
    chosenVideoUrl,
    setImage, generateStory, generateAnimation, saveChosenVideo,
  }
})
