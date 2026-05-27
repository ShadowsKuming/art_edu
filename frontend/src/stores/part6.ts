import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
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

/**
 * 2026-05 chat redesign.
 *
 * The assistant message history used to live inside
 * Part6AssistancePanel.vue, but the new "discuss → confirm" UX needs
 * the chat state and the style-confirmation state to live together
 * (the confirm button on a chat message has to flip `confirmedStyles`
 * — the same array that drives the 3 pigs in Part6Content.vue).
 *
 * Moving everything into the store also lets us survive panel
 * unmount / remount (e.g. when the user switches Parts in the
 * sidebar and comes back) without losing the conversation.
 */
export type ChatRole = 'assistant' | 'user'
export type ChatIntent = 'recommend' | 'skills' | 'styles'

export interface ChatIntentChip {
  key: ChatIntent
  label: string
}

export interface ChatMessage {
  id: number
  role: ChatRole
  text: string
  // First assistant message hosts the three intent buttons. The
  // store seeds these on init; the panel just renders them.
  intentChips?: ChatIntentChip[]
  // When the backend / model proposes a 3-style set, the assistant
  // message carries them so the panel can render chips + a confirm
  // button right under the bubble. `proposedStyles` is null on every
  // other message.
  proposedStyles?: Style[]
  // Has the teacher clicked "Confirm" on this message yet? Used to
  // toggle the button label between "确认这套风格" and "已确认 ✓"
  // and to disable the button after click.
  confirmed?: boolean
}

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export const usePart6Store = defineStore('part6', () => {
  // ── Sketch (Step 1) ────────────────────────────────────────────
  const sketchDataUrl = ref<string | null>(null)
  const sketchBase64 = ref<string | null>(null)
  const sketchMime = ref('image/jpeg')

  // ── Styles (Step 2) ────────────────────────────────────────────
  // `styles` is now the *confirmed* style set — Part6Content.vue
  // renders the 3 pigs straight off this array, so it stays empty
  // until the teacher clicks "Confirm" in the chat panel.
  const styles = ref<Style[]>([])
  const lessonSummary = ref('')
  const selectedStyleIdx = ref<number | null>(null)
  const usedStyleIndices = ref<number[]>([])

  // Legacy fields kept so the panel / content components still
  // compile during the transition. `generatingStyles` is now wired
  // to `chatLoading` (the only "in-flight" state we surface), and
  // `stylesError` to `chatError`.
  const stylesError = ref<string | null>(null)
  const generatingStyles = computed(() => chatLoading.value)

  // ── Chat state (moved out of Part6AssistancePanel.vue) ─────────
  const messages = ref<ChatMessage[]>([])
  const chatLoading = ref(false)
  const chatError = ref<string | null>(null)
  let _msgIdSeq = 1

  // ── Conversion state ───────────────────────────────────────────
  const view = ref<'steps' | 'converting' | 'result'>('steps')
  const latestResult = ref<StyleResult | null>(null)
  const conversionError = ref<string | null>(null)

  /**
   * Seed the chat with the new greeting + 3 clickable intent chips.
   * Called once when Part6AssistancePanel mounts (idempotent — won't
   * re-seed if there's already conversation history).
   */
  function initChat(intentChips: ChatIntentChip[], greeting: string) {
    if (messages.value.length > 0) return
    messages.value.push({
      id: _msgIdSeq++,
      role: 'assistant',
      text: greeting,
      intentChips,
    })
  }

  function setSketch(dataUrl: string) {
    sketchDataUrl.value = dataUrl
    const [meta, b64] = dataUrl.split(',')
    sketchBase64.value = b64
    sketchMime.value = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
    // Re-uploading the sketch only resets transfer-specific state.
    // The confirmed style set + chat history survive so the teacher
    // can iterate on multiple sketches against the same styles.
    usedStyleIndices.value = []
    latestResult.value = null
    view.value = 'steps'
    conversionError.value = null
    // ❗ Do NOT reset `styles` / `messages` here. That was the old
    // (pre-redesign) behaviour and would wipe the chat the user
    // just had with 艺芽.
  }

  /**
   * Send a turn to /api/part6/chat. `intent` is set only when the
   * teacher clicks one of the three intent chips on the first
   * assistant message; free-form text turns leave it undefined.
   */
  async function sendChat(text: string, intent?: ChatIntent, language: string = 'zh') {
    const lessonId = useProjectsStore().activeLessonId
    if (!lessonId) {
      // Non-curriculum project — Part 6 chat isn't useful without
      // an LKP, so surface a clear error and bail.
      chatError.value = 'Part 6 chat requires a curriculum lesson context.'
      return
    }
    if (chatLoading.value) return

    const content = text.trim()
    if (!content) return

    // Push the user message immediately so the panel renders it
    // optimistically (no perceived lag waiting for the LLM).
    messages.value.push({
      id: _msgIdSeq++,
      role: 'user',
      text: content,
    })

    chatLoading.value = true
    chatError.value = null
    stylesError.value = null

    // Strip per-turn UI metadata (chips, confirmed flag) before
    // sending to the backend — the model only needs {role, text}.
    const history = messages.value
      .filter(m => !m.intentChips || m.role === 'user')
      .map(m => ({ role: m.role, text: m.text }))

    try {
      const res = await fetch(`${API_BASE}/api/part6/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_id: lessonId,
          messages: history,
          language,
          intent: intent ?? null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      // Backend returns `{reply, proposed_styles}` (proposed_styles
      // may be null). Map snake_case → camelCase for the bubble.
      const proposed: Style[] | null = Array.isArray(data.proposed_styles)
        ? data.proposed_styles.map((s: any) => ({ label: String(s.label), prompt: String(s.prompt) }))
        : null

      messages.value.push({
        id: _msgIdSeq++,
        role: 'assistant',
        text: String(data.reply ?? ''),
        proposedStyles: proposed ?? undefined,
        confirmed: false,
      })
    } catch (e: any) {
      chatError.value = e?.message ?? 'Chat request failed'
      messages.value.push({
        id: _msgIdSeq++,
        role: 'assistant',
        text: `[Error] ${chatError.value}`,
      })
    } finally {
      chatLoading.value = false
    }
  }

  /**
   * Commit a proposed style triple into `styles` so the middle
   * editing area (Part6Content.vue) renders the 3 pigs.
   *
   * When the teacher has already confirmed a previous set, clicking
   * Confirm on a newer message simply OVERWRITES (per the user's
   * Q3 decision in plan-mode). usedStyleIndices is reset so all 3
   * pigs are usable again on the freshly-confirmed set.
   */
  function confirmStyles(messageId: number) {
    const msg = messages.value.find(m => m.id === messageId)
    if (!msg || !msg.proposedStyles || msg.proposedStyles.length !== 3) return

    styles.value = [...msg.proposedStyles]
    selectedStyleIdx.value = null
    usedStyleIndices.value = []
    latestResult.value = null
    view.value = 'steps'
    conversionError.value = null

    // Mark THIS message as confirmed; clear the flag on any earlier
    // message so only one Confirm button reads "已确认 ✓" at a time.
    messages.value.forEach(m => {
      if (m.proposedStyles) m.confirmed = m.id === messageId
    })
  }

  /**
   * @deprecated 2026-05 — kept so any external caller still
   * compiles, but the new chat flow no longer routes through here.
   * Real usage now goes via `sendChat(text, 'recommend')` which hits
   * /api/part6/chat instead of /api/part6/generate-styles.
   */
  async function generateStyles(_lessonContext: string, _language = 'en') {
    /* no-op (see deprecation note above) */
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
    // sketch
    sketchDataUrl, sketchBase64, sketchMime,
    // styles
    styles, lessonSummary, selectedStyleIdx, usedStyleIndices,
    generatingStyles, stylesError,
    // chat
    messages, chatLoading, chatError,
    initChat, sendChat, confirmStyles,
    // conversion
    view, latestResult, conversionError,
    // actions
    setSketch, generateStyles, convert, convertAgain,
  }
})
