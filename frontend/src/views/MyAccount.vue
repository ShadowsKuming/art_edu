<script setup lang="ts">
/**
 * My Account view (`/account`).
 *
 * Reproduces Figma frame `564:4677` ("My account-1") — the user-profile
 * landing page accessed from the Dashboard hub's "My Account" card and
 * from the avatar block in the shared header.
 *
 * Layout:
 *   • shared `<DashboardHeader>` (logo, lang pill, avatar + greeting)
 *   • "← Back to Dashboard" link
 *   • title block: "My Account" + Underline.svg
 *   • welcome heading + subtitle (uses {name} from displayLabel)
 *   • two-column row: profile-card (green gradient) + invite-code card
 *   • full-width feedback card (yellow) → Send Feedback → /#contact
 *   • full-width quote card (banner + Picasso quote)
 *   • absolutely positioned decorative right-side image
 *
 * The avatar's small edit pencil opens `<AvatarPickerPopover>`.
 *
 * Display name and bio are bound to the user store with debounced
 * persistence: input updates the local refs immediately, blur or change
 * commits to localStorage. Switching to localStorage on every keystroke
 * would also be fine here (it's free), but blur keeps the write rhythm
 * matching how textareas usually flush.
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@/stores/user'
import { getAvatar } from '@/data/avatars'
import DashboardHeader from '@/components/dashboard/DashboardHeader.vue'
import AvatarPickerPopover from '@/components/account/AvatarPickerPopover.vue'

import decorUrl from '@/assets/images/account-decor.png'
import quoteBannerUrl from '@/assets/images/quote-banner.png'
import underlineUrl from '@/assets/images/Underline.svg'

const router = useRouter()
const { t } = useI18n()
const userStore = useUserStore()

// Local refs mirror the store so typing is responsive without round-tripping
// through localStorage on every keystroke.
const displayNameDraft = ref(userStore.displayName)
const bioDraft = ref(userStore.bio)

// Keep the drafts in sync if the store changes from elsewhere (e.g. another
// tab via the storage event in a future iteration, or AvatarPicker opens).
watch(
    () => userStore.displayName,
    (v) => {
        if (v !== displayNameDraft.value) displayNameDraft.value = v
    },
)
watch(
    () => userStore.bio,
    (v) => {
        if (v !== bioDraft.value) bioDraft.value = v
    },
)

const pickerOpen = ref(false)

/** Currently chosen avatar (large profile photo). */
const currentAvatar = computed(() => getAvatar(userStore.avatarIndex))

/** Persist display name on blur. */
function commitDisplayName() {
    userStore.setDisplayName(displayNameDraft.value)
}
/** Persist bio on blur. */
function commitBio() {
    userStore.setBio(bioDraft.value)
}

/** Send-feedback button → contact section on the homepage. */
function onSendFeedback() {
    router.push({ path: '/', hash: '#contact' })
}

/** Back link → dashboard hub. */
function onBack() {
    router.push('/dashboard')
}
</script>

