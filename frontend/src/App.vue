<script setup lang="ts">
import { RouterView } from 'vue-router'
import { watch, onMounted, onBeforeUnmount } from 'vue'
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


// Keep the slide store's locale in sync with vue-i18n so the EN/中
// toggle in the workspace header swaps bilingual text on every slide
// element that was hydrated from an LKP. `immediate: true` ensures the
// initial value (from localStorage, see src/i18n/index.ts) is applied
// before any slides are rendered.
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
})
</script>

<template>
  <div class="min-h-screen bg-white text-gray-900">
    <RouterView />
    <!-- Single global toast renderer; any view can fire via useToastStore().show() -->
    <ToastHost />
  </div>
</template>
