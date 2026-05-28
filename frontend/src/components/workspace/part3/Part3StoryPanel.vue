<script setup lang="ts">
import { ref, computed, nextTick, onUnmounted, watch } from 'vue'
import { usePart3Store } from '@/stores/part3'
import { useToastStore } from '@/stores/toast'
import { useI18n } from 'vue-i18n'

type Tab = 'story' | 'design' | 'sound'

const activeTab     = ref<Tab>('story')
const store         = usePart3Store()
const { t, locale } = useI18n()

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

// ── Streaming preview ─────────────────────────────────────────────────────
const storyStreamPreview = computed(() => {
  const text = store.storyStreamText
  if (!text) return ''
  const match = text.match(/"part1"\s*:\s*"((?:[^"\\]|\\.)*)/s)
  return match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : ''
})

function selectChoice(id: number) {
  store.generateContinuation(id, locale.value)
}

// ── Design-Rationale chat (Part 3 iterative revision) ─────────────────
//
// The chat lives inside the Design tab so teachers can keep talking
// to the executor about the story they just generated, without
// jumping out of the Part-3 workspace. State is managed by the store
// (one history per artwork), this section is just the local input
// box + scrolling glue.

const chatInput = ref('')
const chatScroller = ref<HTMLElement | null>(null)

async function sendDesignChat() {
  const text = chatInput.value.trim()
  if (!text || store.designChatLoading) return
  chatInput.value = ''
  await store.sendDesignChat(text, locale.value)
  // Scroll the new assistant reply into view.
  nextTick(() => {
    chatScroller.value?.scrollTo({
      top: chatScroller.value.scrollHeight,
      behavior: 'smooth',
    })
  })
}

/**
 * 2026-05 — Conditional renderer for the "修改后的故事" preview
 * card. The backend returns `revision_scope` telling us which of
 * part1 / choices / part3 / designRationale actually changed in
 * this MODE B turn. Legacy messages predate this field and have an
 * empty/undefined scope — for those we render all 4 sections, same
 * as before, to avoid breaking history when an old project deck is
 * resumed.
 */
function revisionHas(
  msg: { revisionScope?: string[] | null },
  key: 'part1' | 'choices' | 'part3' | 'designRationale',
): boolean {
  const scope = msg.revisionScope
  if (!scope || scope.length === 0) return true
  return scope.includes(key)
}

/**
 * Clarify-option chip click handler. The backend returns 4 fixed
 * Chinese strings on Phase B disambiguation turns (see
 * `_STORY_CHAT_PHASE_B` in `backend/main.py`); each is rendered as a
 * pill button under the assistant bubble. Clicking just re-sends the
 * label as if the teacher had typed it, which the next chat turn will
 * interpret as an unambiguous MODE B trigger.
 */
async function pickClarifyOption(opt: string) {
  if (store.designChatLoading) return
  const text = opt.trim()
  if (!text) return
  await store.sendDesignChat(text, locale.value)
  nextTick(() => {
    chatScroller.value?.scrollTo({
      top: chatScroller.value.scrollHeight,
      behavior: 'smooth',
    })
  })
}

function onChatKeydown(e: KeyboardEvent) {
  // Enter sends, Shift+Enter inserts a newline (standard chat UX).
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    sendDesignChat()
  }
}

function applyRevised(idx: number) {
  store.applyRevisedStory(idx)
  toastStore.show(t('part3.storyPanel.chatStoryUpdated'), 'success')
}

/** Jump to Story Preview tab so the teacher can immediately verify
 *  the applied revision. Triggered from the "View Story Preview ›"
 *  link rendered under an already-applied revision card. */
function goToStoryPreview() {
  activeTab.value = 'story'
}


// Keep the message list anchored to the bottom whenever a new
// message lands. Watching length is cheap and avoids double-fire
// on every text mutation inside a single message.
watch(
  () => store.designChatMessages.length,
  () => {
    nextTick(() => {
      chatScroller.value?.scrollTo({
        top: chatScroller.value.scrollHeight,
        behavior: 'smooth',
      })
    })
  },
)

// ── TTS ───────────────────────────────────────────────────────────────────

const TTS_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', tagKey: 'ttsWarm'    as const },
  { id: 'zh-CN-XiaoyiNeural',   name: '晓伊', tagKey: 'ttsBright'  as const },
  { id: 'zh-CN-YunjianNeural',  name: '云健', tagKey: 'ttsDeep'    as const },
  { id: 'zh-CN-YunxiNeural',    name: '云希', tagKey: 'ttsCrisp'   as const },
  { id: 'zh-TW-HsiaoYuNeural',  name: '曉雨', tagKey: 'ttsGentle'  as const },
  { id: 'zh-TW-YunJheNeural',   name: '雲哲', tagKey: 'ttsNatural' as const },
]