<template>
    <div class="acc-page">
        <DashboardHeader />

        <main class="acc-main">
            <button type="button" class="acc-back" @click="onBack">
                <svg width="20" height="12" viewBox="0 0 20 12" fill="none" aria-hidden="true">
                    <path d="M19 6H1M1 6L6 1M1 6l5 5" stroke="#000" stroke-width="2" stroke-linecap="round"
                        stroke-linejoin="round" />
                </svg>
                <span>{{ t('account.backToDashboard') }}</span>
            </button>

            <header class="acc-title">
                <h1 class="acc-title__text">{{ t('account.title') }}</h1>
                <img :src="underlineUrl" alt="" class="acc-title__underline" aria-hidden="true" />
            </header>

            <section class="acc-welcome">
                <h2 class="acc-welcome__heading">
                    {{ t('account.welcome', { name: userStore.displayLabel }) }}
                </h2>
                <p class="acc-welcome__subtitle">{{ t('account.subtitle') }}</p>
            </section>

            <!-- Top row: profile (left) + invite-code (right) ────────── -->
            <section class="acc-row acc-row--top">
                <!-- ── Profile card ─────────────────────────────────── -->
                <article class="acc-profile">
                    <div class="acc-profile__photo">
                        <img :src="currentAvatar.src" :alt="currentAvatar.label" class="acc-profile__avatar" />
                        <button type="button" class="acc-profile__edit"
                            :aria-label="t('account.profile.editAvatarAria')" @click="pickerOpen = true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path
                                    d="M16.862 3.487a2.06 2.06 0 0 1 2.915 2.914L7.5 18.679l-4 1 1-4L16.862 3.487Z"
                                    stroke="#5C6060" stroke-width="2" stroke-linecap="round"
                                    stroke-linejoin="round" />
                            </svg>
                        </button>
                    </div>

                    <div class="acc-profile__info">
                        <label class="acc-field">
                            <span class="acc-field__label">
                                {{ t('account.profile.displayName') }}
                            </span>
                            <input v-model="displayNameDraft" type="text" class="acc-field__input"
                                :placeholder="t('account.profile.displayNamePlaceholder')" maxlength="60"
                                @change="commitDisplayName" @blur="commitDisplayName" />
                        </label>

                        <label class="acc-field">
                            <span class="acc-field__label">
                                {{ t('account.profile.bio') }}
                            </span>
                            <textarea v-model="bioDraft" class="acc-field__textarea"
                                :placeholder="t('account.profile.bioPlaceholder')" maxlength="240" rows="2"
                                @change="commitBio" @blur="commitBio" />
                        </label>
                    </div>
                </article>

                <!-- ── Invite code card ─────────────────────────────── -->
                <aside class="acc-code" :aria-label="t('account.inviteCode.label')">
                    <div class="acc-code__label">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                                d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"
                                stroke="#425470" stroke-width="2" stroke-linecap="round" />
                        </svg>
                        <span>{{ t('account.inviteCode.label') }}</span>
                    </div>
                    <div class="acc-code__value">
                        {{ userStore.inviteCode || '—' }}
                    </div>
                </aside>
            </section>

            <!-- Feedback card ────────────────────────────────────────── -->
            <section class="acc-feedback">
                <div class="acc-feedback__copy">
                    <h3 class="acc-feedback__title">{{ t('account.feedback.title') }}</h3>
                    <p class="acc-feedback__body">{{ t('account.feedback.body') }}</p>
                </div>
                <button type="button" class="acc-feedback__btn" @click="onSendFeedback">
                    <span>{{ t('account.feedback.send') }}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12h14M13 6l6 6-6 6" stroke="#000" stroke-width="2.5" stroke-linecap="round"
                            stroke-linejoin="round" />
                    </svg>
                </button>
            </section>

            <!-- Quote card ───────────────────────────────────────────── -->
            <figure class="acc-quote">
                <img :src="quoteBannerUrl" alt="" class="acc-quote__bg" aria-hidden="true" />
                <figcaption class="acc-quote__text">
                    {{ t('account.quote.text') }}
                </figcaption>
            </figure>
        </main>

        <!-- Decorative right-side strip — Figma image with white inner-shadow fade -->
        <img :src="decorUrl" :alt="t('account.decorAlt')" class="acc-decor" />

        <!-- Avatar picker popover -->
        <AvatarPickerPopover v-model:open="pickerOpen" />
    </div>
</template>

<style scoped>
.acc-page {
    position: relative;
    min-height: 100vh;
    background: var(--color-bg);
    overflow-x: hidden;
}

/* ── Decorative right-side image ────────────────────────────
   Absolutely positioned so the page content can flow on top.
   The Figma uses an inset 100px white shadow on the left edge
   to fade the image into the page background — we match that
   with a CSS gradient overlay since `box-shadow: inset` won't
   show through an <img>. */

