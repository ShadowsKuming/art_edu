<script setup lang="ts">
import { computed } from 'vue'
import { usePart6Store } from '@/stores/part6'
import { useSlideStore } from '@/stores/slides'
import { useI18n } from 'vue-i18n'

const store      = usePart6Store()
const slideStore = useSlideStore()
const { t }      = useI18n()

const canConvert = computed(() =>
  store.selectedStyleIdx !== null &&
  !store.usedStyleIndices.includes(store.selectedStyleIdx!)
)

const allUsed = computed(() =>
  store.styles.length > 0 &&
  store.usedStyleIndices.length >= store.styles.length
)

function selectPig(i: number) {
  if (!store.usedStyleIndices.includes(i)) {
    store.selectedStyleIdx = i
  }
}

function openFilePicker() {
  const input = document.createElement('input')
  input.type   = 'file'
  input.accept = 'image/*'
  input.style.cssText = 'position:fixed;top:-999px;left:-999px;'
  document.body.appendChild(input)
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.remove()
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => store.setSketch(reader.result as string)
    reader.readAsDataURL(file)
  })
  input.click()
}

function saveAndNext() {
  slideStore.navigateToNextPart()
}
</script>

<template>
  <section class="p6-content">

    <!-- ── Result view ─────────────────────────────────────── -->
    <div v-if="store.view === 'result' && store.latestResult" class="p6-result-view">
      <div class="p6-compare">
        <div class="p6-compare-panel">
          <img :src="store.latestResult.originalUrl" class="p6-compare-img" />
          <p class="p6-compare-caption">{{ store.latestResult.prompt }}</p>
        </div>
        <div class="p6-arrow">
          <svg viewBox="0 0 48 24" fill="none">
            <path d="M2 12h40M34 4l8 8-8 8" stroke="#7FEC8F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="p6-compare-panel">
          <img :src="store.latestResult.resultUrl" class="p6-compare-img" />
        </div>
      </div>
      <button class="p6-convert-again-btn" @click="store.convertAgain()">{{ t('part6.convertAgain') }}</button>
    </div>

    <!-- ── Steps view ──────────────────────────────────────── -->
    <div v-else class="p6-canvas-area">

      <!-- Step 1: Upload -->
      <div class="p6-step">
        <p class="p6-step-label">
          <span class="p6-dot" />
          <strong v-html="t('part6.step1Label')" />
        </p>

        <div
          class="p6-upload-zone"
          :class="{ 'p6-upload-zone--filled': store.sketchDataUrl }"
          @click="!store.sketchDataUrl && openFilePicker()"
        >
          <template v-if="!store.sketchDataUrl">
            <div class="p6-upload-icon">
              <svg viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="20" fill="#7FEC8F"/>
                <path d="M20 27V13M20 13l-5 5M20 13l5 5" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <p class="p6-upload-label">{{ t('part6.uploadLabel') }}</p>
            <button class="p6-select-btn" @click.stop="openFilePicker">{{ t('part6.selectFiles') }}</button>
          </template>
          <template v-else>
            <img :src="store.sketchDataUrl" class="p6-sketch-img" />
            <!-- 2026-05: swapped the half-circle "refresh" icon for a
                 conventional upload glyph (arrow ↑ into a tray). The
                 previous icon's two SVG paths combined into something
                 that looked like a "J" at 14×14, which teachers in
                 the pilot mistook for a broken/missing icon. Standard
                 upload semantics is clearer for the re-upload action. -->
            <button class="p6-reupload-btn" :title="t('part6.replace')" @click.stop="openFilePicker">
              <svg viewBox="0 0 16 16" fill="none">
                <!-- Tray / bottom rectangle -->
                <path d="M2 12v1.5A1.5 1.5 0 003.5 15h9A1.5 1.5 0 0014 13.5V12"
                      stroke="currentColor" stroke-width="1.6"
                      stroke-linecap="round" stroke-linejoin="round" />
                <!-- Up arrow shaft -->
                <path d="M8 11V2"
                      stroke="currentColor" stroke-width="1.6"
                      stroke-linecap="round" stroke-linejoin="round" />
                <!-- Up arrow head -->
                <path d="M4.5 5.5L8 2l3.5 3.5"
                      stroke="currentColor" stroke-width="1.6"
                      stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </template>
        </div>
      </div>

      <!-- Step 2: Pig style selectors (shown once sketch uploaded) -->
      <div v-if="store.sketchDataUrl" class="p6-step">
        <p class="p6-step-label">
          <span class="p6-dot" />
          <strong v-html="t('part6.step2Label')" />
        </p>

        <!-- Loading -->
        <div v-if="store.generatingStyles" class="p6-styles-loading">
          <div class="p6-spinner" />
          <span>{{ t('part6.generatingStyles') }}</span>
        </div>

        <!-- No styles yet -->
        <div v-else-if="!store.styles.length" class="p6-styles-hint">
          <p>{{ t('part6.stylesHint') }}</p>
        </div>

        <!-- Pig cards -->
        <div v-else class="p6-pig-row">
          <div
            v-for="(style, i) in store.styles"
            :key="i"
            class="p6-pig-card"
            :class="{
              'p6-pig-card--selected': store.selectedStyleIdx === i,
              'p6-pig-card--used':     store.usedStyleIndices.includes(i),
            }"
            @click="selectPig(i)"
          >
            <img
              :src="store.usedStyleIndices.includes(i) ? '/pig-broken.svg' : '/pig.svg'"
              class="p6-pig-img"
              alt="style pig"
            />
            <p class="p6-pig-label">{{ style.label }}</p>
          </div>
        </div>

        <!-- Errors -->
        <p v-if="store.stylesError" class="p6-error">{{ store.stylesError }}</p>
        <p v-if="store.conversionError" class="p6-error">{{ store.conversionError }}</p>

        <!-- All used notice -->
        <p v-if="allUsed" class="p6-all-used">{{ t('part6.allUsed') }}</p>

        <!-- Convert button (below selected pig) -->
        <button
          v-if="store.styles.length && !allUsed"
          class="p6-convert-btn"
          :disabled="!canConvert"
          @click="canConvert && store.convert()"
        >
          {{ t('part6.convertBtn') }}
        </button>
      </div>

    </div>

    <!-- ── Converting overlay ──────────────────────────────── -->
    <div v-if="store.view === 'converting'" class="p6-overlay">
      <div class="p6-converting-card">
        <div class="p6-orbit">
          <div class="p6-orbit-dot" style="top:0px;left:30px;background:#FF6B6B" />
          <div class="p6-orbit-dot" style="top:15px;left:56px;background:#FFB347" />
          <div class="p6-orbit-dot" style="top:45px;left:56px;background:#FFE66D" />
          <div class="p6-orbit-dot" style="top:60px;left:30px;background:#7FEC8F" />
          <div class="p6-orbit-dot" style="top:45px;left:4px;background:#6EC6FF" />
          <div class="p6-orbit-dot" style="top:15px;left:4px;background:#C39BD3" />
        </div>
        <p class="p6-converting-text">{{ t('part6.convertingOverlay') }}</p>
      </div>
    </div>

    <!-- ── Footer ──────────────────────────────────────────── -->
    <div class="p6-footer">
      <button class="p6-save-plain-btn" @click="() => {}">{{ t('part6.save') }}</button>
      <button class="p6-save-btn" @click="saveAndNext">{{ t('part6.saveNext') }}</button>
    </div>

  </section>
