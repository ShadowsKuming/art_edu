import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useProjectsStore } from './projects'

export interface Style {
  label: string
  /** English image-gen prompt sent verbatim to Doubao Seedream. */
  prompt: string
  /**
   * 2026-05 — Chinese-version of the prompt, 95-105 中文字, shown in the
   * Part-6 chat panel's "提示词预览" box so the teacher can review the
   * actual prompt content in Chinese before applying the style. Optional
   * for backward-compat with older API payloads; the panel falls back to
   * an empty placeholder when missing.
   */
  promptZh?: string
  /**
   * 2026-05-29 — Teacher's edit of the Chinese prompt preview box.
   *
   * Empty / undefined ⇒ teacher hasn't touched the default, convert()
   * uses `promptZh` (or `prompt` as final fallback).
   *
   * Non-empty trimmed string ⇒ teacher overrode the default in the
   * panel's textarea, convert() sends THIS verbatim to Doubao Seedream
   * (which accepts ZH or EN equally). Doubao i2i does not care which
   * language the prompt is in.
   *
   * Lives on both the `proposedStyles[]` entries inside chat messages
   * (so the edit survives chip switches and previewIdx toggles) AND on
   * the confirmed `styles[]` entries (so convert() can read it). The
   * confirm path copies the edit forward, see `confirmStyles()` below.
   */
  promptZhEdited?: string
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
  /**
   * 2026-05 — which proposed-style chip the teacher currently has
   * "open" in the preview box of THIS message. `null` means the box
   * is collapsed (no chip clicked yet). Clicking a chip flips this
   * to that chip's index (0/1/2); clicking the same chip again
   * collapses it back to `null`.
   */
  previewIdx?: number | null
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

  /**
   * 2026-05 — message id of whatever message the teacher confirmed.
   * Driving state machine:
   *   null AND no msg has proposedStyles → phase = 'pre-recommend'
   *   null AND some msg has proposedStyles → phase = 'reviewing'
   *   non-null → phase = 'locked'  (Step 2 pigs shown, no more chips)
   */
  const confirmedMessageId = ref<number | null>(null)

  /**
   * 2026-05 — teacher preview vs classroom mode toggle (Q1: default
   * teacher preview).
   *   true  → 老师预览模式: each pig is reusable; convertAgain doesn't
   *           mark the style as used. Lets the teacher iterate.
   *   false → 课堂模式: classic behaviour, each pig is one-shot to
   *           prevent students from monopolising the transform.
   */
  const teacherPreviewMode = ref(true)

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

