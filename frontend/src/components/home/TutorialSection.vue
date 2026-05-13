<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SectionHeading from './SectionHeading.vue'
import TutorialCard from './TutorialCard.vue'
import bannerUrl from '@/assets/images/tutorial-banner.png'
import logoMarkUrl from '@/assets/images/logo-mark.png'
import step1 from '@/assets/images/tutorial-step-1.png'
import step2 from '@/assets/images/tutorial-step-2.png'
import step3 from '@/assets/images/tutorial-step-3.png'
import step4 from '@/assets/images/tutorial-step-4.png'
import step5 from '@/assets/images/tutorial-step-5.png'

interface StepCopy {
  title: string
  body: string
}

const { t, tm } = useI18n()

const stepImages = [step1, step2, step3, step4, step5]

const steps = computed(() => {
  const copy = (tm('home.tutorial.steps') as StepCopy[]) ?? []
  return stepImages.map((image, i) => ({
    image,
    title: copy[i]?.title ?? '',
    body: copy[i]?.body ?? '',
  }))
})

/**
 * Renders the intro paragraph with `home.tutorial.introBold` portion in semibold.
 * Splits the i18n string the first time the bold token appears and reassembles it.
 */
const introParts = computed(() => {
  const full = t('home.tutorial.intro')
  const bold = t('home.tutorial.introBold')
  const idx = full.indexOf(bold)
  if (idx === -1) return { before: full, bold: '', after: '' }
  return {
    before: full.slice(0, idx),
    bold,
    after: full.slice(idx + bold.length),
  }
})
</script>

<template>
  <section id="tutorial" class="tutorial">
    <div class="tutorial__inner">
      <!-- Header row: heading + subtitle on the left, banner illustration on the right -->
      <div class="tutorial__header">
        <SectionHeading
          :title="t('home.tutorial.title')"
          :subtitle="t('home.tutorial.subtitle')"
        />
        <img
          :src="bannerUrl"
          :alt="t('home.tutorial.bannerAlt')"
          class="tutorial__banner"
        />
      </div>

      <!-- 5-card grid with the connecting outlined strip behind it -->
      <div class="tutorial__cards-wrapper">
        <div class="tutorial__strip" aria-hidden="true" />
        <ol class="tutorial__cards">
          <li v-for="(s, i) in steps" :key="i" class="tutorial__cards-item">
            <TutorialCard
              :step="i + 1"
              :title="s.title"
              :body="s.body"
              :image="s.image"
              :image-alt="s.title"
            />
          </li>
        </ol>
      </div>

      <!-- Footer: small logo on the left, intro paragraph on the right -->
      <div class="tutorial__footer">
        <img
          :src="logoMarkUrl"
          alt="ArtBloom"
          class="tutorial__logo-mark"
        />
        <p class="tutorial__intro">
          <span>{{ introParts.before }}</span>
          <strong v-if="introParts.bold">{{ introParts.bold }}</strong>
          <span>{{ introParts.after }}</span>
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tutorial {
  background: var(--color-bg);
  padding: var(--space-9) 0;
}

.tutorial__inner {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 0 var(--gutter);
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.tutorial__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: var(--space-7);
}

.tutorial__banner {
  justify-self: end;
  width: 100%;
  max-width: 732px;
  height: auto;
  border-radius: var(--radius-card);
  object-fit: cover;
}

.tutorial__cards-wrapper {
  position: relative;
}

.tutorial__strip {
  /* Decorative outlined rectangle that visually links the 5 cards */
  position: absolute;
  inset: auto var(--space-3) 18%;
  border: 1.5px solid var(--color-primary);
  border-radius: 20px;
  height: clamp(80px, 10vw, 114px);
  z-index: 0;
  pointer-events: none;
}

.tutorial__cards {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-5);
  list-style: none;
  margin: 0;
  padding: 0;
}

.tutorial__cards-item {
  display: flex;
}

.tutorial__cards-item > * {
  width: 100%;
}

.tutorial__footer {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  flex-wrap: wrap;
}

.tutorial__logo-mark {
  height: 72px;
  width: auto;
  object-fit: contain;
  flex-shrink: 0;
}

.tutorial__intro {
  flex: 1;
  min-width: 320px;
  font-size: var(--fs-body);
  line-height: 1.4;
  color: var(--color-text-soft);
}

.tutorial__intro strong {
  font-weight: 600;
  color: var(--color-text-strong);
}

@media (max-width: 1200px) {
  .tutorial__cards {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .tutorial__strip {
    display: none;
  }
}

@media (max-width: 800px) {
  .tutorial__header {
    grid-template-columns: 1fr;
  }
  .tutorial__banner {
    justify-self: stretch;
  }
  .tutorial__cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 540px) {
  .tutorial__cards {
    grid-template-columns: 1fr;
  }
}
</style>
