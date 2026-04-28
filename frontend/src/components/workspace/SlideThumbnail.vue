<script setup lang="ts">
import type { Slide } from '@/stores/slides'
import { CANVAS_W, CANVAS_H } from '@/stores/slides'

defineProps<{ slide: Slide }>()
</script>

<template>
  <div class="st-root">
    <div v-if="slide.bgColor" class="st-bg-color" :style="{ background: slide.bgColor }" />
    <img v-if="slide.background" :src="slide.background" class="st-bg" />
    <template v-for="el in slide.elements" :key="el.id">
      <img
        v-if="el.type === 'image'"
        :src="el.src"
        class="st-img"
        :style="{
          left:   (el.x / CANVAS_W * 100) + '%',
          top:    (el.y / CANVAS_H * 100) + '%',
          width:  (el.width  / CANVAS_W * 100) + '%',
          height: (el.height / CANVAS_H * 100) + '%',
        }"
      />
      <div
        v-else
        class="st-text"
        :style="{
          left:       (el.x / CANVAS_W * 100) + '%',
          top:        (el.y / CANVAS_H * 100) + '%',
          width:      (el.width  / CANVAS_W * 100) + '%',
          height:     (el.height / CANVAS_H * 100) + '%',
          fontSize:   (el.fontSize / CANVAS_W * 100) + 'cqw',
          fontFamily: el.fontFamily,
          color:      el.color,
          fontWeight: el.fontWeight === 'Bold' ? '700' : el.fontWeight === 'Medium' ? '500' : '400',
          textAlign:  el.textAlign,
        }"
      >{{ el.content }}</div>
    </template>
  </div>
</template>

<style scoped>
.st-root {
  position: relative;
  width: 100%;
  height: 100%;
  background: #fff;
  container-type: inline-size;
  overflow: hidden;
}

.st-bg-color {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.st-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.st-img {
  position: absolute;
  object-fit: contain;
  pointer-events: none;
}

.st-text {
  position: absolute;
  overflow: hidden;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  pointer-events: none;
}
</style>
