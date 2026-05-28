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
  /**
   * Retired 2026-05. New backend responses no longer include this
   * field — the AI sound suggestions tab was removed because the
   * video model has no audio output and teachers said in pilot
   * interviews they never adopted the suggestions. Kept optional so
   * pre-2026-05 saved projects still parse cleanly.
   */
  soundDesign?: string
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

export interface DesignChatMessage {
  role: 'user' | 'assistant'
  text: string
  /** When the assistant returned a candidate story rewrite, we store
   *  it inline on the message so the user can review/apply it later
   *  even after sending follow-up messages. */
  revisedStory?: StoryData | null
  /** 2026-05 — when the model rewrote one or more specific branch
   *  continuations (Phase B), it returns them as a map keyed by
   *  choice id. Stored alongside `revisedStory` so applyRevisedStory
   *  can merge these into `generatedContinuations` without clobbering
   *  branches the teacher didn't ask to change. */
  revisedContinuations?: Record<number, string>
  /** Becomes true once the user clicks "Apply" on the proposed
   *  rewrite — keeps the button from being clicked twice. */
  revisedStoryApplied?: boolean
}


/** Persistent story/animation state saved per artwork when the user switches away. */
export interface SavedArtworkState {
  storyData: StoryData | null
  animationVersions: AnimationVersion[]
  remainingAttempts: number
  chosenVideoUrl: string | null
  selectedChoiceId: number | null
  generatedContinuations: Record<number, string>
  designChatMessages: DesignChatMessage[]
}

export interface Part3Pair {
  id: string   // = slide ID
  imageDataUrl: string | null  // data URL for uploaded files; plain URL for curated artworks
  imageUrl: string | null      // original URL for curated artworks (used for lazy base64 fetch)
  imageBase64: string | null
  imageMime: string
  selectedArtworkId: string | null   // curated artwork_id currently active, or null
  uploadedArtworks: UploadedArtwork[]
  selectedUploadedId: string | null  // uploaded artwork id currently active, or null
  /** Saved story/animation state keyed by artwork_id or uploaded id. */
  artworkStates: Record<string, SavedArtworkState>
  activeArtworkKey: string | null    // current key in artworkStates
  storyData: StoryData | null
  storyLoading: boolean
  storyError: string | null
  storyStreamText: string
  animationVersions: AnimationVersion[]
  animationLoading: boolean
  animationError: string | null
  remainingAttempts: number
  chosenVideoUrl: string | null
  selectedChoiceId: number | null
  generatedContinuations: Record<number, string>
  continuationLoading: boolean
  continuationError: string | null
  continuationStreamText: string
  /** Per-artwork iterative-revision chat (lives under the "Design
   *  Rationale" tab in Part3StoryPanel). Reset when switching to a
   *  different artwork, restored when switching back — same lifecycle
   *  as `generatedContinuations`. */
  designChatMessages: DesignChatMessage[]
  designChatLoading: boolean
  designChatError: string | null
}


const API_BASE = import.meta.env.VITE_API_BASE ?? ''