const selectedVoiceIdx = ref(0)
const ttsLoading       = ref(false)
const ttsSpeaking      = ref(false)
const ttsPaused        = ref(false)
const ttsError         = ref<string | null>(null)

// Two playback paths: backend MP3 stream (preferred) vs. browser
// Web Speech API (fallback when the backend returns 403/5xx — which
// happens when edge-tts is rate-limited from a datacenter IP).
let ttsAudio:     HTMLAudioElement | null = null
let ttsObjectUrl: string | null           = null
let ttsUtterance: SpeechSynthesisUtterance | null = null
let ttsUsingFallback = false

const toastStore = useToastStore()

// ── TTS read-segment picker ─────────────────────────────────────────
//
// Pilot feedback (2026-05): teachers want to read just the second half
// of the story aloud during the classroom recap, not always part1.
// The two segments are exposed as a pill-button single-select; the
// "choices" block (part2) is never spoken — it's UI affordance, not
// narrative content.
type TtsSegment = 'part1' | 'part3'
const selectedSegment = ref<TtsSegment>('part1')

/** Picks the active part-3 text, with a sensible fallback: when no
 *  branch has been clicked yet, `store.activeContinuation` is null but
 *  the original story payload always pre-fills choice 0 in
 *  `generatedContinuations[0]` (see part3.ts → generateStory). */
const part3Text = computed(() => {
  const pair = store.activePair
  if (!pair) return ''
  return (
    store.activeContinuation
    ?? pair.generatedContinuations?.[0]
    ?? ''
  )
})

const ttsReadText = computed(() => {
  const sd = store.storyData
  if (!sd) return ''
  if (selectedSegment.value === 'part3') return part3Text.value
  return sd.part1
})

/** True when the user has chosen the part-3 segment but no
 *  continuation text exists yet — Play button is disabled and a hint
 *  is shown directing them back to Story Preview. */
const part3NotReady = computed(() =>
  selectedSegment.value === 'part3' && !part3Text.value.trim()
)

// Stop any in-flight playback if the user toggles segments so we
// don't end up with mismatched audio + UI state.
watch(selectedSegment, () => { ttsStop() })


const ttsStatusKey = computed(() => {
  if (ttsLoading.value)                      return 'part3.storyPanel.ttsLoading'
  if (ttsSpeaking.value && !ttsPaused.value) return 'part3.storyPanel.ttsPlaying'
  if (ttsPaused.value)                       return 'part3.storyPanel.ttsPaused'
  return 'part3.storyPanel.ttsReady'
})

function _cleanupAudio() {
  if (ttsAudio) {
    ttsAudio.pause()
    ttsAudio.onplay  = null
    ttsAudio.onpause = null
    ttsAudio.onended = null
    ttsAudio.onerror = null
    ttsAudio = null
  }
  if (ttsObjectUrl) {
    URL.revokeObjectURL(ttsObjectUrl)
    ttsObjectUrl = null
  }
  // Cancel any in-flight Web Speech utterance too.
  if (ttsUtterance && typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
    ttsUtterance.onstart = null
    ttsUtterance.onpause = null
    ttsUtterance.onresume = null
    ttsUtterance.onend = null
    ttsUtterance.onerror = null
    ttsUtterance = null
  }
  ttsUsingFallback = false
  ttsSpeaking.value = false
  ttsPaused.value   = false
}

/**
 * Pick a sensible browser voice for the current text language. We
 * read the first character to decide ZH-vs-EN, then prefer ZH-CN /
 * ZH-TW voices that match the selected edge-tts voice's locale.
 */
function _pickFallbackVoice(text: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const wantsZh = /[\u4e00-\u9fff]/.test(text.slice(0, 50))
  if (!wantsZh) {
    return voices.find(v => v.lang.startsWith('en')) ?? voices[0]
  }
  // Match cn vs tw if possible (the edge-tts voice IDs are 'zh-CN-…'
  // and 'zh-TW-…'; we just look at the leading 5 chars).
  const wantTw = TTS_VOICES[selectedVoiceIdx.value].id.startsWith('zh-TW')
  const exact = voices.find(v => v.lang.toLowerCase() === (wantTw ? 'zh-tw' : 'zh-cn'))
  if (exact) return exact
  return voices.find(v => v.lang.toLowerCase().startsWith('zh')) ?? voices[0]
}

/**
 * Browser-native fallback. Called when the backend `/api/tts`
 * endpoint returns an error (typically 403 — edge-tts rate-limited
 * from a datacenter IP). Uses `window.speechSynthesis` so no server
 * round-trip and no MS dependency. Voice is OS-provided so the
 * tone won't exactly match the edge-tts voice, but every modern
 * Mac / Windows / iOS / Android browser ships a usable zh-CN voice.
 */
