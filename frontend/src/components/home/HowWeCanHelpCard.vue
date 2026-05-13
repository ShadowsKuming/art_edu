<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import supportIcon from '@/assets/images/support.svg'
import collaborationIcon from '@/assets/images/collaboration.svg'
import feedbackIcon from '@/assets/images/feedback.svg'

interface HelpItem {
  title: string
  body: string
}

type IconKey = 'support' | 'collaboration' | 'feedback'

const { t, tm } = useI18n()

/**
 * Per-item icon assets — keyed by iconKey so the order in i18n
 * (Access Support / Research collaboration / Feedback) maps 1:1
 * to the correct SVG.
 */
const iconMap: Record<IconKey, string> = {
  support: supportIcon,
  collaboration: collaborationIcon,
  feedback: feedbackIcon,
}

const items = computed(() => {
  const copy = (tm('home.contact.helpItems') as HelpItem[]) ?? []
  const keys: IconKey[] = ['support', 'collaboration', 'feedback']
  return copy.map((item, i) => ({ ...item, iconKey: keys[i] }))
})
</script>

<template>
  <article class="help-card">
    <h3 class="help-card__title">{{ t('home.contact.helpTitle') }}</h3>

    <ul class="help-card__list">
      <li
        v-for="(item, i) in items"
        :key="i"
        class="help-card__item"
      >
        <span
          class="help-card__bubble"
          :class="`help-card__bubble--${item.iconKey}`"
          aria-hidden="true"
        >
          <img
            :src="iconMap[item.iconKey]"
            class="help-card__icon"
            alt=""
            aria-hidden="true"
          />
        </span>

        <div class="help-card__text">
          <h4 class="help-card__item-title">{{ item.title }}</h4>
          <p class="help-card__item-body">{{ item.body }}</p>
        </div>
      </li>
    </ul>
  </article>
</template>

<style scoped>
.help-card {
  background: var(--color-surface-soft);
  border-radius: var(--radius-card-lg);
  padding: var(--space-6) var(--space-7);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.help-card__title {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 22px;
  color: var(--color-text-muted);
}

.help-card__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  list-style: none;
  margin: 0;
  padding: 0;
}

.help-card__item {
  display: grid;
  grid-template-columns: 75px 1fr;
  align-items: center;
  gap: var(--space-5);
}

.help-card__bubble {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 75px;
  height: 75px;
  border-radius: 50%;
  color: var(--color-text);
  flex-shrink: 0;
}

.help-card__bubble--support       { background: var(--bubble-support); }
.help-card__bubble--collaboration { background: var(--bubble-collaboration); }
.help-card__bubble--feedback      { background: var(--bubble-feedback); }

.help-card__icon {
  width: 50%;
  height: 50%;
  display: block;
  object-fit: contain;
}

.help-card__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.help-card__item-title {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 22px;
  color: var(--color-text-muted);
}

.help-card__item-body {
  font-size: var(--fs-body-sm);
  line-height: 1.4;
  color: var(--color-text-muted);
}

@media (max-width: 540px) {
  .help-card {
    padding: var(--space-5);
  }
  .help-card__item {
    grid-template-columns: 60px 1fr;
    gap: var(--space-4);
  }
  .help-card__bubble {
    width: 60px;
    height: 60px;
  }
}
</style>
