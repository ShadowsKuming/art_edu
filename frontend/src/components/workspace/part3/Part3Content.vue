<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePart3Store } from '@/stores/part3'
import { useSlideStore } from '@/stores/slides'

const props = defineProps<{ mode: 'story' | 'animation' }>()
const emit  = defineEmits<{ 'update:mode': [mode: 'story' | 'animation'] }>()

const store      = usePart3Store()
const slideStore = useSlideStore()

const selectedVersionIdx = ref<number | null>(null)

const activeVideoUrl = computed(() => {
  if (selectedVersionIdx.value === null) return null
  const v = store.animationVersions[selectedVersionIdx.value]
  return v?.status === 'done' ? v.videoUrl : null
})

function selectVersion(i: number) {
  if (store.animationVersions[i]?.status === 'done') {
    selectedVersionIdx.value = i
  }
}

function openFilePicker() {
  const input = document.createElement('input')
  input.type  = 'file'
  input.accept = 'image/*'
  input.style.cssText = 'position:fixed;top:-999px;left:-999px;'
  document.body.appendChild(input)
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.remove()
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { store.setImage(reader.result as string); selectedVersionIdx.value = null }
    reader.readAsDataURL(file)
  })
  input.click()
}

async function onGenerateStory() {
  emit('update:mode', 'story')
  await store.generateStory()
}

async function onGenerateAnimation() {
  emit('update:mode', 'animation')
  await store.generateAnimation()
}

function saveAndNext() {
  if (activeVideoUrl.value) {
    store.saveChosenVideo(activeVideoUrl.value)
  }
  slideStore.navigateToNextPart()
}
</script>

<template>
  <section class="p3-content">
    <div class="p3-canvas-area">

      <!-- Image display -->
      <div class="p3-image-wrap">
        <div v-if="!store.imageDataUrl" class="p3-upload-placeholder" @click="openFilePicker">
          <svg viewBox="0 0 48 48" fill="none" class="p3-upload-icon">
            <rect x="4" y="10" width="40" height="28" rx="4" stroke="#9ca3af" stroke-width="2"/>
            <circle cx="17" cy="21" r="4" stroke="#9ca3af" stroke-width="2"/>
            <path d="M4 34l10-10 8 8 6-6 16 12" stroke="#9ca3af" stroke-width="2" stroke-linejoin="round"/>
          </svg>
          <p class="p3-upload-label">Click to upload artwork image</p>
        </div>

        <template v-else>
          <!-- Show video player when a completed animation is selected -->
          <video
            v-if="activeVideoUrl"
            :src="activeVideoUrl"
            class="p3-image"
            controls
            autoplay
            loop
          />
          <!-- Otherwise show the static image -->
          <img v-else :src="store.imageDataUrl" class="p3-image" />
          <button class="p3-reupload-btn" title="Replace image" @click="openFilePicker">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M13 8A5 5 0 112 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M13 4v4h-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </template>
      </div>

      <!-- Attempt counter -->
      <p v-if="mode === 'animation' && store.imageDataUrl" class="p3-attempt-counter">
        Remaining animation attempts: {{ store.remainingAttempts }} / 3
      </p>

      <!-- Mode buttons -->
      <div class="p3-action-row">
        <button
          class="p3-mode-btn"
          :class="{ 'p3-mode-btn--active': mode === 'story' }"
          :disabled="!store.imageDataUrl || store.storyLoading"
          @click="onGenerateStory"
        >
          <svg viewBox="0 0 20 20" fill="none" class="p3-btn-icon">
            <path d="M4 5h12M4 8h8M4 11h10M4 14h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span v-if="store.storyLoading && mode === 'story'">Generating…</span>
          <span v-else>Generate Story</span>
        </button>

        <button
          class="p3-mode-btn"
          :class="{ 'p3-mode-btn--active': mode === 'animation' }"
          :disabled="!store.imageDataUrl || store.remainingAttempts <= 0 || store.animationLoading"
          @click="onGenerateAnimation"
        >
          <svg viewBox="0 0 20 20" fill="none" class="p3-btn-icon">
            <rect x="2" y="5" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M14 8l4-2v8l-4-2V8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          <span v-if="store.animationLoading && mode === 'animation'">Generating…</span>
          <span v-else>Generate Animation</span>
        </button>
      </div>

      <!-- Error messages -->
      <p v-if="mode === 'story' && store.storyError" class="p3-error">{{ store.storyError }}</p>
      <p v-if="mode === 'animation' && store.animationError" class="p3-error">{{ store.animationError }}</p>

      <!-- Animation version picker -->
      <div v-if="mode === 'animation' && store.animationVersions.length" class="p3-anim-versions">
        <div
          v-for="(v, i) in store.animationVersions"
          :key="v.taskId"
          class="p3-anim-thumb"
          :class="{
            'p3-anim-thumb--pending':  v.status === 'pending',
            'p3-anim-thumb--failed':   v.status === 'failed',
            'p3-anim-thumb--selected': selectedVersionIdx === i,
          }"
          @click="selectVersion(i)"
        >
          <img v-if="store.imageDataUrl" :src="store.imageDataUrl" class="p3-anim-thumb-img" />
          <div class="p3-anim-thumb-overlay" />
          <div v-if="v.status === 'pending'" class="p3-anim-spinner" />
          <!-- Play icon for done versions -->
          <div v-if="v.status === 'done'" class="p3-anim-play-icon">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.45)"/>
              <path d="M10 8.5l6 3.5-6 3.5V8.5z" fill="#fff"/>
            </svg>
          </div>
          <span class="p3-anim-label">
            {{ v.status === 'pending' ? 'Processing…' : v.status === 'failed' ? 'Failed' : `Animation ${i + 1}` }}
          </span>
        </div>
      </div>

    </div>

    <div class="p3-footer">
      <button class="p3-save-btn" @click="saveAndNext">Save &amp; Next</button>
    </div>
  </section>