async function _playWithSpeechSynthesis(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    throw new Error('speechSynthesis not available')
  }
  // Safari sometimes returns an empty voice list until the
  // `voiceschanged` event fires — give it one tick.
  if (window.speechSynthesis.getVoices().length === 0) {
    await new Promise<void>((resolve) => {
      const handler = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handler)
        resolve()
      }
      window.speechSynthesis.addEventListener('voiceschanged', handler)
      setTimeout(() => {
        window.speechSynthesis.removeEventListener('voiceschanged', handler)
        resolve()
      }, 500)
    })
  }
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = TTS_VOICES[selectedVoiceIdx.value].id.startsWith('zh-TW') ? 'zh-TW' : 'zh-CN'
  utt.rate = 0.95
  utt.pitch = 1.0
  const voice = _pickFallbackVoice(text)
  if (voice) utt.voice = voice
  utt.onstart  = () => { ttsSpeaking.value = true;  ttsPaused.value = false }
  utt.onpause  = () => { ttsPaused.value = true }
  utt.onresume = () => { ttsPaused.value = false }
  utt.onend    = () => { ttsSpeaking.value = false; ttsPaused.value = false; ttsUtterance = null }
  utt.onerror  = () => { ttsSpeaking.value = false; ttsPaused.value = false; ttsUtterance = null }
  ttsUtterance = utt
  ttsUsingFallback = true
  window.speechSynthesis.speak(utt)
}

async function ttsPlay() {
  ttsError.value = null

  // resume if paused — works for both the MP3 audio and the
  // Web Speech utterance branches.
  if (ttsPaused.value) {
    if (ttsUsingFallback && ttsUtterance) {
      window.speechSynthesis.resume()
      ttsPaused.value = false
      return
    }
    if (ttsAudio) {
      await ttsAudio.play()
      ttsPaused.value = false
      return
    }
  }

  _cleanupAudio()
  ttsLoading.value = true

  // ── Branch A: try the backend /api/tts (edge-tts) ─────────────
  let backendFailed = false
  try {
    const res = await fetch(`${API_BASE}/api/tts`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        text:     ttsReadText.value,
        voice_id: TTS_VOICES[selectedVoiceIdx.value].id,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail ?? `TTS request failed (${res.status})`)
    }
    const blob    = await res.blob()
    ttsObjectUrl  = URL.createObjectURL(blob)
    ttsAudio      = new Audio(ttsObjectUrl)
    ttsAudio.onplay  = () => { ttsSpeaking.value = true;  ttsPaused.value = false }
    ttsAudio.onpause = () => { if (!ttsAudio?.ended) ttsPaused.value = true }
    ttsAudio.onended = () => { ttsSpeaking.value = false; ttsPaused.value = false }
    ttsAudio.onerror = () => { ttsSpeaking.value = false; ttsPaused.value = false }
    await ttsAudio.play()
  } catch (e: any) {
    backendFailed = true
    console.warn('[tts] backend failed, falling back to speechSynthesis:', e?.message)
  }

  // ── Branch B: Web Speech fallback ─────────────────────────────
  if (backendFailed) {
    try {
      await _playWithSpeechSynthesis(ttsReadText.value)
      toastStore.show('已切换到本机朗读（服务器朗读暂不可用）', 'warning')
    } catch (e: any) {
      ttsError.value = e?.message ?? 'TTS failed'
      _cleanupAudio()
    }
  }

  ttsLoading.value = false
}

function ttsPause() {
  if (ttsUsingFallback && ttsUtterance) {
    window.speechSynthesis.pause()
    return
  }
  ttsAudio?.pause()
}

function ttsStop() {
  _cleanupAudio()
}

onUnmounted(_cleanupAudio)
</script>

