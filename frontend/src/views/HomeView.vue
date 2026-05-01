<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toggleLocale } from '@/i18n'

const router = useRouter()
const { t, locale } = useI18n()
</script>

<template>
  <main class="home">
    <button class="lang-btn" @click="toggleLocale">{{ locale === 'en' ? '中文' : 'EN' }}</button>
    <img src="/LOGO.png" alt="ArtBloom" class="home-logo" />
    <h1 class="home-title">{{ t('home.welcome') }}</h1>
    <p class="home-desc">{{ t('home.desc') }}</p>
    <button class="home-btn" @click="router.push('/dashboard')">{{ t('home.getStarted') }}</button>
  </main>
</template>

<style scoped>
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  background: #F3F4F4;
  position: relative;
}

.lang-btn {
  position: absolute;
  top: 20px;
  right: 24px;
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1.5px solid #d1d5db;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  color: #374151;
}
.lang-btn:hover { border-color: #7FEC8F; background: #f0fdf4; }

.home-logo { height: 64px; width: auto; }

.home-title {
  font-size: 32px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.home-desc {
  font-size: 16px;
  color: #6b7280;
  margin: 0;
}

.home-btn {
  height: 48px;
  padding: 0 32px;
  background: #7FEC8F;
  color: #000;
  border: none;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 2px 3px 6px rgba(0,0,0,0.12);
}

.home-btn:hover { transform: translateY(-1px) scale(1.02); }
</style>
