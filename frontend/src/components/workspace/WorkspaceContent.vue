<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import SlideCanvas from './canvas/SlideCanvas.vue'
import ColorPicker from './ColorPicker.vue'
import { useSlideStore, CANVAS_W, CANVAS_H } from '@/stores/slides'
import { useI18n } from 'vue-i18n'

type Tool = 'text' | 'image' | 'video' | 'audio'
const activeTool = ref<Tool>('text')

const slideStore = useSlideStore()

const selectedEl = computed(() => slideStore.selectedElement)
const hasSlide = computed(() => !!slideStore.activeSlide)

function addElement() {
  if (!slideStore.activeSlideId) return
  slideStore.addElement(slideStore.activeSlideId, 'text')
}

function onToolClick(tool: Tool) {
  activeTool.value = tool
  showImageMenu.value = false
  if (tool === 'text') addElement()
}

// Properties bound to selected element, falls back to defaults
const fontFamily = computed({
  get: () => selectedEl.value?.fontFamily ?? 'Albert Sans',
  set: (v) => updateEl({ fontFamily: v }),
})
const fontWeight = computed({
  get: () => selectedEl.value?.fontWeight ?? 'Normal',
  set: (v) => updateEl({ fontWeight: v }),
})
const fontSize = computed({
  get: () => selectedEl.value?.fontSize ?? 24,
  set: (v) => updateEl({ fontSize: Number(v) }),
})
const textAlign = computed({
  get: () => selectedEl.value?.textAlign ?? 'left',
  set: (v) => updateEl({ textAlign: v as 'left' | 'center' | 'right' | 'justify' }),
})
const activeColor = computed({
  get: () => selectedEl.value?.color ?? '#111827',
  set: (v) => updateEl({ color: v }),
})

function updateEl(patch: Parameters<typeof slideStore.updateElement>[2]) {
  if (!slideStore.activeSlideId || !slideStore.selectedElementId) return
  slideStore.updateElement(slideStore.activeSlideId, slideStore.selectedElementId, patch)
}

const colorSwatches = ['#80506D', '#F5A7C7', '#F5C842', '#A7C7E7', '#C5E84A']
const showColorPicker = ref(false)

const showImageMenu = ref(false)
const showBgColorPicker = ref(false)
const bgColorDraft = ref('#ffffff')
const imageMenuAnchorEl = ref<HTMLElement | null>(null)

// 2026-05-28: `hasLocalBackground` and `resetToGlobal()` were removed
// alongside the master-slide / global-theme feature. Each slide's
// background is now fully independent — there is no "global theme"
// for an individual slide to override or revert to. See the
// matching deletion in `stores/slides.ts`.

function openBgColorPicker() {
  bgColorDraft.value = slideStore.activeSlide?.bgColor ?? '#ffffff'
  showBgColorPicker.value = true
  showImageMenu.value = false
}

function applyBgColor() {
  if (!slideStore.activeSlideId) return
  slideStore.setSlideBgColor(slideStore.activeSlideId, bgColorDraft.value)
  showBgColorPicker.value = false
}

function toggleImageMenu() {
  showImageMenu.value = !showImageMenu.value
  if (showImageMenu.value) activeTool.value = 'image'
}