</template>

<style scoped>
.p6-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #F3F4F4;
  background-image: radial-gradient(circle, rgba(0,0,0,0.25) 1px, transparent 1px);
  background-size: 24px 24px;
  box-shadow: inset 0px 0px 3px 2px rgb(0 0 0 / 10%), inset 0px 0px 1px 0px rgba(0,0,0,0.60);
  position: relative;
}

/* ── Canvas area ─────────────────────────────────────────── */
.p6-canvas-area {
  flex: 1;
  overflow-y: auto;
  padding: 32px 40px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Steps ───────────────────────────────────────────────── */
.p6-step {
  background: #fff;
  border-radius: 16px;
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  max-width: 760px;
  width: 100%;
}

.p6-step-label {
  margin: 0;
  font-size: 14px;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 8px;
}

.p6-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #7FEC8F;
  flex-shrink: 0;
  display: inline-block;
}

/* ── Upload zone ─────────────────────────────────────────── */
.p6-upload-zone {
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  min-height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  background: #fafafa;
}

.p6-upload-zone:hover:not(.p6-upload-zone--filled) { border-color: #7FEC8F; }
.p6-upload-zone--filled { cursor: default; border-style: solid; border-color: #e5e7eb; }

.p6-upload-icon svg { width: 40px; height: 40px; }
.p6-upload-label { font-size: 13px; color: #6b7280; margin: 0; }

.p6-select-btn {
  height: 32px;
  padding: 0 18px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  color: #374151;
}
.p6-select-btn:hover { background: #e5e7eb; }

.p6-sketch-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  max-height: 220px;
  padding: 8px;
  box-sizing: border-box;
}

.p6-reupload-btn {
  position: absolute;
  top: 8px;
  right: 8px;
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
.p6-reupload-btn:hover { background: rgba(0,0,0,0.65); }

/* ── Styles loading / hint ───────────────────────────────── */
.p6-styles-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #6b7280;
}

.p6-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(127,236,143,0.3);
  border-top-color: #7FEC8F;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

.p6-styles-hint {
  padding: 12px;
  background: #f9fafb;
  border-radius: 10px;
  font-size: 13px;
  color: #6b7280;
  text-align: center;
  line-height: 1.6;
}
.p6-styles-hint p { margin: 0; }

/* ── Pig row ─────────────────────────────────────────────── */
.p6-pig-row {
  display: flex;
  gap: 20px;
}

.p6-pig-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 12px 14px;
  border-radius: 16px;
  border: 3px solid transparent;
  background: #fafafa;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  user-select: none;
}

.p6-pig-card:hover:not(.p6-pig-card--used) {
  border-color: #B2F4BC;
  transform: translateY(-2px);
}

.p6-pig-card--selected {
  border-color: #7FEC8F;
  box-shadow: 0 0 0 3px rgba(127, 236, 143, 0.45);
  background: #f0fdf4;
}

.p6-pig-card--used {
  cursor: not-allowed;
  opacity: 0.45;
  filter: grayscale(0.4);
}

.p6-pig-img {
  width: 100px;
  height: auto;
  display: block;
}

.p6-pig-label {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  text-align: center;
  line-height: 1.3;
}

/* ── Convert button ──────────────────────────────────────── */
.p6-convert-btn {
  align-self: center;
  height: 42px;
  padding: 0 36px;
  background: #7FEC8F;
  border: none;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 2px 2px 6px rgba(0,0,0,0.12);
  transition: transform 0.15s, opacity 0.15s;
}

.p6-convert-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.p6-convert-btn:not(:disabled):hover {
  transform: translateY(-1px) scale(1.02);
}

.p6-all-used {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  text-align: center;
}

.p6-error {
  margin: 0;
  font-size: 12px;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 6px 12px;
}

/* ── Converting overlay ──────────────────────────────────── */
.p6-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.p6-converting-card {
  background: #fff;
  border-radius: 24px;
  padding: 48px 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}

.p6-orbit {
  position: relative;
  width: 72px;
  height: 72px;
  animation: spin 1.4s linear infinite;
}

.p6-orbit-dot {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.p6-converting-text {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #111827;
  letter-spacing: 0.02em;
}

/* ── Result view ─────────────────────────────────────────── */
.p6-result-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 32px 40px;
  overflow-y: auto;
}

.p6-compare {
  display: flex;
  align-items: center;
  gap: 24px;
  width: 100%;
  max-width: 820px;
}

.p6-compare-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.p6-compare-img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 14px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  display: block;
}

.p6-compare-caption {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
  text-align: center;
}

.p6-arrow {
  flex-shrink: 0;
}

.p6-arrow svg {
  width: 56px;
  height: 28px;
}

.p6-convert-again-btn {
  height: 44px;
  padding: 0 32px;
  background: #fff;
  border: 2px solid #7FEC8F;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  color: #111827;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transition: background 0.15s, transform 0.15s;
}

.p6-convert-again-btn:hover {
  background: #f0fdf4;
  transform: translateY(-1px);
}

/* ── Footer ──────────────────────────────────────────────── */
.p6-footer {
  padding: 16px 40px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.p6-save-plain-btn {
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
.p6-save-plain-btn:hover { background: #d8d8d8; }

.p6-save-btn {
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
.p6-save-btn:hover { transform: translateY(-1px) scale(1.02); }
</style>
