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

// 2026-05 — id of the most-recent message that carries a proposed
// style triple. Only this message's Confirm button is "active" while
// the teacher is still in reviewing phase; earlier proposals' Confirm
// buttons go grey to match the state machine.
const latestProposalMsgId = computed<number | null>(() => {
  for (let i = store.messages.length - 1; i >= 0; i--) {
    const m = store.messages[i]
    if (m.proposedStyles && m.proposedStyles.length > 0) return m.id
  }
  return null
})

// 2026-05 — whether to render a "为我推荐这节课的风格转换方案" chip
// under an AI message. Only true when:
//   • the message is an assistant turn (excluding the greeting which
//     already shows its own intent chips), AND
//   • we are still in pre-recommend phase, AND
//   • the message did NOT itself bring proposed_styles (recommend turn).
// In any other phase (reviewing / locked) no follow-up chip is shown,
// which keeps the chat clean once the teacher has been recommended a
// set or has already confirmed one.
function showRecommendChipFor(msg: { id: number; role: string; intentChips?: any; proposedStyles?: any }) {
  if (store.phase !== 'pre-recommend') return false
  if (msg.role !== 'assistant') return false
  if (msg.intentChips?.length) return false
  if (msg.proposedStyles?.length) return false
  return true
}

function onRecommendFollowUp() {
  void send(t('part6.bot.intents.recommend'), 'recommend')
}

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
 * Click handler for the proposed-style chips on an assistant message.
 *
 * Behaviour (2026-05 redesign):
 *   1. Open / switch / collapse the per-message preview box
 *      (`store.setPreview` does the toggle bookkeeping).
 *   2. After the teacher has confirmed THIS message's style set,
 *      clicking a chip *also* moves the global `selectedStyleIdx`
 *      so the matching pig in the middle canvas gets highlighted
 *      (parity with the old UI).
 *
 * Crucially this works even before the set is confirmed — the
 * preview box opens regardless. The pig highlight just doesn't
 * fire because `store.styles` is still empty.
 */
function selectChip(msgId: number, idx: number) {
  store.setPreview(msgId, idx)
  // Mirror to the confirmed selection only if the user has actually
  // applied this set (i.e. the styles array matches this message).
  const msg = store.messages.find(m => m.id === msgId)
  if (msg?.confirmed && store.styles.length > idx) {
    store.selectedStyleIdx = idx
  }
}

function confirmFromMessage(msgId: number) {
  store.confirmStyles(msgId)
  // Auto-select the first style so the teacher can press
  // "开始转换" immediately without an extra click.
  if (store.styles.length > 0 && store.selectedStyleIdx === null) {
    store.selectedStyleIdx = 0
  }
}

/**
 * 2026-05-29 — Prompt-preview edit helpers.
 *
 * `onPromptInput` writes the textarea's current value into the
 * message's `proposedStyles[idx].promptZhEdited` via the store. We
 * pass through the store rather than v-modeling the nested object
 * directly so the autosave watcher in CreateLesson.vue picks the
 * mutation up (it deep-watches `part6Store.messages`).
 *
 * `isPromptEdited` returns true when the teacher's edit differs
 * from the original `promptZh` (after trimming). Used to gate the
 * "已编辑" badge + "重置" link + "重新确认" button.
 *
 * `displayPrompt` is what we feed the textarea: the edited version
 * if it exists, otherwise the default ZH. We don't lazily initialise
 * `promptZhEdited` until the teacher actually types — that way an
 * untouched chip still reports `isPromptEdited === false` and the
 * "已编辑" badge stays hidden.
 */
function displayPrompt(msg: { proposedStyles?: any[] }, idx: number): string {
  const style = msg.proposedStyles?.[idx]
  if (!style) return ''
  return style.promptZhEdited ?? style.promptZh ?? ''
}

function isPromptEdited(msg: { proposedStyles?: any[] }, idx: number): boolean {
  const style = msg.proposedStyles?.[idx]
  if (!style) return false
  const edited = (style.promptZhEdited ?? '').trim()
  if (!edited) return false
  return edited !== (style.promptZh ?? '').trim()
}

function onPromptInput(msgId: number, idx: number, ev: Event) {
  const target = ev.target as HTMLTextAreaElement
  store.setPromptEdit(msgId, idx, target.value)
}

function onPromptReset(msgId: number, idx: number) {
  store.resetPromptEdit(msgId, idx)
}

