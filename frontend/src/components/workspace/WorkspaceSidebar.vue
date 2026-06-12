<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSlideStore } from '@/stores/slides'
import { usePart3Store } from '@/stores/part3'
import { useProjectsStore } from '@/stores/projects'
import { useToastStore } from '@/stores/toast'
import { getLesson } from '@/data/lessons'
import SlideThumbnail from './SlideThumbnail.vue'
import { useI18n } from 'vue-i18n'


const { t, tm } = useI18n()
const toastStore = useToastStore()


const PART_IDS = [1, 2, 3, 4, 5, 6, 7]

// Parts 1, 2, 4, 5 show normal slide thumbnails.
//
// 2026-05 — Part 5 ("创意示范") was previously a single video-only
// page. Pilot teachers wanted to keep the demonstration video AND
// add their own blank canvas slides for follow-up notes / class
// activities. Part 5 now behaves like 1/2/4 with one quirk: the
// FIRST Part-5 slide is always the "video slide" (renders
// `Part5Content` in `CreateLesson.vue`), and it cannot be deleted
// (see `canDelete` below). Subsequent slides are regular blank
// canvases.
//
// Part 3 still gets its own artwork-thumbnail list further down.
const SLIDE_EDITOR_PARTS = new Set([1, 2, 4, 5])

const slideStore = useSlideStore()
const part3Store = usePart3Store()
const projectsStore = useProjectsStore()

// 2026-05-28: lock / unlock progression retired. The sidebar now
// only distinguishes the active Part from the rest — there is no
// "completed" (green-check) or "locked" (greyed-out, not-allowed)
// state any more. Teachers can jump to any Part at any time.
type Status = 'active' | 'idle'

const parts = computed(() =>
  PART_IDS.map(id => ({
    id,
    label: (tm('sidebar.parts') as string[])[id - 1],
    status: (id === slideStore.activePart ? 'active' : 'idle') as Status,
  }))
)

const activePartSlides = computed(() => slideStore.slidesForPart(slideStore.activePart))

// Curated artworks from the active lesson (Part 3 only)
const part3CuratedArtworks = computed(() => {
  const lessonId = projectsStore.activeLessonId
  if (!lessonId) return []
  return getLesson(lessonId)?.textbook_artworks ?? []
})

// 2026-05-28: every Part is reachable now — drop the `status`
// guard. Signature kept (still takes `status`) so any future caller
// that wants to short-circuit can; the body is just the unconditional
// navigation now.
function selectPart(partId: number, _status: Status) {
  slideStore.navigateToPart(partId)
}

function addSlide() {
  slideStore.addSlide(slideStore.activePart)
}

function deleteSlide(slideId: string) {
  slideStore.removeSlide(slideId)
}

function canDelete(slide: { id: string; partId: number }) {
  // 2026-05 — The first Part-5 slide is the "video slide" and must
  // never be deleted (it owns the Part5Content video player UI).
  // Other Part-5 slides and all Parts-1/2/4 slides follow the
  // normal rule: must leave at least one slide in the Part.
  if (slideStore.isPart5VideoSlide(slide.id)) return false
  return slideStore.slidesForPart(slide.partId).length > 1
}

function selectSlide(id: string) {
  slideStore.selectSlide(id)
}

// ── Drag & drop reorder (Parts 1/2/4/5 only) ────────────────────
//
// 2026-06 — Teachers in the pilot wanted to shuffle slide order
// inside a Part (e.g. swap the order of two activity slides in
// Part 4) without recreating them. We use the native HTML5
// drag-and-drop API rather than a third-party lib to avoid adding
// runtime weight.
//
// Drag is enabled on slide thumbnails for Parts 1/2/4/5. The Part-5
// video slide (index 0) is intentionally `draggable="false"` and
// never accepts drops at its position — the store also enforces
// this server-side via `reorderSlidesInPart`. Part 3's artwork
// thumbnails and the 7-row Part-list itself stay non-draggable.

const dragFromIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(e: DragEvent, partIndex: number, slideId: string) {
  // Disallow dragging the Part-5 video slide (always at index 0).
  if (slideStore.isPart5VideoSlide(slideId)) {
    e.preventDefault()
    return
  }
  dragFromIndex.value = partIndex
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    // Setting some data is required for the drag to fire `drop` in
    // Firefox; the payload itself isn't used (we read dragFromIndex
    // from local state instead, which survives the cross-frame copy).
    e.dataTransfer.setData('text/plain', String(partIndex))
  }
}

