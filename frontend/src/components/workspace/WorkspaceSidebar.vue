<script setup lang="ts">
import { computed } from 'vue'
import { useSlideStore } from '@/stores/slides'
import { usePart3Store } from '@/stores/part3'
import { useProjectsStore } from '@/stores/projects'
import { getLesson } from '@/data/lessons'
import SlideThumbnail from './SlideThumbnail.vue'
import { useI18n } from 'vue-i18n'

const { t, tm } = useI18n()

const PART_IDS = [1, 2, 3, 4, 5, 6, 7]

// Parts 1, 2, 4 show normal slide thumbnails.
// Part 3 gets its own artwork list below.
const SLIDE_EDITOR_PARTS = new Set([1, 2, 4])

const slideStore = useSlideStore()
const part3Store = usePart3Store()
const projectsStore = useProjectsStore()

type Status = 'active' | 'completed' | 'inactive'

const parts = computed(() =>
  PART_IDS.map(id => ({
    id,
    label: (tm('sidebar.parts') as string[])[id - 1],
    status: (
      id === slideStore.activePart ? 'active' :
      id <= slideStore.maxUnlockedPart ? 'completed' : 'inactive'
    ) as Status,
  }))
)

const activePartSlides = computed(() => slideStore.slidesForPart(slideStore.activePart))

// Curated artworks from the active lesson (Part 3 only)
const part3CuratedArtworks = computed(() => {
  const lessonId = projectsStore.activeLessonId
  if (!lessonId) return []
  return getLesson(lessonId)?.textbook_artworks ?? []
})

function selectPart(partId: number, status: Status) {
  if (status !== 'inactive') {
    slideStore.navigateToPart(partId)
  }
}

function addSlide() {
  const id = slideStore.addSlide(slideStore.activePart)
}

function deleteSlide(slideId: string) {
  slideStore.removeSlide(slideId)
}

function canDelete(partId: number) {
  return slideStore.slidesForPart(partId).length > 1
}

function selectSlide(id: string) {
  slideStore.selectSlide(id)
}

// ── Part 3 artwork actions ──────────────────────────────────────

function pickCuratedArtwork(artworkId: string, url: string) {
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
  const art = part3Store.uploadedArtworks.find(a => a.id === id)
  if (!art) return
  part3Store.selectUploadedArtwork(id)
  const activeId = slideStore.activeSlideId
  if (activeId) slideStore.setSlideBackground(activeId, art.imageDataUrl)
}

function uploadNewArtwork() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.style.cssText = 'position:fixed;top:-999px;left:-999px;'
  document.body.appendChild(input)
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.remove()
    if (!file) return
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
            'part-row--completed': part.status === 'completed',
            'part-row--inactive': part.status === 'inactive',
          }"
          @click="selectPart(part.id, part.status)"
        >
          <span class="part-label">{{ part.label }}</span>
          <svg
            v-if="part.status === 'completed'"
            class="check-icon"
            viewBox="0 0 20 20"
            fill="none"
          >
            <circle cx="10" cy="10" r="9" fill="#22c55e" />
            <path
              d="M6 10.5l3 3 5-5"
              stroke="#fff"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
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

        <!-- Normal slide thumbnails for parts 1, 2, 4 -->
        <div
          v-else-if="part.status === 'active' && SLIDE_EDITOR_PARTS.has(part.id)"
          class="slides-list"
        >
          <div
            v-for="slide in activePartSlides"
            :key="slide.id"
            class="slide-thumb"
            :class="{ 'slide-thumb--active': slideStore.activeSlideId === slide.id }"
            @click="selectSlide(slide.id)"
          >
            <SlideThumbnail :slide="slide" />
            <button
              v-if="canDelete(slide.partId)"
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

.part-row--active    { background: #B2F4BC; }
.part-row--completed { background: #E6E6E6; }
.part-row--inactive  { background: #E6E6E6; cursor: not-allowed; }
.part-row--completed:hover { background: #d9d9d9; }

.part-label {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  line-height: 1.4;
}
.part-row--inactive .part-label { color: #9ca3af; font-weight: 400; }

.check-icon { width: 20px; height: 20px; flex-shrink: 0; }

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
</style>