<template>
  <div class="sp-panel">

    <!-- Header -->
    <div class="sp-header">
      <div class="sp-tabs">
        <button
          v-for="tab in (['story', 'design', 'sound'] as Tab[])"
          :key="tab"
          class="sp-tab"
          :class="{ 'sp-tab--active': activeTab === tab }"
          @click="activeTab = tab"
        >
          {{ tab === 'story' ? t('part3.storyPanel.storyPreview') : tab === 'design' ? t('part3.storyPanel.designRationale') : t('part3.storyPanel.soundDesign') }}
        </button>
      </div>
    </div>

    <!-- Loading with streaming preview -->
    <div v-if="store.storyLoading" class="sp-body">
      <div class="sp-stream-header">
        <div class="sp-spinner sp-spinner--small" />
        <span class="sp-stream-label">{{ t('part3.storyPanel.generatingStory') }}</span>
      </div>
      <p v-if="storyStreamPreview" class="sp-text sp-stream-text">
        {{ storyStreamPreview }}<span class="sp-cursor" />
      </p>
    </div>

    <!-- Error -->
    <div v-else-if="store.storyError" class="sp-error">
      <p>{{ store.storyError }}</p>
    </div>

    <!-- Empty state — intentionally blank. Per pilot feedback the
         "Upload an artwork…" hint duplicated the canvas placeholder
         and cluttered the panel. The container is kept so the
         flex column still reserves the right side of the layout
         before the story payload arrives. -->
    <div v-else-if="!store.storyData" class="sp-empty" />

    <!-- Story Preview tab -->
    <div v-else-if="activeTab === 'story'" class="sp-body">
      <h3 class="sp-section-title">{{ t('part3.storyPanel.part1Title') }}</h3>
      <p class="sp-text">{{ store.storyData.part1 }}</p>

      <h3 class="sp-section-title">{{ t('part3.storyPanel.part2Title') }}</h3>
      <p class="sp-subtext">{{ t('part3.storyPanel.choicesHint') }}</p>
      <div class="sp-choices">
        <button
          v-for="c in store.storyData.choices"
          :key="c.id"
          class="sp-choice"
          :class="{ 'sp-choice--selected': store.selectedChoiceId === c.id }"
          :disabled="store.continuationLoading"
          @click="selectChoice(c.id)"
        >
          <span class="sp-choice-dot" />
          <span><strong>{{ c.label }}</strong> – {{ c.desc }}</span>
        </button>
      </div>

      <h3 class="sp-section-title">{{ t('part3.storyPanel.part3Title') }}</h3>

      <!-- Loading continuation (with streaming text) -->
      <div v-if="store.continuationLoading">
        <div class="sp-cont-loading">
          <div class="sp-spinner sp-spinner--small" />
          <span>{{ t('part3.storyPanel.generatingCont') }}</span>
        </div>
        <p v-if="store.continuationStreamText" class="sp-text sp-stream-text">
          {{ store.continuationStreamText }}<span class="sp-cursor" />
        </p>
      </div>

      <!-- Continuation error -->
      <p v-else-if="store.continuationError" class="sp-error sp-error--inline">
        {{ store.continuationError }}
      </p>

      <!-- No choice selected yet -->
      <p v-else-if="store.selectedChoiceId === null" class="sp-cont-hint">
        {{ t('part3.storyPanel.choosePathHint') }}
      </p>

      <!-- Generated continuation -->
      <p v-else-if="store.activeContinuation" class="sp-text">
        {{ store.activeContinuation }}
      </p>
    </div>

    <!-- Design Rationale tab -->
    <div v-else-if="activeTab === 'design'" class="sp-body sp-body--design">
      <!-- Top half: the AI-generated designRationale text. This is a
           CSS `resize: vertical` box so teachers can drag the bottom
           edge to give the chat below more room when the rationale
           runs long (5-paragraph spec → ~330-360 字 in ZH mode). -->
      <h3 class="sp-section-title">{{ t('part3.storyPanel.designRationale') }}</h3>
      <div class="sp-design-rationale-box">
        <p class="sp-text sp-design-text">{{ store.storyData.designRationale }}</p>
      </div>

      <div class="sp-chat-divider" />

      <!-- AI co-revision chat -->
      <h3 class="sp-section-title">{{ t('part3.storyPanel.chatTitle') }}</h3>
      <p class="sp-subtext">{{ t('part3.storyPanel.chatHint') }}</p>

      <div ref="chatScroller" class="sp-chat-scroller">
        <p v-if="!store.designChatMessages.length" class="sp-chat-empty">
          {{ t('part3.storyPanel.chatEmpty') }}
        </p>

        <div
          v-for="(msg, idx) in store.designChatMessages"
          :key="idx"
          class="sp-chat-bubble"
          :class="msg.role === 'user' ? 'sp-chat-bubble--user' : 'sp-chat-bubble--bot'"
        >
          <p class="sp-chat-text">{{ msg.text }}</p>

          <!-- 2026-05 — Phase-B clarification chips. When the model
               returned a `clarify_options` list (only happens when
               the teacher's request was ambiguous), render each as a
               pill button. Clicking a chip re-sends that label so
               the next turn lands in MODE B with a concrete target.
               We skip the row entirely when there are no options or
               when the revision card is already attached. -->
          <ul
            v-if="msg.role === 'assistant'
              && msg.clarifyOptions?.length
              && !msg.revisedStory"
            class="sp-clarify-options"
          >
            <li v-for="opt in msg.clarifyOptions" :key="opt">
              <button
                type="button"
                class="sp-clarify-btn"
                :disabled="store.designChatLoading"
                @click="pickClarifyOption(opt)"
              >
                {{ opt }}
              </button>
            </li>
          </ul>

          <!-- Inline revision proposal card — renders the FULL revised
               story (part1 / choices / part3 / designRationale) so
               teachers can read the new version inline before
               choosing to apply or iterate further. -->
          <div
            v-if="msg.role === 'assistant' && msg.revisedStory"
            class="sp-chat-revision"
          >
            <div class="sp-chat-revision-head">
              <svg viewBox="0 0 16 16" fill="none" class="sp-chat-revision-icon">
                <path d="M8 1.5l1.7 3.5 3.8.5-2.7 2.7.6 3.8L8 10.2 4.6 12l.6-3.8L2.5 5.5l3.8-.5L8 1.5z" fill="#16a34a"/>
              </svg>
              <span>{{ t('part3.storyPanel.chatRevisedTitle') }}</span>
            </div>
            <p class="sp-chat-revision-hint">{{ t('part3.storyPanel.chatRevisedHint') }}</p>

            <!-- 2026-05 — Render ONLY the sections the model said it
                 changed. `msg.revisionScope` is the canonical source
                 of truth coming from the backend; when it's missing
                 (legacy messages, JSON parse failures, etc.) we fall
                 back to showing all 4 sections — same behaviour as
                 before this refactor.

                 Helper: `shouldRender('part1', msg)` returns true
                 when the scope array is empty/undefined OR contains
                 the given key. Declared inline in the script via
                 `revisionHas(msg, key)`. -->
            <div class="sp-revision-preview">
              <template v-if="revisionHas(msg, 'part1')">
                <h4 class="sp-revision-section">{{ t('part3.storyPanel.chatRevisedPart1') }}</h4>
                <p class="sp-revision-text">{{ msg.revisedStory.part1 }}</p>
              </template>

              <template v-if="revisionHas(msg, 'choices')">
                <h4 class="sp-revision-section">{{ t('part3.storyPanel.chatRevisedPart2') }}</h4>
                <ul class="sp-revision-choices">
                  <li v-for="c in msg.revisedStory.choices" :key="c.id">
                    <strong>{{ c.label }}</strong> – {{ c.desc }}
                  </li>
                </ul>
              </template>

              <template v-if="revisionHas(msg, 'part3')">
                <h4 class="sp-revision-section">{{ t('part3.storyPanel.chatRevisedPart3') }}</h4>
                <p class="sp-revision-text">{{ msg.revisedStory.part3 }}</p>
              </template>

              <template v-if="revisionHas(msg, 'designRationale')">
                <h4 class="sp-revision-section">{{ t('part3.storyPanel.chatRevisedDesign') }}</h4>
                <p class="sp-revision-text sp-revision-text--design">
                  {{ msg.revisedStory.designRationale }}
                </p>
              </template>
            </div>

            <div class="sp-revision-actions">
              <button
                class="sp-chat-apply-btn"
                :disabled="msg.revisedStoryApplied"
                @click="applyRevised(idx)"
              >
                {{ msg.revisedStoryApplied
                  ? t('part3.storyPanel.chatApplied')
                  : t('part3.storyPanel.chatApply') }}
              </button>
              <!-- After apply: a subtle text link the teacher can use
                   to jump back to Story Preview and verify. We don't
                   auto-switch tabs (option a from the design review)
                   so the chat history stays on screen. -->
              <button
                v-if="msg.revisedStoryApplied"
                type="button"
                class="sp-revision-link"
                @click="goToStoryPreview"
              >
                {{ t('part3.storyPanel.chatViewStory') }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="store.designChatLoading" class="sp-chat-bubble sp-chat-bubble--bot">
          <div class="sp-chat-typing">
            <span class="sp-chat-typing-dot" />
            <span class="sp-chat-typing-dot" />
            <span class="sp-chat-typing-dot" />
          </div>
        </div>

        <p v-if="store.designChatError" class="sp-error sp-error--inline">
          {{ store.designChatError }}
        </p>
      </div>

      <div class="sp-chat-input-row">
        <textarea
          v-model="chatInput"
          class="sp-chat-input"
          :placeholder="t('part3.storyPanel.chatPlaceholder')"
          :disabled="store.designChatLoading"
          rows="2"
          @keydown="onChatKeydown"
        />
        <button
          class="sp-chat-send-btn"
          :disabled="!chatInput.trim() || store.designChatLoading"
          :aria-label="t('part3.storyPanel.chatSend')"
          @click="sendDesignChat"
        >
          <svg v-if="!store.designChatLoading" viewBox="0 0 20 20" fill="none">
            <path d="M3 10l14-7-5 16-2.5-6L3 10z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          <div v-else class="sp-spinner sp-spinner--small" />
        </button>
      </div>
    </div>

    <!-- Sound Design tab -->
    <div v-else class="sp-body">

      <!-- TTS Player -->
      <h3 class="sp-section-title">{{ t('part3.storyPanel.ttsTitle') }}</h3>

      <!-- Empty only when there's no story at all. When the user picks
           part3 but no continuation exists yet, we still render the
           segment picker + voice picker so they can simply switch
           back — clearer than hiding everything. -->
      <div v-if="!store.storyData" class="sp-tts-empty">
        {{ t('part3.storyPanel.ttsNoText') }}
      </div>

      <template v-else>
        <!-- Segment picker — choose which half of the story to read.
             Part 2 (interactive choices) is never read aloud since
             it's a UI affordance, not narrative content. -->
        <p class="sp-subtext">{{ t('part3.storyPanel.ttsSegmentLabel') }}</p>
        <div class="sp-segment-row">
          <button
            type="button"
            class="sp-segment-btn"
            :class="{ 'sp-segment-btn--active': selectedSegment === 'part1' }"
            @click="selectedSegment = 'part1'"
          >
            {{ t('part3.storyPanel.ttsSegmentPart1') }}
          </button>
          <button
            type="button"
            class="sp-segment-btn"
            :class="{ 'sp-segment-btn--active': selectedSegment === 'part3' }"
            @click="selectedSegment = 'part3'"
          >
            {{ t('part3.storyPanel.ttsSegmentPart3') }}
          </button>
        </div>
        <p v-if="part3NotReady" class="sp-cont-hint">
          {{ t('part3.storyPanel.ttsPart3NotReady') }}
        </p>

        <!-- Voice selector (6 Edge-TTS voices, always available) -->
        <p class="sp-subtext">{{ t('part3.storyPanel.ttsVoiceLabel') }}</p>
        <div class="sp-voice-grid">
          <button
            v-for="(v, i) in TTS_VOICES"
            :key="v.id"
            class="sp-voice-btn"
            :class="{ 'sp-voice-btn--active': selectedVoiceIdx === i }"
            @click="selectedVoiceIdx = i; ttsStop()"
          >
            <svg viewBox="0 0 16 16" fill="none" class="sp-voice-icon">
              <circle cx="8" cy="5" r="2.5" stroke="currentColor" stroke-width="1.3"/>
              <path d="M3 14c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            <span class="sp-voice-name">{{ v.name }}</span>
            <span class="sp-voice-lang">{{ t(`part3.storyPanel.${v.tagKey}`) }}</span>
          </button>
        </div>

        <!-- Controls -->
        <div class="sp-tts-controls">
          <button
            class="sp-tts-btn sp-tts-btn--play"
            :disabled="ttsLoading || (ttsSpeaking && !ttsPaused) || part3NotReady"
            @click="ttsPlay"
          >
            <svg v-if="!ttsLoading" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.5 5.5l9 4.5-9 4.5V5.5z"/>
            </svg>
            <div v-else class="sp-spinner sp-spinner--small" />
            {{ ttsLoading ? t('part3.storyPanel.ttsLoading') : t('part3.storyPanel.ttsPlay') }}
          </button>
          <button class="sp-tts-btn" :disabled="!ttsSpeaking || ttsPaused" @click="ttsPause">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <rect x="5" y="4" width="3.5" height="12" rx="1"/>
              <rect x="11.5" y="4" width="3.5" height="12" rx="1"/>
            </svg>
            {{ t('part3.storyPanel.ttsPause') }}
          </button>
          <button class="sp-tts-btn" :disabled="!ttsSpeaking && !ttsPaused" @click="ttsStop">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <rect x="4" y="4" width="12" height="12" rx="2"/>
            </svg>
            {{ t('part3.storyPanel.ttsStop') }}
          </button>
          <span class="sp-tts-status" :class="{ 'sp-tts-status--playing': ttsSpeaking && !ttsPaused }">
            {{ t(ttsStatusKey) }}
          </span>
        </div>

        <!-- TTS error -->
        <p v-if="ttsError" class="sp-error sp-error--inline">{{ ttsError }}</p>
      </template>

      <!-- 2026-05: legacy "AI Sound Suggestions" block removed. The
           backend no longer generates the `soundDesign` story field
           (it was unused by teachers in the pilot and the video model
           has no audio output anyway), so this tab is now TTS-only. -->
    </div>

  </div>
</template>

<style scoped>
.sp-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f0fdf4;
  overflow: hidden;
}

.sp-header {
  flex-shrink: 0;
  border-bottom: 1px solid #d1fae5;
}

.sp-tabs {
  display: flex;
  padding: 16px 16px 0;
  gap: 4px;
}

.sp-tab {
  padding: 8px 14px;
  border-radius: 8px 8px 0 0;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
}

.sp-tab:hover { color: #111827; }
.sp-tab--active { background: #7FEC8F; color: #000; font-weight: 600; }

.sp-loading,
.sp-error,
.sp-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 32px 24px;
  text-align: center;
}

.sp-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(127, 236, 143, 0.3);
  border-top-color: #7FEC8F;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.sp-spinner--small {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

.sp-stream-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sp-stream-label { font-size: 12px; color: #6b7280; }

.sp-stream-text { white-space: pre-wrap; }

.sp-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: #16a34a;
  margin-left: 1px;
  vertical-align: text-bottom;
  animation: blink 0.9s step-start infinite;
}

@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

@keyframes spin { to { transform: rotate(360deg); } }

.sp-loading p, .sp-empty p { font-size: 13px; color: #6b7280; margin: 0; }
.sp-error p { font-size: 13px; color: #dc2626; margin: 0; }

.sp-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sp-section-title { margin: 0; font-size: 14px; font-weight: 700; color: #111827; }
.sp-subtext       { margin: 0; font-size: 13px; color: #6b7280; }
.sp-text          { margin: 0; font-size: 13px; color: #374151; line-height: 1.7; }

.sp-choices { display: flex; flex-direction: column; gap: 8px; }

.sp-choice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1.5px solid transparent;
  background: #fff;
  font-size: 13px;
  font-family: inherit;
  color: #374151;
  text-align: left;
  cursor: pointer;
  line-height: 1.5;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.sp-choice:hover { border-color: #B2F4BC; }
.sp-choice--selected { background: #B2F4BC; border-color: #7FEC8F; color: #111827; }

.sp-choice-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7FEC8F;
  flex-shrink: 0;
  margin-top: 4px;
}

.sp-choice--selected .sp-choice-dot { background: #16a34a; }
.sp-choice:disabled { opacity: 0.55; cursor: not-allowed; }

.sp-cont-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #6b7280;
  padding: 4px 0;
}

.sp-cont-hint {
  margin: 0;
  font-size: 13px;
  color: #9ca3af;
  font-style: italic;
}

.sp-error--inline {
  font-size: 12px;
  color: #dc2626;
  margin: 0;
}

/* ── TTS ──────────────────────────────────────────────────────────────── */

.sp-tts-empty {
  font-size: 13px;
  color: #9ca3af;
  font-style: italic;
}

.sp-voice-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.sp-voice-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1.5px solid #e5e7eb;
  background: #fff;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  min-width: 0;
}

.sp-voice-btn:hover { border-color: #B2F4BC; }
.sp-voice-btn--active { background: #B2F4BC; border-color: #7FEC8F; }

.sp-voice-icon { width: 14px; height: 14px; flex-shrink: 0; color: #6b7280; }
.sp-voice-btn--active .sp-voice-icon { color: #16a34a; }

.sp-voice-name {
  font-size: 12px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.sp-voice-lang {
  font-size: 10px;
  color: #9ca3af;
  flex-shrink: 0;
}

.sp-tts-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sp-tts-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1.5px solid #d1d5db;
  background: #fff;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  color: #374151;
  cursor: pointer;
}

.sp-tts-btn svg { width: 14px; height: 14px; }
.sp-tts-btn:hover:not(:disabled) { border-color: #7FEC8F; background: #f0fdf4; }
.sp-tts-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.sp-tts-btn--play { background: #7FEC8F; border-color: #7FEC8F; color: #000; }
.sp-tts-btn--play:hover:not(:disabled) { background: #5de06f; }

.sp-tts-status {
  font-size: 11px;
  color: #9ca3af;
  margin-left: auto;
}

.sp-tts-status--playing { color: #16a34a; font-weight: 600; }

/* Segment picker (Opening vs. Continuation) — same visual language as
   the voice grid but laid out horizontally as two pills. */
.sp-segment-row {
  display: flex;
  gap: 8px;
}

.sp-segment-btn {
  flex: 1;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1.5px solid #e5e7eb;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: #374151;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.sp-segment-btn:hover { border-color: #B2F4BC; }
.sp-segment-btn--active {
  background: #B2F4BC;
  border-color: #7FEC8F;
  color: #064e3b;
}

.sp-tts-divider {
  height: 1px;
  background: #d1fae5;
  margin: 4px 0;
}

/* ── Design-Rationale chat ───────────────────────────────────────────── */

/* Design tab gets a flex column with a scrolling chat history that
   sticks to the bottom, plus a fixed input row. The outer `.sp-body`
   already scrolls, so we make the chat history a self-contained
   bounded box (max-height) to avoid double-scrollbars. */
.sp-body--design { gap: 10px; }

.sp-design-text { white-space: pre-wrap; }

/* Resizable rationale viewer. CSS `resize: vertical` gives the user a
   grab handle at the bottom-right corner to shrink/expand. We cap
   min/max so it can't collapse into nothing or push the chat off
   screen. Default starts at ~140px which is enough for 4-5 lines —
   tall enough to read the opening sentence, short enough to leave
   plenty of room for chat. */
.sp-design-rationale-box {
  resize: vertical;
  overflow-y: auto;
  min-height: 80px;
  max-height: 360px;
  height: 140px;
  padding: 10px 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.sp-design-rationale-box .sp-design-text {
  margin: 0;
}

.sp-chat-divider {
  height: 1px;
  background: #d1fae5;
  margin: 8px 0 4px;
}

.sp-chat-scroller {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
  padding: 8px 4px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.sp-chat-empty {
  margin: 8px 4px;
  font-size: 12px;
  color: #9ca3af;
  font-style: italic;
}

.sp-chat-bubble {
  max-width: 88%;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.55;
  word-wrap: break-word;
}

.sp-chat-bubble--user {
  align-self: flex-end;
  background: #7FEC8F;
  color: #064e3b;
  border-bottom-right-radius: 4px;
}

.sp-chat-bubble--bot {
  align-self: flex-start;
  background: #f3f4f6;
  color: #1f2937;
  border-bottom-left-radius: 4px;
}

.sp-chat-text {
  margin: 0;
  white-space: pre-wrap;
}

/* 2026-05 — clarify-option pills shown beneath an ambiguous-request
   reply. Same visual language as the segment / voice pill buttons in
   the Sound Design tab so the chat feels of a piece with the rest of
   the Part-3 panel. `flex-wrap` lets the 4 chips reflow onto two rows
   on narrow chat-pane widths. */
.sp-clarify-options {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sp-clarify-btn {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1.5px solid #6ee7b7;
  background: #ffffff;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: #047857;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.sp-clarify-btn:hover:not(:disabled) {
  background: #d1fae5;
  border-color: #10b981;
}

.sp-clarify-btn:active:not(:disabled) {
  background: #a7f3d0;
}

.sp-clarify-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sp-chat-revision {
  margin-top: 8px;
  padding: 8px 10px;
  background: #ecfdf5;
  border: 1px dashed #6ee7b7;
  border-radius: 10px;
}

.sp-chat-revision-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #047857;
}

.sp-chat-revision-icon { width: 14px; height: 14px; }

.sp-chat-revision-hint {
  margin: 4px 0 8px;
  font-size: 11px;
  color: #047857;
  line-height: 1.5;
}

/* Full-story preview inside the revision card. The card itself sits
   inside an .sp-chat-bubble which is already max-width 88% of the
   scroller; the preview gets a white inset and its own scrollbar so
   a very long revision doesn't blow out the bubble height. */
.sp-revision-preview {
  max-height: 320px;
  overflow-y: auto;
  padding: 10px 12px;
  background: #ffffff;
  border: 1px solid #d1fae5;
  border-radius: 8px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sp-revision-section {
  margin: 8px 0 2px;
  font-size: 12px;
  font-weight: 700;
  color: #065f46;
}

.sp-revision-section:first-child {
  margin-top: 0;
}

.sp-revision-text {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: #1f2937;
  white-space: pre-wrap;
}

.sp-revision-text--design {
  color: #4b5563;
  font-size: 12px;
}

.sp-revision-choices {
  margin: 0;
  padding-left: 18px;
  font-size: 12.5px;
  line-height: 1.6;
  color: #1f2937;
}

.sp-revision-choices li {
  margin: 2px 0;
}

.sp-revision-choices strong {
  color: #047857;
  margin-right: 2px;
}

.sp-revision-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.sp-revision-link {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: #047857;
  cursor: pointer;
  text-decoration: none;
}

.sp-revision-link:hover {
  text-decoration: underline;
}

.sp-chat-apply-btn {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  border: none;
  background: #10b981;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.sp-chat-apply-btn:hover:not(:disabled) { background: #059669; }
.sp-chat-apply-btn:disabled {
  background: #d1fae5;
  color: #065f46;
  cursor: default;
}

.sp-chat-typing {
  display: flex;
  gap: 4px;
  padding: 4px 2px;
}

.sp-chat-typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9ca3af;
  animation: chatTyping 1.2s infinite ease-in-out;
}

.sp-chat-typing-dot:nth-child(2) { animation-delay: 0.15s; }
.sp-chat-typing-dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes chatTyping {
  0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
  30%           { opacity: 1;   transform: translateY(-3px); }
}

.sp-chat-input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.sp-chat-input {
  flex: 1;
  resize: none;
  padding: 10px 12px;
  border: 1.5px solid #d1fae5;
  border-radius: 12px;
  background: #ffffff;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  color: #111827;
  outline: none;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.sp-chat-input:focus { border-color: #7FEC8F; }
.sp-chat-input:disabled { background: #f9fafb; cursor: not-allowed; }

.sp-chat-send-btn {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 50%;
  border: none;
  background: #7FEC8F;
  color: #064e3b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
}

.sp-chat-send-btn:hover:not(:disabled) { background: #5de06f; }
.sp-chat-send-btn:disabled {
  background: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
  box-shadow: none;
}

.sp-chat-send-btn svg { width: 18px; height: 18px; }
</style>
