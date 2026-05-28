<script setup lang="ts">
import { RouterView } from 'vue-router'
import { watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSlideStore } from '@/stores/slides'
import type { Locale } from '@/stores/slides'
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
})
</script>

<template>
  <div class="min-h-screen bg-white text-gray-900">
    <RouterView />
    <!-- Single global toast renderer; any view can fire via useToastStore().show() -->
    <ToastHost />
  </div>
</template>

