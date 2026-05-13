<script setup lang="ts">
defineProps<{
  /** 1-based step number (1-5). */
  step: number
  /** Card title. */
  title: string
  /** Card body copy. */
  body: string
  /** Image source for the top half of the card. */
  image: string
  /** Image alt text. */
  imageAlt: string
}>()
</script>

<template>
  <article class="tutorial-card" :data-step="step">
    <div class="tutorial-card__media">
      <img :src="image" :alt="imageAlt" class="tutorial-card__img" />
      <!-- Numbered chip overlapping the seam between image and body.
           Only place we genuinely need absolute positioning. -->
      <span class="tutorial-card__chip" aria-hidden="true">{{ step }}</span>
    </div>

    <div class="tutorial-card__body">
      <h3 class="tutorial-card__title">{{ title }}</h3>
      <p class="tutorial-card__text">{{ body }}</p>
    </div>
  </article>
</template>

<style scoped>
.tutorial-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-card-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  /* Color is applied via [data-step] selectors below */
  background: var(--grad-card-1);
  isolation: isolate;
}

.tutorial-card[data-step='1'] { background: var(--grad-card-1); }
.tutorial-card[data-step='2'] { background: var(--grad-card-2); }
.tutorial-card[data-step='3'] { background: var(--grad-card-3); }
.tutorial-card[data-step='4'] { background: var(--grad-card-4); }
.tutorial-card[data-step='5'] { background: var(--grad-card-5); }

.tutorial-card__media {
  position: relative;
  width: 100%;
  aspect-ratio: 322 / 242;
  background: rgba(255, 255, 255, 0.4);
  border-bottom: 1px solid #DDDDDD;
  /* Allow the chip to overflow the bottom edge */
  overflow: visible;
}

.tutorial-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* Image clip is on the image itself so border-radius corners stay clean */
  border-radius: var(--radius-card-lg) var(--radius-card-lg) 0 0;
}

.tutorial-card__chip {
  /* Sits on the seam between media and body — half above, half below */
  position: absolute;
  bottom: -27px;
  left: var(--space-5);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 55px;
  height: 55px;
  border-radius: 50%;
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 30px;
  line-height: 1;
  color: var(--color-bg);
  background: var(--chip-1);
  box-shadow: var(--shadow-soft);
  z-index: 2;
}

.tutorial-card[data-step='1'] .tutorial-card__chip { background: var(--chip-1); }
.tutorial-card[data-step='2'] .tutorial-card__chip { background: var(--chip-2); }
.tutorial-card[data-step='3'] .tutorial-card__chip { background: var(--chip-3); }
.tutorial-card[data-step='4'] .tutorial-card__chip { background: var(--chip-4); }
.tutorial-card[data-step='5'] .tutorial-card__chip { background: var(--chip-5); }

.tutorial-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-7) var(--space-5) var(--space-6);
  flex: 1;
}

.tutorial-card__title {
  font-family: var(--font-body);
  font-weight: 700;
  font-size: var(--fs-card-title);
  line-height: 1.2;
  color: var(--color-text-strong);
}

.tutorial-card__text {
  font-size: var(--fs-body);
  line-height: 1.4;
  color: var(--color-text-soft);
}
</style>