function onDocClick(e: MouseEvent) {
  if (imageMenuAnchorEl.value && !imageMenuAnchorEl.value.contains(e.target as Node)) {
    showImageMenu.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

function pickImage(callback: (dataUrl: string, w: number, h: number) => void) {
  showImageMenu.value = false
  const slideId = slideStore.activeSlideId
  if (!slideId) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0;pointer-events:none;'
  document.body.appendChild(input)
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.remove()
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()
      img.onload = () => callback(dataUrl, img.naturalWidth, img.naturalHeight)
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
  input.click()
}

function uploadBackground() {
  pickImage((dataUrl) => {
    slideStore.setSlideBackground(slideStore.activeSlideId!, dataUrl)
    activeTool.value = 'image'
  })
}

function uploadImageElement() {
  pickImage((dataUrl, nw, nh) => {
    const maxW = CANVAS_W * 0.6
    const maxH = CANVAS_H * 0.6
    const scale = Math.min(maxW / nw, maxH / nh, 1)
    const w = Math.round(nw * scale)
    const h = Math.round(nh * scale)
    slideStore.addImageElement(slideStore.activeSlideId!, dataUrl, w, h)
    activeTool.value = 'image'
  })
}

// 2026-05-28: removed `generateImage()` — the "Generate image" entry in
// the image dropdown has been retired site-wide. There was never a
// backend for it (the handler was a stub that just closed the menu),
// and surfacing the button gave teachers the false impression the
// feature was coming. If/when a real image-gen service ships, restore
// both the function and the matching `<button class="image-menu-item">`
// in the template, plus the `content.imageMenu.generateImage` strings
// in `frontend/src/i18n/{zh,en}.ts`.

function uploadVideo() {
  const slideId = slideStore.activeSlideId
  if (!slideId) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'video/*'
  input.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0;pointer-events:none;'
  document.body.appendChild(input)
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.remove()
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const vid = document.createElement('video')
      vid.onloadedmetadata = () => {
        const maxW = CANVAS_W * 0.6
        const maxH = CANVAS_H * 0.6
        const scale = Math.min(maxW / (vid.videoWidth || 480), maxH / (vid.videoHeight || 270), 1)
        const w = Math.round((vid.videoWidth || 480) * scale)
        const h = Math.round((vid.videoHeight || 270) * scale)
        slideStore.addVideoElement(slideId, dataUrl, w, h)
      }
      vid.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
  input.click()
}

function uploadAudio() {
  const slideId = slideStore.activeSlideId
  if (!slideId) return
  // Toggle: if slide already has audio, remove it
  if (slideStore.activeSlide?.audioBg) {
    slideStore.setSlideAudio(slideId, undefined)
    return
  }
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'audio/*'
  input.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0;pointer-events:none;'
  document.body.appendChild(input)
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.remove()
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => slideStore.setSlideAudio(slideId, reader.result as string)
    reader.readAsDataURL(file)
  })
  input.click()
}
const { t } = useI18n()
const fontFamilies = ['Albert Sans', 'Plus Jakarta Sans', 'Inter', 'Noto Sans SC']
const fontWeights = ['Normal', 'Medium', 'Bold']
</script>

