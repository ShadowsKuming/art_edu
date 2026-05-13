<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import HeroPhotoCollage from './HeroPhotoCollage.vue'
import heroMain from '@/assets/images/hero-main.png'

const { t } = useI18n()
</script>

<template>
  <section id="home" class="hero" :aria-label="t('home.nav.home')">
    <div class="hero__inner">
      <!-- Left column: wordmark on top of painted-shapes hero image, plus paragraph -->
      <div class="hero__primary">
        <div class="hero__art-stack">
          <img
            :src="heroMain"
            :alt="t('home.hero.mainImageAlt')"
            class="hero__art"
          />
          <h1 class="hero__title">
            <span class="hero__title-line">{{ t('home.hero.titleArt') }}</span>
            <span class="hero__title-line hero__title-line--light">
              {{ t('home.hero.titleBloom') }}
            </span>
          </h1>
        </div>
        <p class="hero__description">{{ t('home.hero.description') }}</p>
      </div>

      <!-- Right column: 3 rotated photo cards with handwritten captions -->
      <HeroPhotoCollage class="hero__collage" />
    </div>
  </section>
</template>

<style scoped>
.hero {
  width: 100%;
  background: var(--color-bg);
  padding: var(--space-7) 0 var(--space-9);
  overflow: hidden;
}

.hero__inner {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 0 var(--gutter);
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: clamp(var(--space-5), 4vw, var(--space-9));
  align-items: center;
}

.hero__primary {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
  min-width: 0;
}

/* Pull the description block up to sit closer to the wordmark/illustration,
   matching the Figma layout. */
.hero__description {
  margin-top: -150px;
  /* Lift the paragraph above the hero illustration so its text isn't
     covered by the painted shapes. */
  position: relative;
  z-index: 2;
}

.hero__art-stack {
  position: relative;
  width: 100%;
  aspect-ratio: 998 / 848;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.hero__art {
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  pointer-events: none;
}

.hero__title {
  /* Overlay the wordmark on top of the painted shapes */
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--fs-hero);
  line-height: 0.95;
  color: var(--color-text);
  letter-spacing: -2px;
  padding-left: clamp(var(--space-2), 2vw, var(--space-6));
}

.hero__title-line {
  display: block;
  font-weight: 700;
}

.hero__title-line--light {
  font-weight: 300;
}

.hero__description {
  font-size: var(--fs-body-lg);
  line-height: 1.4;
  color: var(--color-text);
  max-width: 770px;
  /* Negative margin defined above to shift the paragraph up by ~150px. */
}

.hero__collage {
  min-width: 0;
}

@media (max-width: 1100px) {
  .hero__inner {
    grid-template-columns: 1fr;
  }
  .hero__title {
    position: static;
    inset: auto;
    padding: 0;
  }
  .hero__art-stack {
    aspect-ratio: auto;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-5);
  }
  .hero__art {
    aspect-ratio: 998 / 600;
  }
  /* Disable the desktop overlap shift on small screens — the columns stack
     vertically so we don't want the description hugging the illustration. */
  .hero__description {
    margin-top: 0;
  }
}

@media (max-width: 720px) {
  .hero {
    padding: var(--space-5) 0 var(--space-7);
  }
}
</style>
