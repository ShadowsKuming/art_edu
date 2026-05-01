<script setup lang="ts">
import { computed } from 'vue'
import { usePart5Store } from '@/stores/part5'
import { useSlideStore } from '@/stores/slides'

const store = usePart5Store()
const slideStore = useSlideStore()

const slideStyle = computed(() => {
  if (slideStore.globalBackground) {
    return {
      backgroundImage: `url(${slideStore.globalBackground})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  if (slideStore.globalBgColor) {
    return { backgroundColor: slideStore.globalBgColor }
  }
  return { backgroundColor: '#ffffff' }
})

function openVideoPicker() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'video/*'
  input.style.cssText = 'position:fixed;top:-999px;left:-999px;'
  document.body.appendChild(input)
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.remove()
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => store.setVideo(reader.result as string, file.name)
    reader.readAsDataURL(file)
  })
  input.click()
}

function saveAndNext() {
  slideStore.navigateToNextPart()
}
</script>

<template>
  <section class="p5-content">
    <div class="p5-canvas-area">

      <!-- Slide preview with global theme background -->
      <div class="p5-slide-preview" :style="slideStyle">
        <div class="p5-slide-title">Making Example</div>

        <!-- Video area -->
        <div class="p5-video-area">
          <video
            v-if="store.videoDataUrl"
            :src="store.videoDataUrl"
            class="p5-video"
            controls
          />
          <div v-else class="p5-video-placeholder" @click="openVideoPicker">
            <svg viewBox="0 0 48 48" fill="none" class="p5-upload-icon">
              <rect x="4" y="10" width="30" height="22" rx="3" stroke="#9ca3af" stroke-width="2"/>
              <path d="M34 18l10-5v18l-10-5V18z" stroke="#9ca3af" stroke-width="2" stroke-linejoin="round"/>
            </svg>
            <p class="p5-video-placeholder-label">Click to upload instruction video</p>
          </div>
        </div>
      </div>

      <!-- Re-upload button below slide when video is present -->
      <div v-if="store.videoDataUrl" class="p5-reupload-row">
        <span class="p5-video-name">{{ store.videoName }}</span>
        <button class="p5-reupload-btn" @click="openVideoPicker">Replace video</button>
      </div>

    </div>

    <div class="p5-footer">
      <button class="p5-save-plain-btn" @click="() => {}">Save</button>
      <button class="p5-save-btn" @click="saveAndNext">Save &amp; Next</button>
    </div>
  </section>
</template>

<style scoped>
.p5-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #F3F4F4;
  background-image: radial-gradient(circle, rgba(0,0,0,0.25) 1px, transparent 1px);
  background-size: 24px 24px;
  box-shadow: inset 0px 0px 3px 2px rgb(0 0 0 / 10%), inset 0px 0px 1px 0px rgba(0,0,0,0.60);
}

.p5-canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 40px 32px 16px;
  gap: 16px;
  overflow-y: auto;
}

.p5-slide-preview {
  width: 100%;
  max-width: 760px;
  aspect-ratio: 16 / 9;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.14);
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 32px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.p5-slide-title {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 16px;
  flex-shrink: 0;
  text-shadow: 0 1px 3px rgba(255,255,255,0.6);
}

.p5-video-area {
  flex: 1;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(0,0,0,0.08);
  min-height: 0;
}

.p5-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  background: #000;
}

.p5-video-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  border: 2px dashed #d1d5db;
  border-radius: 10px;
  box-sizing: border-box;
  min-height: 120px;
}

.p5-video-placeholder:hover { border-color: #7FEC8F; }

.p5-upload-icon { width: 48px; height: 48px; }

.p5-video-placeholder-label {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}

.p5-reupload-row {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 760px;
  width: 100%;
}

.p5-video-name {
  font-size: 13px;
  color: #6b7280;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p5-reupload-btn {
  height: 32px;
  padding: 0 16px;
  background: #e6e6e6;
  border: none;
  border-radius: 999px;
  font-size: 13px;
  font-family: inherit;
  color: #374151;
  cursor: pointer;
  white-space: nowrap;
}

.p5-reupload-btn:hover { background: #d8d8d8; }

.p5-footer {
  padding: 16px 32px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.p5-save-plain-btn {
  height: 44px;
  padding: 0 24px;
  background: #e6e6e6;
  color: #374151;
  border: none;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.p5-save-plain-btn:hover { background: #d8d8d8; }

.p5-save-btn {
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

.p5-save-btn:hover { transform: translateY(-1px) scale(1.02); }
</style>
