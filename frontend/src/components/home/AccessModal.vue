<script setup lang="ts">
/**
 * Access-with-invitation-code modal.
 *
 * Built on top of the native <dialog> element so we get a free focus trap,
 * ESC-to-close, scroll lock, ::backdrop styling, and focus restore — no
 * portal/teleport or external library required.
 *
 * The component is intentionally "dumb": it doesn't validate the code or
 * navigate anywhere itself. Instead it emits `submit(code)` so the parent
 * (the SiteHeader) can decide what happens next. Once a real backend
 * exists, the parent can swap the navigation for an API call without
 * touching this file.
 */
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import logoUrl from '@/assets/images/logo-mark.png'

interface Props {
  /** Two-way bound `v-model:open` from the parent. */
  open: boolean
  /** Optional error message shown below the input. */
  error?: string
}
const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'submit', code: string): void
}>()

const { t } = useI18n()

const dialogEl = ref<HTMLDialogElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const code = ref('')

/**
 * Sync the native <dialog> open state with the `open` prop.
 * Using showModal() rather than the `open` attribute so we get the
 * built-in modal semantics (focus trap, backdrop, scroll lock, and the
 * UA-supplied centering via `position: fixed; inset: 0; margin: auto`).
 */
watch(
  () => props.open,
  async (isOpen) => {
    const dlg = dialogEl.value
    if (!dlg) return
    if (isOpen && !dlg.open) {
      dlg.showModal()
      // Focus the input so the user can start typing immediately.
      await nextTick()
      inputEl.value?.focus()
    } else if (!isOpen && dlg.open) {
      dlg.close()
    }
  },
)

/** Triggered by ESC key + native dialog.close() — keeps prop in sync. */
function onNativeClose() {
  if (props.open) emit('update:open', false)
}

function close() {
  emit('update:open', false)
}

/**
 * If the user clicks the dialog backdrop (which from the DOM's perspective
 * is a click directly on the <dialog> element rather than on an inner
 * child), dismiss the modal.
 */
function onBackdropClick(event: MouseEvent) {
  if (event.target === dialogEl.value) close()
}

function onSubmit() {
  emit('submit', code.value.trim())
  // Reset the field so the next open shows an empty input.
  code.value = ''
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="access-modal"
    aria-labelledby="access-modal-title"
    aria-describedby="access-modal-subtitle"
    @close="onNativeClose"
    @click="onBackdropClick"
  >
    <button
      type="button"
      class="access-modal__close"
      :aria-label="t('home.access.closeAria')"
      @click="close"
    >
      <!-- Inline X icon — purely decorative (button has aria-label) -->
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 6l12 12M18 6 6 18"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
        />
      </svg>
    </button>

    <img :src="logoUrl" :alt="t('brand.name')" class="access-modal__logo" />

    <h2 id="access-modal-title" class="access-modal__title">
      {{ t('home.access.title') }}
    </h2>
    <p id="access-modal-subtitle" class="access-modal__subtitle">
      {{ t('home.access.subtitle') }}
    </p>

    <form class="access-modal__form" @submit.prevent="onSubmit">
      <label for="access-modal-input" class="sr-only">
        {{ t('home.access.placeholder') }}
      </label>
      <input
        id="access-modal-input"
        ref="inputEl"
        v-model="code"
        type="text"
        class="access-modal__input"
        :class="{ 'access-modal__input--error': !!error }"
        :placeholder="t('home.access.placeholder')"
        autocomplete="off"
        spellcheck="false"
      />

      <p v-if="error" class="access-modal__error" role="alert">{{ error }}</p>

      <button type="submit" class="access-modal__submit">
        {{ t('home.access.submit') }}
      </button>
    </form>
  </dialog>
</template>

<style scoped>
/* ── The dialog itself ─────────────────────────────────────────────
 *
 * The base `.access-modal` rule MUST NOT set `display`, `position`,
 * `inset`, or `margin`. Doing so overrides the user-agent stylesheet
 * for a *closed* <dialog>, which would cause the dialog's children
 * (logo, headings, input, submit button) to leak into the document
 * flow on initial page load — exactly the "modal showing without
 * clicking Access" bug.
 *
 * UA defaults we rely on:
 *   • closed dialog → `display: none`        (so it's invisible)
 *   • open  dialog → `position: fixed; inset: 0; margin: auto;`
 *                    (which is what centers it on the screen)
 *
 * All layout rules below are gated on the `[open]` attribute.
 * ─────────────────────────────────────────────────────────────── */

.access-modal {
  /* Skin only — no layout. */
  border: 0;
  background: var(--color-bg);
  color: var(--color-text);
  border-radius: var(--radius-card-lg);
  box-shadow: 12px 12px 20px rgba(0, 0, 0, 0.12);
  padding: 0;
  width: min(665px, 92vw);
  max-height: 90vh;
  box-sizing: border-box;
  overflow: visible;
}

.access-modal[open] {
  /* Explicit centering — we don't trust the UA's `inset: 0; margin: auto`
     to fire (it depends on a fully-resolved height which doesn't always
     happen for flex-column dialogs in Chromium). The translate trick is
     rock-solid regardless of ancestor styles. */
  position: fixed;
  top: 50%;
  left: 50%;
  translate: -50% -50%;
  margin: 0;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: 56px 88px 64px;
  animation: access-modal-in 220ms ease-out;
}

.access-modal::backdrop {
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  animation: access-modal-backdrop-in 220ms ease-out;
}

@keyframes access-modal-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
}

