<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSlideStore } from '@/stores/slides'
import SlideThumbnail from './SlideThumbnail.vue'

interface Part {
  id: number
  label: string
  status: 'completed' | 'active' | 'inactive'
}

const slideStore = useSlideStore()

const parts = ref<Part[]>([
  { id: 1, label: 'Part 1: Cover & Opening', status: 'completed' },
  { id: 2, label: 'Part 2: Hook & Guided Attention', status: 'active' },
  { id: 3, label: 'Part 3: Interactive Story', status: 'inactive' },
  { id: 4, label: 'Part 4: Making Task', status: 'inactive' },
  { id: 5, label: 'Part 5: Making Example', status: 'inactive' },
  { id: 6, label: 'Part 6: Work Transformation', status: 'inactive' },
  { id: 7, label: 'Part 7: Share & Feedback', status: 'inactive' },
])

const activePartSlides = computed(() => slideStore.slidesForPart(slideStore.activePart))

// Keep sidebar statuses in sync when activePart changes externally (e.g. Save & Next)
watch(() => slideStore.activePart, (newId, oldId) => {
  const oldPart = parts.value.find(p => p.id === oldId)
  const newPart = parts.value.find(p => p.id === newId)
  if (oldPart && oldPart.status === 'active') oldPart.status = 'completed'
  if (newPart) newPart.status = 'active'
})

function selectPart(part: Part) {
  if (part.status === 'completed' || part.status === 'inactive') {
    parts.value.forEach(p => {
      if (p.id === slideStore.activePart) p.status = 'inactive'
    })
    part.status = 'active'
    slideStore.activePart = part.id
  }
}

function addSlide() {
  slideStore.addSlide(activePart.value)
}

function selectSlide(id: string) {
  slideStore.selectSlide(id)
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-title">Page List</span>
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
          @click="selectPart(part)"
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

        <!-- Slide thumbnails (active only) -->
        <div v-if="part.status === 'active'" class="slides-list">
          <div
            v-for="slide in activePartSlides"
            :key="slide.id"
            class="slide-thumb"
            :class="{ 'slide-thumb--active': slideStore.activeSlideId === slide.id }"
            @click="selectSlide(slide.id)"
          >
            <SlideThumbnail :slide="slide" />
          </div>

          <!-- Add slide -->
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

/* Part rows */
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

.part-row--completed,
.part-row--inactive {
  background: #E6E6E6;
}

.part-row--inactive:hover,
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
  color: #6b7280;
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
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.slide-thumb:hover,
.slide-thumb--active {
  border-color: #B2F4BC;
  box-shadow: 0 0 0 2px #B2F4BC;
}


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
  border-color: #22c55e;
  background: #f0fdf4;
}

.slide-add-icon {
  font-size: 28px;
  color: #9ca3af;
  line-height: 1;
}

.slide-add:hover .slide-add-icon {
  color: #22c55e;
}
</style>
