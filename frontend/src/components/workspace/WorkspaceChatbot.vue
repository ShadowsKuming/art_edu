<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectsStore } from '@/stores/projects'
import { useSlideStore } from '@/stores/slides'
import { useChatbotStore, type ChatMessage } from '@/stores/chatbot'
// Bundled chatbot avatar (was `/LOGO.png` before — switched to the
// purpose-built mascot art so the assistant has its own identity
// distinct from the brand logo in the workspace header).
import botAvatarUrl from '@/assets/images/avatar-artbloom.png'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

const { t, tm, locale } = useI18n()
const projectsStore = useProjectsStore()
const slideStore = useSlideStore()
const chatbotStore = useChatbotStore()

/**
 * Build the locale + part-aware welcome bubble.
 *
 * 2026-05 — Pilot feedback: when every Part shared the same greeting
 * and three chips, the model's answers also felt interchangeable.
 * The i18n table now exposes `chatbot.byPart.{1|2|4|5}` per the
 * Slide-design chatbot scope (Parts 3/6/7 each use a dedicated side
 * panel, so they fall back to the generic copy here on the off
 * chance this chatbot ever surfaces on them).
 *
 * The lookup is forgiving: if `activePart` is null or the partId
 * doesn't have its own block (currently 3/6/7), we use
 * `chatbot.fallback.*`.
 */
function makeWelcome(): ChatMessage {
  const partId = slideStore.activePart
  // Parts 1/2/4/5 each have a dedicated namespace under
  // `chatbot.byPart.<n>`. Anything else (null partId or 3/6/7)
  // resolves to `chatbot.fallback`.
  const hasPartCopy =
    partId === 1 || partId === 2 || partId === 4 || partId === 5
  const ns = hasPartCopy ? `chatbot.byPart.${partId}` : 'chatbot.fallback'
  return {
    role: 'assistant',
    text: t(`${ns}.greeting`),
    suggestions: (tm(`${ns}.suggestions`) as string[]).map((s) => String(s)),
  }
}

/**
 * Per-(project, part) chatbot history bucket key.
 *
 * 2026-05 — Pilot feedback drove this refactor. Previously the
 * chatbot store was a flat array, which meant:
 *   • A user reply in Part 1 leaked into Part 2's pane (the previous
 *     "only welcome" reset gate refused to swap the greeting once
 *     the array was no longer 1-message-long).
 *   • Opening a different project carried the prior project's
 *     transcript into the new workspace.
 *
 * Switching to a bucketed history (`${projectId}:${partId}` →
 * `ChatMessage[]`) isolates conversations along both axes. When the
 * user has no active project (legacy in-memory project), we fall
 * back to the literal string `__noproj__` so each part still gets
 * its own bucket within that anonymous session.
 */
const chatKey = computed(() => {
  const projectId = projectsStore.activeProjectId ?? '__noproj__'
  const partId = slideStore.activePart ?? 0
  return `${projectId}:${partId}`
})

/** Reactive view onto the current bucket. */
const messages = computed<ChatMessage[]>(() =>
  chatbotStore.getMessages(chatKey.value),
)

/**
 * Whenever the (project, part) key changes — including the very
 * first mount — make sure the bucket has a welcome bubble in it.
 * `{ immediate: true }` covers the first run so we don't need a
 * separate onMounted seeder.
 *
 * If the bucket already contains messages (reload-restored history
 * OR a previously visited part the teacher is coming back to), we
 * leave it untouched so the conversation picks up where it left
 * off. Only empty buckets get seeded with the part-specific
 * greeting + chips.
 */
watch(
  chatKey,
  (key) => {
    if (chatbotStore.getMessages(key).length === 0) {
      chatbotStore.setMessages(key, [makeWelcome()])
    }
    scrollBottom()
  },
  { immediate: true },
)

/**
 * Locale-toggle resets only the *current* bucket's welcome, so
 * other parts / projects keep their existing transcripts in
 * whichever language they were written in. We also only stomp the
 * bucket when the user hasn't sent any user messages yet — same
 * "only welcome" idiom as before, just bucket-scoped now.
 */
watch(locale, () => {
  const key = chatKey.value
  const current = chatbotStore.getMessages(key)
  const onlyWelcome =
    current.length === 0 ||
    (current.length === 1 &&
      current[0].role === 'assistant' &&
      !!current[0].suggestions)
  if (onlyWelcome) {
    chatbotStore.setMessages(key, [makeWelcome()])
  }
})

const input = ref('')
const loading = ref(false)
const scrollEl = ref<HTMLElement | null>(null)

