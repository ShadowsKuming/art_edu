<script setup lang="ts">
/**
 * Part 3 — Animation Assistant panel (right column).
 *
 * Rebrand 2026-05: title now reuses `chatbot.title` ("Creative
 * Assistant" / "创意助手") to stay coherent with the global workspace
 * chatbot, and the avatar shows the bundled mascot PNG instead of the
 * old inline SVG. The bot-name / bot-role lines were removed per
 * pilot feedback (redundant given the panel title above).
 *
 * All copy now flows through vue-i18n; the seeded greeting is
 * re-rendered when the user toggles the locale so a half-finished
 * conversation gets a fresh assistant turn in the new language
 * (without dropping the user's own messages).
 */
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePart3Store } from '@/stores/part3'
import { useToastStore } from '@/stores/toast'
// Mascot avatar — same asset already in use across the app.
import botAvatarUrl from '@/assets/images/avatar-artbloom.png'

const { t, tm, rt, locale } = useI18n()
const toastStore = useToastStore()


interface Message {
  role: 'assistant' | 'user'
  text: string
}

const store     = usePart3Store()
const inputText = ref('')

/**
 * Suggestion chips — re-computed from the active locale so toggling
 * EN ↔ 中文 updates the chip labels live. `tm` returns the raw array;
 * `rt` resolves each entry into the locale string.
 */
const suggestions = computed<string[]>(() => {
  const raw = tm('part3.animationPanel.suggestions') as unknown[]
  return Array.isArray(raw) ? raw.map((entry) => rt(entry as string)) : []
})

const messages = ref<Message[]>([
  {
    role: 'assistant',
    text: t('part3.animationPanel.greeting'),
  },
])

/**
 * When the locale flips, refresh the *seeded* assistant greeting so
 * the very first turn always matches the current language. We don't
 * touch user-authored turns or later assistant ack lines — those
 * remain in whatever language they were generated in.
 */
watch(locale, () => {
  if (messages.value.length > 0 && messages.value[0].role === 'assistant') {
    messages.value[0] = {
      role: 'assistant',
      text: t('part3.animationPanel.greeting'),
    }
  }
})

function applySuggestion(s: string) {
  inputText.value = s
}

async function send() {
  const text = inputText.value.trim()
  if (!text) return
  // 2026-06-08 — Defense-in-depth: the Part-3 button-row already
  // soft-gates entering animation mode without a story, but the
  // panel could still be visible (e.g. if `mode === 'animation'`
  // was carried over from an earlier session where a story used to
  // exist). Don't fire a generation request that ignores story
  // context. Mirror the toast wording used in Part3Content.vue so
  // teachers see a consistent message.
  if (!store.storyData) {
    toastStore.show(
      locale.value === 'zh'
        ? '请先生成故事，再来设计动画 ☺'
        : 'Please generate the story first, then design the animation ☺',
      'info',
    )
    return
  }
  // 2026-06-08 — Honour the global single-generation lock here too.
  // The Animation Panel's "send" button drives `generateAnimation()`
  // (with a custom prompt), so it MUST refuse while any other
  // artwork is mid-generation, same as the top-row "生成动画" button.
  if (store.isAnyGenerating) {
    toastStore.show(
      locale.value === 'zh'
        ? '请先等待完成当前生成内容'
        : 'Please wait for the current generation to finish',
      'info',
    )
    return
  }
  messages.value.push({ role: 'user', text })

  inputText.value = ''

  messages.value.push({
    role: 'assistant',
    text: t('part3.animationPanel.acknowledge', { prompt: text }),
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
      <!-- Title reuses the workspace chatbot key so both panels read
           "Creative Assistant" / "创意助手" in lock-step. -->
      <h2 class="ap-title">{{ t('chatbot.title') }}</h2>
    </div>

    <div class="ap-body">
      <!-- Identity: just the mascot avatar now. Bot name & role
           lines were dropped — the panel header above already
           establishes "Creative Assistant" branding. -->
      <div class="ap-identity">
        <div class="ap-avatar">
          <img :src="botAvatarUrl" :alt="t('brand.name')" />
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
        {{ t('part3.animationPanel.noAttempts') }}
      </div>

      <!-- Loading indicator -->
      <div v-if="store.animationLoading" class="ap-generating">
        <div class="ap-spinner" />
        <span>{{ t('part3.animationPanel.generating') }}</span>
      </div>

      <!-- Suggestion chips (show when there are attempts left) -->
      <div v-if="store.remainingAttempts > 0 && !store.animationLoading" class="ap-suggestions">
        <p class="ap-suggest-label">{{ t('part3.animationPanel.suggestionsLabel') }}</p>
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

    <!-- Input.

         2026-06-08 — Story-first gate. The runtime `send()` guard
         already shows a toast if the teacher tries to design an
         animation before the story exists, but the input still
         *looked* enabled, which is a UX dead-end: the user types
         a paragraph, hits send, gets a toast, has to remember what
         she typed, navigate to the story panel, generate, and come
         back. Disabling the textarea + swapping the placeholder to
         "请先生成故事" makes the prerequisite obvious before any
         typing happens, and keeps the toast as the safety-net for
         programmatic / Enter-key edge cases. -->
    <div class="ap-input-area">
      <textarea
        v-model="inputText"
        class="ap-input"
        :placeholder="
          !store.storyData
            ? (locale === 'zh'
                ? '请先在左侧生成故事，再来设计动画 ☺'
                : 'Generate the story on the left first, then design the animation ☺')
            : t('part3.animationPanel.inputPlaceholder')
        "
        rows="3"
        :disabled="!store.storyData || store.remainingAttempts <= 0 || store.animationLoading"
        @keydown="onKeydown"
      />
      <button
        class="ap-send-btn"
        :disabled="!store.storyData || !inputText.trim() || store.remainingAttempts <= 0 || store.animationLoading"
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
  background: #fff;
}

.ap-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
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
