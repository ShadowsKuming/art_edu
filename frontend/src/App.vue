<script setup lang="ts">
import { RouterView } from 'vue-router'
<<<<<<< HEAD
import { watch, onMounted } from 'vue'
=======
import { watch, onMounted, onBeforeUnmount } from 'vue'
>>>>>>> 4f3588d510e5492d902272d617fa221771152d9d
import { useI18n } from 'vue-i18n'
import { useSlideStore } from '@/stores/slides'
import type { Locale } from '@/stores/slides'
import { useUserStore } from '@/stores/user'
import { useUserStateStore } from '@/stores/userState'
import { useProjectsStore } from '@/stores/projects'
import { useChatbotStore } from '@/stores/chatbot'
import { usePart3Store } from '@/stores/part3'
import { usePart5Store } from '@/stores/part5'
import { usePart6Store } from '@/stores/part6'
import { usePart7Store } from '@/stores/part7'
import ToastHost from '@/components/common/ToastHost.vue'
import { useUserStore } from '@/stores/user'
import { useProjectsStore } from '@/stores/projects'
import { apiGet, getToken, clearToken, ApiError } from '@/api/client'

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

<<<<<<< HEAD
const userStore = useUserStore()
const projectsStore = useProjectsStore()

onMounted(async () => {
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
        // Token is invalid — try to get a fresh one with the stored code
        clearToken()
        if (storedCode) {
          try { await userStore.login(storedCode); await projectsStore.loadFromAPI() } catch {}
        }
      }
      // Any other error (network, 503, cold start): keep token, use local data
    }
  } else if (storedCode) {
    // ── Recovery path: have invite code but no JWT ───────────────────
    // This happens when the API was down on first login (fallback mode
    // stored the code but not a JWT). Silently get a real JWT now.
    try {
      await userStore.login(storedCode)
      await projectsStore.loadFromAPI()
    } catch {
      // API still unreachable — keep using local data, that's fine
    }
  }
=======
// ────────────────────────────────────────────────────────────────
// Per-user state persistence (Cloudflare R2 user "database")
//
// 2026-05 — When the invite code changes (login, code switch),
// hydrate every Pinia store from the cached then-canonical state
// for that user. On every subsequent mutation across the workspace
// stores, schedule a debounced save back to R2 + localStorage
// cache. See `frontend/src/stores/userState.ts` for the full flow
// and `backend/main.py` section 10 for the server endpoints.
// ────────────────────────────────────────────────────────────────
const userStore = useUserStore()
const userStateStore = useUserStateStore()
const projectsStore = useProjectsStore()
const chatbotStore = useChatbotStore()
const part3Store = usePart3Store()
const part5Store = usePart5Store()
const part6Store = usePart6Store()
const part7Store = usePart7Store()

// Hydrate on login or invite-code change. `immediate: true` covers
// the case where the user already had a code in localStorage when
// the tab opened (typical refresh path).
watch(
  () => userStore.inviteCode,
  (code) => {
    void userStateStore.activateUser(code || null)
  },
  { immediate: true },
)

// Persist on any change. Each store is watched independently with
// `deep: true` so nested mutations (e.g. editing a single slide's
// element text) trigger a save. `scheduleSave` is debounced inside
// the userState store, so a burst of edits collapses to one PUT.
function watchStore(getter: () => unknown) {
  watch(
    getter,
    () => {
      if (userStateStore.currentCode) userStateStore.scheduleSave()
    },
    { deep: true },
  )
}

onMounted(() => {
  watchStore(() => projectsStore.projects)
  watchStore(() => projectsStore.activeProjectId)
  watchStore(() => chatbotStore.histories)
  watchStore(() => slideStore.slides)
  watchStore(() => slideStore.activePart)
  watchStore(() => slideStore.maxUnlockedPart)
  watchStore(() => slideStore.activeSlideId)
  watchStore(() => slideStore.globalBackground)
  watchStore(() => slideStore.globalBgColor)
  watchStore(() => part3Store.pairs)
  watchStore(() => part3Store.activePairId)
  watchStore(() => (part5Store as any).videoDataUrl)
  watchStore(() => (part5Store as any).videoName)
  watchStore(() => (part6Store as any).$state)
  watchStore(() => (part7Store as any).$state)
  watchStore(() => userStore.displayName)
  watchStore(() => userStore.bio)
  watchStore(() => userStore.avatarIndex)
})

// Best-effort flush on tab close. `beforeunload` runs synchronously
// and the fetch may be aborted, but the userState store also writes
// to localStorage cache *before* hitting the network, so even a
// half-committed save survives the next refresh.
function flushOnUnload() {
  void userStateStore.flushSave()
}
onMounted(() => {
  window.addEventListener('beforeunload', flushOnUnload)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', flushOnUnload)
>>>>>>> 4f3588d510e5492d902272d617fa221771152d9d
})
</script>

<template>
  <div class="min-h-screen bg-white text-gray-900">
    <RouterView />
    <!-- Single global toast renderer; any view can fire via useToastStore().show() -->
    <ToastHost />
  </div>
</template>