function scrollBottom() {
  nextTick(() => scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' }))
}

async function send(text?: string) {
  const content = (text ?? input.value).trim()
  if (!content || loading.value) return

  // Snapshot the bucket key for THIS turn. If the user happens to
  // navigate to a different Part mid-request the response should
  // still land in the bucket that asked the question — not appear
  // inside another Part's transcript.
  const key = chatKey.value

  input.value = ''
  chatbotStore.push(key, { role: 'user', text: content })
  scrollBottom()

  loading.value = true
  try {
    const history = chatbotStore
      .getMessages(key)
      .filter((m) => !m.suggestions)
      .map((m) => ({ role: m.role, text: m.text }))

    const lessonId = projectsStore.activeLessonId
    const partId = slideStore.activePart
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: history,
        language: locale.value,
        lesson_id: lessonId ?? undefined,
        part_id: partId ?? undefined,
      }),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    chatbotStore.push(key, { role: 'assistant', text: data.reply })
  } catch (e: any) {
    chatbotStore.push(key, { role: 'assistant', text: t('chatbot.error') })
  } finally {
    loading.value = false
    scrollBottom()
  }
}
</script>

<template>
  <aside class="chatbot">

    <!-- Header -->
    <div class="chatbot-header">
      <span class="chatbot-title">{{ t('chatbot.title') }}</span>
    </div>

    <!-- Bot identity. The bot name + subtitle were folded into the
         header copy itself ("Creative Assistant") — only the avatar
         remains here as a visual anchor before the message list. -->
    <div class="bot-identity">
      <img :src="botAvatarUrl" :alt="t('brand.name')" class="bot-avatar" />
    </div>

    <!-- Messages -->
    <div ref="scrollEl" class="chatbot-messages">
      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="message-row"
        :class="msg.role === 'user' ? 'message-row--user' : 'message-row--assistant'"
      >
        <div
          class="message-bubble"
          :class="msg.role === 'user' ? 'bubble--user' : 'bubble--assistant'"
        >
          <p class="bubble-text">{{ msg.text }}</p>
          <ul v-if="msg.suggestions" class="suggestion-list">
            <li
              v-for="s in msg.suggestions"
              :key="s"
              class="suggestion-item"
              @click="send(s)"
            >
              <span class="suggestion-dot" />
              {{ s }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Typing indicator -->
    <div v-if="loading" class="typing-indicator">
      <span /><span /><span />
    </div>

    <!-- Input area -->
    <div class="input-area">
      <textarea
        v-model="input"
        :placeholder="t('chatbot.placeholder')"
        class="chat-input"
        rows="2"
        :disabled="loading"
        @keydown.enter.exact.prevent="send()"
      />
      <button
        class="send-btn"
        :disabled="!input.trim() || loading"
        @click="send()"
      >
        <svg viewBox="0 0 20 20" fill="none" class="send-icon">
          <path d="M10 15V5M10 5L6 9M10 5l4 4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

  </aside>
</template>

<style scoped>
.chatbot {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-left: 1px solid #e5e7eb;
  overflow: hidden;
}

/* Header */
.chatbot-header {
  padding: 20px 20px 12px;
  flex-shrink: 0;
}

.chatbot-title {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}

/* Bot identity */
.bot-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px 16px;
  flex-shrink: 0;
}

.bot-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

/* Messages */
.chatbot-messages {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-row {
  display: flex;
}

.message-row--user {
  justify-content: flex-end;
}

.message-row--assistant {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 80%;
  padding: 12px 14px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.55;
}

.bubble--assistant {
  background: #B2F4BC;
  color: #111827;
  border-bottom-left-radius: 4px;
}

.bubble--user {
  background: #f3f4f6;
  color: #111827;
  border-bottom-right-radius: 4px;
}

.bubble-text {
  margin: 0;
}

/* Suggestions */
.suggestion-list {
  list-style: none;
  padding: 0;
  margin: 10px 0 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.suggestion-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: #111827;
  cursor: pointer;
}

.suggestion-item:hover {
  text-decoration: underline;
}

.suggestion-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  flex-shrink: 0;
  margin-top: 5px;
}

/* Typing indicator */
.typing-indicator {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 20px 10px;
}

.typing-indicator span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  animation: bounce 1.2s infinite ease-in-out;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
  40%           { transform: translateY(-6px); opacity: 1; }
}

/* Input area */
.input-area {
  flex-shrink: 0;
  padding: 12px 16px 16px;
  position: relative;
}

.chat-input {
  width: 100%;
  background: #f3f4f6;
  border: none;
  border-radius: 12px;
  padding: 12px 14px 36px 14px;
  font-size: 14px;
  font-family: inherit;
  color: #111827;
  resize: none;
  outline: none;
  line-height: 1.5;
  box-sizing: border-box;
}

.chat-input::placeholder {
  color: #9ca3af;
}

.send-btn {
  position: absolute;
  bottom: 24px;
  right: 24px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #22c55e;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.send-btn:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.send-icon {
  width: 16px;
  height: 16px;
}
</style>
