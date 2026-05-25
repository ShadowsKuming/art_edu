<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { usePart6Store } from '@/stores/part6'
import { useI18n } from 'vue-i18n'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

const store = usePart6Store()
const { t, locale } = useI18n()

const selectedStyle = computed(() =>
  store.selectedStyleIdx !== null ? store.styles[store.selectedStyleIdx] : null,
)

interface Message {
  role: 'assistant' | 'user'
  text: string
  styleChips?: string[]
}

const messages = ref<Message[]>([
  { role: 'assistant', text: t('part6.bot.greeting') },
])

const input    = ref('')
const loading  = ref(false)
const scrollEl = ref<HTMLElement | null>(null)

function scrollBottom() {
  nextTick(() => scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' }))
}

watch(() => store.sketchDataUrl, (val, old) => {
  if (val && !old) {
    messages.value.push({ role: 'assistant', text: t('part6.bot.sketchUploaded') })
    scrollBottom()
  }
})

async function send(text?: string) {
  const content = (text ?? input.value).trim()
  if (!content || loading.value) return
  input.value = ''

  messages.value.push({ role: 'user', text: content })
  scrollBottom()
  loading.value = true

  if (store.sketchDataUrl && !store.styles.length) {
    await store.generateStyles(content, locale.value)

    if (store.stylesError) {
      messages.value.push({ role: 'assistant', text: `${t('part6.bot.errorStyles')} ${store.stylesError}` })
    } else {
      const summaryText = store.lessonSummary
        ? `${store.lessonSummary}\n\n${t('part6.bot.stylesReadySuffix')}`
        : t('part6.bot.stylesReady')

      messages.value.push({
        role: 'assistant',
        text: summaryText,
        styleChips: store.styles.map(s => s.label),
      })

      const selected = selectedStyle.value
      if (selected) {
        messages.value.push({
          role: 'assistant',
          text: `${t('part6.bot.selectedStyleLabel')}\n"${selected.prompt}"\n\n${t('part6.bot.selectedStyleNote')}`,
        })
      }
    }
    loading.value = false
    scrollBottom()
    return
  }

  try {
    const contextMessages = messages.value
      .filter(m => !m.styleChips)
      .map(m => ({ role: m.role, text: m.text }))

    const stylesContext = store.styles.length
      ? `\n\nCurrent style options: ${store.styles.map((s, i) => `${i + 1}. ${s.label}: ${s.prompt}`).join(' | ')}\nSelected: ${selectedStyle.value?.label}`
      : ''

    const systemHint = stylesContext
      ? [{ role: 'assistant', text: `[Context: ${stylesContext}]` }]
      : []

    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [...systemHint, ...contextMessages], language: locale.value }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    messages.value.push({ role: 'assistant', text: data.reply })
  } catch {
    messages.value.push({ role: 'assistant', text: t('part6.bot.errorChat') })
  } finally {
    loading.value = false
    scrollBottom()
  }
}

function selectChip(label: string) {
  const idx = store.styles.findIndex(s => s.label === label)
  if (idx !== -1) store.selectedStyleIdx = idx
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
}
</script>

<template>
  <div class="ap-panel">

    <div class="ap-header">
      <span class="ap-title">{{ t('chatbot.title') }}</span>
    </div>

    <div class="ap-identity">
      <img src="/LOGO.png" alt="ArtBloom" class="ap-avatar" />
      <div class="ap-bot-info">
        <span class="ap-bot-name">ArtBloom</span>
        <span class="ap-bot-role">{{ t('chatbot.subtitle') }}</span>
      </div>
    </div>

    <div ref="scrollEl" class="ap-body">
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
          <p class="bubble-text" style="white-space: pre-line;">{{ msg.text }}</p>

          <!-- Style chips -->
          <div v-if="msg.styleChips?.length" class="ap-chips">
            <button
              v-for="label in msg.styleChips"
              :key="label"
              class="ap-chip"
              :class="{ 'ap-chip--active': selectedStyle?.label === label }"
              @click="selectChip(label)"
            >
              <span class="ap-chip-dot" />{{ label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Typing indicator -->
    <div v-if="loading" class="typing-indicator">
      <span /><span /><span />
    </div>

    <div class="ap-input-area">
      <textarea
        v-model="input"
        class="ap-input"
        :placeholder="t('chatbot.placeholder')"
        rows="2"
        :disabled="loading"
        @keydown="onKeydown"
      />
      <button
        class="ap-send-btn"
        :disabled="!input.trim() || loading"
        @click="send()"
      >
        <svg viewBox="0 0 20 20" fill="none" class="send-icon">
          <path d="M10 15V5M10 5L6 9M10 5l4 4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

  </div>
</template>

<style scoped>
.ap-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  overflow: hidden;
}

.ap-header {
  padding: 20px 20px 12px;
  flex-shrink: 0;
}

.ap-title { margin: 0; font-size: 20px; font-weight: 700; color: #111827; }

.ap-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px 16px;
  flex-shrink: 0;
}

.ap-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.ap-bot-info  { display: flex; flex-direction: column; gap: 2px; }
.ap-bot-name  { font-size: 15px; font-weight: 600; color: #111827; }
.ap-bot-role  { font-size: 12px; color: #9ca3af; }

.ap-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-row { display: flex; }
.message-row--user      { justify-content: flex-end; }
.message-row--assistant { justify-content: flex-start; }

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

.bubble-text { margin: 0; }

.ap-chips { display: flex; flex-direction: column; gap: 7px; align-items: flex-start; margin-top: 10px; }

.ap-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  background: #fff;
  border: 1.5px solid #B2F4BC;
  border-radius: 999px;
  font-size: 13px;
  font-family: inherit;
  color: #374151;
  cursor: pointer;
  text-align: left;
}

.ap-chip:hover   { background: #f0fdf4; border-color: #7FEC8F; }
.ap-chip--active { background: #7FEC8F; border-color: #7FEC8F; font-weight: 600; }

.ap-chip-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  flex-shrink: 0;
}

.ap-chip--active .ap-chip-dot { background: #16a34a; }

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

.ap-input-area {
  flex-shrink: 0;
  padding: 12px 16px 16px;
  position: relative;
}

.ap-input {
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

.ap-input::placeholder { color: #9ca3af; }

.ap-send-btn {
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

.ap-send-btn:disabled { background: #d1d5db; cursor: not-allowed; }

.send-icon { width: 16px; height: 16px; }
</style>
