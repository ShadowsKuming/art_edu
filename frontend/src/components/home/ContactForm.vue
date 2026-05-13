<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const form = reactive({
  firstName: '',
  lastName: '',
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
  <form class="contact-form" novalidate @submit.prevent="onSubmit">
    <!-- Name (first / last) -->
    <fieldset class="contact-form__fieldset contact-form__fieldset--row">
      <legend class="sr-only">{{ t('home.contact.form.nameLabel') }}</legend>

      <div class="contact-form__field">
        <label class="contact-form__label" for="cf-first-name">
          {{ t('home.contact.form.nameLabel') }}
          <span class="contact-form__required" aria-hidden="true">⁕</span>
          <span class="sr-only">({{ t('home.contact.form.required') }})</span>
        </label>
        <input
          id="cf-first-name"
          v-model="form.firstName"
          type="text"
          class="contact-form__input"
          :placeholder="t('home.contact.form.firstNamePlaceholder')"
          required
        />
      </div>

      <div class="contact-form__field">
        <label class="contact-form__label sr-only" for="cf-last-name">
          {{ t('home.contact.form.lastNamePlaceholder') }}
        </label>
        <input
          id="cf-last-name"
          v-model="form.lastName"
          type="text"
          class="contact-form__input"
          :placeholder="t('home.contact.form.lastNamePlaceholder')"
          required
        />
      </div>
    </fieldset>

    <!-- Email + Phone -->
    <fieldset class="contact-form__fieldset contact-form__fieldset--row">
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
          required
        />
      </div>
    </fieldset>

    <!-- Message -->
    <fieldset class="contact-form__fieldset">
      <div class="contact-form__field">
        <label class="contact-form__label" for="cf-message">
          {{ t('home.contact.form.messageLabel') }}
        </label>
        <textarea
          id="cf-message"
          v-model="form.message"
          class="contact-form__input contact-form__textarea"
          rows="4"
        />
      </div>
    </fieldset>

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
}

.contact-form__fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.contact-form__fieldset--row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
  /* The first column has a visible label, the second uses an `sr-only`
     label — without this rule the second input would float to the top
     of its track. Aligning the grid items to the bottom forces both
     `<input>` elements onto the same baseline. */
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
  min-height: 90px;
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
  .contact-form__fieldset--row {
    grid-template-columns: 1fr;
  }
}
</style>
