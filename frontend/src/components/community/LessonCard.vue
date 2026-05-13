<script setup lang="ts">
/**
 * Community lesson card.
 *
 * Faithful re-implementation of the Figma `card` group inside
 * `Lesson library` (file 1YkPdpdcSSvcBXPcp5nFxO, node 564:4587).
 *
 * Layout (≈ 544 × 230 at desktop):
 *   ┌─────────────────────────────────────────┐
 *   │ ┌──thumb──┐   Title                     │
 *   │ │         │   Unit N • Lesson M         │
 *   │ │         │   [Preview] [Save]          │
 *   │ └─────────┘                             │
 *   │ ──────────────────────────────────────  │
 *   │ (avatar) Author        📅 May 12, 2026  │
 *   └─────────────────────────────────────────┘
 *
 * Save / Preview emit events; the parent decides the behaviour. Both
 * are no-ops in the placeholder pass.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import avatarUrl from '@/assets/images/avatar-default.png'

interface Props {
    /** Stable id used in `emit('preview', id)` / `emit('save', id)`. */
    id: string
    titleEn: string
    titleZh: string
    unit: number
    lesson: number
    author: string
    /** ISO date string. */
    date: string
    /** Optional thumbnail URL. Falls back to a flat grey block. */
    thumbnail?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
    (e: 'preview', id: string): void
    (e: 'save', id: string): void
}>()

const { t, locale } = useI18n()

const title = computed(() =>
    locale.value === 'zh' ? props.titleZh : props.titleEn,
)

const formattedDate = computed(() => {
    const loc = locale.value === 'zh' ? 'zh-CN' : 'en-US'
    return new Date(props.date).toLocaleDateString(loc, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
})

const subtitle = computed(() => {
    const u = t('community.card.unitLessonShort', {
        unit: props.unit,
        lesson: props.lesson,
    })
    return u
})
</script>

<template>
    <article class="lc">
        <!-- Thumbnail. Background-image when provided, otherwise a flat
             grey block matching the Figma placeholder rectangle. -->
        <div
            class="lc__thumb"
            :style="thumbnail ? { backgroundImage: `url(${thumbnail})` } : {}"
        />

        <!-- Right-hand text + actions column -->
        <div class="lc__body">
            <h3 class="lc__title">{{ title }}</h3>
            <p class="lc__subtitle">{{ subtitle }}</p>

            <div class="lc__actions">
                <button class="lc__btn lc__btn--outline" type="button" @click="emit('preview', id)">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path
                            d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"
                            stroke="currentColor"
                            stroke-width="1.5"
                        />
                        <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5" />
                    </svg>
                    {{ t('community.card.preview') }}
                </button>
                <button class="lc__btn lc__btn--primary" type="button" @click="emit('save', id)">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path
                            d="M4 2h8v12l-4-3-4 3V2z"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linejoin="round"
                            fill="none"
                        />
                    </svg>
                    {{ t('community.card.save') }}
                </button>
            </div>
        </div>

        <!-- Footer — separator line, author, date -->
        <footer class="lc__footer">
            <img :src="avatarUrl" :alt="author" class="lc__avatar" />
            <span class="lc__author">{{ author }}</span>
            <span class="lc__date">
                <svg viewBox="0 0 16 16" fill="none" class="lc__date-icon" aria-hidden="true">
                    <rect x="2" y="3" width="12" height="11" rx="1.5"
                        stroke="currentColor" stroke-width="1.3" />
                    <path d="M2 6h12M5 1.5v3M11 1.5v3"
                        stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
                </svg>
                {{ formattedDate }}
            </span>
        </footer>
    </article>
</template>

<style scoped>
/* ── Card frame ─────────────────────────────────────────────── */
.lc {
    display: grid;
    grid-template-columns: 240px 1fr;
    grid-template-rows: 1fr auto;
    column-gap: var(--space-4);
    row-gap: var(--space-4);
    padding: var(--space-4);
    background: #fff;
    border: 1px solid #d9d9d9;
    border-radius: 20px;
    box-shadow: var(--shadow-card-soft, 2px 4px 10px rgba(0, 0, 0, 0.08));
    min-height: 230px;
    box-sizing: border-box;
}

/* ── Thumbnail ──────────────────────────────────────────────── */
.lc__thumb {
    grid-row: 1;
    grid-column: 1;
    width: 100%;
    aspect-ratio: 16 / 9;
    background-color: #f1f1f1;
    background-size: cover;
    background-position: center;
    border-radius: 16px;
}

/* ── Right-side body ────────────────────────────────────────── */
.lc__body {
    grid-row: 1;
    grid-column: 2;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    padding-top: var(--space-1);
}

.lc__title {
    margin: 0;
    font-family: var(--font-body, 'Albert Sans', system-ui, sans-serif);
    font-weight: 700;
    font-size: 20px;
    line-height: 1.3;
    color: #2f3334;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.lc__subtitle {
    margin: 0;
    font-size: 14px;
    line-height: 1.4;
    color: #4e607c;
}

/* ── Action buttons ─────────────────────────────────────────── */
.lc__actions {
    display: flex;
    gap: var(--space-2);
    margin-top: auto;
}

.lc__btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 14px;
    border-radius: 5px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    color: #464646;
    cursor: pointer;
    transition: filter 0.15s, background-color 0.15s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.lc__btn svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
}

.lc__btn--outline {
    background: #fff;
    border: 1px solid #dedede;
}

.lc__btn--outline:hover {
    background: #f7f7f7;
}

.lc__btn--primary {
    background: rgba(127, 236, 143, 0.5);
    border: 1px solid transparent;
}

.lc__btn--primary:hover {
    filter: brightness(0.97);
}

/* ── Footer ─────────────────────────────────────────────────── */
.lc__footer {
    grid-row: 2;
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-top: var(--space-3);
    border-top: 1px solid #d9d9d9;
    font-size: 14px;
    color: #2f3334;
}

.lc__avatar {
    width: 31px;
    height: 31px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}

.lc__author {
    font-weight: 400;
}

.lc__date {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #64748b;
    font-size: 14px;
}

.lc__date-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
}

/* ── Responsive ─────────────────────────────────────────────── */
@media (max-width: 540px) {
    .lc {
        grid-template-columns: 1fr;
    }

    .lc__thumb {
        grid-column: 1;
    }

    .lc__body {
        grid-column: 1;
        grid-row: 2;
    }

    .lc__footer {
        grid-row: 3;
    }
}
</style>