function makePair(id: string): Part3Pair {
  return {
    id,
    imageDataUrl: null, imageUrl: null, imageBase64: null, imageMime: 'image/jpeg',
    selectedArtworkId: null, uploadedArtworks: [], selectedUploadedId: null,
    artworkStates: {}, activeArtworkKey: null,
    storyData: null, storyLoading: false, storyError: null, storyStreamText: '',
    animationVersions: [], animationLoading: false, animationError: null,
    remainingAttempts: 3, chosenVideoUrl: null,
    selectedChoiceId: null, generatedContinuations: {},
    continuationLoading: false, continuationError: null, continuationStreamText: '',
    designChatMessages: [], designChatLoading: false, designChatError: null,
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
  const designChatMessages = computed(() => activePair.value?.designChatMessages ?? [])
  const designChatLoading = computed(() => activePair.value?.designChatLoading ?? false)
  const designChatError = computed(() => activePair.value?.designChatError ?? null)
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

  /** Snapshot current story/animation state into artworkStates before switching. */
  function _saveArtworkState(pair: Part3Pair) {
    const key = pair.activeArtworkKey
    if (!key) return
    pair.artworkStates[key] = {
      storyData: pair.storyData,
      animationVersions: JSON.parse(JSON.stringify(pair.animationVersions)),
      remainingAttempts: pair.remainingAttempts,
      chosenVideoUrl: pair.chosenVideoUrl,
      selectedChoiceId: pair.selectedChoiceId,
      generatedContinuations: { ...pair.generatedContinuations },
      designChatMessages: pair.designChatMessages.map(m => ({ ...m })),
    }
  }

  /** Restore saved story/animation state for a key, or start fresh if first visit. */
  function _restoreArtworkState(pair: Part3Pair, key: string) {
    pair.activeArtworkKey = key
    // Always reset transient loading states
    pair.storyLoading = false
    pair.storyError = null
    pair.storyStreamText = ''
    pair.animationLoading = false
    pair.animationError = null
    pair.continuationLoading = false
    pair.continuationError = null
    pair.continuationStreamText = ''
    pair.designChatLoading = false
    pair.designChatError = null
    const saved = pair.artworkStates[key]
    if (saved) {
      pair.storyData = saved.storyData
      pair.animationVersions = saved.animationVersions
      pair.remainingAttempts = saved.remainingAttempts
      pair.chosenVideoUrl = saved.chosenVideoUrl
      pair.selectedChoiceId = saved.selectedChoiceId
      pair.generatedContinuations = saved.generatedContinuations
      pair.designChatMessages = saved.designChatMessages ?? []
    } else {
      pair.storyData = null
      pair.animationVersions = []
      pair.remainingAttempts = 3
      pair.chosenVideoUrl = null
      pair.selectedChoiceId = null
      pair.generatedContinuations = {}
      pair.designChatMessages = []
    }
  }

  function addUploadedArtwork(dataUrl: string) {
    const pair = activePair.value
    if (!pair) return
    const id = `ua-${Date.now()}`
    const [meta, b64] = dataUrl.split(',')
    const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
    pair.uploadedArtworks.push({ id, imageDataUrl: dataUrl, imageBase64: b64, imageMime: mime })
    _saveArtworkState(pair)
    pair.selectedUploadedId = id
    pair.selectedArtworkId = null
    pair.imageDataUrl = dataUrl
    pair.imageUrl = null
    pair.imageBase64 = b64
    pair.imageMime = mime
    _restoreArtworkState(pair, id)
  }

  function selectUploadedArtwork(id: string) {
    const pair = activePair.value
    if (!pair) return
    const art = pair.uploadedArtworks.find(a => a.id === id)
    if (!art) return
    _saveArtworkState(pair)
    pair.selectedUploadedId = id
    pair.selectedArtworkId = null
    pair.imageDataUrl = art.imageDataUrl
    pair.imageUrl = null
    pair.imageBase64 = art.imageBase64
    pair.imageMime = art.imageMime
    _restoreArtworkState(pair, id)
  }

  function removeUploadedArtwork(id: string) {
    const pair = activePair.value
    if (!pair) return
    delete pair.artworkStates[id]
    pair.uploadedArtworks = pair.uploadedArtworks.filter(a => a.id !== id)
    if (pair.selectedUploadedId === id) {
      const next = pair.uploadedArtworks[0]
      if (next) {
        pair.selectedUploadedId = next.id
        pair.imageDataUrl = next.imageDataUrl
        pair.imageUrl = null
        pair.imageBase64 = next.imageBase64
        pair.imageMime = next.imageMime
        _restoreArtworkState(pair, next.id)
      } else {
        pair.selectedUploadedId = null
        pair.activeArtworkKey = null
        pair.imageDataUrl = null
        pair.imageBase64 = null
        pair.imageUrl = null
        pair.storyData = null
        pair.animationVersions = []
        pair.remainingAttempts = 3
      }
    }
  }

  /**
   * Pick one of the LKP's curated artworks. Saves the current artwork's
   * story/animation state before switching, and restores the target's
   * saved state (or starts fresh if it's the first visit).
   */
  function setArtworkFromUrl(url: string, artworkId: string) {
    const pair = activePair.value
    if (!pair) return
    _saveArtworkState(pair)
    pair.selectedArtworkId = artworkId
    pair.selectedUploadedId = null
    pair.imageDataUrl = url
    pair.imageUrl = url
    pair.imageBase64 = null
    pair.imageMime = 'image/jpeg'
    _restoreArtworkState(pair, artworkId)
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

      // 2026-05: defensive parse. Previously a truncated or empty
      // response would throw a raw "Unexpected end of JSON input"
      // that gave the user no idea what happened. Now we:
      //   1. catch the SyntaxError
      //   2. log the raw text to the console for diagnostics
      //   3. surface a clearer Chinese/English error in the UI
      //
      // Most-likely causes (in order): backend hit max_tokens and
      // truncated the JSON mid-string; backend errored before any
      // SSE chunks landed (empty fullText); or the model wrapped the
      // JSON in unexpected prose despite the "no preamble" rule.
      try {
        pair.storyData = JSON.parse(raw)
      } catch (parseErr) {
        console.error('[generateStory] JSON.parse failed. Raw response:', raw)
        const preview = raw.slice(0, 120).replace(/\s+/g, ' ')
        const hint = !raw
          ? '生成结果为空,可能是后端连接异常,请稍后重试。'
          : `故事 JSON 解析失败(可能是生成被截断)。请重新生成。预览: ${preview}…`
        throw new Error(hint)
      }

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

  /**
   * Send a message to `/api/story/chat`. The endpoint returns
   * `{ reply, revised_story | null }`. We always push the reply as
   * an assistant message; if `revised_story` is present we stash it
   * on the message so the panel can render an "Apply" button (we
   * deliberately do NOT auto-replace `storyData` — the teacher must
   * confirm).
   */
  async function sendDesignChat(message: string, language = 'zh') {
    const pair = activePair.value
    if (!pair?.storyData || !pair.imageDataUrl) return
    const text = message.trim()
    if (!text || pair.designChatLoading) return
    if (!await _ensureBase64(pair)) return

    pair.designChatMessages.push({ role: 'user', text })
    pair.designChatLoading = true
    pair.designChatError = null

    const lessonId = useProjectsStore().activeLessonId

    try {
      const history = pair.designChatMessages.map(m => ({ role: m.role, text: m.text }))
      const res = await fetch(`${API_BASE}/api/story/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 2026-05 — Phase A/B wiring.
        //   selected_choice_id: null → Phase A (only part1 + choices
        //     drafted, no continuation yet; backend forbids touching
        //     part3 and asks the teacher to pick a branch first).
        //   selected_choice_id: int  → Phase B (≥1 continuation
        //     exists; backend will FIRST ask the teacher which slice
        //     they want changed when the request is ambiguous).
        // We also forward `generatedContinuations` keyed by choice id
        // so the model sees every branch already written and can
        // rewrite just the one the teacher names without losing the
        // others.
        body: JSON.stringify({
          image_base64: pair.imageBase64,
          image_mime: pair.imageMime,
          messages: history,
          current_story: pair.storyData,
          language,
          lesson_id: lessonId ?? undefined,
          artwork_id: pair.selectedArtworkId ?? undefined,
          selected_choice_id: pair.selectedChoiceId,
          continuations: Object.fromEntries(
            Object.entries(pair.generatedContinuations).map(([k, v]) => [String(k), v]),
          ),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail ?? 'Chat failed')
      }
      const data = await res.json()
      // `revised_continuations` is an optional map { choiceId: newPart3 }
      // returned when the model rewrote one or more branches' part3.
      // Normalise to Record<number, string> so applyRevisedStory can
      // merge it into generatedContinuations cleanly.
      const rawConts = (data.revised_continuations ?? {}) as Record<string, string>
      const revisedContinuations: Record<number, string> = {}
      for (const [k, v] of Object.entries(rawConts)) {
        const n = Number(k)
        if (Number.isInteger(n) && typeof v === 'string' && v.trim()) {
          revisedContinuations[n] = v
        }
      }
      pair.designChatMessages.push({
        role: 'assistant',
        text: data.reply ?? '',
        revisedStory: data.revised_story ?? null,
        revisedContinuations,
        revisedStoryApplied: false,
      })

    } catch (e: any) {
      pair.designChatError = e.message
    } finally {
      pair.designChatLoading = false
    }
  }

  /**
   * Replace `storyData` with the revision proposed in an assistant
   * message. Marks the message as `applied` so its "Apply" button
   * hides on subsequent renders. Also rebuilds the choice-0 cache
   * in `generatedContinuations` so Part3 Story Preview keeps showing
   * the freshly revised Part 3 text.
   */
  function applyRevisedStory(messageIndex: number) {
    const pair = activePair.value
    if (!pair) return
    const msg = pair.designChatMessages[messageIndex]
    if (!msg?.revisedStory || msg.revisedStoryApplied) return
    pair.storyData = JSON.parse(JSON.stringify(msg.revisedStory))
    msg.revisedStoryApplied = true

    // 2026-05 — Phase A/B aware continuation merge.
    //
    // Phase A (no continuation yet): backend was instructed to return
    //   part3 = "" to signal "I did not touch the continuation". We
    //   keep `generatedContinuations` empty and `selectedChoiceId`
    //   null so the teacher must still pick a branch to generate
    //   part3 — matches the rest of the Story Preview flow.
    //
    // Phase B (≥1 continuation already drafted): backend may return
    //   `revisedContinuations` = { choiceId: newPart3 } for the
    //   branches it rewrote. We merge those into the existing dict
    //   so untouched branches stay intact. If revisedContinuations
    //   is empty AND revisedStory.part3 is non-empty, fall back to
    //   the legacy single-branch behaviour and overwrite the
    //   currently-selected branch (or choice 0 if none).
    const part3 = pair.storyData?.part3 ?? ''
    const hasRevisedConts = msg.revisedContinuations
      && Object.keys(msg.revisedContinuations).length > 0

    if (hasRevisedConts) {
      pair.generatedContinuations = {
        ...pair.generatedContinuations,
        ...msg.revisedContinuations,
      }
      // Keep current branch selection if it was one of the rewritten
      // ones, otherwise default to the first rewritten branch so the
      // teacher immediately sees the change in Story Preview.
      const rewrittenIds = Object.keys(msg.revisedContinuations!).map(Number)
      if (
        pair.selectedChoiceId === null
        || !rewrittenIds.includes(pair.selectedChoiceId)
      ) {
        pair.selectedChoiceId = rewrittenIds[0]
      }
    } else if (part3) {
      // Legacy / Phase A → Phase A revisit. Backfill only if part3
      // is non-empty (Phase A revisions set part3 to "").
      const target = pair.selectedChoiceId ?? 0
      pair.generatedContinuations = {
        ...pair.generatedContinuations,
        [target]: part3,
      }
      if (pair.selectedChoiceId === null) pair.selectedChoiceId = 0
    }
    // Otherwise (Phase A response with empty part3): leave
    // generatedContinuations + selectedChoiceId as they are — the
    // teacher still needs to pick a branch.
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

  // ── Snapshot (persist to DB via project snapshot) ─────────────────
  function getSnapshot() {
    return {
      activePairId: activePairId.value,
      pairs: pairs.value.map(p => ({
        id: p.id,
        imageDataUrl: p.imageDataUrl,
        imageUrl: p.imageUrl,
        imageBase64: p.imageBase64,
        imageMime: p.imageMime,
        selectedArtworkId: p.selectedArtworkId,
        uploadedArtworks: p.uploadedArtworks,
        selectedUploadedId: p.selectedUploadedId,
        artworkStates: p.artworkStates,
        activeArtworkKey: p.activeArtworkKey,
        storyData: p.storyData,
        animationVersions: p.animationVersions,
        remainingAttempts: p.remainingAttempts,
        chosenVideoUrl: p.chosenVideoUrl,
        selectedChoiceId: p.selectedChoiceId,
        generatedContinuations: p.generatedContinuations,
        designChatMessages: p.designChatMessages,
      })),
    }
  }

  function loadSnapshot(snap: ReturnType<typeof getSnapshot>) {
    pairs.value = (snap.pairs ?? []).map((p: any) => ({
      ...makePair(p.id),
      imageDataUrl: p.imageDataUrl ?? null,
      imageUrl: p.imageUrl ?? null,
      imageBase64: p.imageBase64 ?? null,
      imageMime: p.imageMime ?? 'image/jpeg',
      selectedArtworkId: p.selectedArtworkId ?? null,
      uploadedArtworks: p.uploadedArtworks ?? [],
      selectedUploadedId: p.selectedUploadedId ?? null,
      artworkStates: p.artworkStates ?? {},
      activeArtworkKey: p.activeArtworkKey ?? null,
      storyData: p.storyData ?? null,
      animationVersions: p.animationVersions ?? [],
      remainingAttempts: p.remainingAttempts ?? 3,
      chosenVideoUrl: p.chosenVideoUrl ?? null,
      selectedChoiceId: p.selectedChoiceId ?? null,
      generatedContinuations: p.generatedContinuations ?? {},
      designChatMessages: p.designChatMessages ?? [],
    }))
    activePairId.value = snap.activePairId ?? null
  }

  return {
    pairs, activePairId, activePair,
    imageDataUrl, storyData, storyLoading, storyError,
    animationVersions, animationLoading, animationError, remainingAttempts, chosenVideoUrl,
    selectedChoiceId, continuationLoading, continuationError, activeContinuation,
    storyStreamText, continuationStreamText,
    designChatMessages, designChatLoading, designChatError,
    selectedArtworkId, selectedUploadedId, uploadedArtworks,
    ensurePair, removePair, setArtworkFromUrl,
    addUploadedArtwork, selectUploadedArtwork, removeUploadedArtwork,
    generateStory, generateAnimation, saveChosenVideo, generateContinuation,
    sendDesignChat, applyRevisedStory,
    getSnapshot, loadSnapshot,
  }
})

