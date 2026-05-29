<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSlideStore } from '@/stores/slides'
import { useI18n } from 'vue-i18n'
import SlideThumbnail from './SlideThumbnail.vue'
// 2026-05-29 — Part 3/5/6/7 carry app-specific state (generated
// animations, demo videos, AI style results, AI feedback) that the
// generic SlideThumbnail renderer can't show — it would just paint
// the underlying blank canvas + placeholder text. In teaching mode
// we mount the *same* Part components the teacher used to prepare
// the lesson, so what they saw in the editor is exactly what the
// classroom sees on the projector. Plain Part 1/2/4 slides keep
// rendering through SlideThumbnail.
import Part3Content from './part3/Part3Content.vue'
import Part5Content from './part5/Part5Content.vue'
import Part6Content from './part6/Part6Content.vue'
import Part7Content from './part7/Part7Content.vue'

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

// Part 3 internal mode (story | animation). Part3Content emits this
// via v-model:mode — teaching mode just holds it locally and starts
// in animation view so the teacher's generated clip is the first
// thing students see (story panel lives in the right-hand chat
// panel during editing, which we don't show in teaching mode).
const part3Mode = ref<'story' | 'animation'>('animation')

/**
 * Sync the slide store's `activeSlideId` with the slide the teacher
 * has navigated to in fullscreen mode. The Part 3/5/6/7 components
 * read app state keyed by `activeSlideId` (e.g. `usePart3Store`
 * looks up the pair by the active slide), so without this they'd
 * keep showing whichever slide was active when fullscreen opened.
 */
watch(currentSlide, (slide) => {
  if (slide && slide.id !== slideStore.activeSlideId) {
    slideStore.selectSlide(slide.id)
  }
})


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
    @keydown.esc.stop.prevent="exit"
  >
    <!-- Slide stage.
         2026-05-29 — Click-to-advance is bound on the stage wrapper
         only (not the overlay root), and the inner Part 3/5/6/7
         containers stop propagation so teachers can click the
         interactive UI (animation thumbnails, video player, upload
         buttons, AI generate button…) without accidentally jumping
         to the next slide. The slot below the inner container still
         counts as "background" and advances on click. -->
    <div class="tm-stage" @click="next">
      <template v-if="currentSlide">
        <!-- Part 3 — generated story / animation player -->
        <div v-if="currentSlide.partId === 3" class="tm-part-frame" @click.stop>
          <Part3Content v-model:mode="part3Mode" />
        </div>

        <!-- Part 5 — embedded video (Bilibili / YouTube / mp4 / blob).
             Falls back to the generic slide for non-video Part-5
             slides (teacher-added blank canvases come after the
             first auto-seeded video slide). -->
        <div
          v-else-if="currentSlide.partId === 5 && slideStore.isPart5VideoSlide(currentSlide.id)"
          class="tm-part-frame"
          @click.stop
        >
          <Part5Content />
        </div>

        <!-- Part 6 — style picker steps / conversion comparison -->
        <div v-else-if="currentSlide.partId === 6" class="tm-part-frame" @click.stop>
          <Part6Content />
        </div>

        <!-- Part 7 — student work upload + AI feedback -->
        <div v-else-if="currentSlide.partId === 7" class="tm-part-frame" @click.stop>
          <Part7Content />
        </div>

        <!-- Parts 1 / 2 / 4 (and Part-5 non-video slides) — designed
             slides authored on the regular canvas. -->
        <div v-else class="tm-slide-frame">
          <SlideThumbnail :slide="currentSlide" />
        </div>
      </template>
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

/* 2026-05-29 — Frame for the Part 3/5/6/7 interactive content
   components in fullscreen. These components were designed to fill
   the centre column of the editor (which is wider than 16:9 and has
   its own scrolling), so in teaching mode we give them a larger
   landscape canvas — 90% of viewport width, capped at 92% of height
   minus the control bar. The components handle their own internal
   layout (scroll, padding, dot-pattern background). */
.tm-part-frame {
  width: min(92vw, calc((100vh - 64px) * 1.6));
  height: min(calc(100vh - 96px), 92vh);
  background: #F3F4F4;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 8px 48px rgba(0, 0, 0, 0.6);
  display: flex;
  /* Tell child Part*Content sections to fill the frame. Their
     `.p3-content` / `.p5-content` / `.p6-content` / `.p7` already
     have `flex: 1` + `display: flex; flex-direction: column;` so
     this works out of the box. */
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