  // 2026-05 — derive the wire-format `phase` string from current
  // confirmation + history state. Sent in every /api/part6/chat call
  // so the backend knows whether to emit proposed_styles.
  const phase = computed<'pre-recommend' | 'reviewing' | 'locked'>(() => {
    if (confirmedMessageId.value !== null) return 'locked'
    if (messages.value.some(m => m.proposedStyles && m.proposedStyles.length > 0)) {
      return 'reviewing'
    }
    return 'pre-recommend'
  })

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
      // 2026-05 — compute phase BEFORE we add the new user message
      // above (the messages list now already has the user message we
      // just pushed). We want the request's phase to describe the
      // state the model is reacting to. confirmedMessageId still
      // reflects the latest confirm action, so phase.value is current.
      const res = await fetch(`${API_BASE}/api/part6/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_id: lessonId,
          messages: history,
          language,
          intent: intent ?? null,
          phase: phase.value,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      // Backend returns `{reply, proposed_styles}` (proposed_styles
      // may be null). Map snake_case → camelCase for the bubble; the
      // new `prompt_zh` field carries the curriculum/AI-authored
      // Chinese version of the prompt for the preview box.
      const proposed: Style[] | null = Array.isArray(data.proposed_styles)
        ? data.proposed_styles.map((s: any) => ({
          label: String(s.label),
          prompt: String(s.prompt),
          promptZh: typeof s.prompt_zh === 'string' ? s.prompt_zh : '',
        }))
        : null

      messages.value.push({
        id: _msgIdSeq++,
        role: 'assistant',
        text: String(data.reply ?? ''),
        proposedStyles: proposed ?? undefined,
        // 2026-05 — auto-expand the preview box to the first chip so
        // the teacher immediately sees the prompt content without
        // having to click. They can switch chips or click the same
        // chip again to collapse.
        previewIdx: proposed && proposed.length > 0 ? 0 : null,
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

    // 2026-05-29 — Deep-copy each Style so that subsequent edits to
    // the message's `proposedStyles` (teacher tweaking the preview
    // textarea after confirm) don't silently mutate the confirmed
    // `styles[]` array. To re-sync edits done after confirm, the
    // panel re-calls `confirmStyles(messageId)` for the same id —
    // see Part6AssistancePanel.vue's "reconfirm" button.
    styles.value = msg.proposedStyles.map(s => ({ ...s }))
    selectedStyleIdx.value = null

    usedStyleIndices.value = []
    latestResult.value = null
    view.value = 'steps'
    conversionError.value = null

    // 2026-05 — flip to the LOCKED phase. After this:
    //   • The Step 2 card (3 pigs) renders in the middle.
    //   • All historical Confirm buttons go grey-disabled.
    //   • Any further /api/part6/chat call sends phase=locked, so
    //     proposed_styles is never returned again.
    //   • The teacher can click "重新讨论风格" (in Step 2) → unlock.
    confirmedMessageId.value = messageId

    // Mark THIS message as confirmed; clear the flag on any earlier
    // message so only one Confirm button reads "已确认 ✓" at a time.
    messages.value.forEach(m => {
      if (m.proposedStyles) m.confirmed = m.id === messageId
    })
  }

  /**
   * 2026-05 — "重新讨论风格" / "Reopen the discussion" button on the
   * Step 2 card. Clears the lock and any confirmed-style state so the
   * teacher can iterate on a new set with the AI. The chat history
   * is intentionally preserved so the teacher can refer back to what
   * they discussed before.
   */
  function unlockStyles() {
    confirmedMessageId.value = null
    styles.value = []
    selectedStyleIdx.value = null
    usedStyleIndices.value = []
    latestResult.value = null
    view.value = 'steps'
    conversionError.value = null
    // Clear the per-message `confirmed` flag too so the chat reverts
    // to "reviewing" with the latest proposal's Confirm enabled.
    messages.value.forEach(m => {
      if (m.proposedStyles) m.confirmed = false
    })
  }

  /**
   * 2026-05 — toggle teacher preview ↔ classroom mode. When switching
   * to classroom mode we also reset usedStyleIndices so a fresh
   * classroom session starts with all 3 pigs intact (the teacher may
   * have "used" them during preview).
   */
  function setTeacherPreviewMode(on: boolean) {
    teacherPreviewMode.value = on
    if (!on) {
      // Entering classroom mode — reset the "used" tracker so the
      // class gets a clean slate of 3 pigs.
      usedStyleIndices.value = []
    }
  }

  /**
   * 2026-05 — toggle the "提示词预览" box on a specific assistant
   * message. Clicking a chip in message N flips that message's
   * `previewIdx` to the chip's index; clicking the same chip again
   * collapses the box back to null. Other messages' preview state
   * is untouched, so the teacher can have multiple turns expanded
   * if they want to compare versions.
   */
  function setPreview(messageId: number, idx: number | null) {
    const msg = messages.value.find(m => m.id === messageId)
    if (!msg || !msg.proposedStyles) return
    // Click-to-toggle: same chip closes the box.
    msg.previewIdx = msg.previewIdx === idx ? null : idx
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

    // 2026-05-29 — Prompt resolution order, highest priority first:
    //   1. `style.promptZhEdited`  — teacher's edit in the preview
    //      textarea (Doubao Seedream accepts ZH natively, so we send
    //      this verbatim).
    //   2. `style.promptZh`        — the default ZH prompt the
    //      backend returned alongside the EN one.
    //   3. `style.prompt`          — original EN, ultimate fallback
    //      for legacy projects whose Style objects predate the
    //      `promptZh` field (no ZH available).
    const edited = (style.promptZhEdited ?? '').trim()
    const promptToSend = edited || style.promptZh || style.prompt

    try {
      const res = await fetch(`${API_BASE}/api/part6/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: sketchBase64.value,
          image_mime: sketchMime.value,
          prompt: promptToSend,
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
        prompt: promptToSend,
        resultUrl: data.image_url,
      }
      view.value = 'result'
    } catch (e: any) {
      conversionError.value = e.message
      view.value = 'steps'
    }
  }

  /**
   * 2026-05-29 — Helper for Part6AssistancePanel.vue: write the
   * teacher's preview-box edit into `msg.proposedStyles[idx].promptZhEdited`.
   *
   * Centralised in the store (rather than a v-model on a deeply
   * nested object) so the mutation routes through Pinia's reactive
   * system cleanly and the cross-device autosave watcher in
   * CreateLesson.vue picks it up via its existing deep-watch on
   * `part6Store.messages`.
   */
  function setPromptEdit(messageId: number, idx: number, text: string) {
    const msg = messages.value.find(m => m.id === messageId)
    if (!msg || !msg.proposedStyles || !msg.proposedStyles[idx]) return
    msg.proposedStyles[idx].promptZhEdited = text
  }

  /**
   * 2026-05-29 — Clear the teacher's edit on a specific chip so the
   * preview box snaps back to the original `promptZh`. Called by the
   * "重置为默认" link below the textarea.
   */
  function resetPromptEdit(messageId: number, idx: number) {
    const msg = messages.value.find(m => m.id === messageId)
    if (!msg || !msg.proposedStyles || !msg.proposedStyles[idx]) return
    msg.proposedStyles[idx].promptZhEdited = undefined
  }


  function convertAgain() {
    // 2026-05 — only mark a pig as "used" in classroom mode. In
    // teacher-preview mode the teacher can test the same style over
    // and over while iterating, so we never lock pigs.
    if (
      !teacherPreviewMode.value &&
      selectedStyleIdx.value !== null &&
      !usedStyleIndices.value.includes(selectedStyleIdx.value)
    ) {
      usedStyleIndices.value = [...usedStyleIndices.value, selectedStyleIdx.value]
    }
    selectedStyleIdx.value = null
    view.value = 'steps'
  }

  // ── Snapshot (persist to DB via project snapshot) ─────────────────
  function getSnapshot() {
    return {
      sketchDataUrl: sketchDataUrl.value,
      sketchBase64: sketchBase64.value,
      sketchMime: sketchMime.value,
      styles: styles.value,
      lessonSummary: lessonSummary.value,
      selectedStyleIdx: selectedStyleIdx.value,
      usedStyleIndices: usedStyleIndices.value,
      confirmedMessageId: confirmedMessageId.value,
      messages: messages.value,
      view: view.value,
      latestResult: latestResult.value,
    }
  }

  function loadSnapshot(snap: ReturnType<typeof getSnapshot>) {
    sketchDataUrl.value = snap.sketchDataUrl ?? null
    sketchBase64.value = snap.sketchBase64 ?? null
    sketchMime.value = snap.sketchMime ?? 'image/jpeg'
    styles.value = snap.styles ?? []
    lessonSummary.value = snap.lessonSummary ?? ''
    selectedStyleIdx.value = snap.selectedStyleIdx ?? null
    usedStyleIndices.value = snap.usedStyleIndices ?? []
    confirmedMessageId.value = snap.confirmedMessageId ?? null
    messages.value = snap.messages ?? []
    view.value = snap.view ?? 'steps'
    latestResult.value = snap.latestResult ?? null
    chatLoading.value = false
    chatError.value = null
    conversionError.value = null
  }

  /**
   * 2026-05-29 — Wipe the entire Part-6 state back to factory defaults.
   *
   * Used when switching between projects (or after sign-out) to stop
   * the previous project's sketch, style triple, chat history,
   * confirmation lock, and conversion results from leaking into the
   * next project. Before this existed, every entry point that opened
   * a project only conditionally called `loadSnapshot()` — if the
   * incoming project had no `part6Snapshot`, the old state silently
   * survived, which is the cross-project leak teachers reported.
   *
   * The internal `_msgIdSeq` counter is also rewound so a fresh
   * conversation in the new project starts message ids back at 1
   * (purely cosmetic — collisions across resets were impossible
   * anyway because messages live inside the per-store `messages`
   * array, not in any global registry).
   *
   * `teacherPreviewMode` is intentionally NOT reset — it's a teacher-
   * level UI preference, not project-level data. Same rationale as
   * `App.vue`'s locale toggle: we don't want every project switch
   * to undo a deliberate UX choice the teacher made for the session.
   */
  function reset() {
    sketchDataUrl.value = null
    sketchBase64.value = null
    sketchMime.value = 'image/jpeg'
    styles.value = []
    lessonSummary.value = ''
    selectedStyleIdx.value = null
    usedStyleIndices.value = []
    confirmedMessageId.value = null
    messages.value = []
    _msgIdSeq = 1
    view.value = 'steps'
    latestResult.value = null
    chatLoading.value = false
    chatError.value = null
    stylesError.value = null
    conversionError.value = null
    // `teacherPreviewMode` left untouched on purpose — see docstring.
  }

  return {
    // sketch
    sketchDataUrl, sketchBase64, sketchMime,
    // styles
    styles, lessonSummary, selectedStyleIdx, usedStyleIndices,
    generatingStyles, stylesError,
    // chat
    messages, chatLoading, chatError, phase,
    confirmedMessageId, teacherPreviewMode,
    initChat, sendChat, confirmStyles, unlockStyles, setPreview, setTeacherPreviewMode,
    setPromptEdit, resetPromptEdit,
    // conversion
    view, latestResult, conversionError,
    // actions
    setSketch, generateStyles, convert, convertAgain,
    getSnapshot, loadSnapshot, reset,
  }
})
