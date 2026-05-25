<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { usePart6Store } from '@/stores/part6'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

const store = usePart6Store()

/**
 * Currently selected style, or `null` when nothing is selected.
 * Centralises the `selectedStyleIdx` null-check so we can use this
 * directly in template/script without TypeScript flagging `null`
 * as an array index.
 */
const selectedStyle = computed(() =>
  store.selectedStyleIdx !== null ? store.styles[store.selectedStyleIdx] : null,
)

interface Message {
  role: 'assistant' | 'user'
  text: string
  styleChips?: string[]   // chip labels shown after styles are generated
}

const messages = ref<Message[]>([
  {
    role: 'assistant',
    text: 'Hi! I\'m ArtBloom. Upload a student sketch in Step 1, then tell me about your lesson theme or learning objective — I\'ll generate 3 personalised style transfer options for you.',
  },
])

const input    = ref('')
const loading  = ref(false)
const scrollEl = ref<HTMLElement | null>(null)

function scrollBottom() {
  nextTick(() => scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' }))
}

// When sketch is uploaded for the first time, nudge the teacher
watch(() => store.sketchDataUrl, (val, old) => {
  if (val && !old) {
    messages.value.push({
      role: 'assistant',
      text: 'Sketch uploaded! Now describe your lesson context and I\'ll generate the style options. For example: "Students are learning to exaggerate proportions in animal drawings."',
    })
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

  // First generate styles if we have a sketch and styles haven't been generated yet
  if (store.sketchDataUrl && !store.styles.length) {
    await store.generateStyles(content)

    if (store.stylesError) {
      messages.value.push({ role: 'assistant', text: `Sorry, I couldn't generate style options: ${store.stylesError}` })
    } else {
      const summaryText = store.lessonSummary
        ? `${store.lessonSummary}\n\nHere are the 3 recommended style options:`
        : 'Here are 3 style transfer options based on your lesson:'

      messages.value.push({
        role: 'assistant',
        text: summaryText,
        styleChips: store.styles.map(s => s.label),
      })

      // Show the prompt for the selected style
      const selected = selectedStyle.value
      if (selected) {
        messages.value.push({
          role: 'assistant',
          text: `Selected style prompt:\n"${selected.prompt}"\n\nPlease review the style prompts for each option. If you'd like any adjustments, just let me know.`,
        })
      }
    }
    loading.value = false
    scrollBottom()
    return
  }

  // Otherwise, use regular chat (with styles context injected)
  try {
    const contextMessages = messages.value
      .filter(m => !m.styleChips)
      .map(m => ({ role: m.role, text: m.text }))

    // Inject current style info as context
    const stylesContext = store.styles.length
      ? `\n\nCurrent style options: ${store.styles.map((s, i) => `${i + 1}. ${s.label}: ${s.prompt}`).join(' | ')}\nSelected: ${selectedStyle.value?.label}`
      : ''

    const systemHint = stylesContext
      ? [{ role: 'assistant', text: `[Context: ${stylesContext}]` }]
      : []

    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [...systemHint, ...contextMessages] }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    messages.value.push({ role: 'assistant', text: data.reply })
  } catch {
    messages.value.push({ role: 'assistant', text: 'Sorry, something went wrong. Please try again.' })
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
      <h2 class="ap-title">Assistance</h2>
    </div>

    <div class="ap-identity">
      <div class="ap-avatar">
        <svg viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#7FEC8F"/>
          <path d="M10 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#000" stroke-width="1.8" stroke-linecap="round"/>
          <circle cx="16" cy="11" r="3" fill="#000"/>
        </svg>
      </div>
      <div>
        <p class="ap-bot-name">ArtBloom</p>
        <p class="ap-bot-role">Creative Assistant</p>
      </div>
    </div>

    <div ref="scrollEl" class="ap-body">
      <template v-for="(msg, i) in messages" :key="i">

        <div v-if="msg.role === 'assistant'" class="ap-assistant-msg">
          <p class="ap-msg-text" style="white-space: pre-line;">{{ msg.text }}</p>

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

        <div v-else class="ap-user-msg">
          <p class="ap-msg-text">{{ msg.text }}</p>
        </div>

      </template>

      <!-- Typing indicator -->
      <div v-if="loading" class="ap-typing">
        <span /><span /><span />
      </div>
    </div>

    <div class="ap-input-area">
      <textarea
        v-model="input"
        class="ap-input"
        placeholder="Ask questions about the work transformation......"
        rows="3"
        :disabled="loading"
        @keydown="onKeydown"
      />
      <button
        class="ap-send-btn"
        :disabled="!input.trim() || loading"
        @click="send()"
      >
        <svg viewBox="0 0 20 20" fill="none">
          <path d="M10 15V5M10 5l-4 4M10 5l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
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
  padding: 18px 20px 10px;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.ap-title { margin: 0; font-size: 17px; font-weight: 700; color: #111827; }

.ap-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px 10px;
  flex-shrink: 0;
}

.ap-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid #7FEC8F;
}

.ap-avatar svg { width: 40px; height: 40px; display: block; }

.ap-bot-name  { margin: 0; font-size: 14px; font-weight: 700; color: #111827; }
.ap-bot-role  { margin: 0; font-size: 12px; color: #6b7280; }

.ap-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #f0fdf4;
}

.ap-assistant-msg { display: flex; flex-direction: column; gap: 8px; }

.ap-user-msg {
  align-self: flex-end;
  background: #7FEC8F;
  border-radius: 12px 12px 2px 12px;
  padding: 10px 14px;
  max-width: 85%;
}

.ap-msg-text { margin: 0; font-size: 13px; color: #374151; line-height: 1.6; }
.ap-user-msg .ap-msg-text { color: #000; }

.ap-chips { display: flex; flex-direction: column; gap: 7px; align-items: flex-start; }

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

.ap-chip:hover        { background: #f0fdf4; border-color: #7FEC8F; }
.ap-chip--active      { background: #7FEC8F; border-color: #7FEC8F; font-weight: 600; }

.ap-chip-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #7FEC8F;
  flex-shrink: 0;
}

.ap-chip--active .ap-chip-dot { background: #16a34a; }

.ap-typing {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 0;
}

.ap-typing span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #7FEC8F;
  animation: bounce 1.2s infinite ease-in-out;
}

.ap-typing span:nth-child(2) { animation-delay: 0.2s; }
.ap-typing span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
  40%           { transform: translateY(-6px); opacity: 1; }
}

.ap-input-area {
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-shrink: 0;
  background: #fff;
}

.ap-input {
  flex: 1;
  resize: none;
  border: 1.5px solid #e6e6e6;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 13px;
  font-family: inherit;
  color: #111827;
  outline: none;
  line-height: 1.5;
}

.ap-input:focus   { border-color: #7FEC8F; }
.ap-input:disabled { opacity: 0.5; }

.ap-send-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #7FEC8F;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #000;
  padding: 8px;
}

.ap-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ap-send-btn:not(:disabled):hover { transform: scale(1.05); }
</style>