</template>

<style scoped>
.p3-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #F3F4F4;
  background-image: radial-gradient(circle, rgba(0,0,0,0.25) 1px, transparent 1px);
  background-size: 24px 24px;
  box-shadow: inset 0px 0px 3px 2px rgb(0 0 0 / 10%), inset 0px 0px 1px 0px rgba(0,0,0,0.60);
}

.p3-canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 40px 32px 16px;
  gap: 16px;
  overflow-y: auto;
}

.p3-image-wrap {
  width: 100%;
  max-width: 760px;
  aspect-ratio: 16 / 9;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}

.p3-upload-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  cursor: pointer;
  border: 2px dashed #d1d5db;
  border-radius: 14px;
  box-sizing: border-box;
}

.p3-upload-placeholder:hover { border-color: #7FEC8F; }

.p3-upload-icon { width: 48px; height: 48px; }

.p3-upload-label { font-size: 14px; color: #9ca3af; margin: 0; }

.p3-image { width: 100%; height: 100%; object-fit: cover; display: block; }

.p3-play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.p3-play-btn svg { width: 64px; height: 64px; }

.p3-reupload-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0,0,0,0.4);
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
}

.p3-reupload-btn:hover { background: rgba(0,0,0,0.6); }

.p3-attempt-counter {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
  align-self: flex-end;
  max-width: 760px;
  width: 100%;
  text-align: right;
}

.p3-action-row { display: flex; gap: 10px; }

.p3-mode-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 18px;
  border-radius: 999px;
  border: 1.5px solid #d1d5db;
  background: #fff;
  font-size: 14px;
  font-family: inherit;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
}

.p3-mode-btn:hover:not(:disabled) { border-color: #7FEC8F; }
.p3-mode-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.p3-mode-btn--active {
  background: #7FEC8F;
  border-color: #7FEC8F;
  color: #000;
  box-shadow: 2px 1px 2px rgba(0,0,0,0.1);
}

.p3-btn-icon { width: 16px; height: 16px; }

.p3-error {
  margin: 0;
  font-size: 12px;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 6px 12px;
  max-width: 760px;
}

.p3-anim-versions { display: flex; gap: 12px; max-width: 760px; }

.p3-anim-thumb {
  width: 160px;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #e5e7eb;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  box-shadow: 0 1px 6px rgba(0,0,0,0.1);
}

.p3-anim-thumb:hover { border-color: #B2F4BC; }
.p3-anim-thumb--pending  { border-color: #fbbf24; cursor: default; }
.p3-anim-thumb--failed   { border-color: #f87171; opacity: 0.7; cursor: default; }
.p3-anim-thumb--selected { border-color: #7FEC8F; box-shadow: 0 0 0 2px #7FEC8F; }

.p3-anim-thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }

.p3-anim-thumb-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.08); }

.p3-anim-spinner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.3);
}

.p3-anim-spinner::after {
  content: '';
  width: 20px;
  height: 20px;
  border: 2.5px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.p3-anim-play-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.p3-anim-play-icon svg { width: 32px; height: 32px; }

.p3-anim-label {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.6);
}

.p3-footer {
  padding: 16px 32px;
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.p3-save-btn {
  height: 44px;
  padding: 0 28px;
  background: #7FEC8F;
  color: #000;
  border: none;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 2px 3px 6px rgba(0,0,0,0.12);
}

.p3-save-btn:hover { transform: translateY(-1px) scale(1.02); }
</style>
