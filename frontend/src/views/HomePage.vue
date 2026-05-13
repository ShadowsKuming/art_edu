<script setup lang="ts">
/**
 * ArtBloom marketing homepage.
 * One scrollable page with three anchored sections (#home, #tutorial, #contact)
 * navigated via the sticky <SiteHeader />.
 */
import SiteHeader from '@/components/home/SiteHeader.vue'
import HeroSection from '@/components/home/HeroSection.vue'
import TutorialSection from '@/components/home/TutorialSection.vue'
import ContactSection from '@/components/home/ContactSection.vue'
</script>

<template>
  <div class="home-page">
    <SiteHeader />

    <main class="home-page__main">
      <HeroSection />
      <TutorialSection />
      <ContactSection />
    </main>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  background: var(--color-bg);
  display: flex;
  flex-direction: column;
}

.home-page__main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
