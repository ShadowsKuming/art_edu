<script setup lang="ts">
/**
 * One of the five action cards on the Dashboard hub.
 *
 * Renders as a real <button> (these are actions, not navigations to a
 * static URL — the parent decides what to do on click). All five cards
 * look fully active per the Figma design; "orphan" cards simply emit
 * a `click` the parent ignores or hands off to a stub.
 *
 * Layout (CSS Grid):
 *   row 1 → icon  (top-left, 80×80)
 *   row 2 → title (30 px Albert Sans Bold)
 *   row 3 → description (18 px / 140%, --color-text-muted)
 *   row 4 → entry button pinned bottom-right via `margin-top: auto`
 *
 * No `position: absolute` is used. The card colour is a CSS variable
 * passed via the `color` prop so theming stays in `tokens.css`.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

type IconName = 'sparkles' | 'palette' | 'book' | 'play' | 'person'

interface Props {
    /** CSS custom-property name for the card background, e.g. "--card-create". */
    color: string
    title: string
    description: string
    icon: IconName
}
const props = defineProps<Props>()

const emit = defineEmits<{
    (e: 'click'): void
}>()

const { t } = useI18n()

/**
 * Resolve `--card-…` token to a `var(--card-…)` reference for inline style.
 */
const backgroundStyle = computed(() => ({
    background: `var(${props.color})`,
}))
</script>

<template>
    <button type="button" class="db-card" :style="backgroundStyle" :aria-label="t('dashboardHub.entryAriaLabel', { title })"
        @click="emit('click')">
        <!-- Icon row ─────────────────────────────────────────────── -->
        <span class="db-card__icon" aria-hidden="true">
            <!-- Create Lesson — magic wand with sparkles -->
            <svg v-if="icon === 'sparkles'" viewBox="0 0 80 80" fill="none">
                <path
                    d="M52 24l-28 28a4 4 0 105.66 5.66l28-28A4 4 0 0052 24z M16 18l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM58 6l3 9 9 3-9 3-3 9-3-9-9-3 9-3zM62 50l1.6 4.8 4.8 1.6-4.8 1.6L62 62.8l-1.6-4.8-4.8-1.6 4.8-1.6z"
                    fill="currentColor" />
            </svg>

            <!-- My Lessons — palette -->
            <svg v-else-if="icon === 'palette'" viewBox="0 0 80 80" fill="none">
                <path
                    d="M40 8C22 8 8 22 8 40s14 32 32 32c4 0 6-3 6-6 0-2-1-3-1-5 0-3 2-5 5-5h6c10 0 16-7 16-16C72 22 58 8 40 8zm-22 32a4 4 0 11.001-8.001A4 4 0 0118 40zm10-14a4 4 0 11.001-8.001A4 4 0 0128 26zm14-2a4 4 0 11.001-8.001A4 4 0 0142 24zm14 6a4 4 0 11.001-8.001A4 4 0 0156 30z"
                    fill="currentColor" />
            </svg>

            <!-- Community — open book -->
            <svg v-else-if="icon === 'book'" viewBox="0 0 80 80" fill="none">
                <path
                    d="M8 14v50a2 2 0 002 2h26V18s-6-4-14-4S8 14 8 14zM72 14v50a2 2 0 01-2 2H44V18s6-4 14-4 14 0 14 0z M14 24h16M14 32h16M14 40h16M50 24h16M50 32h16M50 40h16"
                    stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
                    fill="none" />
            </svg>

            <!-- Start Teaching — play -->
            <svg v-else-if="icon === 'play'" viewBox="0 0 80 80" fill="none">
                <circle cx="40" cy="40" r="34" stroke="currentColor" stroke-width="4" fill="none" />
                <path d="M33 27v26l22-13z" fill="currentColor" />
            </svg>

            <!-- My Account — person -->
            <svg v-else-if="icon === 'person'" viewBox="0 0 80 80" fill="none">
                <circle cx="40" cy="40" r="34" stroke="currentColor" stroke-width="4" fill="none" />
                <circle cx="40" cy="32" r="11" stroke="currentColor" stroke-width="4" fill="none" />
                <path d="M19 64a21 21 0 0142 0" stroke="currentColor" stroke-width="4" fill="none"
                    stroke-linecap="round" />
            </svg>
        </span>

        <!-- Title + description ─────────────────────────────────── -->
        <h3 class="db-card__title">{{ title }}</h3>
        <p class="db-card__desc">{{ description }}</p>

        <!-- Entry button (decorative arrow inside white circle) ── -->
        <span class="db-card__entry" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
                    stroke-linejoin="round" />
            </svg>
        </span>
    </button>
</template>

<style scoped>
.db-card {
    /* Base box — colour applied via inline style from the `color` prop. */
    border: 0;
    border-radius: 40px;
    box-shadow: var(--shadow-card-soft);
    padding: 50px 50px 35px;
    text-align: left;
    cursor: pointer;
    position: relative;
    /* sole reason: contains the focus ring; no children rely on it */

    display: flex;
    flex-direction: column;
    gap: var(--space-4);

    min-height: 489px;
    color: var(--color-text-strong);
    font-family: var(--font-body);

    transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
}

.db-card:hover {
    transform: translateY(-4px);
    box-shadow: 4px 14px 22px rgba(0, 0, 0, 0.08);
    filter: brightness(1.02);
}

.db-card:focus-visible {
    outline: 3px solid var(--color-text);
    outline-offset: 4px;
}

.db-card:active {
    transform: translateY(-1px);
}

/* ── Icon ────────────────────────────────────────────────── */

.db-card__icon {
    width: 80px;
    height: 80px;
    color: var(--color-text-muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.db-card__icon svg {
    width: 100%;
    height: 100%;
}

/* ── Title ───────────────────────────────────────────────── */

.db-card__title {
    margin: 92px 0 0;
    /* Figma puts title at y=225 (=50 padding + 80 icon + ~95 gap) */
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 30px;
    line-height: 1;
    color: var(--color-text);
}

/* ── Description ─────────────────────────────────────────── */

.db-card__desc {
    margin: 0;
    font-size: 18px;
    font-weight: 400;
    line-height: 1.4;
    color: var(--color-text-muted);
}

/* ── Entry button (bottom-right) ─────────────────────────── */

.db-card__entry {
    margin-top: auto;
    /* push to bottom of flex column */
    align-self: flex-end;
    width: 55px;
    height: 55px;
    border-radius: 50%;
    background: var(--color-bg);
    box-shadow: var(--shadow-entry-btn);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text);
    transition: transform 0.18s ease, background 0.18s ease;
}

.db-card:hover .db-card__entry {
    transform: translateX(2px);
    background: var(--color-primary);
}

.db-card__entry svg {
    width: 24px;
    height: 24px;
}

/* ── Responsive ──────────────────────────────────────────── */

@media (max-width: 1100px) {
    .db-card {
        min-height: 420px;
        padding: 40px 36px 28px;
    }

    .db-card__title {
        margin-top: 72px;
    }
}

@media (max-width: 720px) {
    .db-card {
        min-height: 360px;
        padding: 36px 32px 24px;
        border-radius: 30px;
    }

    .db-card__icon {
        width: 64px;
        height: 64px;
    }

    .db-card__title {
        margin-top: 56px;
        font-size: 26px;
    }

    .db-card__desc {
        font-size: 16px;
    }

    .db-card__entry {
        width: 48px;
        height: 48px;
    }
}
</style>
