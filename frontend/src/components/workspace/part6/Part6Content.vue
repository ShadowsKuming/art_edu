<script setup lang="ts">
import { ref } from 'vue'
import { usePart6Store } from '@/stores/part6'
import { useSlideStore } from '@/stores/slides'

const store      = usePart6Store()
const slideStore = useSlideStore()

const expandedResults = ref<Set<number>>(new Set())

function toggleResult(i: number) {
  if (expandedResults.value.has(i)) expandedResults.value.delete(i)
  else expandedResults.value.add(i)
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
    <div class="p6-canvas-area">

      <!-- Step 1 -->
      <div class="p6-step">
        <p class="p6-step-label">
          <span class="p6-dot" />
          <strong>Step 1:</strong> Upload a sketch or unfinished work
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
            <p class="p6-upload-label">Upload Student Work</p>
            <button class="p6-select-btn" @click.stop="openFilePicker">Select Files</button>
          </template>
          <template v-else>
            <img :src="store.sketchDataUrl" class="p6-sketch-img" />
            <button class="p6-reupload-btn" title="Replace" @click.stop="openFilePicker">
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M13 8A5 5 0 112 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M13 4v4h-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </template>
        </div>
      </div>

      <!-- Step 2 (shown once sketch uploaded) -->
      <div v-if="store.sketchDataUrl" class="p6-step p6-step--pink">
        <p class="p6-step-label">
          <span class="p6-dot" />
          <strong>Step 2:</strong> Choose a style and unlock your artwork's potential!
        </p>

        <!-- Loading -->
        <div v-if="store.generatingStyles" class="p6-styles-loading">
          <div class="p6-spinner" />
          <span>Generating style options…</span>
        </div>

        <!-- Empty hint -->
        <div v-else-if="!store.styles.length" class="p6-styles-hint">
          <p>Tell ArtBloom about your lesson in the chat panel →<br>style options will appear here.</p>
        </div>

        <!-- Style cards -->
        <div v-else class="p6-style-cards">
          <div
            v-for="(style, i) in store.styles"
            :key="i"
            class="p6-style-card"
            :class="{ 'p6-style-card--selected': store.selectedStyleIdx === i }"
            @click="store.selectedStyleIdx = i"
          >
            <img :src="store.sketchDataUrl!" class="p6-style-card-img" />
            <div class="p6-style-card-overlay" />
            <p class="p6-style-card-label">{{ style.label }}</p>
          </div>
        </div>

        <!-- Error -->
        <p v-if="store.stylesError" class="p6-error">{{ store.stylesError }}</p>
        <p v-if="store.conversionError" class="p6-error">{{ store.conversionError }}</p>

        <!-- Convert button -->
        <button
          v-if="store.styles.length"
          class="p6-convert-btn"
          :disabled="store.converting"
          @click="store.convert()"
        >
          <span v-if="store.converting">
            <span class="p6-btn-spinner" /> Converting…
          </span>
          <span v-else>Converting!</span>
        </button>
      </div>

      <!-- Results (collapsed, click to expand) -->
      <div v-if="store.results.length" class="p6-results">
        <div
          v-for="(r, i) in store.results"
          :key="i"
          class="p6-result-item"
        >
          <button class="p6-result-header" @click="toggleResult(i)">
            <span class="p6-result-title">{{ r.styleLabel }} — Result {{ i + 1 }}</span>
            <svg class="p6-result-chevron" :class="{ 'p6-result-chevron--open': expandedResults.has(i) }" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-if="expandedResults.has(i)" class="p6-result-image-wrap">
            <img :src="r.imageUrl" class="p6-result-image" />
          </div>
        </div>
      </div>

    </div>

    <div class="p6-footer">
      <button class="p6-save-btn" @click="saveAndNext">Save &amp; Next</button>
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
}

.p6-canvas-area {
  flex: 1;
  overflow-y: auto;
  padding: 32px 40px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Steps */
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

.p6-step--pink { background: #fff5f5; }

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

/* Upload zone */
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

/* Style cards */
.p6-styles-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #6b7280;
  padding: 8px 0;
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

.p6-style-cards {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.p6-style-card {
  flex: 1;
  min-width: 140px;
  aspect-ratio: 1 / 1;
  border-radius: 16px;
  overflow: hidden;
  border: 3px solid transparent;
  cursor: pointer;
  position: relative;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.15s, border-color 0.15s;
}

.p6-style-card:hover { transform: scale(1.03); border-color: #B2F4BC; }
.p6-style-card--selected { border-color: #7FEC8F; box-shadow: 0 0 0 2px #7FEC8F; }

.p6-style-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.p6-style-card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.28);
}

.p6-style-card-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 12px;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  text-align: center;
  text-shadow: 0 1px 4px rgba(0,0,0,0.5);
  line-height: 1.35;
}

/* Convert button */
.p6-convert-btn {
  align-self: center;
  height: 40px;
  padding: 0 32px;
  background: #7FEC8F;
  border: none;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 2px 2px 6px rgba(0,0,0,0.12);
}

.p6-convert-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.p6-convert-btn:not(:disabled):hover { transform: translateY(-1px) scale(1.02); }

.p6-btn-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0,0,0,0.2);
  border-top-color: #000;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
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

/* Results */
.p6-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 760px;
  width: 100%;
}

.p6-result-item {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
}

.p6-result-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}

.p6-result-header:hover { background: #f9fafb; }

.p6-result-title {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.p6-result-chevron {
  width: 16px;
  height: 16px;
  color: #6b7280;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.p6-result-chevron--open { transform: rotate(180deg); }

.p6-result-image-wrap {
  padding: 0 16px 16px;
}

.p6-result-image {
  width: 100%;
  border-radius: 8px;
  display: block;
}

/* Footer */
.p6-footer {
  padding: 16px 40px;
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

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
