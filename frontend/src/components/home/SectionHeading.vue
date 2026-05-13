<script setup lang="ts">
import underlineSvg from '@/assets/images/Underline.svg'

defineProps<{
  /** Headline text (e.g. "Tutorial", "Contact Us"). */
  title: string
  /** Optional supporting paragraph. */
  subtitle?: string
}>()
</script>

<template>
  <header class="section-heading">
    <h2 class="section-heading__title">
      {{ title }}
      <!-- Decorative wavy underline — uses the shared Underline.svg asset. -->
      <img
        :src="underlineSvg"
        class="section-heading__underline"
        alt=""
        aria-hidden="true"
      />
    </h2>
    <p v-if="subtitle" class="section-heading__subtitle">{{ subtitle }}</p>
  </header>
</template>

<style scoped>
.section-heading {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 770px;
}

.section-heading__title {
  display: inline-block;
  position: relative;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--fs-h2);
  line-height: 1.1;
  color: var(--color-text);
  letter-spacing: -0.5px;
}

.section-heading__underline {
  display: block;
  width: clamp(180px, 28vw, 320px);
  height: auto;
  margin-top: var(--space-2);
}

.section-heading__subtitle {
  font-size: var(--fs-body-lg);
  line-height: 1.4;
  color: var(--color-text-soft);
  max-width: 770px;
}
</style>
