<script setup lang="ts">
/**
 * Avatar picker popover.
 *
 * Native-`<dialog>` overlay (same defensive pattern as `AccessModal` and
 * `LessonSelectionModal`) that shows the 12 built-in avatars in a 6 × 2
 * grid. Tapping any avatar persists the choice via `userStore.setAvatarIndex`
 * and dismisses the dialog.
 *
 * Layout matches Figma frame `680:1280` (group `头像标签页`):
 *   • 900 × 342 panel @ 30 px radius, neutral `#F3F3F3` fill
 *   • 12 tiles, 130 px each, with 10 px gutters
 *   • selected tile sits inside a white pill with a soft shadow
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@/stores/user'
import { AVATARS } from '@/data/avatars'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const { t } = useI18n()
const userStore = useUserStore()

const dialogRef = ref<HTMLDialogElement | null>(null)

// Open / close in lock-step with the prop. `showModal()` gives us focus-trap,
// ESC-to-close, scroll-lock, and `::backdrop` for free.
watch(
    () => props.open,
    (isOpen) => {
        const dlg = dialogRef.value
        if (!dlg) return
        if (isOpen && !dlg.open) {
            dlg.showModal()
        } else if (!isOpen && dlg.open) {
            dlg.close()
        }
    },
)

/** Pick an avatar and close the popover. */
function pick(index: number) {
    userStore.setAvatarIndex(index)
    emit('update:open', false)
}

/**
 * Native `<dialog>` close — triggered by ESC or `dlg.close()`.
 * Sync the prop so v-model parent state stays consistent.
 */
function onClose() {
    if (props.open) emit('update:open', false)
}

/** Backdrop click → close. */
function onBackdropClick(event: MouseEvent) {
    const dlg = dialogRef.value
    if (!dlg) return
    const rect = dlg.getBoundingClientRect()
    const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
    if (!inside) emit('update:open', false)
}
</script>

<template>
    <dialog ref="dialogRef" class="apk" :aria-label="t('account.picker.ariaLabel')" @close="onClose"
        @click="onBackdropClick">
        <div class="apk__panel" @click.stop>
            <button type="button" class="apk__close" :aria-label="t('account.picker.closeAria')"
                @click="emit('update:open', false)">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M1 1l12 12M13 1L1 13" stroke="#5C6060" stroke-width="2" stroke-linecap="round" />
                </svg>
            </button>

            <ul class="apk__grid" role="listbox" :aria-label="t('account.picker.title')">
                <li v-for="(avatar, idx) in AVATARS" :key="avatar.id" class="apk__cell"
                    :class="{ 'apk__cell--selected': userStore.avatarIndex === idx }">
                    <button type="button" class="apk__tile" role="option"
                        :aria-selected="userStore.avatarIndex === idx" :aria-label="avatar.label" @click="pick(idx)">
                        <img :src="avatar.src" :alt="avatar.label" class="apk__img" />
                    </button>
                </li>
            </ul>
        </div>
    </dialog>
</template>

<style scoped>
/* ── Defensive base: no layout when closed (mirrors AccessModal). ── */

.apk {
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    max-width: none;
    max-height: none;
}

.apk:not([open]) {
    display: none;
}

.apk[open] {
    /* Centre the panel; native <dialog> uses its own positioning model. */
    width: min(900px, calc(100vw - 32px));
    margin: auto;
    overflow: visible;
}

.apk::backdrop {
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(4px);
}

/* ── Panel ───────────────────────────────────────────────── */

.apk__panel {
    position: relative;
    background: #F3F3F3;
    border-radius: 30px;
    padding: 35px;
    box-shadow:
        10px 10px 30px rgba(0, 0, 0, 0.10),
        5px 5px 20px rgba(0, 0, 0, 0.15);
}

.apk__close {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease;
}

.apk__close:hover {
    background: #fff;
}

.apk__close:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
}

/* ── Grid ────────────────────────────────────────────────── */

.apk__grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 10px;
}

.apk__cell {
    /* The selected cell gets a lifted white pill behind the tile. Using
       a wrapper rather than styling the button itself keeps the visual
       "lift" pixel-perfect against the panel fill. */
    border-radius: 50%;
    padding: 4px;
    background: transparent;
    transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.apk__cell--selected {
    background: #fff;
    box-shadow: 3px 3px 6px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
}

.apk__tile {
    display: block;
    width: 100%;
    aspect-ratio: 1 / 1;
    border: 0;
    padding: 0;
    background: transparent;
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.15s ease;
    overflow: hidden;
}

.apk__tile:hover {
    transform: scale(1.04);
}

.apk__tile:focus-visible {
    outline: 3px solid var(--color-primary);
    outline-offset: 3px;
}

.apk__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    user-select: none;
    -webkit-user-drag: none;
    pointer-events: none;
}

/* ── Responsive ──────────────────────────────────────────── */

@media (max-width: 720px) {
    .apk__panel {
        padding: 24px;
        border-radius: 24px;
    }

    .apk__grid {
        grid-template-columns: repeat(4, 1fr);
    }
}

@media (max-width: 480px) {
    .apk__grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
    }
}
</style>