/**
 * 2026-05-29 — Re-apply edits that were made AFTER the teacher
 * confirmed the style set. `confirmStyles()` deep-copies the
 * message's proposedStyles into `styles[]`, so post-confirm edits
 * to the message don't automatically reach the pigs / convert()
 * call. Clicking this button just re-runs `confirmStyles(msgId)`
 * for the same message, which re-copies the (now-edited) version.
 */
function reconfirmFromMessage(msgId: number) {
  store.confirmStyles(msgId)
}

/**
 * 2026-05-29 — Should we show the "重新确认" hint button under the
 * preview textarea?
 *
 *   Only when:
 *     1. This message is the one currently confirmed
 *        (confirmedMessageId === msg.id), AND
 *     2. The teacher has edited the prompt of the currently-open
 *        chip AFTER confirming — i.e. the message-level edit and
 *        the confirmed `styles[idx].promptZhEdited` are out of sync.
 */
function needsReconfirm(msg: { id: number; proposedStyles?: any[]; previewIdx?: number | null }): boolean {
  if (store.confirmedMessageId !== msg.id) return false
  const idx = msg.previewIdx
  if (idx === null || idx === undefined) return false
  const msgEdited = (msg.proposedStyles?.[idx]?.promptZhEdited ?? '').trim()
  const confirmedEdited = (store.styles[idx]?.promptZhEdited ?? '').trim()
  return msgEdited !== confirmedEdited
}


/**
 * 2026-05 — should the Confirm button on this proposal message still
 * be clickable? Rules:
 *   • If the teacher has already locked a set (`confirmedMessageId`
 *     non-null), ONLY that one message shows "已确认 ✓"; every other
 *     Confirm button is disabled but visible (so the teacher can see
 *     the history).
 *   • While reviewing (no lock yet), only the LATEST proposal's
 *     Confirm is clickable; earlier proposals show a greyed Confirm.
 */
function isConfirmActive(msg: { id: number; confirmed?: boolean }) {
  if (store.confirmedMessageId !== null) {
    // Locked: only the confirmed message reads "已确认 ✓"; the rest
    // are disabled (msg.confirmed === false).
    return false
  }
  return msg.id === latestProposalMsgId.value
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

          <!-- Proposed-style chips + preview box + confirm button.
               Rendered on every assistant message that came back from
               /api/part6/chat with `proposed_styles` non-null. Chips
               stay clickable (for the preview box) regardless of
               phase, but the Confirm button follows the state machine
               described in `isConfirmActive()` above. -->
          <template v-if="msg.proposedStyles?.length">
            <div class="ap-chips">
              <button
                v-for="(style, idx) in msg.proposedStyles"
                :key="`${msg.id}-${style.label}-${idx}`"
                class="ap-chip"
                :class="{
                  'ap-chip--preview': msg.previewIdx === idx,
                  'ap-chip--active': msg.confirmed && selectedStyle?.label === style.label,
                }"
                @click="selectChip(msg.id, idx)"
              >
                <span class="ap-chip-dot" />{{ style.label }}
              </button>
            </div>

            <!-- 提示词预览 box.
                 2026-05-29 — Upgraded from a read-only paragraph to
                 a free-form editable textarea. The teacher can rewrite
                 the prompt that gets sent to Doubao Seedream i2i, or
                 leave it untouched to use the default. Edits live on
                 `msg.proposedStyles[idx].promptZhEdited` and are
                 preserved across chip switches, project switches, and
                 device switches (autosave watcher already deep-watches
                 `messages`). See store helpers `setPromptEdit` /
                 `resetPromptEdit` for the mutation paths. -->
            <div
              v-if="msg.previewIdx !== null && msg.previewIdx !== undefined"
              class="ap-preview-box"
            >
              <p class="ap-preview-label">
                {{ t('part6.bot.previewLabel', { name: msg.proposedStyles[msg.previewIdx]?.label }) }}
              </p>
              <textarea
                class="ap-preview-textarea"
                :value="displayPrompt(msg, msg.previewIdx)"
                :placeholder="t('part6.bot.previewEmpty')"
                rows="8"
                @input="onPromptInput(msg.id, msg.previewIdx, $event)"
              />
              <!-- "已编辑" badge + reset link + (if confirmed AND edited
                   after confirm) the "重新确认" reapply button. -->
              <div v-if="isPromptEdited(msg, msg.previewIdx)" class="ap-preview-meta">
                <span class="ap-preview-edited-badge">
                  ✎ {{ t('part6.bot.previewEdited') }}
                </span>
                <button
                  type="button"
                  class="ap-preview-reset-btn"
                  @click="onPromptReset(msg.id, msg.previewIdx)"
                >
                  {{ t('part6.bot.previewReset') }}
                </button>
                <button
                  v-if="needsReconfirm(msg)"
                  type="button"
                  class="ap-preview-reconfirm-btn"
                  @click="reconfirmFromMessage(msg.id)"
                >
                  {{ t('part6.bot.previewReconfirm') }}
                </button>
              </div>
            </div>

            <!-- Confirm button. Only the *latest* proposal in
                 reviewing phase is clickable; older proposals show
                 grey-disabled. Once locked, the chosen message shows
                 "已确认 ✓" and all others stay grey-disabled. -->
            <button
              class="ap-confirm-btn"
              :class="{ 'ap-confirm-btn--done': msg.confirmed }"
              :disabled="!isConfirmActive(msg)"
              @click="confirmFromMessage(msg.id)"
            >
              {{ msg.confirmed ? t('part6.bot.stylesConfirmed') : t('part6.bot.confirmStyles') }}
            </button>
          </template>

          <!-- 2026-05 — follow-up "为我推荐方案" chip. Appears under
               every assistant reply during the pre-recommend phase
               (except the initial greeting, which already shows its
               own 3 intent chips). Disappears the moment the teacher
               triggers a recommendation. -->
          <div v-if="showRecommendChipFor(msg)" class="ap-chips ap-chips--followup">
            <button
              class="ap-chip ap-chip--intent ap-chip--followup"
              :disabled="store.chatLoading"
              @click="onRecommendFollowUp"
            >
              <span class="ap-chip-dot" />{{ t('part6.bot.intents.recommend') }}
            </button>
          </div>
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
/* Follow-up "为我推荐方案" chip rendered under non-greeting AI replies
   during pre-recommend phase. Visually identical to the intent chips
   but with a touch more breathing room above. */
