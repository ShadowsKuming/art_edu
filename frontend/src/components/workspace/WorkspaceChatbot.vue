<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectsStore } from '@/stores/projects'
import { useSlideStore } from '@/stores/slides'
import { useChatbotStore } from '@/stores/chatbot'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

const { t, tm, locale } = useI18n()
const projectsStore = useProjectsStore()
const slideStore = useSlideStore()
const chatbotStore = useChatbotStore()

function makeWelcome() {
  return {
    role: 'assistant' as const,
    text: t('chatbot.greeting'),
    suggestions: (tm('chatbot.suggestions') as string[]).map(s => String(s)),
  }
}

// Seed the welcome message only on first mount (store is empty)
onMounted(() => {
  if (chatbotStore.messages.length === 0) {
    chatbotStore.setMessages([makeWelcome()])
  }
})

// Reset to new welcome when locale changes
watch(locale, () => {
  chatbotStore.setMessages([makeWelcome()])
})

const input    = ref('')
const loading  = ref(false)
const scrollEl = ref<HTMLElement | null>(null)

function scrollBottom() {
  nextTick(() => scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' }))
}

async function send(text?: string) {
  const content = (text ?? input.value).trim()
  if (!content || loading.value) return

  input.value = ''
  chatbotStore.push({ role: 'user', text: content })
  scrollBottom()

  loading.value = true
  try {
    const history = chatbotStore.messages
      .filter(m => !m.suggestions)
      .map(m => ({ role: m.role, text: m.text }))

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
    chatbotStore.push({ role: 'assistant', text: data.reply })
  } catch (e: any) {
    chatbotStore.push({ role: 'assistant', text: t('chatbot.error') })
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

    <!-- Bot identity -->
    <div class="bot-identity">
      <img src="/LOGO.png" alt="ArtBloom" class="bot-avatar" />
      <div class="bot-info">
        <span class="bot-name">ArtBloom</span>
        <span class="bot-subtitle">{{ t('chatbot.subtitle') }}</span>
      </div>
    </div>

    <!-- Messages -->
    <div ref="scrollEl" class="chatbot-messages">
      <div
        v-for="(msg, i) in chatbotStore.messages"
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

.bot-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bot-name {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.bot-subtitle {
  font-size: 12px;
  color: #9ca3af;
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
