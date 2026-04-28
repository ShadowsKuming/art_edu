<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useNavigationStore } from '@/stores/navigation'

const router = useRouter()
const nav = useNavigationStore()

function goToDashboard() {
  nav.enterDashboard()
  router.push('/dashboard')
}
</script>

<template>
  <main class="flex flex-col items-center justify-center min-h-[60vh] gap-6">
    <h1 class="text-3xl font-bold text-gray-800">Welcome</h1>
    <p class="text-gray-500">Start by entering the dashboard.</p>
    <button
      class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
      @click="goToDashboard"
    >
      Enter Dashboard
    </button>
  </main>
</template>