function onDragOver(e: DragEvent, partIndex: number) {
  if (dragFromIndex.value === null) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = partIndex
}

function onDragLeave(partIndex: number) {
  if (dragOverIndex.value === partIndex) dragOverIndex.value = null
}

function onDrop(e: DragEvent, partIndex: number) {
  e.preventDefault()
  const from = dragFromIndex.value
  dragFromIndex.value = null
  dragOverIndex.value = null
  if (from === null || from === partIndex) return
  slideStore.reorderSlidesInPart(slideStore.activePart, from, partIndex)
}

function onDragEnd() {
  dragFromIndex.value = null
  dragOverIndex.value = null
}

function isDraggable(slideId: string): boolean {
  // Part-5 video slide is pinned to index 0; everything else inside
  // SLIDE_EDITOR_PARTS can be dragged.
  return !slideStore.isPart5VideoSlide(slideId)
}


// ── Part 3 artwork actions ──────────────────────────────────────
//
// 2026-06-12 — Cross-artwork generation race fix (KB §33).
//
// All three "switch active Part-3 artwork" entry points (pick a
// curated artwork, pick a previously-uploaded one, upload a new
// one) MUST refuse the switch while ANY story / animation
// generation is in flight on ANY artwork. Reason: §30's per-pair
// `pair.storyData` field is the active-view mirror; if an SSE
// completes after the teacher switched artworks, its `pair.storyData
// = parsedJSON` line writes the story for the wrong artwork (and
// the next autosave persists that into `artworkStates[wrongKey]`).
//
// §30 fixed the analogous race for re-clicking generate buttons via
// the global `_genLock`, but the lock only disables BUTTONS — the
// sidebar thumbnail click is a separate entry point that bypasses
// it entirely. This guard is the first of three defensive layers
// added in §33:
//   1. (here) refuse the switch outright,
//   2. (part3.ts) capture target artwork at generate-start; if it
//      changed by SSE completion, route the result into
//      `artworkStates[targetKey]` directly instead of polluting
//      the current view's `pair.storyData`,
//   3. (projects.ts migrateProjects) one-off heal scan for any
//      project that already got poisoned by this race before the
//      fix landed.
//
// If you ever add a NEW entry point that switches `pair.activeArtworkKey`
// (e.g. a Part3Content thumbnail row, a keyboard shortcut, a
// future "shuffle artworks" button), you MUST add the same
// `isAnyGenerating` guard — otherwise the §33 race reopens.

function ensurePart3NotBusy(): boolean {
  if (part3Store.isAnyGenerating) {
    toastStore.show(t('part3.busyArtworkSwitch'), 'warning')
    return false
  }
  return true
}

function pickCuratedArtwork(artworkId: string, url: string) {
  if (!ensurePart3NotBusy()) return
  // Ensure a Part-3 slide + pair exists
  const part3Slides = slideStore.slides.filter(s => s.partId === 3)
  if (part3Slides.length === 0) {
    const id = slideStore.addSlide(3)
    part3Store.ensurePair(id)
  } else {
    part3Store.ensurePair(part3Slides[0].id)
    slideStore.selectSlide(part3Slides[0].id)
  }
  part3Store.setArtworkFromUrl(url, artworkId)
  const activeId = slideStore.activeSlideId
  if (activeId) slideStore.setSlideBackground(activeId, url)
}

function pickUploadedArtwork(id: string) {
  if (!ensurePart3NotBusy()) return
  const art = part3Store.uploadedArtworks.find(a => a.id === id)
  if (!art) return
  part3Store.selectUploadedArtwork(id)
  const activeId = slideStore.activeSlideId
  if (activeId) slideStore.setSlideBackground(activeId, art.imageDataUrl)
}

