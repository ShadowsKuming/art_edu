<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toggleLocale } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { useProjectsStore } from '@/stores/projects'
import logoUrl from '@/assets/images/logo.png'
import AccessModal from './AccessModal.vue'

type Anchor = 'home' | 'tutorial' | 'contact'

const router = useRouter()
const { t, locale } = useI18n()
const userStore = useUserStore()
const projectsStore = useProjectsStore()

const activeSection = ref<Anchor>('home')
const sectionIds: Anchor[] = ['home', 'tutorial', 'contact']

/** Controls the AccessModal visibility (v-model:open). */
const accessOpen = ref(false)


let observer: IntersectionObserver | null = null

onMounted(() => {
  // Highlight the nav link of whichever section is currently in view.
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting)
      if (visible.length === 0) return
      const top = visible.reduce((a, b) =>
        a.intersectionRatio > b.intersectionRatio ? a : b,
      )
      const id = top.target.id as Anchor
      if (sectionIds.includes(id)) activeSection.value = id
    },
    { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
  )
  sectionIds.forEach((id) => {
    const el = document.getElementById(id)
    if (el) observer?.observe(el)
  })
})

onUnmounted(() => {
  observer?.disconnect()
})

function goHome() {
  router.push('/')
}

function jumpTo(id: Anchor) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    activeSection.value = id
  }
}

/**
 * Triggered by the "Access / 进入" pill in the header.
 *
 * 2026-05 — Once a teacher has logged in on a device, their invite
 * code is persisted in `userStore.inviteCode` (localStorage backed,
 * see `frontend/src/stores/user.ts`). On every subsequent click of
 * the access pill we skip the modal and route straight to the
 * dashboard — matches the pilot spec "input invite code only on the
 * FIRST login per device". To force the modal back (e.g. for
 * device-switch testing), clear `localStorage['artbloom.user.inviteCode']`
 * or implement a proper logout that calls `userStore.signOut()`.
 */
function onAccess() {
  const existing = (userStore.inviteCode ?? '').trim()
  if (existing) {
    router.push('/dashboard')
    return
  }
  accessOpen.value = true
}

/**
 * Submit handler for the AccessModal.
 *
 * Calls the API login endpoint to authenticate the user and load their
 * projects. Falls back to local-only mode if the API is unavailable
 * (e.g. DATABASE_URL not configured on the server).
 */
async function onAccessSubmit(code: string) {
  try {
    await userStore.login(code || 'Guest')
    await projectsStore.loadFromAPI()
  } catch {
    // DB not available — fall back to local-only mode
    userStore.setUsername(code || 'Guest')
  }
  accessOpen.value = false
  router.push('/dashboard')
}
</script>

<template>
  <header class="site-header">
    <div class="site-header__inner">
      <button
        type="button"
        class="site-header__logo"
        :aria-label="t('home.nav.home')"
        @click="goHome"
      >
        <img :src="logoUrl" :alt="t('brand.name')" class="site-header__logo-img" />
      </button>

      <nav class="site-header__nav" :aria-label="t('home.nav.home')">
        <a
          v-for="id in sectionIds"
          :key="id"
          :href="`#${id}`"
          class="site-header__nav-link"
          :class="{ 'is-active': activeSection === id }"
          @click.prevent="jumpTo(id)"
        >
          {{ t(`home.nav.${id}`) }}
        </a>
      </nav>

      <div class="site-header__actions">
        <button class="site-header__lang" type="button" @click="toggleLocale">
          {{ locale === 'en' ? '中文' : 'EN' }}
        </button>
        <button class="site-header__access" type="button" @click="onAccess">
          {{ t('home.nav.access') }}
        </button>
      </div>
    </div>

    <!-- Invitation-code modal (renders nothing until opened). -->
    <AccessModal v-model:open="accessOpen" @submit="onAccessSubmit" />
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-bg);
  box-shadow: var(--shadow-header);
}

.site-header__inner {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-3) var(--gutter);
  display: flex;
  align-items: center;
  gap: var(--space-7);
  min-height: var(--header-height);
}

.site-header__logo {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  border-radius: var(--space-2);
  transition: transform 0.15s ease;
}

.site-header__logo:hover {
  transform: scale(1.02);
}

.site-header__logo-img {
  height: 56px;
  width: auto;
  object-fit: contain;
}

.site-header__nav {
  display: flex;
  align-items: center;
  gap: clamp(var(--space-6), 5vw, 88px);
  flex: 1;
  justify-content: center;
}

.site-header__nav-link {
  position: relative;
  font-size: var(--fs-nav);
  font-weight: 500;
  color: var(--color-text-muted);
  padding: var(--space-2) 0;
  transition: color 0.15s ease;
}

.site-header__nav-link:hover {
  color: var(--color-text);
}

.site-header__nav-link.is-active {
  font-weight: 600;
  color: var(--color-text);
}

.site-header__nav-link.is-active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  height: 4px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
}

.site-header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.site-header__lang {
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
}

.site-header__lang:hover {
  border-color: var(--color-primary);
  background: #f0fdf4;
}

.site-header__access {
  height: 46px;
  padding: 0 var(--space-5);
  border-radius: var(--radius-pill);
  border: 1.3px solid var(--color-text-muted);
  background: var(--color-bg);
  font-size: var(--fs-nav);
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.site-header__access:hover {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text);
}

@media (max-width: 720px) {
  .site-header__inner {
    gap: var(--space-4);
  }
  .site-header__nav {
    gap: var(--space-5);
  }
  .site-header__logo-img {
    height: 40px;
  }
  .site-header__access {
    height: 38px;
    padding: 0 var(--space-4);
  }
}
</style>
