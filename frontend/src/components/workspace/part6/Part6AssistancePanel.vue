<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { usePart6Store, type ChatIntent } from '@/stores/part6'
import { useI18n } from 'vue-i18n'

// Same purpose-built mascot used by WorkspaceChatbot (Parts 1/2/4/5).
import botAvatarUrl from '@/assets/images/avatar-artbloom.png'

const store = usePart6Store()
const { t, locale } = useI18n()

// ── Bootstrap the chat once on mount ─────────────────────────────
//
// The store keeps message history across panel unmount/remount, so
// we only seed the greeting + 3 intent chips on first mount of the
// entire app session. `initChat` itself is idempotent, but we also
// re-seed if the locale changes so the canned chip labels stay in
// the active language.
function seedGreeting() {
  store.initChat(
    [
      { key: 'recommend', label: t('part6.bot.intents.recommend') },
      { key: 'skills', label: t('part6.bot.intents.skills') },
      { key: 'styles', label: t('part6.bot.intents.styles') },
    ],
    t('part6.bot.greeting'),
  )
}
onMounted(seedGreeting)
// If the teacher toggles the language while no conversation has
// happened yet, swap the chip labels to the new locale. (Once they
// have real chat turns, leave the history alone — translating it
// mid-conversation would be jarring.)
watch(locale, () => {
  if (store.messages.length === 1 && store.messages[0].intentChips) {
    store.messages.splice(0, store.messages.length)
    seedGreeting()
  }
})

const selectedStyle = computed(() =>
  store.selectedStyleIdx !== null ? store.styles[store.selectedStyleIdx] : null,
)

const input = ref('')
const scrollEl = ref<HTMLElement | null>(null)

function scrollBottom() {
  nextTick(() => scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' }))
}

// Any time the message list grows, push the scroll to the bottom so
// the latest bubble is visible (matches the WorkspaceChatbot UX).
watch(() => store.messages.length, scrollBottom)
watch(() => store.chatLoading, scrollBottom)

async function send(text?: string, intent?: ChatIntent) {
  const content = (text ?? input.value).trim()
  if (!content) return
  input.value = ''
  await store.sendChat(content, intent, locale.value)
}

/**
 * Click handler for the three intent chips on the greeting bubble.
 * We pass the chip *label* as the user message (so it appears in the
 * conversation as if the teacher typed it) AND the intent key (so the
 * backend short-circuits / steers the LLM appropriately).
 */
function onIntentChip(chip: { key: ChatIntent; label: string }) {
  void send(chip.label, chip.key)
}

/**
 * Click handler for the chip-cluster of proposed styles on an
 * assistant message — flips the active style index so the small
 * green dot moves to the chosen chip (parity with the old UI).
 */
function selectChip(label: string) {
  const idx = store.styles.findIndex(s => s.label === label)
  if (idx !== -1) store.selectedStyleIdx = idx
}

function confirmFromMessage(msgId: number) {
  store.confirmStyles(msgId)
  // Auto-select the first style so the teacher can press
  // "开始转换" immediately without an extra click.
  if (store.styles.length > 0 && store.selectedStyleIdx === null) {
    store.selectedStyleIdx = 0
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void send()
  }
}
</script>

<template>
  <div class="ap-panel">

    <div class="ap-header">
      <span class="ap-title">{{ t('chatbot.title') }}</span>
    </div>

    <!-- Bot identity simplified to match WorkspaceChatbot (Parts
         1/2/4/5): only the mascot avatar is rendered, no name caption. -->
    <div class="ap-identity">
      <img :src="botAvatarUrl" :alt="t('brand.name')" class="ap-avatar" />
    </div>

    <div ref="scrollEl" class="ap-body">
      <div
        v-for="msg in store.messages"
        :key="msg.id"
        class="message-row"
        :class="msg.role === 'user' ? 'message-row--user' : 'message-row--assistant'"
      >
        <div
          class="message-bubble"
          :class="msg.role === 'user' ? 'bubble--user' : 'bubble--assistant'"
        >
          <p class="bubble-text" style="white-space: pre-line;">{{ msg.text }}</p>

          <!-- Intent chips (only on the greeting message) -->
          <div v-if="msg.intentChips?.length" class="ap-chips ap-chips--intents">
            <button
              v-for="chip in msg.intentChips"
              :key="chip.key"
              class="ap-chip ap-chip--intent"
              :disabled="store.chatLoading"
              @click="onIntentChip(chip)"
            >
              <span class="ap-chip-dot" />{{ chip.label }}
            </button>
          </div>

          <!-- Proposed-style chips + confirm button.
               Rendered on every assistant message that came back from
               /api/part6/chat with `proposed_styles` non-null. -->
          <template v-if="msg.proposedStyles?.length">
            <div class="ap-chips">
              <button
                v-for="style in msg.proposedStyles"
                :key="style.label"
                class="ap-chip"
                :class="{ 'ap-chip--active': msg.confirmed && selectedStyle?.label === style.label }"
                :disabled="!msg.confirmed"
                @click="selectChip(style.label)"
              >
                <span class="ap-chip-dot" />{{ style.label }}
              </button>
            </div>
            <button
              class="ap-confirm-btn"
              :class="{ 'ap-confirm-btn--done': msg.confirmed }"
              :disabled="msg.confirmed"
              @click="confirmFromMessage(msg.id)"
            >
              {{ msg.confirmed ? t('part6.bot.stylesConfirmed') : t('part6.bot.confirmStyles') }}
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Typing indicator -->
    <div v-if="store.chatLoading" class="typing-indicator">
      <span /><span /><span />
    </div>

    <div class="ap-input-area">
      <textarea
        v-model="input"
        class="ap-input"
        :placeholder="t('chatbot.placeholder')"
        rows="2"
        :disabled="store.chatLoading"
        @keydown="onKeydown"
      />
      <button
        class="ap-send-btn"
        :disabled="!input.trim() || store.chatLoading"
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
.ap-chips--intents { margin-top: 12px; }

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

.ap-chip:hover:not(:disabled) { background: #f0fdf4; border-color: #7FEC8F; }
.ap-chip--active              { background: #7FEC8F; border-color: #7FEC8F; font-weight: 600; }
.ap-chip:disabled             { opacity: 0.65; cursor: default; }

/* Intent chips look slightly more "button-like" — they are
   primary CTAs on the greeting bubble, not just toggles. */
.ap-chip--intent {
  background: #fff;
  border-color: #16a34a;
  color: #15803d;
  font-weight: 500;
}
.ap-chip--intent:hover:not(:disabled) {
  background: #16a34a;
  color: #fff;
}

.ap-chip-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  flex-shrink: 0;
}

.ap-chip--active .ap-chip-dot { background: #16a34a; }

/* Confirm button — appears under a chip cluster of proposed
   styles. Bright green so the teacher knows this is the action
   that drops the 3 pigs into the middle canvas. */
.ap-confirm-btn {
  margin-top: 10px;
  padding: 9px 18px;
  border-radius: 999px;
  border: none;
  background: linear-gradient(180deg, #22c55e 0%, #16a34a 100%);
  color: #fff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(22, 163, 74, 0.25);
}

.ap-confirm-btn:hover:not(:disabled) {
  filter: brightness(1.05);
}

.ap-confirm-btn:disabled {
  cursor: default;
  opacity: 0.85;
}

.ap-confirm-btn--done {
  background: #e5e7eb;
  color: #6b7280;
  box-shadow: none;
}

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
