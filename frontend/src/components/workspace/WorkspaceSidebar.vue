<script setup lang="ts">
import { computed } from 'vue'
import { useSlideStore } from '@/stores/slides'
import { usePart3Store } from '@/stores/part3'
import SlideThumbnail from './SlideThumbnail.vue'
import { useI18n } from 'vue-i18n'

const { t, tm } = useI18n()

const PART_IDS = [1, 2, 3, 4, 5, 6, 7]

// Parts that show slide thumbnails + add slide button in the sidebar
const SLIDE_EDITOR_PARTS = new Set([1, 2, 3, 4])

const slideStore = useSlideStore()
const part3Store = usePart3Store()

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

function selectPart(partId: number, status: Status) {
  if (status !== 'inactive') {
    slideStore.navigateToPart(partId)
  }
}

function addSlide() {
  const id = slideStore.addSlide(slideStore.activePart)
  if (slideStore.activePart === 3) {
    part3Store.ensurePair(id)
  }
}

function deleteSlide(slideId: string) {
  if (slideStore.activePart === 3) {
    part3Store.removePair(slideId)
  }
  slideStore.removeSlide(slideId)
}

function canDelete(partId: number) {
  return slideStore.slidesForPart(partId).length > 1
}

function selectSlide(id: string) {
  slideStore.selectSlide(id)
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

        <!-- Slide thumbnails (active slide-editor parts only) -->
        <div
          v-if="part.status === 'active' && SLIDE_EDITOR_PARTS.has(part.id)"
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

.part-row--active {
  background: #B2F4BC;
}

.part-row--completed {
  background: #E6E6E6;
}

.part-row--inactive {
  background: #E6E6E6;
  cursor: not-allowed;
}

.part-row--completed:hover {
  background: #d9d9d9;
}

.part-label {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  line-height: 1.4;
}

.part-row--inactive .part-label {
  color: #9ca3af;
  font-weight: 400;
}

.check-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* Slide thumbnails */
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
  border: 1px solid #e5e7eb;
  overflow: visible;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  position: relative;
}

.slide-thumb:hover,
.slide-thumb--active {
  border-color: #B2F4BC;
  box-shadow: 0 0 0 2px #B2F4BC;
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

.slide-add:hover {
  border-color: #7FEC8F;
  background: #f0fdf4;
}

.slide-add-icon {
  font-size: 28px;
  color: #9ca3af;
  line-height: 1;
}

.slide-add:hover .slide-add-icon {
  color: #7FEC8F;
}
</style>