@keyframes access-modal-backdrop-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Close button ──────────────────────────────────────────────── */

.access-modal__close {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.access-modal__close:hover {
  background: var(--color-input-bg);
  color: var(--color-text);
}

.access-modal__close svg {
  width: 22px;
  height: 22px;
  display: block;
}

/* ── Brand logo + headings ─────────────────────────────────────── */

.access-modal__logo {
  width: clamp(160px, 35%, 230px);
  height: auto;
  object-fit: contain;
  margin-bottom: var(--space-3);
  user-select: none;
}

.access-modal__title {
  margin: 0;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: clamp(22px, 2.4vw, 26px);
  line-height: 1.5;
  color: var(--color-text);
  text-align: center;
}

.access-modal__subtitle {
  margin: 0;
  font-family: var(--font-body);
  font-weight: 400;
  font-size: var(--fs-body);
  line-height: 1.5;
  color: var(--color-text-soft);
  text-align: center;
  max-width: 38ch;
}

/* ── Form (input + submit) ─────────────────────────────────────── */

.access-modal__form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.access-modal__error {
  margin: -4px 0 0;
  font-size: 14px;
  color: #dc2626;
  text-align: center;
  font-weight: 500;
}

.access-modal__input {
  appearance: none;
  width: 100%;
  height: 55px;
  padding: 0 24px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: var(--color-input-bg);
  font-family: var(--font-body);
  font-size: var(--fs-body);
  color: var(--color-text);
  text-align: center;
  outline: none;
  transition: border-color 0.15s ease, background 0.15s ease;
  box-sizing: border-box;
}

.access-modal__input::placeholder {
  color: #756666;
  /* Per Figma — subtler than --color-text-placeholder. */
}

.access-modal__input:focus {
  border-color: var(--color-primary);
  background: var(--color-bg);
}

.access-modal__input--error {
  border-color: #dc2626;
  background: #fff5f5;
}

.access-modal__submit {
  width: 100%;
  height: 55px;
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-text);
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 20px;
  cursor: pointer;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.access-modal__submit:hover {
  transform: translateY(-1px);
  filter: brightness(0.97);
}

.access-modal__submit:active {
  transform: translateY(0);
}

/* ── Responsive tweaks (no absolute positioning required) ─────── */

@media (max-width: 720px) {
  .access-modal[open] {
    padding: 44px 32px 48px;
    gap: var(--space-3);
  }
  .access-modal {
    width: min(94vw, 480px);
  }
  .access-modal__logo {
    width: clamp(140px, 45%, 200px);
  }
}

@media (max-width: 480px) {
  .access-modal[open] {
    padding: 36px 22px 40px;
  }
  .access-modal__input,
  .access-modal__submit {
    height: 50px;
  }
}
</style>