function uploadNewArtwork() {
  // Block at the entry rather than after the file picker so the
  // teacher doesn't go through the OS file picker only to have
  // the upload silently no-op. The toast fires immediately on the
  // "+" tile click.
  if (!ensurePart3NotBusy()) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.style.cssText = 'position:fixed;top:-999px;left:-999px;'
  document.body.appendChild(input)
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.remove()
    if (!file) return
    // Re-check after the file picker resolves — a slow OS picker
    // could let a generation start in the gap. Belt-and-braces.
    if (!ensurePart3NotBusy()) return
    // Ensure a Part-3 slide + pair exists
    let part3SlideId = slideStore.slides.find(s => s.partId === 3)?.id ?? null
    if (!part3SlideId) {
      part3SlideId = slideStore.addSlide(3)
    }
    part3Store.ensurePair(part3SlideId)
    slideStore.selectSlide(part3SlideId)

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      part3Store.addUploadedArtwork(dataUrl)
      slideStore.setSlideBackground(part3SlideId!, dataUrl)
    }
    reader.readAsDataURL(file)
  })
  input.click()
}

</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-title">{{ t('sidebar.pageList') }}</span>
    </div>

    <div class="sidebar-body">
      <div
        v-for="part in parts"
        :key="part.id"
        class="part-block"
      >
        <!-- Part row -->
        <div
          class="part-row"
          :class="{
            'part-row--active': part.status === 'active',
            'part-row--idle': part.status === 'idle',
          }"
          @click="selectPart(part.id, part.status)"
        >
          <span class="part-label">{{ part.label }}</span>
          <!-- 2026-05-28: green check icon removed — was rendered
               when `status === 'completed'` to indicate an unlocked
               Part. With the lock/unlock progression retired, every
               Part shares neutral styling and no completion mark. -->
        </div>

        <!-- Part 3: artwork list instead of slide thumbnails -->
        <div
          v-if="part.status === 'active' && part.id === 3"
          class="slides-list"
        >
          <!-- Curated artworks from LKP -->
          <div
            v-for="art in part3CuratedArtworks"
            :key="art.artwork_id"
            class="slide-thumb artwork-thumb"
            :class="{ 'slide-thumb--active': part3Store.selectedArtworkId === art.artwork_id }"
            @click="pickCuratedArtwork(art.artwork_id, art.image_url)"
          >
            <img :src="art.image_url" :alt="art.title_zh" class="artwork-thumb-img" />
            <div class="artwork-thumb-label">
              <span>{{ art.title_zh }}</span>
            </div>
          </div>

          <!-- User-uploaded artworks -->
          <div
            v-for="ua in part3Store.uploadedArtworks"
            :key="ua.id"
            class="slide-thumb artwork-thumb"
            :class="{ 'slide-thumb--active': part3Store.selectedUploadedId === ua.id }"
            @click="pickUploadedArtwork(ua.id)"
          >
            <img :src="ua.imageDataUrl" alt="" class="artwork-thumb-img" />
            <button
              class="slide-delete-btn"
              @click.stop="part3Store.removeUploadedArtwork(ua.id)"
            >×</button>
          </div>

          <!-- Upload new artwork -->
          <div class="slide-add" @click="uploadNewArtwork">
            <span class="slide-add-icon">+</span>
          </div>
        </div>

        <!-- Normal slide thumbnails for parts 1, 2, 4, 5.
             Part 5's first slide is the "video slide": instead of
             rendering the slide's elements via `<SlideThumbnail>`
             (which leaks any LKP-seeded text like "艺术实践·步骤提示"
             through the sidebar), we draw a pure play-icon cover so
             the teacher can instantly identify it as the video
             slot. The underlying slide model has been wiped of
             elements by `slideStore.navigateToPart(5)` for the same
             reason — see the comment there. -->
        <div
          v-else-if="part.status === 'active' && SLIDE_EDITOR_PARTS.has(part.id)"
          class="slides-list"
        >
          <div
            v-for="(slide, idx) in activePartSlides"
            :key="slide.id"
            class="slide-thumb"
            :class="{
              'slide-thumb--active': slideStore.activeSlideId === slide.id,
              'slide-thumb--video': slideStore.isPart5VideoSlide(slide.id),
              'slide-thumb--dragging': dragFromIndex === idx,
              'slide-thumb--drop-target': dragOverIndex === idx && dragFromIndex !== null && dragFromIndex !== idx,
            }"
            :draggable="isDraggable(slide.id)"
            @click="selectSlide(slide.id)"
            @dragstart="onDragStart($event, idx, slide.id)"
            @dragover="onDragOver($event, idx)"
            @dragleave="onDragLeave(idx)"
            @drop="onDrop($event, idx)"
            @dragend="onDragEnd"
          >

            <!-- Video-slide cover (Part 5 only, first slide): pure
                 play-icon, no slide-elements, no text overlay. -->
            <div
              v-if="slideStore.isPart5VideoSlide(slide.id)"
              class="slide-video-cover"
              aria-hidden="true"
            >
              <svg viewBox="0 0 48 48" fill="none" class="slide-video-cover__icon">
                <circle cx="24" cy="24" r="22" fill="#ffffff" stroke="#16a34a" stroke-width="2.5" />
                <path d="M20 16l13 8-13 8V16z" fill="#16a34a" />
              </svg>
            </div>
            <SlideThumbnail v-else :slide="slide" />
            <button
              v-if="canDelete(slide)"
              class="slide-delete-btn"
              :title="t('sidebar.deleteSlide')"
              @click.stop="deleteSlide(slide.id)"
            >×</button>
          </div>

          <div class="slide-add" @click="addSlide">
            <span class="slide-add-icon">+</span>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  overflow: hidden;
}