<template>
  <section class="content">

    <!-- Canvas area -->
    <div class="canvas-area">
      <div class="slide-viewport">
        <SlideCanvas />
      </div>
      <!-- Floating toolbar pill -->
      <div ref="imageMenuAnchorEl" class="toolbar-area">
        <div class="toolbar-pill">
          <div class="toolbar">
            <button
              class="tool-btn"
              :class="{ 'tool-btn--active': activeTool === 'text' }"
              :disabled="!hasSlide"
              @click.stop="onToolClick('text')"
            >
              <span class="tool-label-tt">Tt</span>
            </button>
            <button
              class="tool-btn"
              :class="{ 'tool-btn--active': activeTool === 'image' }"
              :disabled="!hasSlide"
              @click.stop="toggleImageMenu"
            >
              <svg viewBox="0 0 20 20" fill="none" class="tool-icon">
                <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>
                <circle cx="7" cy="8.5" r="1.5" fill="currentColor"/>
                <path d="M2 14l4-4 3 3 3-3 6 6" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </button>
            <button
              class="tool-btn"
              :class="{ 'tool-btn--active': activeTool === 'video' }"
              :disabled="!hasSlide"
              @click.stop="onToolClick('video'); uploadVideo()"
            >
              <svg viewBox="0 0 20 20" fill="none" class="tool-icon">
                <rect x="2" y="5" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
                <path d="M14 8l4-2v8l-4-2V8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </button>
            <button
              class="tool-btn"
              :class="{ 'tool-btn--active': activeTool === 'audio' || !!slideStore.activeSlide?.audioBg }"
              :disabled="!hasSlide"
              @click.stop="onToolClick('audio'); uploadAudio()"
            >
              <svg viewBox="0 0 20 20" fill="none" class="tool-icon">
                <path d="M9 4v12M6 7v6M3 9v2M12 6v8M15 8v4M18 9v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Image tool dropdown -->
        <div v-if="showImageMenu" class="image-menu" @click.stop>
          <p class="image-menu-section">{{ t('content.imageMenu.addAsElement') }}</p>
          <button class="image-menu-item" @click="uploadImageElement">
            <svg viewBox="0 0 20 20" fill="none" class="image-menu-icon">
              <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="7" cy="8.5" r="1.5" fill="currentColor"/>
              <path d="M2 14l4-4 3 3 3-3 6 6" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
            <span class="image-menu-label">{{ t('content.imageMenu.uploadImage') }}</span>
          </button>
          <!-- 2026-05-28: "Generate image" button removed site-wide
               (no backend, was a no-op stub). See the corresponding
               note next to the deleted `generateImage()` handler in
               the <script> block above. -->
          <div class="image-menu-divider" />
          <p class="image-menu-section">{{ t('content.imageMenu.slideBackground') }}</p>
          <button class="image-menu-item" @click="uploadBackground">
            <svg viewBox="0 0 20 20" fill="none" class="image-menu-icon">
              <path d="M10 13V4M10 4l-3 3M10 4l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3 14v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span class="image-menu-label">{{ t('content.imageMenu.uploadBackground') }}</span>
          </button>
          <button class="image-menu-item" @click="openBgColorPicker">
            <svg viewBox="0 0 20 20" fill="none" class="image-menu-icon">
              <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="10" cy="10" r="3.5" fill="currentColor"/>
            </svg>
            <span class="image-menu-label">{{ t('content.imageMenu.solidColor') }}</span>
          </button>
          <!-- 2026-05-28: "Reset to global theme" button removed
               site-wide together with the master-slide feature. See
               note next to the deleted `hasLocalBackground` /
               `resetToGlobal()` in the <script> block above. -->
        </div>

        <ColorPicker
          v-if="showBgColorPicker"
          v-model="bgColorDraft"
          @ok="applyBgColor"
          @cancel="showBgColorPicker = false"
        />
      </div>
      <!-- Properties panel -->
      <div class="editor-controls">
        <div class="properties-row">

          <template v-if="selectedEl?.type === 'text'">
            <div class="props-section">
              <div class="prop-group">
                <label class="prop-label">{{ t('content.fontFamily') }}</label>
                <select v-model="fontFamily" class="prop-select prop-select--wide">
                  <option v-for="f in fontFamilies" :key="f">{{ f }}</option>
                </select>
              </div>
              <div class="prop-group">
                <label class="prop-label">{{ t('content.weight') }}</label>
                <select v-model="fontWeight" class="prop-select">
                  <option v-for="w in fontWeights" :key="w">{{ w }}</option>
                </select>
              </div>
              <div class="prop-group">
                <label class="prop-label">{{ t('content.size') }}</label>
                <input v-model.number="fontSize" type="number" class="prop-input-number" />
              </div>
              <div class="prop-group">
                <label class="prop-label">{{ t('content.alignment') }}</label>
                <div class="align-btns">
                  <button
                    v-for="a in ['left','center','right','justify'] as const"
                    :key="a"
                    class="align-btn"
                    :class="{ 'align-btn--active': textAlign === a }"
                    @click="textAlign = a"
                  >
                    <svg viewBox="0 0 16 16" fill="none" class="align-icon">
                      <template v-if="a === 'left'">
                        <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        <line x1="2" y1="8" x2="10" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        <line x1="2" y1="12" x2="12" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      </template>
                      <template v-else-if="a === 'center'">
                        <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        <line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        <line x1="3" y1="12" x2="13" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      </template>
                      <template v-else-if="a === 'right'">
                        <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        <line x1="6" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        <line x1="4" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      </template>
                      <template v-else>
                        <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      </template>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="prop-group">
                <label class="prop-label">{{ t('content.textColor') }}</label>
                <div class="color-row">
                  <button
                    v-for="c in colorSwatches"
                    :key="c"
                    class="color-swatch"
                    :class="{ 'color-swatch--active': activeColor === c }"
                    :style="{ background: c }"
                    @click="activeColor = c"
                  />
                </div>
                <div class="color-hex" @click="showColorPicker = true">
                  <span class="color-hex-dot" :style="{ background: activeColor }" />
                  <span class="color-hex-value">{{ activeColor.replace('#', '').toUpperCase() }}</span>
                </div>
              </div>

              <ColorPicker
                v-if="showColorPicker"
                v-model="activeColor"
                @ok="showColorPicker = false"
                @cancel="showColorPicker = false"
              />
            </div>
          </template>

          <template v-else-if="selectedEl?.type === 'image'">
            <div class="props-section">
              <div class="prop-group">
                <label class="prop-label">{{ t('content.flip') }}</label>
                <div class="flip-btns">
                  <button
                    class="flip-btn"
                    :class="{ 'flip-btn--active': selectedEl.flipH }"
                    title="Flip horizontal"
                    @click="updateEl({ flipH: !selectedEl.flipH })"
                  >
                    <svg viewBox="0 0 20 20" fill="none" class="flip-icon">
                      <path d="M10 3v14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 2"/>
                      <path d="M6 6L2 10l4 4V6z" fill="currentColor"/>
                      <path d="M14 6l4 4-4 4V6z" fill="currentColor"/>
                    </svg>
                  </button>
                  <button
                    class="flip-btn"
                    :class="{ 'flip-btn--active': selectedEl.flipV }"
                    title="Flip vertical"
                    @click="updateEl({ flipV: !selectedEl.flipV })"
                  >
                    <svg viewBox="0 0 20 20" fill="none" class="flip-icon">
                      <path d="M3 10h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 2"/>
                      <path d="M6 6l4-4 4 4H6z" fill="currentColor"/>
                      <path d="M6 14l4 4 4-4H6z" fill="currentColor"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="props-placeholder">
              {{ hasSlide ? t('content.noSelection') : t('content.noSlide') }}
            </div>
          </template>

          <!-- 2026-05-28: Per-part "保存" / "下一部分" footer buttons
               retired site-wide. The workspace no longer gates
               progression — teachers navigate via the sidebar. The
               previous `<button class="btn-save-next">` lived here
               and called `slideStore.navigateToNextPart()` (also
               retired). See matching deletions in part3/5/6/7
               content components. -->
        </div>
      </div>
    </div>

    

  </section>
