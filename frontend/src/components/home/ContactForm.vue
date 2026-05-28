<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const form = reactive({
  name: '',
  email: '',
  phone: '',
  message: '',
})

function onSubmit() {
  // Submission wiring will be added later. For now, log to console so
  // the markup remains semantic (a real <form> with submit button).
  // eslint-disable-next-line no-console
  console.info('[ArtBloom] Contact form submitted:', { ...form })
}
</script>

<template>
  <!--
    2026-05 — Contact form rewrite.
    The previous markup wrapped each row of inputs in a `<fieldset>` and
    applied `display: grid` / `display: flex` to the fieldset itself.
    In Chrome ≤ ~123 and Safari, `<fieldset>` does NOT honour grid/flex
    layout on the element itself (it forces `display: block` on the
    anonymous fieldset content box), which on this page caused the
    inputs to collapse to zero height and effectively disappear from the
    contact section.

    Switched to plain `<div>` containers — semantics are still good
    (real `<form>` + `<label>` per field) and the inputs now render
    reliably across browsers.

    Also simplified to a single "Name" field (down from First / Last)
    so the form mirrors the Figma spec (姓名 / 邮箱 / 手机 / 信息 / 发送).
  -->
  <form class="contact-form" novalidate @submit.prevent="onSubmit">
    <!-- Name -->
    <div class="contact-form__field">
      <label class="contact-form__label" for="cf-name">
        {{ t('home.contact.form.nameLabel') }}
        <span class="contact-form__required" aria-hidden="true">⁕</span>
        <span class="sr-only">({{ t('home.contact.form.required') }})</span>
      </label>
      <input
        id="cf-name"
        v-model="form.name"
        type="text"
        class="contact-form__input"
        :placeholder="t('home.contact.form.namePlaceholder')"
        autocomplete="name"
        required
      />
    </div>

    <!-- Email + Phone -->
    <div class="contact-form__row">
      <div class="contact-form__field">
        <label class="contact-form__label" for="cf-email">
          {{ t('home.contact.form.emailLabel') }}
          <span class="contact-form__required" aria-hidden="true">⁕</span>
        </label>
        <input
          id="cf-email"
          v-model="form.email"
          type="email"
          class="contact-form__input"
          :placeholder="t('home.contact.form.emailPlaceholder')"
          autocomplete="email"
          required
        />
      </div>

      <div class="contact-form__field">
        <label class="contact-form__label" for="cf-phone">
          {{ t('home.contact.form.phoneLabel') }}
          <span class="contact-form__required" aria-hidden="true">⁕</span>
        </label>
        <input
          id="cf-phone"
          v-model="form.phone"
          type="tel"
          class="contact-form__input"
          :placeholder="t('home.contact.form.phonePlaceholder')"
          autocomplete="tel"
          required
        />
      </div>
    </div>

    <!-- Message -->
    <div class="contact-form__field">
      <label class="contact-form__label" for="cf-message">
        {{ t('home.contact.form.messageLabel') }}
      </label>
      <textarea
        id="cf-message"
        v-model="form.message"
        class="contact-form__input contact-form__textarea"
        :placeholder="t('home.contact.form.messagePlaceholder')"
        rows="4"
      />
    </div>

    <button type="submit" class="contact-form__submit">
      {{ t('home.contact.form.send') }}
    </button>
  </form>
</template>

<style scoped>
.contact-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  width: 100%;
  min-width: 0;
}

.contact-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
  align-items: end;
}

.contact-form__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.contact-form__label {
  font-family: var(--font-body);
  font-weight: 500;
  font-size: var(--fs-body-lg);
  color: var(--color-text);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.contact-form__required {
  color: var(--color-danger);
  font-size: 28px;
  line-height: 0;
  font-family: var(--font-body);
}

.contact-form__input {
  appearance: none;
  width: 100%;
  background: var(--color-input-bg);
  border: 1px solid transparent;
  border-radius: var(--radius-input);
  padding: 14px 18px;
  font-size: var(--fs-body);
  color: var(--color-text);
  outline: none;
  transition: border-color 0.15s ease, background 0.15s ease;
  box-sizing: border-box;
}

.contact-form__input::placeholder {
  color: var(--color-text-placeholder);
}

.contact-form__input:focus {
  border-color: var(--color-primary);
  background: var(--color-bg);
}

.contact-form__textarea {
  resize: vertical;
  min-height: 120px;
  line-height: 1.5;
  font-family: var(--font-body);
}

.contact-form__submit {
  align-self: stretch;
  background: var(--color-primary);
  color: var(--color-text);
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 22px;
  height: 70px;
  border: 0;
  border-radius: var(--radius-pill);
  cursor: pointer;
  margin-top: var(--space-4);
  transition: transform 0.15s ease, filter 0.15s ease;
}

.contact-form__submit:hover {
  transform: translateY(-1px);
  filter: brightness(0.97);
}

.contact-form__submit:active {
  transform: translateY(0);
}

@media (max-width: 720px) {
  .contact-form__row {
    grid-template-columns: 1fr;
  }
}
</style>
