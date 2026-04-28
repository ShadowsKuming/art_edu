<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted } from 'vue'
import { useSlideStore } from '@/stores/slides'
import SlideElement from './SlideElement.vue'

const slideStore = useSlideStore()
const canvasEl = ref<HTMLElement | null>(null)

provide('canvasEl', canvasEl)

function deselect() {
  slideStore.selectElement(null)
}

function onKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (target.isContentEditable) return
  if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return
  if ((e.key === 'Delete' || e.key === 'Backspace') && slideStore.selectedElementId && slideStore.activeSlide) {
    e.preventDefault()
    slideStore.removeElement(slideStore.activeSlide.id, slideStore.selectedElementId)
  }
}

onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div class="canvas-wrapper">
    <!-- No slide selected -->
    <div v-if="!slideStore.activeSlide" class="canvas-empty">
      <p>Select a slide from the sidebar or press <strong>+</strong> to create one.</p>
    </div>

    <!-- Slide canvas -->
    <div
      v-else
      ref="canvasEl"
      class="slide-canvas"
      @click.self="deselect"
    >
      <div
        v-if="slideStore.activeSlide.bgColor"
        class="slide-bg-color"
        :style="{ background: slideStore.activeSlide.bgColor }"
      />
      <img
        v-if="slideStore.activeSlide.background"
        :src="slideStore.activeSlide.background"
        class="slide-bg"
        @click="deselect"
      />
      <SlideElement
        v-for="el in slideStore.activeSlide.elements"
        :key="el.id"
        :element="el"
        :selected="slideStore.selectedElementId === el.id"
        @select="slideStore.selectElement(el.id)"
        @update="(patch) => slideStore.updateElement(slideStore.activeSlide!.id, el.id, patch)"
        @delete="slideStore.removeElement(slideStore.activeSlide!.id, el.id)"
      />
    </div>
  </div>
</template>

<style scoped>
.canvas-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
}

.slide-canvas {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.slide-bg-color {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.slide-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  z-index: 0;
}

.canvas-empty {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}

.canvas-empty p {
  font-size: 15px;
  color: #9ca3af;
  text-align: center;
}
</style>