</template>

<style scoped>
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #F3F4F4;
  background-image: radial-gradient(circle, rgba(0, 0, 0, 0.25) 1px, transparent 1px);
  background-size: 24px 24px;
  box-shadow: inset 0px 0px 3px 2px rgb(0 0 0 / 10%), inset 0px 0px 1px 0px rgba(0, 0, 0, 0.60);
}

.canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: start;
  overflow-y: auto;
  padding: 40px 32px 24px;
  gap: 20px;
}

.slide-viewport {
  width: 100%;
  max-width: 900px;
  display: flex;
  justify-content: center;
}

/* Floating toolbar pill */
.toolbar-pill {
  background: #fff;
  border-radius: 999px;
  padding: 3px 4px;
  box-shadow: 2px 3px 6px rgba(0, 0, 0, 0.12), 11px 4px 16px 0px rgba(0, 0, 0, 0.12);
  display: inline-flex;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
}


.tool-btn{
    width: 20px;
    height: 20px;
    border-radius: 5px;
    /* border: 1.5px solid #d1d5db; */
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #374151;
}

.tool-btn:hover:not(:disabled) {
  border-color: #7FEC8F;
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tool-btn--active {
  border-radius: 50%;
  background: #7FEC8F;
  border-color: #7FEC8F;
  color: #000;
  box-shadow: 2px 1px 2px rgba(0, 0, 0, 0.12), 1px 0px 0px 0px rgba(0, 0, 0, 0.12);
  transform: scale(1.1);
}

.tool-label-tt {
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  line-height: 1;
}

.tool-icon {
  width: 18px;
  height: 18px;
}

/* Properties panel */
.editor-controls {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex-shrink: 0;
}

.properties-row {
  display: flex;
  align-items: flex-end;
  gap: 24px;
}

.props-section {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  flex-wrap: wrap;
  flex: 1;
}

.prop-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prop-label {
  font-size: 11px;
  color: #5C6060;
  font-weight: 500;
  white-space: nowrap;
}

.prop-select {
  height: 36px;
  border: 1px solid #e6e6e6;
  border-radius: 16px;
  padding: 0 10px;
  font-size: 13px;
  font-family: inherit;
  color: #111827;
  background: #e6e6e6;
  outline: none;
  cursor: pointer;
  width: 120px;
}

.prop-select--wide { width: 180px; }

.prop-input-number {
  height: 36px;
  width: 64px;
  border: 1px solid #e6e6e6;
  border-radius: 16px;
  padding: 0 10px;
  font-size: 13px;
  font-family: inherit;
  color: #111827;
  background-color: #e6e6e6;
  text-align: center;
  outline: none;
}

.align-btns {
  display: flex;
  gap: 8px;
  background-color: #e6e6e6;
  border-radius: 16px;
  padding: 3px 8px;
}

.align-btn {
  width: 50px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #6b7280;
}

.align-btn--active { 
  background: #ffffff; 
  border-color: #ffffff; 
  color: #000; 
  border-radius: 16px;
}
.align-icon { width: 16px; height: 16px; }

.color-row { display: flex; gap: 6px; }

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
}

