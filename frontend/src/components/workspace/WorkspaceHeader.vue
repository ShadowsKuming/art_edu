<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSlideStore } from '@/stores/slides'
import { usePart5Store } from '@/stores/part5'
import { useProjectsStore } from '@/stores/projects'
import { useI18n } from 'vue-i18n'
import { toggleLocale } from '@/i18n'

defineProps<{
  canStartTeaching?: boolean
}>()

const router = useRouter()
const slideStore = useSlideStore()
const part5Store = usePart5Store()
const projectsStore = useProjectsStore()
const { t, locale } = useI18n()

function goBack() {
  projectsStore.saveCurrentProject(
    slideStore.getSnapshot(),
    part5Store.videoDataUrl ?? undefined,
    part5Store.videoName || undefined,
  )
  router.push('/dashboard')
}
</script>

<template>
  <header class="header">
    <div class="header-inner">
      <div class="header-logo">
        <img src="/LOGO.png" alt="ArtBloom" class="logo" />
      </div>

      <div class="header-actions">
        <button class="btn-lang" @click="toggleLocale">{{ locale === 'en' ? '中文' : 'EN' }}</button>
        <button class="btn-outline" @click="goBack">{{ t('nav.back') }}</button>
        <button class="btn-outline">{{ t('nav.previewLesson') }}</button>
        <button
          class="btn-filled"
          :class="canStartTeaching ? 'btn-filled--active' : 'btn-filled--disabled'"
          :disabled="!canStartTeaching"
        >
          {{ t('nav.startTeaching') }}
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.header-inner {
  max-width: 1700px;
  margin: 0 auto;
  padding: clamp(8px, 0.52vw, 10px) clamp(20px, 1.5px + 2.43vw, 48px);
  display: flex;
  align-items: center;
}

.logo {
  height: clamp(32px, 16px + 2.08vw, 56px);
  width: auto;
}

.header-actions {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: clamp(8px, -20px + 3.65vw, 50px);
}

.btn-lang {
  padding: clamp(3px, 0.16vw, 4px) clamp(8px, -1.5px + 1.04vw, 14px);
  border-radius: 999px;
  border: 1.5px solid #d1d5db;
  background: #fff;
  font-size: clamp(11px, 10px + 0.1vw, 13px);
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  color: #374151;
}
.btn-lang:hover { border-color: #7FEC8F; background: #f0fdf4; }

.btn-outline,
.btn-filled {
  padding: clamp(3px, 0.16vw, 4px) clamp(8px, -1.5px + 1.04vw, 16px);
  border-radius: 999px;
  font-size: clamp(12px, 10px + 0.17vw, 14px);
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
}

.btn-outline {
  background: #fff;
  border: 1px solid #111827;
  color: #111827;
}

.btn-outline:hover {
  background: #B2F4BC;
  border-color: transparent;
}

.btn-filled {
  border: none;
  color: #fff;
}

.btn-filled--active {
  background: #22c55e;
  cursor: pointer;
}

.btn-filled--active:hover {
  background: #16a34a;
}

.btn-filled--disabled {
  background: #d9d9d9;
  cursor: not-allowed;
}
</style>