.sidebar-header {
  padding: 20px 20px 14px;
}

.sidebar-title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}

.sidebar-body {
  flex: 1;
  overflow-y: auto;
}

.part-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  cursor: pointer;
  user-select: none;
}

.part-row--active { background: #B2F4BC; }
/* 2026-05-28: `.part-row--completed` (grey unlocked row) and
   `.part-row--inactive` (locked, cursor: not-allowed) classes
   retired with the lock/unlock progression. All non-active rows
   now use the same neutral `.part-row--idle` style below. */
.part-row--idle { background: #E6E6E6; }
.part-row--idle:hover { background: #d9d9d9; }

.part-label {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  line-height: 1.4;
}

/* 2026-05-28: `.check-icon` retired alongside the completed-state
   green check mark. No replacement — the part row is now icon-less. */

/* Slide / artwork thumbnails list */
.slides-list {
  padding: 8px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.slide-thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  background: #fff;
  border: 2px solid #e5e7eb;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  position: relative;
}

.slide-thumb:hover,
.slide-thumb--active {
  border-color: #7FEC8F;
  box-shadow: 0 0 0 2px #B2F4BC;
}

/* Artwork thumbnail variant */
.artwork-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.artwork-thumb-label {
  position: absolute;
  inset: auto 0 0 0;
  padding: 4px 8px;
  background: linear-gradient(transparent, rgba(0,0,0,0.6));
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}

.slide-delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0,0,0,0.55);
  color: #fff;
  border: none;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.slide-thumb:hover .slide-delete-btn { display: flex; }
.slide-delete-btn:hover { background: #dc2626; }

.slide-add {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  border: 2px dashed #d1d5db;
  background-color: #E6E6E6;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.slide-add:hover { border-color: #7FEC8F; background: #f0fdf4; }
.slide-add-icon { font-size: 28px; color: #9ca3af; line-height: 1; }
.slide-add:hover .slide-add-icon { color: #7FEC8F; }

/* 2026-05-28 — Part 5 first-slide cover. The video slide owns the
   centre-canvas `Part5Content` UI, so its sidebar thumbnail just
   has to communicate "this is the video slot" — no live element
   preview. A pure play-icon centred on a soft-green field does the
   job and avoids leaking LKP-seeded text ("艺术实践·步骤提示" etc.)
   through the SlideThumbnail renderer. */
.slide-video-cover {
  position: absolute;
  inset: 0;
  background: #f0fdf4;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slide-video-cover__icon {
  width: 38%;
  max-width: 56px;
  height: auto;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.08));
}

/* Subtle outline on the video slide thumbnail so it reads as
   "special" against the user-added blank canvases. */
.slide-thumb--video {
  border-color: #B2F4BC;
}

/* 2026-06 — Drag & drop visual feedback for slide reordering.
   `.slide-thumb--dragging` is the thumbnail being dragged (kept
   half-opaque so its origin is still locatable). `.slide-thumb--drop-target`
   draws a 2px green inset border on whichever thumbnail the
   pointer is currently hovering over — clear "drop here" cue
   without shifting layout. */
.slide-thumb[draggable='true'] { cursor: grab; }
.slide-thumb[draggable='true']:active { cursor: grabbing; }

.slide-thumb--dragging {
  opacity: 0.45;
}

.slide-thumb--drop-target {
  border-color: #16a34a !important;
  box-shadow: 0 0 0 2px #7FEC8F !important;
  transform: translateY(-1px);
  transition: transform 0.08s ease;
}
</style>

