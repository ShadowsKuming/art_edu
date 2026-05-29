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
      <!-- Video placeholder -->
      <div
        v-if="el.type === 'video'"
        class="st-video"
        :style="{
          left:   (el.x / CANVAS_W * 100) + '%',
          top:    (el.y / CANVAS_H * 100) + '%',
          width:  (el.width  / CANVAS_W * 100) + '%',
          height: (el.height / CANVAS_H * 100) + '%',
        }"
      >
        <svg viewBox="0 0 24 24" fill="white" class="st-play-icon">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
      <img
        v-else-if="el.type === 'image'"
        :src="el.src"
        class="st-img"
        :style="{
          left:   (el.x / CANVAS_W * 100) + '%',
          top:    (el.y / CANVAS_H * 100) + '%',
          width:  (el.width  / CANVAS_W * 100) + '%',
          height: (el.height / CANVAS_H * 100) + '%',
          objectFit:      el.objectFit,
          objectPosition: el.objectPosition,
        }"
      />
      <!-- Audio element. 2026-05-29 — Native `<audio controls>` so
           teachers can play embedded music clips directly in
           fullscreen teaching mode. `@click.stop` keeps clicks on
           the player from bubbling to the click-to-advance handler
           on `.tm-stage`. -->
      <div
        v-else-if="el.type === 'audio'"
        class="st-audio"
        :style="{
          left:   (el.x / CANVAS_W * 100) + '%',
          top:    (el.y / CANVAS_H * 100) + '%',
          width:  (el.width  / CANVAS_W * 100) + '%',
          height: (el.height / CANVAS_H * 100) + '%',
        }"
        @click.stop
        @mousedown.stop
      >
        <audio
          :src="el.src"
          controls
          preload="metadata"
          class="st-audio-player"
        />
      </div>
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
    <!-- Audio badge -->
    <div v-if="slide.audioBg" class="st-audio-badge" title="Has audio">
      <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10">
        <path d="M9 2v12L4 10H1V6h3L9 2zM11.5 5.5a3 3 0 010 5M13 3.5a5.5 5.5 0 010 9"/>
      </svg>
    </div>
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

.st-video {
  position: absolute;
  background: #1f2937;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  pointer-events: none;
}

.st-play-icon {
  width: 30%;
  height: 30%;
  opacity: 0.7;
}

/* 2026-05-29 — audio element box; box is transparent, native
   player fills its width. Stays interactive in TeachingMode
   (the parent `<div>` stops click/mousedown so the slide doesn't
   advance when the teacher hits play). */
.st-audio {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  box-sizing: border-box;
}

.st-audio-player {
  width: 100%;
  max-height: 100%;
}

.st-audio-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(4, 221, 123, 0.85);
  color: #fff;
  border-radius: 999px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
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
