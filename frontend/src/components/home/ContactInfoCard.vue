<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import emailIcon from '@/assets/images/email.svg'
import wechatIcon from '@/assets/images/wechat.svg'

const { t } = useI18n()
</script>

<template>
  <article class="info-card">
    <div class="info-card__row">
      <span class="info-card__icon info-card__icon--email" aria-hidden="true">
        <img :src="emailIcon" alt="" aria-hidden="true" />
      </span>
      <div class="info-card__text">
        <h4 class="info-card__label">{{ t('home.contact.emailLabel') }}</h4>
        <a
          :href="`mailto:${t('home.contact.emailValue')}`"
          class="info-card__value"
        >
          {{ t('home.contact.emailValue') }}
        </a>
      </div>
    </div>

    <hr class="info-card__divider" />

    <div class="info-card__row">
      <span class="info-card__icon info-card__icon--wechat" aria-hidden="true">
        <img :src="wechatIcon" alt="" aria-hidden="true" />
      </span>
      <div class="info-card__text">
        <h4 class="info-card__label">{{ t('home.contact.wechatLabel') }}</h4>
        <span class="info-card__value">{{ t('home.contact.wechatValue') }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.info-card {
  display: grid;
  grid-template-columns: 1fr;
  /* Stack rows vertically with the divider between them, matching the
     Figma "Email above WeChat" layout. */
  gap: var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card-lg);
  padding: var(--space-5) var(--space-6);
  box-shadow: var(--shadow-card);
}

.info-card__row {
  display: grid;
  grid-template-columns: 56px 1fr;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
}

.info-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  color: var(--color-text-muted);
  flex-shrink: 0;
  /* Subclass-driven background colour — soft purple for email,
     soft green for WeChat (per Figma). */
}

.info-card__icon--email  { background: var(--bubble-email);  }
.info-card__icon--wechat { background: var(--bubble-wechat); }

.info-card__icon svg,
.info-card__icon img {
  width: 60%;
  height: 60%;
  display: block;
  object-fit: contain;
}

.info-card__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.info-card__label {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 22px;
  color: var(--color-text-muted);
}

.info-card__value {
  font-size: var(--fs-body-lg);
  color: var(--color-text-muted);
  word-break: break-all;
}

a.info-card__value:hover {
  text-decoration: underline;
}

.info-card__divider {
  width: 100%;
  height: 1px;
  border: 0;
  background: var(--color-border);
  margin: 0;
  opacity: 0.9;
}
</style>
