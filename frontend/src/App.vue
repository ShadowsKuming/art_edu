<script setup lang="ts">
import { RouterView } from 'vue-router'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSlideStore } from '@/stores/slides'
import type { Locale } from '@/stores/slides'
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
</script>

<template>
  <div class="min-h-screen bg-white text-gray-900">
    <RouterView />
    <!-- Single global toast renderer; any view can fire via useToastStore().show() -->
    <ToastHost />
  </div>
</template>