.acc-decor {
    position: absolute;
    top: var(--header-height, 88px);
    right: 0;
    width: clamp(280px, 28vw, 544px);
    max-height: calc(100vh - var(--header-height, 88px));
    object-fit: cover;
    object-position: center;
    pointer-events: none;
    user-select: none;
    -webkit-user-drag: none;
    /* Inset white fade on the left edge */
    -webkit-mask-image: linear-gradient(to right,
            transparent 0,
            rgba(0, 0, 0, 0.3) 60px,
            #000 150px);
    mask-image: linear-gradient(to right,
            transparent 0,
            rgba(0, 0, 0, 0.3) 60px,
            #000 150px);
    z-index: 0;
}

/* ── Main content ──────────────────────────────────────────── */

.acc-main {
    position: relative;
    z-index: 1;
    max-width: var(--content-max);
    margin: 0 auto;
    /* Reserve space on the right for the decor image so content never
       sits underneath it on wide viewports. */
    padding: var(--space-5) calc(var(--gutter) + clamp(0px, 24vw, 480px)) var(--space-7) var(--gutter);
}

/* ── Back link ─────────────────────────────────────────────── */

.acc-back {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: 0;
    padding: 6px 0;
    color: var(--color-text);
    font: 500 16px/20px var(--font-body, inherit);
    cursor: pointer;
    margin-bottom: var(--space-3);
}

.acc-back:hover {
    color: var(--color-primary);
}

.acc-back svg {
    transition: transform 0.15s ease;
}

.acc-back:hover svg {
    transform: translateX(-2px);
}

/* ── Title ─────────────────────────────────────────────────── */

.acc-title {
    position: relative;
    display: inline-block;
    margin-bottom: var(--space-5);
}

.acc-title__text {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(36px, 5vw, 50px);
    line-height: 1.1;
    color: #0C0C0C;
}

.acc-title__underline {
    position: absolute;
    left: 36%;
    bottom: -10px;
    width: 36%;
    height: auto;
    pointer-events: none;
}

/* ── Welcome heading + subtitle ────────────────────────────── */

.acc-welcome {
    margin: var(--space-5) 0 var(--space-5);
}

.acc-welcome__heading {
    margin: 0 0 8px;
    font-weight: 600;
    font-size: clamp(28px, 3.2vw, 40px);
    line-height: 1.3;
    color: #000;
}

.acc-welcome__subtitle {
    margin: 0;
    font-size: 18px;
    line-height: 1.5;
    color: #606060;
}

/* ── Top row (profile + invite code) ───────────────────────── */

.acc-row--top {
    display: grid;
    grid-template-columns: 2.5fr 1fr;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
}

@media (max-width: 1100px) {
    .acc-row--top {
        grid-template-columns: 1fr;
    }
}

/* ── Profile card ──────────────────────────────────────────── */

.acc-profile {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 24px;
    align-items: center;
    padding: 27px 32px;
    background: linear-gradient(227deg,
            rgba(0, 209, 31, 1) 3%,
            rgba(127, 236, 143, 1) 36%,
            rgba(209, 232, 212, 1) 98%);
    border-radius: 35px;
    box-shadow: 3px 3px 8px rgba(0, 0, 0, 0.12);
}

@media (max-width: 600px) {
    .acc-profile {
        grid-template-columns: 1fr;
        justify-items: center;
        text-align: left;
    }
}

.acc-profile__photo {
    position: relative;
    width: 135px;
    height: 135px;
    flex-shrink: 0;
}

.acc-profile__avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    box-shadow: 3px 3px 6px rgba(0, 0, 0, 0.15);
    background: #fff;
}

.acc-profile__edit {
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow:
        0 2px 4px -2px rgba(0, 0, 0, 0.1),
        0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transition: transform 0.15s ease, background 0.15s ease;
}

.acc-profile__edit:hover {
    transform: scale(1.08);
    background: #f9fafb;
}

.acc-profile__edit:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
}

.acc-profile__info {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    width: 100%;
    min-width: 0;
}

