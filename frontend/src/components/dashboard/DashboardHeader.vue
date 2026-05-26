<script setup lang="ts">
/**
 * Dashboard / authenticated-area top bar.
 *
 * Sized to match `SiteHeader` (the homepage bar) so the bar feels
 * consistent across the whole app: same `--header-height` (88 px),
 * same gutter, same logo height. Re-used by both `Dashboard.vue`
 * and `MyLessons.vue` (and any future authenticated view).
 *
 * Layout:
 *   [Logo button] ······ [Lang pill] [Avatar] [Hi, {username}]
 *
 * Behaviour:
 *   • Logo click  → if already on /dashboard, reload the page;
 *                   otherwise router.push('/dashboard'). Mirrors the
 *                   familiar "click logo to go home / refresh" pattern.
 *   • Lang pill   → calls `toggleLocale` from `@/i18n`, identical to
 *                   the homepage's site header.
 *   • Avatar +    → reads `userStore.username`. Falls back to "Guest"
 *     greeting     if the store is empty (deep-link, cleared storage).
 *
 * The bottom divider (Figma `#B7B7B7` + `0 4px 4px /10%`) is preserved
 * as the visual separator from the page content.
 */
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toggleLocale } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { getAvatar } from '@/data/avatars'

// Convention: `logo.png` is the **black-and-white** wordmark used ONLY on
// the marketing `SiteHeader`. Every authenticated header uses the colour
// `logo-mark.png` instead.
import logoUrl from '@/assets/images/logo-mark.png'

const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()
const userStore = useUserStore()

/**
 * Display label for the greeting. Prefers the user-chosen display name
 * (set on the My Account page); falls back to the verbatim invitation
 * code, then "Guest" as a last resort.
 */
const displayName = computed(() => userStore.displayLabel)

/** Currently selected avatar (driven by user store + AVATARS data). */
const currentAvatar = computed(() => getAvatar(userStore.avatarIndex))


/**
 * Logo click handler.
 *
 * On any non-/dashboard page the logo navigates to /dashboard (the hub).
 * If the user is already on /dashboard the click reloads the window —
 * a familiar "tap the logo to refresh" gesture that also clears any
 * transient client-side state.
 */
function onLogoClick() {
    if (route.path === '/dashboard') {
        window.location.reload()
    } else {
        router.push('/dashboard')
    }
}

/**
 * Avatar / greeting click handler.
 *
 * Tapping the user block routes to the My Account page. If the user is
 * already on `/account`, the click reloads (mirrors the logo's
 * "tap-to-refresh" behaviour for symmetry).
 */
function onUserClick() {
    if (route.path === '/account') {
        window.location.reload()
    } else {
        router.push('/account')
    }
}

</script>

<template>
    <header class="db-header">
        <div class="db-header__inner">
            <button type="button" class="db-header__logo" :aria-label="t('dashboardHub.dashboardAriaLabel')"
                @click="onLogoClick">
                <img :src="logoUrl" :alt="t('brand.name')" class="db-header__logo-img" />
            </button>

            <div class="db-header__actions">
                <button class="db-header__lang" type="button" @click="toggleLocale">
                    {{ locale === 'en' ? '中文' : 'EN' }}
                </button>

                <button type="button" class="db-header__user" :aria-label="t('dashboardHub.accountAriaLabel')"
                    @click="onUserClick">
                    <img :src="currentAvatar.src" :alt="t('dashboardHub.avatarAlt')" class="db-header__avatar" />
                    <span class="db-header__greeting">
                        {{ t('dashboardHub.greeting', { name: displayName }) }}
                    </span>
                </button>
            </div>
        </div>
    </header>
</template>

<style scoped>
.db-header {
    /* Match SiteHeader: sticky, white bg, sits above page content. */
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-divider);
    box-shadow: var(--shadow-divider);
}

.db-header__inner {
    max-width: var(--content-max);
    margin: 0 auto;
    padding: var(--space-3) var(--gutter);
    min-height: var(--header-height);
    /* 88 px — matches SiteHeader */
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-5);
}

/* ── Logo (left) — clickable button ─────────────────────────── */

.db-header__logo {
    display: inline-flex;
    align-items: center;
    border: 0;
    background: transparent;
    padding: 0;
    border-radius: var(--space-2);
    cursor: pointer;
    flex-shrink: 0;
    transition: transform 0.15s ease;
}

.db-header__logo:hover {
    transform: scale(1.02);
}

.db-header__logo:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
}

.db-header__logo-img {
    height: 56px;
    /* matches SiteHeader's logo */
    width: auto;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
}

/* ── Right-side cluster: lang pill + user block ────────────── */

.db-header__actions {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-shrink: 0;
    min-width: 0;
}

/* ── Language toggle pill — copied from SiteHeader for parity. ─ */

.db-header__lang {
    height: 36px;
    padding: 0 14px;
    border-radius: var(--radius-pill);
    border: 1.5px solid var(--color-border);
    background: var(--color-bg);
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
    flex-shrink: 0;
}

.db-header__lang:hover {
    border-color: var(--color-primary);
    background: #f0fdf4;
}

/* ── User block (right) ────────────────────────────────────── */

.db-header__user {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    /* Treat as a borderless pill button — same hover/focus affordance as
       the logo so the two interactive ends of the bar feel symmetrical. */
    border: 0;
    background: transparent;
    padding: 4px 8px;
    border-radius: var(--radius-pill);
    cursor: pointer;
    color: inherit;
    transition: background 0.15s ease, transform 0.15s ease;
}

.db-header__user:hover {
    background: rgba(127, 236, 143, 0.12);
    transform: scale(1.02);
}

.db-header__user:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
}

.db-header__avatar {
    width: 52px;
    /* proportional to the 88 px bar — was 70 px on a 101 px bar */
    height: 52px;
    border-radius: 50%;
    object-fit: cover;
    box-shadow: var(--shadow-avatar);
    flex-shrink: 0;
    user-select: none;
    -webkit-user-drag: none;
}

.db-header__greeting {
    font-family: var(--font-body);
    font-size: 18px;
    font-weight: 400;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* ── Responsive ───────────────────────────────────────────── */

@media (max-width: 720px) {
    .db-header__inner {
        gap: var(--space-3);
    }

    .db-header__logo-img {
        height: 40px;
    }

    .db-header__avatar {
        width: 44px;
        height: 44px;
    }

    .db-header__greeting {
        font-size: 16px;
    }

    .db-header__lang {
        height: 32px;
        padding: 0 12px;
        font-size: 12px;
    }
}

@media (max-width: 480px) {
    .db-header__greeting {
        font-size: 14px;
        max-width: 12ch;
    }

    .db-header__avatar {
        width: 38px;
        height: 38px;
    }
}
</style>
