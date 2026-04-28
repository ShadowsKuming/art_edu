<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useNavigationStore } from '@/stores/navigation'

const router = useRouter()
const nav = useNavigationStore()

function goToWorkspace() {
  nav.enterWorkspace()
  router.push('/workspace')
}
</script>

<template>
  <main class="flex flex-col items-center justify-center min-h-[60vh] gap-6">
    <h1 class="text-3xl font-bold text-gray-800">Dashboard</h1>
    <p class="text-gray-500">Manage your projects here.</p>
    <button
      class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
      @click="goToWorkspace"
    >
      Enter Workspace
    </button>
  </main>
</template>
