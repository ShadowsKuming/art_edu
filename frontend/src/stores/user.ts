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
import { apiPost, apiPatch, getToken, setToken, ApiError } from '@/api/client'

/**
 * Login timeout & retry policy.
 *
 * 2026-06-05 — Pilot teachers on classroom networks routinely saw
 * the FIRST `/api/auth/login` request take 40-90 seconds because:
 *   (a) Render Free dynos cold-start in ~50 s after 15 min idle;
 *   (b) The China → Render proxy adds 1-3 s round-trip;
 *   (c) Some school networks throttle HTTPS to non-whitelisted CDNs.
 *
 * Previously the call relied on `fetch()`'s default deadline (≈30 s
 * in iPadOS Safari), threw a generic network error, and `SiteHeader`
 * caught it as "API unreachable" → silently logged the user in
 * **without a JWT**. The dashboard then quietly showed an empty
 * project list because `loadFromAPI()` short-circuits when there's
 * no token, and the teacher thought "all my lessons are gone".
 *
 * Mitigation:
 *   • LOGIN_TIMEOUT_MS = 90 s — comfortably exceeds Render's worst
 *     observed cold start so genuine slowness is no longer mistaken
 *     for a hard failure.
 *   • One automatic retry after `LOGIN_RETRY_DELAY_MS` — by the
 *     second attempt the first request has already warmed the dyno
 *     and 99 % succeed within 1-2 s. We deliberately do NOT retry
 *     401s (wrong invite code) because retrying won't change the
 *     answer and would just look broken to the user.
 */
const LOGIN_TIMEOUT_MS = 90_000
const LOGIN_RETRY_DELAY_MS = 2_000


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

    /** Whether the user has a valid JWT token (API mode). */
    const isLoggedIn = computed(() => !!getToken())

    /** Set the invitation code typed in the access modal. */
    function setInviteCode(code: string) {
        inviteCode.value = code.trim()
        writeLS(KEY_INVITE, inviteCode.value)
    }

    /** Update the user's display name (My Account form). */
    function setDisplayName(name: string) {
        displayName.value = name
        writeLS(KEY_DISPLAY, displayName.value)
        if (getToken()) apiPatch('/api/auth/me', { display_name: name }).catch(console.error)
    }

    /** Update the user's bio / teaching motto. */
    function setBio(text: string) {
        bio.value = text
        writeLS(KEY_BIO, bio.value)
        if (getToken()) apiPatch('/api/auth/me', { bio: text }).catch(console.error)
    }

    /** Pick a new avatar (0-based index into AVATARS). */
    function setAvatarIndex(index: number) {
        avatarIndex.value = index
        writeLS(KEY_AVATAR, String(index))
        if (getToken()) apiPatch('/api/auth/me', { avatar_index: index }).catch(console.error)
    }

    /**
     * Login via API — POST /api/auth/login with a generous 90 s
     * timeout and one automatic retry on transient network errors.
     *
     * Throws `ApiError(401)` for an invalid invite code (caller
     * should show "wrong code" UI). Throws any other error (network
     * / 5xx / timeout) after both attempts fail — caller should
     * surface a real error message rather than fake a successful
     * login (which used to be the source of empty-dashboard bugs
     * on classroom devices; see SiteHeader.onAccessSubmit).
     */
    async function login(code: string): Promise<void> {
        type LoginResult = {
            token: string
            user_id: string
            invite_code: string
            display_name: string | null
            bio: string | null
            avatar_index: number
        }

        const attempt = (): Promise<LoginResult> =>
            apiPost<LoginResult>(
                '/api/auth/login',
                { invite_code: code },
                { timeoutMs: LOGIN_TIMEOUT_MS },
            )

        let result: LoginResult
        try {
            result = await attempt()
        } catch (err) {
            // Don't retry 401 — the invite code is genuinely wrong
            // and burning a second attempt would just make the UI
            // look frozen for another 2-90 s.
            if (err instanceof ApiError && err.status === 401) throw err
            // Anything else (network, timeout, 5xx, Render cold
            // start) — wait a beat and try once more. The first
            // attempt usually warmed the dyno; the retry typically
            // completes in 1-2 s.
            await new Promise((r) => setTimeout(r, LOGIN_RETRY_DELAY_MS))
            result = await attempt()
        }

        setToken(result.token)
        inviteCode.value = result.invite_code
        writeLS(KEY_INVITE, result.invite_code)
        if (result.display_name) {
            displayName.value = result.display_name
            writeLS(KEY_DISPLAY, result.display_name)
        }
        if (result.bio) {
            bio.value = result.bio
            writeLS(KEY_BIO, result.bio)
        }
        avatarIndex.value = result.avatar_index
        writeLS(KEY_AVATAR, String(result.avatar_index))
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
        isLoggedIn,
        setInviteCode,
        setDisplayName,
        setBio,
        setAvatarIndex,
        login,
        clearAll,
        // legacy aliases
        username,
        setUsername,
        clearUsername,
    }
})