/* ── Form fields ───────────────────────────────────────────── */

.acc-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.acc-field__label {
    font-weight: 700;
    font-size: 14px;
    line-height: 16px;
    color: #425470;
}

.acc-field__input,
.acc-field__textarea {
    background: #fff;
    border: 0;
    border-radius: 32px;
    padding: 12px 16px;
    font-family: inherit;
    font-size: 16px;
    line-height: 24px;
    color: #2F3334;
    outline: none;
    transition: box-shadow 0.15s ease;
    width: 100%;
    box-sizing: border-box;
}

.acc-field__textarea {
    border-radius: 24px;
    resize: vertical;
    min-height: 60px;
    color: #5C6060;
}

.acc-field__input:focus,
.acc-field__textarea:focus {
    box-shadow: 0 0 0 2px var(--color-primary);
}

/* ── Invite code card ──────────────────────────────────────── */

.acc-code {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: #ECF3FF;
    border-radius: 35px;
    padding: 28px 24px;
    box-shadow: 3px 3px 8px rgba(0, 0, 0, 0.12);
}

.acc-code__label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 14px;
    line-height: 24px;
    color: #425470;
}

.acc-code__value {
    font-weight: 800;
    font-size: clamp(22px, 2.4vw, 30px);
    line-height: 32px;
    letter-spacing: 0.08em;
    color: #5C6060;
    text-align: center;
}

/* ── Feedback card ─────────────────────────────────────────── */

.acc-feedback {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: var(--space-4);
    background: #FFFAE8;
    border-radius: 35px;
    padding: 28px 32px;
    box-shadow: 3px 3px 8px rgba(0, 0, 0, 0.12);
    margin-bottom: var(--space-4);
}

@media (max-width: 720px) {
    .acc-feedback {
        grid-template-columns: 1fr;
    }
}

.acc-feedback__title {
    margin: 0 0 6px;
    font-weight: 700;
    font-size: 20px;
    line-height: 28px;
    color: #2F3334;
}

.acc-feedback__body {
    margin: 0;
    font-size: 16px;
    line-height: 20px;
    color: #425470;
    max-width: 70ch;
}

.acc-feedback__btn {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 16px 32px;
    background: var(--color-primary, #7FEC8F);
    border: 0;
    border-radius: 9999px;
    font-weight: 700;
    font-size: 16px;
    line-height: 24px;
    color: #000;
    cursor: pointer;
    box-shadow:
        0 8px 10px -6px rgba(47, 51, 52, 0.10),
        0 20px 25px -5px rgba(47, 51, 52, 0.10);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    white-space: nowrap;
    justify-self: end;
}

.acc-feedback__btn:hover {
    transform: translateY(-1px);
    box-shadow:
        0 10px 12px -6px rgba(47, 51, 52, 0.15),
        0 24px 30px -5px rgba(47, 51, 52, 0.15);
}

.acc-feedback__btn:focus-visible {
    outline: 3px solid #000;
    outline-offset: 3px;
}

/* ── Quote card ────────────────────────────────────────────── */

.acc-quote {
    position: relative;
    margin: 0;
    border-radius: 35px;
    overflow: hidden;
    box-shadow: 3px 3px 8px rgba(0, 0, 0, 0.12);
    aspect-ratio: 1072 / 150;
    min-height: 120px;
}

.acc-quote__bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 40%;
    user-select: none;
    -webkit-user-drag: none;
}

.acc-quote__text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 24px;
    font-family: 'Albert Sans', var(--font-body, sans-serif);
    font-style: italic;
    font-weight: 700;
    font-size: clamp(18px, 2.4vw, 30px);
    line-height: 1.2;
    color: #fff;
    text-align: center;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
}

/* ── Hide decorative image on tablet/mobile ───────────────── */

@media (max-width: 1100px) {
    .acc-decor {
        display: none;
    }

    .acc-main {
        padding-right: var(--gutter);
    }
}
</style>
