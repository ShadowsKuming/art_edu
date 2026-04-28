<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useNavigationStore } from '@/stores/navigation'

defineProps<{
  canStartTeaching?: boolean
}>()

const router = useRouter()
const nav = useNavigationStore()

function goBack() {
  nav.canAccessDashboard = true
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
        <button class="btn-outline" @click="goBack">Back</button>
        <button class="btn-outline">Save Draft</button>
        <button class="btn-outline">Preview Lesson</button>
        <button
          class="btn-filled"
          :class="canStartTeaching ? 'btn-filled--active' : 'btn-filled--disabled'"
          :disabled="!canStartTeaching"
        >
          Start Teaching
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
