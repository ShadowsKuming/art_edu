<script setup lang="ts">
import { RouterView } from 'vue-router'
import { watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSlideStore } from '@/stores/slides'
import type { Locale } from '@/stores/slides'
import { useUserStore } from '@/stores/user'
import { useProjectsStore } from '@/stores/projects'
import { apiGet, getToken, clearToken, ApiError } from '@/api/client'
import ToastHost from '@/components/common/ToastHost.vue'

// Keep the slide store's locale in sync with vue-i18n so the EN/中
// toggle in the workspace header swaps bilingual text on every slide
// element that was hydrated from an LKP.
const { locale } = useI18n()
const slideStore = useSlideStore()

watch(
  locale,
  (next) => {
    const value = (next === 'zh' ? 'zh' : 'en') as Locale
    slideStore.setLocale(value)
  },
  { immediate: true },
)

const userStore = useUserStore()
const projectsStore = useProjectsStore()

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

/**
 * Fire-and-forget warm-up ping.
 *
 * 2026-06-05 — Render Free dynos sleep after ~15 min of idle traffic
 * and a cold start adds ~50 s to whichever request happens to be
 * first. For pilot teachers that first request is almost always
 * `POST /api/auth/login`, and the 50 s wait used to manifest as
 * "the site is broken" before the now-removed fake-login fallback
 * masked it as "all my lessons disappeared".
 *
 * Calling `/api/health` here as soon as the SPA mounts means by the
 * time the teacher has read the landing page and clicked "Access",
 * the dyno is already awake and the login completes in 1-2 s.
 *
 * We deliberately don't `await` this — a slow warm-up MUST NOT block
 * the rest of bootstrap.
 */
function warmupApi() {
  if (!API_BASE) return
  // 10 s budget is plenty for the round-trip; if it's slower than
  // that the dyno is probably so wedged that warming is futile.
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 10_000)
  fetch(`${API_BASE}/api/health`, { signal: ctl.signal, cache: 'no-store' })
    .catch(() => { /* warm-up failures are silent by design */ })
    .finally(() => clearTimeout(t))
}

onMounted(async () => {
  // Kick the dyno awake as early as possible. Runs in parallel with
  // whatever bootstrap path we take below.
  warmupApi()

  const storedCode = localStorage.getItem('artbloom-username')

  if (getToken()) {
    // ── Normal path: validate existing JWT ──────────────────────────
    try {
      const me = await apiGet<{
        user_id: string
        invite_code: string
        display_name: string | null
        bio: string | null
        avatar_index: number
      }>('/api/auth/me')
      userStore.setInviteCode(me.invite_code)
      if (me.display_name) userStore.setDisplayName(me.display_name)
      if (me.bio) userStore.setBio(me.bio)
      userStore.setAvatarIndex(me.avatar_index)
      await projectsStore.loadFromAPI()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Token is invalid (revoked or DB reset) — try to get a fresh
        // one with the stored code, otherwise leave the user
        // unauthenticated so the next "Access" click reopens the modal.
        clearToken()
        if (storedCode) {
          try {
            await userStore.login(storedCode)
            await projectsStore.loadFromAPI()
          } catch (recoveryErr) {
            if (recoveryErr instanceof ApiError && recoveryErr.status === 401) {
              // Stored code is also bad (e.g. revoked invite) — wipe
              // everything so the user sees a fresh AccessModal.
              userStore.clearAll()
            }
            // Any other recovery failure: leave local state intact —
            // next page load (or a retry from the user) will try again.
          }
        }
      }
      // Any other error (network, 503, cold start): keep token, use
      // local data. The cross-device sync watchers in the workspace
      // will retry their own writes on the next mutation.
    }
  } else if (storedCode) {
    // ── Self-heal path ──────────────────────────────────────────────
    //
    // 2026-06-05 — Previously this branch only ran for users who
    // entered an invite code in fallback mode (no JWT path was wired).
    // Since the fake-login fallback in SiteHeader has been removed,
    // landing here today means the user's JWT got cleared (browser
    // data wipe, private window expire, etc.) but their stored code
    // is still around. The right thing to do is silently mint a fresh
    // JWT and reload projects — same UX as if they'd never left.
    //
    // If the stored code turns out to be invalid (e.g. revoked while
    // they were away), wipe local state so the next "Access" click
    // reopens the modal instead of looping forever on a dead code.
    try {
      await userStore.login(storedCode)
      await projectsStore.loadFromAPI()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        userStore.clearAll()
      }
      // Non-401 (network / cold start / timeout) — keep storedCode so
      // the next page load can try again. Surface nothing yet; the
      // user hasn't taken an action that warrants an error toast.
    }
  }
})
</script>

<template>
  <div class="min-h-screen bg-white text-gray-900">
    <RouterView />
    <!-- Single global toast renderer; any view can fire via useToastStore().show() -->
    <ToastHost />
  </div>
</template>
