<script setup lang="ts">
/**
 * Global toast renderer. Mount **once** in `App.vue` (just after the
 * `<RouterView />`) and any view/component can fire a message via
 * `useToastStore().show(text)`.
 *
 * Visual design — pill-shaped card, fixed at the bottom-right, with a
 * 240 ms slide-in / fade-out transition. The `tone` from the store
 * picks an accent colour (success = brand green by default).
 *
 * Clicking the card dismisses it immediately.
 */
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
    <Teleport to="body">
        <Transition name="toast">
            <div
                v-if="toast.current"
                :key="toast.current.id"
                class="toast"
                :class="`toast--${toast.current.tone}`"
                role="status"
                aria-live="polite"
                @click="toast.dismiss()"
            >
                <span class="toast__icon" aria-hidden="true">
                    <!-- Success checkmark by default; tone-specific marks
                         could swap here later if product asks. -->
                    <svg viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="9" stroke="currentColor"
                            stroke-width="1.6" fill="rgba(255,255,255,0.18)" />
                        <path d="M6 10.5l2.5 2.5L14 7.5"
                            stroke="currentColor" stroke-width="1.8"
                            stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </span>
                <span class="toast__text">{{ toast.current.text }}</span>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.toast {
    position: fixed;
    bottom: 32px;
    right: 32px;
    z-index: 9999;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px 12px 14px;
    border-radius: 999px;
    background: #111827;
    color: #fff;
    font-family: var(--font-body, 'Albert Sans', system-ui, sans-serif);
    font-size: 14px;
    font-weight: 500;
    line-height: 1.3;
    box-shadow:
        0 10px 24px rgba(0, 0, 0, 0.18),
        0 2px 6px rgba(0, 0, 0, 0.10);
    cursor: pointer;
    max-width: 360px;
}

.toast__icon {
    display: inline-flex;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
}

.toast__icon svg {
    width: 100%;
    height: 100%;
}

/* Tone accents — currently only the icon shifts colour. */
.toast--success .toast__icon { color: #7FEC8F; }
.toast--info    .toast__icon { color: #60a5fa; }
.toast--warning .toast__icon { color: #fbbf24; }

.toast__text {
    /* Allow wrapping on long messages — pill stays pill-ish but grows
       vertically rather than spilling off the viewport. */
    white-space: normal;
}

/* Enter / leave transition (slide up + fade). */
.toast-enter-from {
    opacity: 0;
    transform: translateY(12px);
}
.toast-enter-active,
.toast-leave-active {
    transition:
        opacity 0.24s ease,
        transform 0.24s ease;
}
.toast-leave-to {
    opacity: 0;
    transform: translateY(12px);
}
</style>
