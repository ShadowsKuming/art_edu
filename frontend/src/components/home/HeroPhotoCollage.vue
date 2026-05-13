<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import photo1 from '@/assets/images/hero-photo-1.png'
import photo2 from '@/assets/images/hero-photo-2.png'
import photo3 from '@/assets/images/hero-photo-3.png'

const { t } = useI18n()

interface Photo {
  src: string
  altKey: 'home.hero.photo1Alt' | 'home.hero.photo2Alt' | 'home.hero.photo3Alt'
  rotate: string
  shiftY: string
}

const photos: Photo[] = [
  { src: photo1, altKey: 'home.hero.photo1Alt', rotate: '-4deg',  shiftY: '40px' },
  { src: photo2, altKey: 'home.hero.photo2Alt', rotate: '3deg',   shiftY: '0px'  },
  { src: photo3, altKey: 'home.hero.photo3Alt', rotate: '-2deg',  shiftY: '64px' },
]
</script>

<template>
  <figure class="hero-collage" :aria-label="t('home.hero.mainImageAlt')">
    <ul class="hero-collage__list">
      <li
        v-for="(photo, i) in photos"
        :key="i"
        class="hero-collage__item"
        :style="{
          '--rotate': photo.rotate,
          '--shift-y': photo.shiftY,
        }"
      >
        <img :src="photo.src" :alt="t(photo.altKey)" class="hero-collage__img" />
      </li>
    </ul>
  </figure>
</template>

<style scoped>
.hero-collage {
  position: relative;
  margin: 0;
  padding: 0;
}

.hero-collage__list {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: clamp(-32px, -1.5vw, -8px);
  /* slight overlap between cards */
  /* Shift the photo collage up per Figma. */
  margin-top: -75px;
}

.hero-collage__item {
  flex: 0 1 320px;
  max-width: 340px;
  aspect-ratio: 4 / 5;
  border-radius: var(--radius-card);
  overflow: hidden;
  box-shadow: var(--shadow-photo);
  background: var(--color-input-bg);
  transform: rotate(var(--rotate, 0deg)) translateY(var(--shift-y, 0));
  /* Hover transitions/lift removed per design — collage sits static. */
}

.hero-collage__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (max-width: 900px) {
  .hero-collage__list {
    gap: var(--space-3);
    /* Reset the desktop overlap shift on tablet/mobile. */
    margin-top: 0;
  }
  .hero-collage__item {
    flex-basis: 30%;
    max-width: 30%;
  }
}
</style>
