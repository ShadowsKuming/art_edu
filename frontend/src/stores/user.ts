import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * User profile store.
 *
 * Holds:
 *   • inviteCode    — verbatim invitation code typed into AccessModal.
 *                     Read-only after entry; surfaced on the account page
 *                     and used as the dashboard greeting fallback.
 *   • displayName   — optional override the user can set on the My Account
 *                     page. When non-empty, it replaces the invite code in
 *                     the dashboard header greeting.
 *   • bio           — optional teaching motto / short bio.
 *   • avatarIndex   — 0-based index into `AVATARS` (see `@/data/avatars`).
 *                     Defaults to `DEFAULT_AVATAR_INDEX` (the centred
 *                     bangs-girl that Figma uses as the selected avatar
 *                     on the My Account page).
 *
 * Everything is persisted to `localStorage` so a refresh keeps the user's
 * picks intact. When real auth lands, swap the AccessModal handler from
 * `setInviteCode(code)` to `setInviteCode(api.user.inviteCode)` etc.
 *
 * Backward compatibility: the original `username` / `setUsername` /
 * `clearUsername` API is preserved as thin aliases so existing call sites
 * (SiteHeader, MyLessons fall-back, etc.) continue to work without churn.
 */
import { DEFAULT_AVATAR_INDEX } from '@/data/avatars'

const KEY_INVITE = 'artbloom-username' // legacy key, kept for back-compat
const KEY_DISPLAY = 'artbloom-display-name'
const KEY_BIO = 'artbloom-bio'
const KEY_AVATAR = 'artbloom-avatar-index'

function readLS(key: string): string {
    if (typeof localStorage === 'undefined') return ''
    return localStorage.getItem(key) ?? ''
}

function writeLS(key: string, value: string): void {
    try {
        localStorage.setItem(key, value)
    } catch {
        // Quota / private mode — ignore, in-memory value still works.
    }
}

function removeLS(key: string): void {
    try {
        localStorage.removeItem(key)
    } catch {
        /* ignore */
    }
}

export const useUserStore = defineStore('user', () => {
    const inviteCode = ref<string>(readLS(KEY_INVITE))
    const displayName = ref<string>(readLS(KEY_DISPLAY))
    const bio = ref<string>(readLS(KEY_BIO))
    const avatarIndex = ref<number>(
        (() => {
            const raw = readLS(KEY_AVATAR)
            if (raw === '') return DEFAULT_AVATAR_INDEX
            const n = Number.parseInt(raw, 10)
            return Number.isFinite(n) ? n : DEFAULT_AVATAR_INDEX
        })(),
    )

    /**
     * Label shown in the dashboard header / welcome heading.
     * Display name (if user has set one) wins over the invite code; falls
     * back to "Guest" only if both are blank (deep-link, cleared storage).
     */
    const displayLabel = computed(
        () => displayName.value.trim() || inviteCode.value || 'Guest',
    )

    /** Set the invitation code typed in the access modal. */
    function setInviteCode(code: string) {
        inviteCode.value = code.trim()
        writeLS(KEY_INVITE, inviteCode.value)
    }

    /** Update the user's display name (My Account form). */
    function setDisplayName(name: string) {
        displayName.value = name
        writeLS(KEY_DISPLAY, displayName.value)
    }

    /** Update the user's bio / teaching motto. */
    function setBio(text: string) {
        bio.value = text
        writeLS(KEY_BIO, bio.value)
    }

    /** Pick a new avatar (0-based index into AVATARS). */
    function setAvatarIndex(index: number) {
        avatarIndex.value = index
        writeLS(KEY_AVATAR, String(index))
    }

    /** Wipe everything — useful when implementing real sign-out. */
    function clearAll() {
        inviteCode.value = ''
        displayName.value = ''
        bio.value = ''
        avatarIndex.value = DEFAULT_AVATAR_INDEX
        removeLS(KEY_INVITE)
        removeLS(KEY_DISPLAY)
        removeLS(KEY_BIO)
        removeLS(KEY_AVATAR)
    }

    // ── Backward-compatible aliases for the original tiny-store shape ──
    /** @deprecated use `inviteCode` */
    const username = inviteCode
    /** @deprecated use `setInviteCode` */
    const setUsername = setInviteCode
    /** @deprecated use `clearAll` */
    const clearUsername = () => {
        inviteCode.value = ''
        removeLS(KEY_INVITE)
    }

    return {
        // canonical API
        inviteCode,
        displayName,
        bio,
        avatarIndex,
        displayLabel,
        setInviteCode,
        setDisplayName,
        setBio,
        setAvatarIndex,
        clearAll,
        // legacy aliases
        username,
        setUsername,
        clearUsername,
    }
})
