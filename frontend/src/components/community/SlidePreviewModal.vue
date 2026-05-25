<script setup lang="ts">
/**
 * Reusable read-only slide-deck previewer.
 *
 * Shows the full hydrated slide list of a lesson — one large
 * `<SlideThumbnail>` per slide, vertically stacked and scrollable —
 * with a header that carries the lesson title + subtitle and a close
 * (×) button. No edit controls; this is purely "look, don't touch".
 *
 * Used by:
 *   • Community page Preview button (current consumer).
 *   • Future My Lessons row "👁 Preview" action (drop-in).
 *
 * Close triggers: ✕ button, backdrop click, Esc key, or programmatic
 * `emit('close')` from the parent.
 */
import { onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SlideThumbnail from '@/components/workspace/SlideThumbnail.vue'
import type { Slide } from '@/stores/slides'

interface Props {
    open: boolean
    slides: Slide[]
    title: string
    subtitle?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
    (e: 'close'): void
}>()

const { t } = useI18n()

/**
 * Per-slide label derived from the slide's `partId` and its position
 * inside that Part. The numbering resets per Part so the previewer
 * matches the workspace sidebar's "Part 2 · Slide 1 / 2" rhythm.
 */
const labelledSlides = computed(() => {
    const seenPerPart = new Map<number, number>()
    return props.slides.map((slide) => {
        const next = (seenPerPart.get(slide.partId) ?? 0) + 1
        seenPerPart.set(slide.partId, next)
        return {
            slide,
            label: t('community.preview.slideOf', {
                part: slide.partId,
                n: next,
            }),
        }
    })
})

function close() {
    emit('close')
}

function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && props.open) close()
}

onMounted(() => {
    window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
})

/**
 * Lock body scroll while the modal is open, restoring on close, so
 * the user can scroll inside the modal panel without the page
 * underneath also scrolling.
 */
watch(
    () => props.open,
    (isOpen) => {
        if (typeof document === 'undefined') return
        document.body.style.overflow = isOpen ? 'hidden' : ''
    },
)
</script>

<template>
    <Teleport to="body">
        <Transition name="spm">
            <div v-if="open" class="spm-backdrop" @click.self="close"
                role="dialog" aria-modal="true" :aria-label="t('community.preview.title')">
                <div class="spm-panel">
                    <header class="spm-head">
                        <div class="spm-head__text">
                            <p class="spm-head__kicker">{{ t('community.preview.title') }}</p>
                            <h2 class="spm-head__title">{{ title }}</h2>
                            <p v-if="subtitle" class="spm-head__subtitle">{{ subtitle }}</p>
                        </div>
                        <button class="spm-head__close" type="button"
                            :aria-label="t('community.preview.close')" @click="close">
                            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor"
                                    stroke-width="1.8" stroke-linecap="round" />
                            </svg>
                        </button>
                    </header>

                    <div class="spm-body" :aria-label="t('community.preview.title')">
                        <article v-for="(item, idx) in labelledSlides" :key="item.slide.id ?? idx"
                            class="spm-slide">
                            <span class="spm-slide__label">{{ item.label }}</span>
                            <div class="spm-slide__frame">
                                <SlideThumbnail :slide="item.slide" />
                            </div>
                        </article>

                        <p v-if="!labelledSlides.length" class="spm-empty">
                            {{ t('community.preview.empty') }}
                        </p>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.spm-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(15, 23, 42, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 24px;
    box-sizing: border-box;
}

.spm-panel {
    background: #fff;
    border-radius: 20px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
    width: min(920px, 100%);
    max-height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* ── Header ───────────────────────────────────────────────────── */
.spm-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 24px 28px 18px;
    border-bottom: 1px solid #eef0f4;
}

.spm-head__text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.spm-head__kicker {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #94a3b8;
}

.spm-head__title {
    margin: 0;
    font-family: var(--font-body, 'Albert Sans', system-ui, sans-serif);
    font-size: 22px;
    font-weight: 700;
    color: #111827;
    line-height: 1.25;
    word-break: break-word;
}

.spm-head__subtitle {
    margin: 0;
    font-size: 14px;
    color: #4e607c;
}

.spm-head__close {
    flex-shrink: 0;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: none;
    background: #f1f5f9;
    color: #1f2937;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s;
}

.spm-head__close:hover {
    background: #e2e8f0;
}

.spm-head__close svg {
    width: 18px;
    height: 18px;
}

/* ── Scroll body ─────────────────────────────────────────────── */
.spm-body {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 20px 28px 28px;
    display: flex;
    flex-direction: column;
    gap: 22px;
    /* Pleasant scrollbar on macOS/Windows. */
    scrollbar-gutter: stable both-edges;
}

.spm-slide {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.spm-slide__label {
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    letter-spacing: 0.02em;
}

.spm-slide__frame {
    /* 16:9 frame so SlideThumbnail can fill correctly via container
       queries (its CSS depends on `container-type: inline-size`). */
    aspect-ratio: 16 / 9;
    width: 100%;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    overflow: hidden;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.spm-empty {
    margin: 40px 0;
    text-align: center;
    color: #94a3b8;
    font-size: 14px;
}

/* ── Modal transition (matches Toast — slide + fade) ─────────── */
.spm-enter-from,
.spm-leave-to {
    opacity: 0;
}

.spm-enter-from .spm-panel,
.spm-leave-to .spm-panel {
    transform: translateY(12px);
}

.spm-enter-active,
.spm-leave-active {
    transition: opacity 0.2s ease;
}

.spm-enter-active .spm-panel,
.spm-leave-active .spm-panel {
    transition: transform 0.2s ease;
}

/* ── Mobile ──────────────────────────────────────────────────── */
@media (max-width: 720px) {
    .spm-backdrop { padding: 12px; }
    .spm-head { padding: 18px 20px 14px; }
    .spm-body { padding: 16px 20px 22px; gap: 18px; }
    .spm-head__title { font-size: 18px; }
}
</style>
