<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { usePart3Store } from '@/stores/part3'
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

let ttsAudio:     HTMLAudioElement | null = null
let ttsObjectUrl: string | null           = null

const ttsReadText = computed(() => {
  const sd = store.storyData
  if (!sd) return ''
  return store.activeContinuation
    ? `${sd.part1}\n\n${store.activeContinuation}`
    : sd.part1
})

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
  ttsSpeaking.value = false
  ttsPaused.value   = false
}

async function ttsPlay() {
  ttsError.value = null

  // resume if paused
  if (ttsPaused.value && ttsAudio) {
    await ttsAudio.play()
    ttsPaused.value = false
    return
  }

  _cleanupAudio()
  ttsLoading.value = true

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
      throw new Error(err.detail ?? 'TTS request failed')
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
    ttsError.value = e.message
    _cleanupAudio()
  } finally {
    ttsLoading.value = false
  }
}

function ttsPause() {
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
    <div v-else-if="activeTab === 'design'" class="sp-body">
      <h3 class="sp-section-title">{{ t('part3.storyPanel.designRationale') }}</h3>
      <p class="sp-text">{{ store.storyData.designRationale }}</p>
    </div>

    <!-- Sound Design tab -->
    <div v-else class="sp-body">

      <!-- TTS Player -->
      <h3 class="sp-section-title">{{ t('part3.storyPanel.ttsTitle') }}</h3>

      <div v-if="!ttsReadText" class="sp-tts-empty">
        {{ t('part3.storyPanel.ttsNoText') }}
      </div>

      <template v-else>
        <!-- Voice selector (4 Doubao voices, always available) -->
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
            :disabled="ttsLoading || (ttsSpeaking && !ttsPaused)"
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

      <!-- AI ambient sound suggestions -->
      <div class="sp-tts-divider" />
      <h3 class="sp-section-title">{{ t('part3.storyPanel.aiSuggestionsTitle') }}</h3>
      <p class="sp-text" style="white-space: pre-line;">{{ store.storyData.soundDesign }}</p>
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

.sp-tts-divider {
  height: 1px;
  background: #d1fae5;
  margin: 4px 0;
}
</style>
