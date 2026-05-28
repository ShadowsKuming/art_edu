<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSlideStore } from '@/stores/slides'
import { useI18n } from 'vue-i18n'
import SlideThumbnail from './SlideThumbnail.vue'

const emit = defineEmits<{ close: [] }>()
const slideStore = useSlideStore()
const { t } = useI18n()

// Sort by partId so slides always present in part order (1→2→3…),
// regardless of the order they were added to the slides array.
// Stable sort preserves relative insertion order within each part.
const slides = computed(() =>
  [...slideStore.slides].sort((a, b) => a.partId - b.partId)
)
const currentIndex = ref(0)
const currentSlide = computed(() => slides.value[currentIndex.value] ?? null)

const controlsVisible = ref(true)
let hideTimer: ReturnType<typeof setTimeout> | null = null

function resetHideTimer() {
  controlsVisible.value = true
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { controlsVisible.value = false }, 3000)
}

function prev() {
  if (currentIndex.value > 0) currentIndex.value--
  resetHideTimer()
}

function next() {
  if (currentIndex.value < slides.value.length - 1) currentIndex.value++
  resetHideTimer()
}

async function exit() {
  if (document.fullscreenElement) {
    try { await document.exitFullscreen() } catch {}
  }
  emit('close')
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') { exit(); return }
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown') {
    e.preventDefault()
    next()
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    prev()
  }
}

function onFullscreenChange() {
  // User pressed Esc via the browser (not our handler) — close overlay
  if (!document.fullscreenElement) emit('close')
}

const overlayEl = ref<HTMLElement | null>(null)

onMounted(async () => {
  try {
    await document.documentElement.requestFullscreen()
  } catch {}
  // Use capture phase so we intercept Escape before the browser's
  // fullscreen handler can swallow it silently in some browsers.
  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  // Focus the overlay so keyboard events are routed to it directly.
  overlayEl.value?.focus()
  const idx = slides.value.findIndex(s => s.id === slideStore.activeSlideId)
  currentIndex.value = idx >= 0 ? idx : 0
  resetHideTimer()
  playSlideAudio(currentSlide.value)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown, true)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  if (hideTimer) clearTimeout(hideTimer)
  stopAudio()
})

// ── Slide audio ──────────────────────────────────────────────────────────────
let audioPlayer: HTMLAudioElement | null = null

function stopAudio() {
  if (audioPlayer) {
    audioPlayer.pause()
    audioPlayer.src = ''
    audioPlayer = null
  }
}

function playSlideAudio(slide: typeof currentSlide.value) {
  stopAudio()
  if (!slide?.audioBg) return
  audioPlayer = new Audio(slide.audioBg)
  audioPlayer.play().catch(() => {})
}

watch(currentSlide, (slide) => playSlideAudio(slide))

const partLabel = computed(() => {
  const s = currentSlide.value
  if (!s) return ''
  const partSlides = slides.value.filter(sl => sl.partId === s.partId)
  const posInPart = partSlides.indexOf(s) + 1
  const partName = t(`sidebar.parts[${s.partId - 1}]`)
  return partSlides.length > 1 ? `${partName}  ·  ${posInPart} / ${partSlides.length}` : partName
})
</script>

<template>
  <div
    ref="overlayEl"
    class="tm-overlay"
    :class="{ 'tm-cursor-hidden': !controlsVisible }"
    tabindex="-1"
    @mousemove="resetHideTimer"
    @click="next"
    @keydown.esc.stop.prevent="exit"
  >
    <!-- Slide stage -->
    <div class="tm-stage">
      <div v-if="currentSlide" class="tm-slide-frame">
        <SlideThumbnail :slide="currentSlide" />
      </div>
      <div v-else class="tm-empty">No slides to present.</div>
    </div>

    <!-- Control bar -->
    <Transition name="tm-fade">
      <div v-show="controlsVisible" class="tm-bar" @click.stop>
        <!-- Part label (left) -->
        <span class="tm-part-label">{{ partLabel }}</span>

        <!-- Prev / counter / next (centre) -->
        <div class="tm-nav">
          <button
            class="tm-nav-btn"
            :disabled="currentIndex === 0"
            :title="t('teaching.prev')"
            @click="prev"
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M14 5L8 11L14 17" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>

          <span class="tm-counter">{{ currentIndex + 1 }}<span class="tm-counter-sep"> / </span>{{ slides.length }}</span>

          <button
            class="tm-nav-btn"
            :disabled="currentIndex === slides.length - 1"
            :title="t('teaching.next')"
            @click="next"
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M8 5L14 11L8 17" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>

        <!-- Exit (right) -->
        <button class="tm-exit-btn" :title="t('teaching.exit')" @click="exit">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13 3L3 13M3 3L13 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          {{ t('teaching.exit') }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.tm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #111;
  display: flex;
  flex-direction: column;
  outline: none;
}

.tm-cursor-hidden {
  cursor: none;
}

/* ── Stage ── */
.tm-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  /* keep slide from going behind the 64px bar */
  padding-bottom: 64px;
  cursor: pointer;
}

.tm-slide-frame {
  /* Fit 16:9 inside available space (viewport minus the 64px bar) */
  width: min(100vw, calc((100vh - 64px) * 16 / 9));
  aspect-ratio: 16 / 9;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 8px 48px rgba(0, 0, 0, 0.6);
}

.tm-empty {
  color: #6b7280;
  font-size: 16px;
}

/* ── Control bar ── */
.tm-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: rgba(10, 10, 10, 0.82);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  color: #e5e7eb;
  gap: 16px;
}

/* Part label */
.tm-part-label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #d1d5db;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Nav cluster */
.tm-nav {
  display: flex;
  align-items: center;
  gap: 20px;
}

.tm-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  transition: background 0.15s;
}

.tm-nav-btn:hover:not(:disabled) {
  background: rgba(127, 236, 143, 0.3);
  color: #7FEC8F;
}

.tm-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.tm-counter {
  font-size: 17px;
  font-weight: 600;
  color: #fff;
  min-width: 64px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.tm-counter-sep {
  color: #6b7280;
  font-weight: 400;
}

/* Exit button */
.tm-exit-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 999px;
  transition: background 0.15s, color 0.15s;
}

.tm-exit-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

/* Transition */
.tm-fade-enter-active,
.tm-fade-leave-active {
  transition: opacity 0.35s ease;
}
.tm-fade-enter-from,
.tm-fade-leave-to {
  opacity: 0;
}
</style>