.color-swatch:hover { border-color: #374151; }
.color-swatch--active { border-color: #111827; }

.color-hex {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  background: #e6e6e6;
  border-radius: 16px;
  padding: 5px 10px;
  cursor: pointer;
}

.color-hex:hover { background: #d8d8d8; }

.color-hex-dot {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
}

.color-hex-value {
  font-size: 12px;
  color: #374151;
  font-family: monospace;
  text-transform: uppercase;
}

.flip-btns {
  display: flex;
  gap: 6px;
}

.flip-btn {
  width: 36px;
  height: 36px;
  border-radius: 16px;
  border: none;
  background: #e6e6e6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #374151;
  padding: 8px;
}

.flip-btn:hover { background: #d8d8d8; }
.flip-btn--active { background: #7FEC8F; color: #000; }

.flip-icon { width: 18px; height: 18px; }

.props-placeholder {
  flex: 1;
  font-size: 13px;
  color: #9ca3af;
  padding: 8px 0;
}

/* 2026-05-28: `.btn-save` and `.btn-save-next` CSS retired together
   with the per-part footer buttons. Kept as dated comment so any
   reviewer searching for the class names lands here instead of
   thinking they were accidentally lost. */

/* 2026-05-28: `.image-menu-item--reset` styling retired with the
   "Reset to global theme" button. */

.toolbar-area {
  position: relative;
  display: inline-flex;
  flex-direction: column;
}

.image-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.14);
  padding: 5px;
  min-width: 210px;
  z-index: 200;
}

.image-menu-section {
  margin: 0;
  padding: 4px 12px 2px;
  font-size: 10px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.image-menu-divider {
  height: 1px;
  background: #e6e6e6;
  margin: 5px 0;
}

.image-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  background: none;
  border: none;
  font-size: 14px;
  font-family: inherit;
  color: #111827;
  text-align: left;
}

.image-menu-item:hover { background: #f3f4f6; }

.image-menu-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: #374151;
}

.image-menu-label { flex: 1; }

.image-menu-chevron {
  width: 14px;
  height: 14px;
  color: #9ca3af;
  flex-shrink: 0;
}
</style>