.ap-chips--followup { margin-top: 12px; }
.ap-chip--followup  { font-weight: 600; }

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
/* Lighter "selected for preview" state — chip is the one currently
   open in the preview box. Different from --active (the pig the
   teacher is about to convert) because preview can be clicked
   before any style set is confirmed. */
.ap-chip--preview             { background: #f0fdf4; border-color: #16a34a; box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.15); }
.ap-chip:disabled             { opacity: 0.65; cursor: default; }

/* 提示词预览 box — rendered under the chips when `msg.previewIdx`
   is set. Soft white card so the (potentially long) Chinese
   description has room to breathe without competing with the
   bubble background. */
.ap-preview-box {
  margin-top: 10px;
  padding: 10px 12px;
  background: #ffffff;
  border: 1px solid #d1fadf;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.ap-preview-label {
  margin: 0 0 6px 0;
  font-size: 12px;
  font-weight: 600;
  color: #15803d;
}
.ap-preview-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #1f2937;
  white-space: pre-line;
}

/* 2026-05-29 — Editable preview textarea. Visually identical to the
   former read-only paragraph (so the teacher recognises this as the
   same prompt-preview surface) but with a hairline focus ring + the
   ability to grow vertically. The textarea inherits the panel's
   font-family so Chinese punctuation renders exactly as before. */
.ap-preview-textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid #d1fadf;
  border-radius: 8px;
  background: #fefffe;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  color: #1f2937;
  resize: vertical;
  min-height: 180px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.ap-preview-textarea:focus {
  border-color: #16a34a;
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.12);
}
.ap-preview-textarea::placeholder {
  color: #9ca3af;
}

/* "已编辑" status row sits directly under the textarea. Only renders
   when the teacher has changed the prompt vs the default. */
.ap-preview-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.ap-preview-edited-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #dcfce7;
  color: #15803d;
  font-size: 11px;
  font-weight: 600;
}
.ap-preview-reset-btn {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  text-decoration: underline;
}
.ap-preview-reset-btn:hover { color: #111827; }

/* "重新确认" reapply button — only renders when the teacher edited
   AFTER the styles were confirmed (so the pigs in the middle still
   hold the stale prompt). Styled as a subtle pill, distinct from
   the big green confirm button so it doesn't compete visually. */
.ap-preview-reconfirm-btn {
  margin-left: auto;
  padding: 4px 12px;
  background: #fff;
  border: 1.5px solid #16a34a;
  border-radius: 999px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: #15803d;
  cursor: pointer;
}
.ap-preview-reconfirm-btn:hover { background: #f0fdf4; }

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
