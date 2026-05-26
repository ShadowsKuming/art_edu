<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePart3Store } from '@/stores/part3'

const { t } = useI18n()

interface Message {
  role: 'assistant' | 'user'
  text: string
}

const store     = usePart3Store()
const inputText = ref('')

const suggestions = [
  'Make the atmosphere of the animation more cheerful',
  'Add changes in light and shadow',
  'Zoom in for a close-up of the main subject',
]

const messages = ref<Message[]>([
  {
    role: 'assistant',
    text: 'Each image has three chances to generate an animation. Click Generate Animation to create the first version, or enter custom instructions below.',
  },
])

function applySuggestion(s: string) {
  inputText.value = s
}

async function send() {
  const text = inputText.value.trim()
  if (!text) return
  messages.value.push({ role: 'user', text })
  inputText.value = ''

  messages.value.push({
    role: 'assistant',
    text: `Got it! Generating a new animation with your adjustments: "${text}". This may take a minute…`,
  })

  await store.generateAnimation(text)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
}
</script>

<template>
  <div class="ap-panel">

    <div class="ap-header">
      <h2 class="ap-title">Animation Assistant</h2>
    </div>

    <div class="ap-body">
      <!-- Identity -->
      <div class="ap-identity">
        <div class="ap-avatar">
          <svg viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="#7FEC8F"/>
            <path d="M10 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#000" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="16" cy="11" r="3" fill="#000"/>
          </svg>
        </div>
        <div>
          <p class="ap-bot-name">{{ t('brand.name') }}</p>
          <p class="ap-bot-role">Creative Assistant</p>
        </div>
      </div>

      <!-- Messages -->
      <template v-for="(msg, i) in messages" :key="i">
        <div v-if="msg.role === 'assistant'" class="ap-assistant-msg">
          <p class="ap-msg-text">{{ msg.text }}</p>
        </div>
        <div v-else class="ap-user-msg">
          <p class="ap-msg-text">{{ msg.text }}</p>
        </div>
      </template>

      <!-- Remaining attempts notice -->
      <div v-if="store.remainingAttempts <= 0" class="ap-notice">
        No animation attempts remaining for this image.
      </div>

      <!-- Loading indicator -->
      <div v-if="store.animationLoading" class="ap-generating">
        <div class="ap-spinner" />
        <span>Generating animation…</span>
      </div>

      <!-- Suggestion chips (show when there are attempts left) -->
      <div v-if="store.remainingAttempts > 0 && !store.animationLoading" class="ap-suggestions">
        <p class="ap-suggest-label">Would you like to modify and regenerate? For example:</p>
        <div class="ap-chips">
          <button
            v-for="s in suggestions"
            :key="s"
            class="ap-chip"
            @click="applySuggestion(s)"
          >
            <span class="ap-chip-dot" />{{ s }}
          </button>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="ap-input-area">
      <textarea
        v-model="inputText"
        class="ap-input"
        placeholder="Enter any animation content you would like to adjust......"
        rows="3"
        :disabled="store.remainingAttempts <= 0 || store.animationLoading"
        @keydown="onKeydown"
      />
      <button
        class="ap-send-btn"
        :disabled="!inputText.trim() || store.remainingAttempts <= 0 || store.animationLoading"
        @click="send"
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
  padding: 18px 20px 14px;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.ap-title { margin: 0; font-size: 17px; font-weight: 700; color: #111827; }

.ap-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: #f0fdf4;
}

.ap-identity { display: flex; align-items: center; gap: 12px; }

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

.ap-notice {
  font-size: 13px;
  color: #6b7280;
  background: #f3f4f6;
  border-radius: 8px;
  padding: 10px 14px;
  text-align: center;
}

.ap-generating {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #6b7280;
}

.ap-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(127, 236, 143, 0.3);
  border-top-color: #7FEC8F;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

.ap-suggestions { display: flex; flex-direction: column; gap: 10px; }
.ap-suggest-label { margin: 0; font-size: 13px; color: #374151; line-height: 1.5; }

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

.ap-chip:hover { background: #f0fdf4; border-color: #7FEC8F; }

.ap-chip-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #7FEC8F;
  flex-shrink: 0;
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

.ap-input:focus { border-color: #7FEC8F; }
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
