<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SectionHeading from './SectionHeading.vue'
import HowWeCanHelpCard from './HowWeCanHelpCard.vue'
import ContactInfoCard from './ContactInfoCard.vue'
import ContactForm from './ContactForm.vue'
import bannerUrl from '@/assets/images/contact-banner.png'

const { t } = useI18n()
</script>

<template>
  <section id="contact" class="contact">
    <div class="contact__inner">
      <!-- Header row: heading + paragraph + banner -->
      <div class="contact__header">
        <SectionHeading
          :title="t('home.contact.title')"
          :subtitle="t('home.contact.subtitle')"
        />
        <img
          :src="bannerUrl"
          :alt="t('home.contact.bannerAlt')"
          class="contact__banner"
        />
      </div>

      <!-- Two-column body: support + contact info on left, form on right -->
      <div class="contact__body">
        <div class="contact__column">
          <HowWeCanHelpCard />
          <ContactInfoCard />
        </div>
        <div class="contact__column">
          <ContactForm />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.contact {
  background: var(--color-bg);
  padding: var(--space-9) 0 var(--space-10);
}

.contact__inner {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 0 var(--gutter);
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.contact__header {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  align-items: center;
  gap: var(--space-7);
}

.contact__banner {
  justify-self: end;
  width: 100%;
  max-width: 488px;
  height: auto;
  border-radius: var(--radius-card);
  object-fit: cover;
}

.contact__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-7);
  align-items: start;
}

.contact__column {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  min-width: 0;
}

@media (max-width: 1100px) {
  .contact__body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 800px) {
  .contact__header {
    grid-template-columns: 1fr;
  }
  .contact__banner {
    justify-self: stretch;
  }
}
</style>
